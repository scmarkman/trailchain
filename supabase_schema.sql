-- TRAILCHAIN schema (public/anon)
-- Run in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.chains (
  id uuid primary key default gen_random_uuid(),
  seed bigint not null,
  daily_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains(id) on delete cascade,
  created_at timestamptz not null default now(),

  completed boolean not null default false,
  score integer not null default 0,
  sparks integer not null default 0,
  duration_ms integer not null default 0,
  mode text not null default 'classic',
  nickname text not null default 'Anon',

  -- list of cell ids (y*W+x)
  trail jsonb not null default '[]'::jsonb
);

create index if not exists segments_chain_created on public.segments(chain_id, created_at desc);
create index if not exists segments_chain_completed on public.segments(chain_id, completed);

alter table public.chains enable row level security;
alter table public.segments enable row level security;

create policy "public read chains"
on public.chains for select
using (true);

create policy "public insert chains"
on public.chains for insert
with check (true);

create policy "public read segments"
on public.segments for select
using (true);

create policy "public insert segments"
on public.segments for insert
with check (true);
