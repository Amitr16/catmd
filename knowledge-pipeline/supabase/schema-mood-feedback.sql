-- CatMD Mood Feedback schema (added 2026-05-13).
--
-- Per-(user, cat, mood) counters that drive the adaptive layer of the
-- daily-mood lottery. The daily mood picker reads these to compute
-- userFeedbackMod — once a mood has ≥5 exposures, the user's share
-- rate on that mood adjusts its future probability. See
-- src/services/moodWeights.ts (`computeFeedbackMod`).
--
-- Why this needs cloud persistence: a user who runs CatMD for two
-- weeks and then reinstalls / changes phones should NOT lose their
-- cat's learned mood preferences. The local AsyncStorage layer is the
-- fast-path cache; this table is the source of truth across devices.
--
-- Pattern matches schema-becoming.sql / schema-users.sql:
--   - text mood_id (controlled enum on the client; left text here for
--     forward compatibility with new mood additions)
--   - user_id uuid + cat_id text (FK to public.cats, cascade on cat
--     delete via existing chain)
--   - composite primary key (user, cat, mood) — one row per triple
--   - RLS keyed to auth.uid()
--
-- Safe to re-run (idempotent).

create table if not exists public.mood_feedback (
    user_id uuid not null references auth.users(id) on delete cascade,
    cat_id text not null references public.cats(id) on delete cascade,
    mood_id text not null,

    -- Days this mood was active for the cat (one bump per day per
    -- mood per cat — the store de-dupes at write time via the
    -- exposureKeys list).
    exposure_count int not null default 0,

    -- Times the user shared a card / postcard while this mood was
    -- active. NOT idempotent — every share is signal.
    share_count int not null default 0,

    -- Chat sessions opened while this mood was active (one per day,
    -- de-duped client-side).
    chat_session_count int not null default 0,

    updated_at timestamptz not null default now(),

    primary key (user_id, cat_id, mood_id)
);

create index if not exists mood_feedback_user_idx
    on public.mood_feedback (user_id, updated_at desc);
create index if not exists mood_feedback_cat_idx
    on public.mood_feedback (cat_id);

alter table public.mood_feedback enable row level security;

drop policy if exists mood_feedback_select_own on public.mood_feedback;
create policy mood_feedback_select_own on public.mood_feedback
    for select to authenticated using (user_id = auth.uid());
drop policy if exists mood_feedback_insert_own on public.mood_feedback;
create policy mood_feedback_insert_own on public.mood_feedback
    for insert to authenticated with check (user_id = auth.uid());
drop policy if exists mood_feedback_update_own on public.mood_feedback;
create policy mood_feedback_update_own on public.mood_feedback
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
drop policy if exists mood_feedback_delete_own on public.mood_feedback;
create policy mood_feedback_delete_own on public.mood_feedback
    for delete to authenticated using (user_id = auth.uid());


-- ─── Touch updated_at on UPDATE ──────────────────────────────────────────
-- Reuses public.touch_updated_at() from schema-users.sql.
drop trigger if exists mood_feedback_touch_updated_at on public.mood_feedback;
create trigger mood_feedback_touch_updated_at
    before update on public.mood_feedback
    for each row execute function public.touch_updated_at();


-- ─── Extend forget_me() to wipe mood_feedback too ────────────────────────
-- Replace the function with the same body PLUS a delete on
-- mood_feedback. The cats delete already cascades to mood_feedback
-- via the cat_id FK, but `forget_me` is a USER-level wipe and the
-- belt-and-braces explicit delete matches the pattern used for the
-- other tables in schema-becoming.sql.
create or replace function public.forget_me()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;
    delete from public.subject_directory where user_id = auth.uid();
    delete from public.self_facts where user_id = auth.uid();
    delete from public.becoming_state where user_id = auth.uid();
    delete from public.mood_feedback where user_id = auth.uid();
    delete from public.cat_events where user_id = auth.uid();
    delete from public.cats where user_id = auth.uid();
    -- Deliberately not deleting from public.scan_usage — quota
    -- preservation, see schema-users.sql for the rationale.
end;
$$;
