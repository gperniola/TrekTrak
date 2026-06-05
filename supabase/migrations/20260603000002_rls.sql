-- Libreria condivisa — Row-Level Security (Fase 1).
-- Helper: l'utente corrente è un membro?
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.id = auth.uid());
$$;

alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.routes enable row level security;
alter table public.completions enable row level security;

-- members: i membri leggono tutti i membri; ognuno inserisce/aggiorna solo la propria riga.
create policy members_select on public.members
  for select using (public.is_member());
create policy members_insert_self on public.members
  for insert with check (id = auth.uid());
create policy members_update_self on public.members
  for update using (id = auth.uid()) with check (id = auth.uid());

-- routes: i membri leggono tutto e inseriscono (come se stessi); update/delete solo creatore o admin.
create policy routes_select on public.routes
  for select using (public.is_member());
create policy routes_insert on public.routes
  for insert with check (created_by = auth.uid());
create policy routes_update on public.routes
  for update using (
    created_by = auth.uid()
    or exists (select 1 from public.members m where m.id = auth.uid() and m.role = 'admin')
  );
create policy routes_delete on public.routes
  for delete using (
    created_by = auth.uid()
    or exists (select 1 from public.members m where m.id = auth.uid() and m.role = 'admin')
  );

-- completions: stesso schema delle routes.
create policy completions_select on public.completions
  for select using (public.is_member());
create policy completions_insert on public.completions
  for insert with check (created_by = auth.uid());
create policy completions_update on public.completions
  for update using (
    created_by = auth.uid()
    or exists (select 1 from public.members m where m.id = auth.uid() and m.role = 'admin')
  );
create policy completions_delete on public.completions
  for delete using (
    created_by = auth.uid()
    or exists (select 1 from public.members m where m.id = auth.uid() and m.role = 'admin')
  );

-- invites: nessuna policy = deny-all per anon/authenticated.
-- Solo la service_role (API routes) la legge, bypassando la RLS.
