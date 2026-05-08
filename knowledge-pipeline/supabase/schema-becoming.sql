-- CatMD Becoming + Subject Directory + Self-Facts schema (added 2026-05-04).
--
-- These three tables together hold the most personal slice of the
-- cat-in-the-app: the named people & pets in its life, the
-- "you love tuna" facts the user has told it, and the per-cat
-- "becoming" stage snapshot. None of them existed before the chat
-- persona shift to first-person; all three are highly personal and
-- deserve cloud backup so users don't lose their cat's identity on
-- reinstall / device change.
--
-- Pattern matches schema-users.sql:
--   - text id (client-generated, offline-first)
--   - user_id uuid + cat_id text (FK to public.cats, cascade on
--     cat-deletion via existing on-delete-cascade chain)
--   - RLS keyed to auth.uid()
--
-- Safe to re-run (idempotent).

-- ─── Subject Directory (named people & pets in a cat's photos) ────────────
create table if not exists public.subject_directory (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    cat_id text not null references public.cats(id) on delete cascade,

    name text not null,
    -- 'person' | 'pet' | 'other' — checked client-side; we keep it open
    -- here in case the taxonomy expands.
    kind text not null,
    species text,
    relationship text,

    -- Recent appearances kept as a JSON array; the directory store
    -- trims to 50 most-recent client-side, so the column grows
    -- bounded.
    appearances jsonb not null default '[]'::jsonb,
    total_appearances int not null default 1,
    first_seen text not null,
    last_seen text not null,

    -- Optional cached LLM-summarised "vibe" blurb.
    vibe text,
    vibe_updated_at timestamptz,

    -- ── Path 2 vision-grounded matching (added 2026-05-04) ──
    -- Rich ~10-attribute description (age band, hair colour, eyewear,
    -- build, distinguishing features, etc.) captured from the FIRST
    -- photo where the subject was tagged. Used by the tag sheet to
    -- recognise the same person on future captures without needing
    -- face-recognition ML. Shape matches PersonDescription for
    -- kind='person', PetDescription for kind='pet'. Null for legacy
    -- entries created before this column existed and for kind='other'.
    canonical_description jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Idempotent add for existing deployments — safe to re-run.
alter table public.subject_directory add column if not exists canonical_description jsonb;

create index if not exists subject_directory_cat_idx
    on public.subject_directory (cat_id, last_seen desc);
create index if not exists subject_directory_user_idx
    on public.subject_directory (user_id, updated_at desc);

alter table public.subject_directory enable row level security;

drop policy if exists subjects_select_own on public.subject_directory;
create policy subjects_select_own on public.subject_directory
    for select to authenticated using (user_id = auth.uid());
drop policy if exists subjects_insert_own on public.subject_directory;
create policy subjects_insert_own on public.subject_directory
    for insert to authenticated with check (user_id = auth.uid());
drop policy if exists subjects_update_own on public.subject_directory;
create policy subjects_update_own on public.subject_directory
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
drop policy if exists subjects_delete_own on public.subject_directory;
create policy subjects_delete_own on public.subject_directory
    for delete to authenticated using (user_id = auth.uid());


-- ─── Self-Facts (durable cat self-knowledge from chat + manual) ──────────
create table if not exists public.self_facts (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    cat_id text not null references public.cats(id) on delete cascade,

    -- The fact in first-person from the cat's POV. e.g.
    -- "I love tuna." / "I am afraid of the vacuum."
    fact text not null,

    -- 'food' | 'place' | 'fear' | 'love' | 'habit' | 'history' | 'preference' | 'other'
    category text not null,

    -- 'chat' | 'manual' | 'auto' — entrypoint. Drives the UI affordance
    -- (chat-extracted facts get a "learned from chat" badge).
    source text not null,

    confidence numeric not null default 1,
    source_turn_id text,
    assertion_count int not null default 1,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists self_facts_cat_idx
    on public.self_facts (cat_id, assertion_count desc, updated_at desc);
create index if not exists self_facts_user_idx
    on public.self_facts (user_id, updated_at desc);

alter table public.self_facts enable row level security;

drop policy if exists self_facts_select_own on public.self_facts;
create policy self_facts_select_own on public.self_facts
    for select to authenticated using (user_id = auth.uid());
drop policy if exists self_facts_insert_own on public.self_facts;
create policy self_facts_insert_own on public.self_facts
    for insert to authenticated with check (user_id = auth.uid());
drop policy if exists self_facts_update_own on public.self_facts;
create policy self_facts_update_own on public.self_facts
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
drop policy if exists self_facts_delete_own on public.self_facts;
create policy self_facts_delete_own on public.self_facts
    for delete to authenticated using (user_id = auth.uid());


-- ─── Becoming State (per-cat 7-facet stage snapshot) ─────────────────────
-- Single row per (user, cat). Holds the last-observed stage map +
-- the consumed-milestone keys so the diary doesn't re-fire the same
-- "you have crossed into known" hook twice across devices.
create table if not exists public.becoming_state (
    user_id uuid not null references auth.users(id) on delete cascade,
    cat_id text not null references public.cats(id) on delete cascade,

    -- {face: 'familiar', voice: 'glimpsed', ...} — keys are FacetId,
    -- values are Stage strings. Client validates shape.
    last_stages jsonb not null default '{}'::jsonb,

    -- Array of "facet:stage" strings that have already been
    -- acknowledged by the diary. e.g. ["face:familiar", "rhythm:known"].
    consumed_milestones jsonb not null default '[]'::jsonb,

    updated_at timestamptz not null default now(),
    primary key (user_id, cat_id)
);

create index if not exists becoming_state_user_idx
    on public.becoming_state (user_id);

alter table public.becoming_state enable row level security;

drop policy if exists becoming_state_select_own on public.becoming_state;
create policy becoming_state_select_own on public.becoming_state
    for select to authenticated using (user_id = auth.uid());
drop policy if exists becoming_state_insert_own on public.becoming_state;
create policy becoming_state_insert_own on public.becoming_state
    for insert to authenticated with check (user_id = auth.uid());
drop policy if exists becoming_state_update_own on public.becoming_state;
create policy becoming_state_update_own on public.becoming_state
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
drop policy if exists becoming_state_delete_own on public.becoming_state;
create policy becoming_state_delete_own on public.becoming_state
    for delete to authenticated using (user_id = auth.uid());


-- ─── Touch updated_at on UPDATE for the new tables ───────────────────────
-- Reuses the public.touch_updated_at() trigger function defined in
-- schema-users.sql.
drop trigger if exists subjects_touch_updated_at on public.subject_directory;
create trigger subjects_touch_updated_at
    before update on public.subject_directory
    for each row execute function public.touch_updated_at();

drop trigger if exists self_facts_touch_updated_at on public.self_facts;
create trigger self_facts_touch_updated_at
    before update on public.self_facts
    for each row execute function public.touch_updated_at();

drop trigger if exists becoming_state_touch_updated_at on public.becoming_state;
create trigger becoming_state_touch_updated_at
    before update on public.becoming_state
    for each row execute function public.touch_updated_at();


-- ─── Extend forget_me() to wipe the new tables too ────────────────────────
-- Replace the function with the same body PLUS deletes of the three
-- new tables. The cats/events deletes already cascade these rows on
-- cat removal, but `forget_me` is a USER-level wipe and these tables
-- are independent of any specific cat — we delete them explicitly.
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
    delete from public.cat_events where user_id = auth.uid();
    delete from public.cats where user_id = auth.uid();
    -- Deliberately not deleting from public.scan_usage — quota
    -- preservation, see schema-users.sql for the rationale.
end;
$$;
