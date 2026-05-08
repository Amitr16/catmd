-- CatMD user-data schema (cats + cat_events) with RLS keyed to auth.uid().
-- Run once on the same Supabase project that holds knowledge_cards.
-- Safe to re-run (idempotent).

-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ─── cats ─────────────────────────────────────────────────────────────────
-- id is `text`, not `uuid`. The client is offline-first and generates its
-- own IDs (e.g. `cat_mob3tmqv_iun8`) so that inserts can happen while
-- offline and later upsert cleanly. Server-side default still produces a
-- uuid-shaped string for rows created directly in the DB.
create table if not exists public.cats (
    id text primary key default gen_random_uuid()::text,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    breed text,
    -- Date of birth (YYYY-MM-DD). Client treats dob_iso as authoritative
    -- when present; age_months is derived and kept for back-compat.
    dob_iso date,
    age_months int,
    weight_kg real,
    sex text check (sex in ('male','female','unknown')),
    spayed_neutered boolean,
    indoor_outdoor text check (indoor_outdoor in ('indoor','outdoor','both')) default 'indoor',
    conditions text[] default '{}',
    medications text[] default '{}',
    -- Free-form owner notes surfaced to the triage prompt.
    notes text,
    photo_url text,
    -- Emergency vet contact — powers the one-tap dial from the urgent
    -- action bar on /result. Kept per-cat because multi-cat households
    -- sometimes use different clinics.
    emergency_vet_name text,
    emergency_vet_phone text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Idempotent add-column for existing deployments that predate these
-- fields. Safe to re-run.
alter table public.cats add column if not exists dob_iso date;
alter table public.cats add column if not exists notes text;
alter table public.cats add column if not exists emergency_vet_name text;
alter table public.cats add column if not exists emergency_vet_phone text;

create index if not exists cats_user_id_idx on public.cats (user_id);

-- ─── cat_events (scans, chat turns, vet-record imports, etc.) ─────────────
-- id + cat_id are `text` for the same reason cats.id is — see comment above.
create table if not exists public.cat_events (
    id text primary key default gen_random_uuid()::text,
    user_id uuid not null references auth.users(id) on delete cascade,
    cat_id text references public.cats(id) on delete cascade,
    type text not null check (type in (
        'scan','chat','vet_record','symptom','litter_box',
        'weight','feeding','medication',
        -- Wave A longitudinal health tracking
        'vaccination','medication_dose','appointment','symptom_photo',
        'water_intake','litter_box_use',
        -- Wave C cat-specific trackers
        'srr_measurement','pain_score','outcome_check'
    )),
    ts timestamptz default now(),
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz default now()
);

create index if not exists cat_events_cat_ts_idx
    on public.cat_events (cat_id, ts desc);
create index if not exists cat_events_user_ts_idx
    on public.cat_events (user_id, ts desc);
create index if not exists cat_events_type_idx
    on public.cat_events (type);

-- ─── updated_at trigger ───────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end
$$;

drop trigger if exists trg_cats_touch on public.cats;
create trigger trg_cats_touch
    before update on public.cats
    for each row execute function public.touch_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────
alter table public.cats enable row level security;
alter table public.cat_events enable row level security;

-- Cats: users can CRUD only their own rows. Anonymous users have a valid
-- auth.uid() — RLS still works; they can only see their own cats.
drop policy if exists cats_select_own on public.cats;
drop policy if exists cats_insert_own on public.cats;
drop policy if exists cats_update_own on public.cats;
drop policy if exists cats_delete_own on public.cats;

create policy cats_select_own on public.cats
    for select to authenticated using (user_id = auth.uid());
create policy cats_insert_own on public.cats
    for insert to authenticated with check (user_id = auth.uid());
create policy cats_update_own on public.cats
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
create policy cats_delete_own on public.cats
    for delete to authenticated using (user_id = auth.uid());

drop policy if exists events_select_own on public.cat_events;
drop policy if exists events_insert_own on public.cat_events;
drop policy if exists events_update_own on public.cat_events;
drop policy if exists events_delete_own on public.cat_events;

create policy events_select_own on public.cat_events
    for select to authenticated using (user_id = auth.uid());
create policy events_insert_own on public.cat_events
    for insert to authenticated with check (user_id = auth.uid());
create policy events_update_own on public.cat_events
    for update to authenticated using (user_id = auth.uid())
    with check (user_id = auth.uid());
create policy events_delete_own on public.cat_events
    for delete to authenticated using (user_id = auth.uid());

-- ─── Scan usage (quota) ───────────────────────────────────────────────────
-- Tracks how many triage scans a user has run in the current calendar month.
-- Intentionally SEPARATE from cat_events so that `forget_me` (user-data
-- wipe) does NOT reset the quota — otherwise a user could reset their
-- free-tier pool by tapping "Forget everything". This table lives in the
-- "billing/metering" concept even though there's no money involved.
create table if not exists public.scan_usage (
    user_id uuid primary key references auth.users(id) on delete cascade,
    month_key text not null,            -- "YYYY-MM" in UTC
    scan_count int not null default 0,
    updated_at timestamptz not null default now()
);

alter table public.scan_usage enable row level security;

-- Clients can read their own usage (to show "X of 3 left" in the UI) but
-- MUST NOT write directly — the RPCs below are the only way to increment.
drop policy if exists scan_usage_select_own on public.scan_usage;
create policy scan_usage_select_own on public.scan_usage
    for select to authenticated using (user_id = auth.uid());

-- Atomically bump the scan count for the current UTC month and return the
-- new count. Callers should treat the returned value as authoritative —
-- never trust client-side counting.
create or replace function public.increment_scan_usage()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
    v_count int;
begin
    if v_user is null then
        raise exception 'not authenticated';
    end if;

    insert into public.scan_usage (user_id, month_key, scan_count)
    values (v_user, v_month, 1)
    on conflict (user_id) do update
      set scan_count = case
            when public.scan_usage.month_key = v_month
              then public.scan_usage.scan_count + 1
            else 1
          end,
          month_key = v_month,
          updated_at = now()
    returning scan_count into v_count;

    return v_count;
end;
$$;

revoke all on function public.increment_scan_usage() from public;
grant execute on function public.increment_scan_usage() to authenticated;

-- Read the current month's count for the calling user. Returns 0 when
-- the user has never scanned or the stored month has rolled over.
create or replace function public.get_scan_usage()
returns int
language sql
security definer
set search_path = public
as $$
    select coalesce((
        select case
            when month_key = to_char(now() at time zone 'utc', 'YYYY-MM') then scan_count
            else 0
        end
        from public.scan_usage
        where user_id = auth.uid()
    ), 0);
$$;

revoke all on function public.get_scan_usage() from public;
grant execute on function public.get_scan_usage() to authenticated;

-- ─── Helper: hard-delete the current user's data (GDPR button) ────────────
-- Invoked by the client as `supabase.rpc('forget_me')`.
-- Deletes all the user's cats + events (ON DELETE CASCADE handles
-- downstream rows). Does NOT delete the auth.users row itself — the client
-- follows up with supabase.auth.signOut() + account deletion via admin API
-- (handled in src/services/auth.ts::deleteAccount()).
--
-- IMPORTANT: this function intentionally does NOT delete from
-- public.scan_usage. Quota is a billing/metering concern and resetting it
-- via the "Forget everything" button would be a trivial loophole around
-- the free-tier pool. Any future table that represents billing state
-- (subscription status, usage metering, rate-limit counters) should be
-- excluded from this wipe for the same reason.
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
    delete from public.cat_events where user_id = auth.uid();
    delete from public.cats where user_id = auth.uid();
    -- Deliberately not deleting from public.scan_usage (see comment above).
end;
$$;

revoke all on function public.forget_me() from public;
grant execute on function public.forget_me() to authenticated;
