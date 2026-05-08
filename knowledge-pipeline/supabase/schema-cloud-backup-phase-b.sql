-- ════════════════════════════════════════════════════════════════════════
-- CatMD — Cloud Backup Phase B (full-data backup + cross-platform restore)
-- ════════════════════════════════════════════════════════════════════════
--
-- What this migration adds:
--   1. Extends `cat_events.type` CHECK constraint to allow Phase B types:
--      diary_entry, personality_quiz, postcard, cat_studio_poster,
--      weekly_reading, med_reminder, checkin_reminder.
--   2. **Bug fix**: adds `daily_checkin` and `behavior_observation` to
--      the CHECK list — they were defined in HealthEventType client-side
--      but missing from the constraint, causing silent push failures.
--   3. New table `notif_prefs` for per-USER (not per-cat) push prefs.
--   4. New table `med_reminders` for per-cat reminder configurations
--      (med_time / checkin_time / weekday).
--   5. Storage bucket `user-media` with per-user folder RLS for photos
--      and posters (Phase B3).
--
-- Run order: AFTER `schema-users.sql` and `schema-becoming.sql`.
-- Idempotent: safe to re-run.
--
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend cat_events.type CHECK ──────────────────────────────────────
-- Drop old constraint then re-add with the full union of types.

alter table public.cat_events
    drop constraint if exists cat_events_type_check;

alter table public.cat_events
    add constraint cat_events_type_check check (type in (
        -- Existing legacy types
        'scan','chat','vet_record','symptom','litter_box',
        'weight','feeding','medication',
        -- Wave A longitudinal health tracking
        'vaccination','medication_dose','appointment','symptom_photo',
        'water_intake','litter_box_use',
        -- Wave C cat-specific trackers
        'srr_measurement','pain_score','outcome_check',
        -- Bug fix (2026-05-06): these were in HealthEventType but missing
        -- from the constraint, silently failing to sync.
        'daily_checkin','behavior_observation',
        -- Phase B (2026-05-06): full-data backup
        'diary_entry','personality_quiz','postcard',
        'cat_studio_poster','weekly_reading'
    ));

-- ─── 2. Per-cat reminder configurations ───────────────────────────────────
-- Single row per (user_id, cat_id) holding the reminder times. Notif ids
-- are device-local — never round-tripped to cloud.

create table if not exists public.cat_reminders (
    user_id uuid not null references auth.users(id) on delete cascade,
    cat_id text not null references public.cats(id) on delete cascade,
    med_time text,             -- "HH:MM" local time, daily medication push
    checkin_time text,         -- "HH:MM" local time, weekly check-in push
    checkin_weekday integer,   -- 1-7 (1=Sunday, ISO-ish)
    updated_at timestamptz default now(),
    primary key (user_id, cat_id)
);

create index if not exists cat_reminders_user_idx
    on public.cat_reminders (user_id);

alter table public.cat_reminders enable row level security;

drop policy if exists reminders_select_own on public.cat_reminders;
drop policy if exists reminders_insert_own on public.cat_reminders;
drop policy if exists reminders_update_own on public.cat_reminders;
drop policy if exists reminders_delete_own on public.cat_reminders;

create policy reminders_select_own on public.cat_reminders
    for select to authenticated using (user_id = auth.uid());
create policy reminders_insert_own on public.cat_reminders
    for insert to authenticated with check (user_id = auth.uid());
create policy reminders_update_own on public.cat_reminders
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
create policy reminders_delete_own on public.cat_reminders
    for delete to authenticated using (user_id = auth.uid());

drop trigger if exists trg_reminders_touch on public.cat_reminders;
create trigger trg_reminders_touch
    before update on public.cat_reminders
    for each row execute function public.touch_updated_at();

-- ─── 3. Per-user notification preferences ─────────────────────────────────
-- Single row per user_id holding the push-category enabled flags. The
-- `enabled` JSONB mirrors notifPrefsStore.enabled — categories like
-- daily_checkin, medication, birthday, adoption_iversary, etc.
-- scheduled_ids stays device-local.

create table if not exists public.notif_prefs (
    user_id uuid primary key references auth.users(id) on delete cascade,
    enabled jsonb not null default '{}'::jsonb,
    updated_at timestamptz default now()
);

alter table public.notif_prefs enable row level security;

drop policy if exists notif_prefs_select_own on public.notif_prefs;
drop policy if exists notif_prefs_insert_own on public.notif_prefs;
drop policy if exists notif_prefs_update_own on public.notif_prefs;
drop policy if exists notif_prefs_delete_own on public.notif_prefs;

create policy notif_prefs_select_own on public.notif_prefs
    for select to authenticated using (user_id = auth.uid());
create policy notif_prefs_insert_own on public.notif_prefs
    for insert to authenticated with check (user_id = auth.uid());
create policy notif_prefs_update_own on public.notif_prefs
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
create policy notif_prefs_delete_own on public.notif_prefs
    for delete to authenticated using (user_id = auth.uid());

drop trigger if exists trg_notif_prefs_touch on public.notif_prefs;
create trigger trg_notif_prefs_touch
    before update on public.notif_prefs
    for each row execute function public.touch_updated_at();

-- ─── 4. Storage bucket for photos + posters (Phase B3) ────────────────────
-- Bucket: `user-media`
-- Folder layout: `<user_id>/<photo_id>.jpg` (or .png for posters)
-- RLS: users can only read/write within their own user_id folder.

insert into storage.buckets (id, name, public)
values ('user-media', 'user-media', false)
on conflict (id) do nothing;

drop policy if exists "user-media own folder select" on storage.objects;
drop policy if exists "user-media own folder insert" on storage.objects;
drop policy if exists "user-media own folder update" on storage.objects;
drop policy if exists "user-media own folder delete" on storage.objects;

create policy "user-media own folder select" on storage.objects
    for select to authenticated using (
        bucket_id = 'user-media'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "user-media own folder insert" on storage.objects
    for insert to authenticated with check (
        bucket_id = 'user-media'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "user-media own folder update" on storage.objects
    for update to authenticated using (
        bucket_id = 'user-media'
        and auth.uid()::text = (storage.foldername(name))[1]
    ) with check (
        bucket_id = 'user-media'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "user-media own folder delete" on storage.objects
    for delete to authenticated using (
        bucket_id = 'user-media'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

-- ─── 5. Update forget_me to include new tables ────────────────────────────
-- The forget_me RPC currently deletes from cats + cat_events. Extend it
-- so "delete everything about my cat" wipes the new tables too.

create or replace function public.forget_me()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.subject_directory where user_id = auth.uid();
    delete from public.self_facts where user_id = auth.uid();
    delete from public.becoming_state where user_id = auth.uid();
    delete from public.cat_reminders where user_id = auth.uid();
    delete from public.notif_prefs where user_id = auth.uid();
    delete from public.cat_events where user_id = auth.uid();
    delete from public.cats where user_id = auth.uid();
    -- Note: storage objects must be deleted via Storage API client-side
    -- or via a separate edge function — Postgres can't reach into the
    -- storage schema's RLS-bound delete path through this RPC.
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- End of Phase B migration. After running:
--   1. Verify with: select unnest(enum_range(null::text)) — actually run
--      `\d+ public.cat_events` to inspect the CHECK definition.
--   2. Test by pushing a `daily_checkin` event from the app (was failing
--      before, should succeed now).
--   3. Confirm `cat_reminders` and `notif_prefs` tables exist.
--   4. Test storage upload via Supabase dashboard:
--      Storage → user-media → Try Upload (should succeed for authenticated
--      user, blocked otherwise).
-- ════════════════════════════════════════════════════════════════════════
