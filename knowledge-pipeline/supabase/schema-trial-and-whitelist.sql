-- ════════════════════════════════════════════════════════════════════════
-- CatMD — Trial state + Pro whitelist (2026-05-12)
-- ════════════════════════════════════════════════════════════════════════
--
-- Two related changes for the paid launch:
--
--   1. `user_trial_state` — per-user trial-start timestamp + a denormalised
--      "has the user ever started the trial" flag. The app's
--      `useEntitlement` hook reads this via the `start_or_get_trial()`
--      RPC: the first call to that RPC stamps `trial_started_at` to now()
--      and returns; subsequent calls return the existing row. 14 days
--      from that stamp = trial expiry. Pure server-side (Supabase) so
--      the user can't cheat by re-installing the app.
--
--   2. `pro_whitelist` — admin-only allowlist of email addresses that
--      get permanent Pro access. Used to reward influencers / press /
--      power testers without making them pay. Lookup is by email of the
--      currently-authed user (via the `is_current_user_whitelisted()`
--      RPC, which reads auth.jwt() ->> 'email'). Admin (you) inserts
--      rows directly via SQL — there's NO app-side write surface to
--      this table.
--
-- Both RPCs are `security definer` so they can read/write tables that
-- regular authenticated users have no direct access to. RLS keeps the
-- tables themselves invisible to clients; only the RPC outputs leak
-- through, and only for the calling user's own row.
--
-- Run order: AFTER `schema-cloud-backup-phase-b.sql` (which defined
-- `touch_updated_at` + the `cat_events.type` constraint base).
-- Idempotent: safe to re-run.
--
-- ════════════════════════════════════════════════════════════════════════


-- ─── 1. user_trial_state ──────────────────────────────────────────────────
-- One row per user. `trial_started_at` is stamped on first call to the
-- start_or_get_trial RPC. The denormalised `trial_ended` flag is a
-- computed shorthand (now() > trial_started_at + 14 days), set to
-- false initially and recomputed every read — kept here so SQL admins
-- can inspect state directly without recomputing.

create table if not exists public.user_trial_state (
    user_id          uuid primary key references auth.users(id) on delete cascade,
    trial_started_at timestamptz not null default now(),
    trial_length_days integer not null default 14,
    -- Useful audit field — when the row was first created (i.e. when
    -- the user effectively started their trial). Same as
    -- trial_started_at on first call; remains stable on re-reads.
    created_at       timestamptz not null default now(),
    updated_at       timestamptz default now()
);

create index if not exists user_trial_state_started_idx
    on public.user_trial_state (trial_started_at);

alter table public.user_trial_state enable row level security;

-- Users can read their own row (so the client can compute days
-- remaining locally without a round-trip on every check). They cannot
-- write — only the RPC (security definer) can.
drop policy if exists trial_state_select_own on public.user_trial_state;
create policy trial_state_select_own on public.user_trial_state
    for select to authenticated using (user_id = auth.uid());

drop trigger if exists trg_user_trial_state_touch on public.user_trial_state;
create trigger trg_user_trial_state_touch
    before update on public.user_trial_state
    for each row execute function public.touch_updated_at();


-- ─── 2. pro_whitelist ─────────────────────────────────────────────────────
-- Owner-controlled allowlist. NOT user-readable. Only the
-- `is_current_user_whitelisted()` RPC reads it, and it only ever
-- returns a single boolean for the calling user — no scraping the
-- list possible from a client.

create table if not exists public.pro_whitelist (
    -- Lowercased, trimmed email. Use the same normalisation client-side
    -- when matching. Primary key prevents duplicates.
    email          text primary key check (email = lower(trim(email))),
    granted_at     timestamptz not null default now(),
    -- Free-text note for your records ("Reddit r/CatAdvice helper",
    -- "Bella @meow_kingdom IG", "beta tester batch 3"). Helps you
    -- audit who's on the list later.
    granted_reason text,
    -- Nullable = forever. Set to a future timestamp for time-limited
    -- access (e.g. 3-month creator campaign). The whitelist RPC
    -- treats expired rows as "not whitelisted".
    expires_at     timestamptz,
    -- Admin who granted it. NULL when you set it via direct SQL (no
    -- auth context). Useful if you ever build a multi-admin tool.
    granted_by     uuid references auth.users(id)
);

create index if not exists pro_whitelist_expires_idx
    on public.pro_whitelist (expires_at)
    where expires_at is not null;

alter table public.pro_whitelist enable row level security;

-- NO policies = NO authenticated user can read or write the table
-- directly. Only the security-definer RPCs below + your direct
-- service-role SQL access can touch it. This is deliberate.


-- ─── 3. RPCs ──────────────────────────────────────────────────────────────

-- start_or_get_trial:
--   On first call, inserts a row with trial_started_at=now() and returns
--   { trial_started_at, trial_ends_at, in_trial: true, days_remaining: 14 }.
--   On subsequent calls, returns the existing row's computed state.
--   Anonymous-but-authed users (Supabase anon session) get a trial too —
--   their anonymous user_id is the key. When they later add an email,
--   the trial stays attached to the same user_id (no carry-over loss).

create or replace function public.start_or_get_trial()
returns table (
    trial_started_at timestamptz,
    trial_ends_at    timestamptz,
    in_trial         boolean,
    days_remaining   integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_started timestamptz;
    v_length  integer;
    v_ends    timestamptz;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'not_authenticated';
    end if;

    -- Insert if absent, return existing row's started_at otherwise.
    insert into public.user_trial_state (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    select uts.trial_started_at, uts.trial_length_days
    into v_started, v_length
    from public.user_trial_state uts
    where uts.user_id = v_user_id;

    v_ends := v_started + make_interval(days => v_length);

    return query select
        v_started,
        v_ends,
        (now() < v_ends),
        greatest(0, extract(day from v_ends - now())::integer);
end;
$$;

revoke all on function public.start_or_get_trial() from public;
grant execute on function public.start_or_get_trial() to authenticated;


-- is_current_user_whitelisted:
--   Returns true when the calling user's email (from their JWT) appears
--   in pro_whitelist with a non-expired entry. False otherwise. Anonymous
--   users (no email) always get false.
create or replace function public.is_current_user_whitelisted()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.pro_whitelist w
        where w.email = lower((auth.jwt() ->> 'email'))
          and (w.expires_at is null or w.expires_at > now())
    );
$$;

revoke all on function public.is_current_user_whitelisted() from public;
grant execute on function public.is_current_user_whitelisted() to authenticated;


-- ─── 4. Admin helper views (for your SQL workbench) ───────────────────────
-- Convenience: `select * from admin_whitelist_audit` shows the current
-- list with computed status. Read-only to service_role (you).

create or replace view public.admin_whitelist_audit as
select
    email,
    granted_reason,
    granted_at,
    expires_at,
    case
        when expires_at is null then 'forever'
        when expires_at > now() then 'active until ' || to_char(expires_at, 'YYYY-MM-DD')
        else 'EXPIRED on ' || to_char(expires_at, 'YYYY-MM-DD')
    end as status
from public.pro_whitelist
order by granted_at desc;


-- ─── 5. Trial-state audit view ─────────────────────────────────────────────
-- For your monitoring: see who's in trial vs expired, ordered by recency.

create or replace view public.admin_trial_audit as
select
    user_id,
    trial_started_at,
    trial_started_at + make_interval(days => trial_length_days) as trial_ends_at,
    case
        when now() < trial_started_at + make_interval(days => trial_length_days) then 'IN TRIAL'
        else 'EXPIRED'
    end as status,
    greatest(0, extract(day from
        trial_started_at + make_interval(days => trial_length_days) - now()
    )::integer) as days_remaining
from public.user_trial_state
order by trial_started_at desc;


-- ─── 6. Admin operations — examples ────────────────────────────────────────
-- Run these manually via the Supabase SQL editor (service_role context).

-- Add an influencer to the whitelist:
--     insert into pro_whitelist (email, granted_reason)
--     values ('amy@catinfluencer.com', 'IG 50k @cat_correspondent');
--
-- Time-limited grant (3-month creator campaign):
--     insert into pro_whitelist (email, granted_reason, expires_at)
--     values ('test@example.com', 'creator-campaign-may26',
--             now() + interval '3 months');
--
-- Remove from whitelist:
--     delete from pro_whitelist where email = 'amy@catinfluencer.com';
--
-- See who's on the list:
--     select * from admin_whitelist_audit;
--
-- See trial state for everyone (or a specific user):
--     select * from admin_trial_audit;
--     select * from admin_trial_audit where user_id = '<uuid>';
--
-- Reset a user's trial (rare — testing):
--     delete from user_trial_state where user_id = '<uuid>';
--
-- End of migration. After running:
--   1. Verify: \d+ public.user_trial_state and \d+ public.pro_whitelist
--   2. Test: call start_or_get_trial() from authenticated context
--   3. Test: call is_current_user_whitelisted() (returns false for normal users)
