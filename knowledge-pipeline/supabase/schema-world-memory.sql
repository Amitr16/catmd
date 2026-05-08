-- ════════════════════════════════════════════════════════════════════════
-- CatMD — World Memory schema (objects, places, toys, environment)
-- ════════════════════════════════════════════════════════════════════════
--
-- New table: `cat_world` — per-cat registry of REAL objects, places,
-- toys, furniture, and environmental context the cat knows about.
-- Different shape from `subject_directory` (which is named people/pets
-- driven by photo tagging).
--
-- Provenance (see `source_type` column):
--   - 'auto_detected'  — vision pass on uploaded photos / video frames
--                        promoted a candidate after recurrence threshold
--                        (≥ 2 sightings within 30 days). Default path
--                        post-2026-05-05 pivot.
--   - 'chat_extracted' — user mentioned the item in chat; the
--                        [LOG_OBJECT] marker fired (high-confidence
--                        explicit input).
--   - 'user_added'     — legacy: pre-pivot user typed it into a form
--                        on /world. The form is gone; existing rows
--                        round-trip.
--
-- Drives the cat's voice grounding: chat replies, diary entries, and
-- pinned-facts retrieval all reference REAL items from this table
-- instead of inventing plausible-sounding objects.
--
-- Run order: AFTER `schema-users.sql`. Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.cat_world (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    cat_id text not null references public.cats(id) on delete cascade,
    name text not null,
    -- Kind discriminator. Free-form text with a CHECK so the client
    -- can't push invalid kinds. Keep extensible — adding a new kind
    -- requires a follow-up migration.
    kind text not null check (kind in (
        'object','furniture','toy','place','environment'
    )),
    -- Optional descriptive fields. All nullable so the input UI can
    -- start with just (name, kind) and let the user add detail later.
    description text,
    color text,
    location text,
    sentiment text check (sentiment in (
        'loves','likes','curious','tolerates','dislikes','fears'
    ) or sentiment is null),
    acquired_at date,
    -- Provenance + evidence (added 2026-05-05 alongside the silent
    -- vision-derived entry path). Optional / nullable so legacy rows
    -- (pre-pivot user-typed entries) round-trip cleanly. The check
    -- constraint enumerates the three valid sources and tolerates
    -- nulls for legacy data.
    --
    -- The constraint is EXPLICITLY NAMED so the migration block below
    -- can detect it by name across both fresh installs (constraint
    -- created here) and pre-pivot installs (column added by the
    -- migration, constraint then attached by name). Without the
    -- explicit name we'd be relying on Postgres' auto-naming
    -- convention (`<table>_<column>_check`), which works today but is
    -- not contractual across versions.
    source_type text constraint cat_world_source_type_check check (
        source_type in ('auto_detected','chat_extracted','user_added')
        or source_type is null
    ),
    evidence_count integer,
    last_referenced_at timestamptz,
    reference_count integer not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ─── Forward migration for installs that ran the pre-pivot schema ─────────
-- Adds the new columns to existing tables idempotently. Postgres
-- `add column if not exists` keeps this safe to re-run forever.
alter table public.cat_world
    add column if not exists source_type text;
alter table public.cat_world
    add column if not exists evidence_count integer;

-- Re-apply the source_type check; `do $$ begin … exception when … end $$`
-- pattern lets us add the constraint only once without erroring on
-- re-runs (constraint adds aren't idempotent natively).
do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'cat_world_source_type_check'
    ) then
        alter table public.cat_world
            add constraint cat_world_source_type_check
            check (source_type in (
                'auto_detected','chat_extracted','user_added'
            ) or source_type is null);
    end if;
end $$;

create index if not exists cat_world_user_idx
    on public.cat_world (user_id);
create index if not exists cat_world_cat_idx
    on public.cat_world (cat_id);
create index if not exists cat_world_kind_idx
    on public.cat_world (kind);

alter table public.cat_world enable row level security;

drop policy if exists world_select_own on public.cat_world;
drop policy if exists world_insert_own on public.cat_world;
drop policy if exists world_update_own on public.cat_world;
drop policy if exists world_delete_own on public.cat_world;

create policy world_select_own on public.cat_world
    for select to authenticated using (user_id = auth.uid());
create policy world_insert_own on public.cat_world
    for insert to authenticated with check (user_id = auth.uid());
create policy world_update_own on public.cat_world
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
create policy world_delete_own on public.cat_world
    for delete to authenticated using (user_id = auth.uid());

drop trigger if exists trg_cat_world_touch on public.cat_world;
create trigger trg_cat_world_touch
    before update on public.cat_world
    for each row execute function public.touch_updated_at();

-- ─── Update forget_me to wipe cat_world too ───────────────────────────────

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
    delete from public.cat_world where user_id = auth.uid();
    delete from public.cat_events where user_id = auth.uid();
    delete from public.cats where user_id = auth.uid();
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- Run AFTER schema-cloud-backup-phase-b.sql. Idempotent.
--
-- Test (post-pivot — entries land via vision extraction, not a form):
--   1. Add a photo from the Bond tab. Background vision pass extracts
--      objects/place/environment into the local candidate pool.
--   2. Add a SECOND photo containing the same object (e.g. same chair).
--      Recurrence threshold = 2 sightings within 30 days → graduates
--      to a visible WorldEntry → cloud sync upserts it here.
--   3. Verify it lands:
--        select id, name, kind, source_type, evidence_count
--        from cat_world where user_id = auth.uid();
--      Auto-detected entries should show source_type='auto_detected'
--      and evidence_count >= 2.
--   4. Mention an item explicitly in chat ("Lily loves the kettle"):
--      the LOG_OBJECT marker fires → entry lands with
--      source_type='chat_extracted' and no evidence_count.
--   5. Confirm RLS by trying to select from another user's session
--      (should return zero rows).
--   6. Re-run this file end-to-end to verify idempotency — the column
--      adds are no-ops and the DO block skips the constraint add.
-- ════════════════════════════════════════════════════════════════════════
