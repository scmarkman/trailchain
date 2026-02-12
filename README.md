# TRAILCHAIN (viral build)

A 20‑second Snake relay where **your final body becomes walls** for the next players in the same chain.

**Why it’s sticky/viral:**
- 20s rounds (zero commitment)
- combo scoring (you *always* think you can do better)
- daily chain streak (retention)
- one‑tap share + share image card (virality)

---

## Local dev

```bash
npm install
npm run dev
```

---

## Supabase setup (required for real chains)

### 1) Create tables + policies

In Supabase **SQL Editor**, run:

```sql
-- TRAILCHAIN schema (public/anon)
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

  -- list of cell ids (y*W+x). kept small (final body only)
  trail jsonb not null default '[]'::jsonb
);

create index if not exists segments_chain_created on public.segments(chain_id, created_at desc);
create index if not exists segments_chain_completed on public.segments(chain_id, completed);

-- RLS (required for anon key to read/write once enabled)
alter table public.chains enable row level security;
alter table public.segments enable row level security;

-- Allow SELECT + INSERT to the public anon key (no auth)
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
```

Supabase note: once RLS is enabled, the anon key can’t access rows unless you add policies. citeturn0search2

### 2) Set environment variables

Create a `.env.local`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# optional, for absolute share URLs (recommended in prod)
VITE_SITE_URL=https://YOURDOMAIN.com
```

---

## Vercel deploy

### 1) Import the GitHub repo into Vercel
Vercel will usually auto-detect **Vite** and set the right build settings. You can override Build Command / Output Directory in Project Settings if needed. citeturn0search1turn0search3

Recommended:
- Framework preset: **Vite**
- Install: `npm install`
- Build: `npm run build`
- Output: `dist`

### 2) Add environment variables (Project → Settings → Environment Variables)
Add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (your prod domain)

Deploy.

### 3) Node version
This project uses Vite 6, which supports Node 18/20/22+. citeturn1search0  
If your build ever fails due to Node version, set Node 20 in Vercel Project Settings.

---

## How the “viral loop” works

- A chain is a URL (`/?c=...` or `/?d=YYYY-MM-DD` for daily).
- Each successful 20s run stores your final snake body as a wall segment.
- Future players load the last **K** successful bodies as walls (K auto-reduces if the board gets too dense).
- End screen has:
  - **Share** (native share + image card if supported)
  - Copy link / copy text

---

## Notes

- Phase mode: press **Space/Shift** (or the PHASE button) once per run to temporarily ignore walls/self-collision.
- This build stores *only* the final body as walls (keeps data small + chain playable).
