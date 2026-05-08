-- CatMD knowledge base schema — run on a fresh Supabase project.
-- The pipeline uses the service-role key; the mobile app uses anon + RLS.
-- Re-run is safe (idempotent for tables, indexes, policies).

-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists vector;
create extension if not exists pg_trgm;       -- fuzzy topic search
create extension if not exists pgcrypto;      -- gen_random_uuid()

-- ─── knowledge_cards ──────────────────────────────────────────────────────
create table if not exists public.knowledge_cards (
    id             uuid primary key default gen_random_uuid(),
    topic          text not null unique,
    category       text not null,
    body           jsonb not null,
    sources        jsonb not null,
    embedding      vector(1536),
    emergency_tags text[] default '{}',
    confidence     float default 0.0,
    generated_at   timestamptz default now(),
    version        int default 1,
    created_at     timestamptz default now(),
    updated_at     timestamptz default now()
);

-- Trigger to bump updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end
$$;

drop trigger if exists trg_knowledge_cards_touch on public.knowledge_cards;
create trigger trg_knowledge_cards_touch
    before update on public.knowledge_cards
    for each row execute function public.touch_updated_at();

-- ─── Indexes ──────────────────────────────────────────────────────────────
-- IVFFlat index for cosine similarity (rule of thumb: lists = sqrt(rows))
create index if not exists knowledge_cards_embedding_ivfflat
    on public.knowledge_cards using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

create index if not exists knowledge_cards_category_idx
    on public.knowledge_cards (category);

create index if not exists knowledge_cards_confidence_idx
    on public.knowledge_cards (confidence desc);

create index if not exists knowledge_cards_emergency_tags_gin
    on public.knowledge_cards using gin (emergency_tags);

create index if not exists knowledge_cards_topic_trgm
    on public.knowledge_cards using gin (topic gin_trgm_ops);

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- Read-only for authenticated users. Service role bypasses RLS (pipeline use).
alter table public.knowledge_cards enable row level security;

drop policy if exists knowledge_cards_read_authenticated on public.knowledge_cards;
create policy knowledge_cards_read_authenticated
    on public.knowledge_cards
    for select
    to authenticated
    using (true);

-- Optional: read for anon users too (lets unauthenticated scan users hit RAG)
drop policy if exists knowledge_cards_read_anon on public.knowledge_cards;
create policy knowledge_cards_read_anon
    on public.knowledge_cards
    for select
    to anon
    using (true);

-- ─── Similarity search RPC ────────────────────────────────────────────────
-- Called from the app with a query embedding + optional filters.
create or replace function public.match_knowledge_cards(
    query_embedding vector(1536),
    match_count     int default 8,
    min_confidence  float default 0.7,
    category_filter text default null,
    emergency_only  boolean default false
)
returns table (
    id              uuid,
    topic           text,
    category        text,
    body            jsonb,
    sources         jsonb,
    emergency_tags  text[],
    confidence      float,
    similarity      float
)
language sql stable
as $$
    select
        c.id, c.topic, c.category, c.body, c.sources,
        c.emergency_tags, c.confidence,
        1 - (c.embedding <=> query_embedding) as similarity
    from public.knowledge_cards c
    where
        c.confidence >= min_confidence
        and (category_filter is null or c.category = category_filter)
        and (not emergency_only or array_length(c.emergency_tags, 1) > 0)
    order by c.embedding <=> query_embedding
    limit match_count;
$$;

-- ─── Quick sanity view ────────────────────────────────────────────────────
create or replace view public.knowledge_cards_summary as
select
    category,
    count(*) as card_count,
    avg(confidence)::numeric(3,2) as avg_confidence,
    sum(case when array_length(emergency_tags,1) > 0 then 1 else 0 end) as emergency_card_count
from public.knowledge_cards
group by category
order by card_count desc;
