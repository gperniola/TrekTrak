-- Correzione di 000006: revocare EXECUTE da authenticated/PUBLIC rompe la RLS, perché le
-- policy SELECT (members/routes/completions) chiamano is_member() e la valutazione richiede
-- il privilegio EXECUTE al ruolo che esegue la query.
-- Soluzione endorsed dall'advisor stesso ("move it out of your exposed API schema"):
-- spostare la funzione in uno schema NON esposto da PostgREST, così non è più un endpoint
-- /rest/v1/rpc, mantenendo EXECUTE per authenticated (necessario alla RLS).

create schema if not exists private;

create or replace function private.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.id = auth.uid());
$$;

-- la RLS valuta la funzione come ruolo chiamante: servono USAGE sullo schema ed EXECUTE.
-- anon resta escluso (le tabelle protette non vanno lette da utenti non loggati).
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

-- ripunta le policy SELECT alla nuova funzione
drop policy members_select on public.members;
create policy members_select on public.members for select using (private.is_member());

drop policy routes_select on public.routes;
create policy routes_select on public.routes for select using (private.is_member());

drop policy completions_select on public.completions;
create policy completions_select on public.completions for select using (private.is_member());

-- rimuovi la vecchia funzione pubblica (non più referenziata, non più esposta come RPC)
drop function public.is_member();
