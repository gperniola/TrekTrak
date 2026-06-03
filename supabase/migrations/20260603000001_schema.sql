-- Libreria condivisa — schema (Fase 1).
-- members: profilo applicativo legato a auth.users. L'email resta in auth.users.
create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

-- invites: token segreto (hash) che abilita la registrazione. Per ora una riga (link unico).
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- routes: l'Itinerary (JSONB) senza completamenti.
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_by uuid not null references public.members(id) on delete cascade,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- completions: diario comunitario, difficoltà percepita 1-5.
create table public.completions (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  created_by uuid not null references public.members(id) on delete cascade,
  person text not null,
  date date not null,
  duration_minutes int,
  difficulty smallint check (difficulty between 1 and 5),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index routes_sort_idx on public.routes (sort_index);
create index completions_route_idx on public.completions (route_id);
