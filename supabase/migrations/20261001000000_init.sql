-- Claude Agent From Scratch - database schema
-- Run once: Supabase Dashboard -> SQL Editor -> paste -> Run   (or: supabase db push)
--
-- Security model
--   * Only the FastAPI backend talks to the database, using the SECRET key (server-side).
--   * Row Level Security is ON for every table and there are NO policies for anon/authenticated,
--     so the publishable/anon key (or anyone guessing your project URL) can read or write nothing.
--   * Visitor IPs are never stored - only a salted hash used for rate limiting.

create extension if not exists pgcrypto;

-- 1. Conversations: one row per chat session (memory container)
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  ip_hash     text not null,
  title       text,
  turn_count  integer not null default 0
);

-- 2. Messages: the raw Claude message history (user / assistant / tool results) = agent memory
create table if not exists public.messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  seq              integer not null,
  role             text not null check (role in ('user', 'assistant')),
  content          jsonb not null,
  created_at       timestamptz not null default now(),
  unique (conversation_id, seq)
);

-- 3. Turns: one row per question -> answer, with the step-by-step trace shown in the UI
create table if not exists public.turns (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  question         text not null,
  answer           text not null,
  trace            jsonb not null default '[]'::jsonb,
  cached           boolean not null default false,
  created_at       timestamptz not null default now()
);

-- 4. Notes saved by the save_note tool
create table if not exists public.notes (
  id               bigint generated always as identity primary key,
  conversation_id  uuid references public.conversations(id) on delete cascade,
  title            text not null check (char_length(title) <= 120),
  content          text not null check (char_length(content) <= 10000),
  created_at       timestamptz not null default now()
);

-- 5. Answer cache: identical first questions that used no time-sensitive tools
create table if not exists public.answer_cache (
  key         text primary key,
  question    text not null,
  answer      text not null,
  trace       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- 6. Usage log: tokens + estimated cost per request (drives the daily budget cap)
create table if not exists public.usage_log (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  conversation_id  uuid references public.conversations(id) on delete set null,
  ip_hash          text not null,
  model            text not null,
  input_tokens     integer not null default 0,
  output_tokens    integer not null default 0,
  web_searches     integer not null default 0,
  cost_usd         numeric(12, 6) not null default 0,
  cached           boolean not null default false,
  latency_ms       integer,
  stop_reason      text
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, seq);
create index if not exists turns_conversation_idx on public.turns (conversation_id, id);
create index if not exists usage_log_created_idx on public.usage_log (created_at);
create index if not exists answer_cache_created_idx on public.answer_cache (created_at);

-- Keep conversation counters in the database so the API never needs a read-modify-write
create or replace function public.on_turn_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set turn_count = turn_count + 1,
         updated_at = now(),
         title      = coalesce(title, left(new.question, 80))
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists turns_after_insert on public.turns;
create trigger turns_after_insert
  after insert on public.turns
  for each row execute function public.on_turn_inserted();

-- Today's totals (UTC) for the budget cap and the public stats badge
create or replace function public.usage_today()
returns table (requests bigint, cache_hits bigint, cost_usd numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::bigint,
         count(*) filter (where cached)::bigint,
         coalesce(sum(cost_usd), 0)
    from public.usage_log
   where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

-- Lock everything down: RLS on, no policies => no access for anon/authenticated roles.
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.turns         enable row level security;
alter table public.notes         enable row level security;
alter table public.answer_cache  enable row level security;
alter table public.usage_log     enable row level security;

revoke all on function public.usage_today()      from public, anon, authenticated;
revoke all on function public.on_turn_inserted() from public, anon, authenticated;
grant execute on function public.usage_today() to service_role;

-- Optional housekeeping (enable pg_cron in Dashboard -> Integrations first):
-- select cron.schedule('purge-old-chats', '17 3 * * *',
--   $$ delete from public.conversations where updated_at < now() - interval '30 days';
--      delete from public.answer_cache  where created_at < now() - interval '14 days';
--      delete from public.usage_log     where created_at < now() - interval '90 days'; $$);
