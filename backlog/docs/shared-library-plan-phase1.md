# Libreria condivisa — Fase 1 (Backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **PREREQUISITO UMANO:** la "Setup checklist Supabase" qui sotto va completata dall'utente PRIMA dei task. Alcuni passi (creare il progetto, le chiavi, le impostazioni Auth) si fanno solo dalla dashboard Supabase.

**Goal:** Predisporre il backend Supabase della libreria condivisa: 4 tabelle con Row-Level Security, due Edge Functions per il gating a invito, versionato nel repo sotto `supabase/`.

**Architecture:** Postgres gestito da Supabase. Lo schema e le policy RLS vivono in una migration SQL; il gating a invito vive in due Edge Functions Deno (`request-access`, `claim-username`) che usano la service-role key (mai esposta al client). Sviluppo e test in locale con la Supabase CLI (`supabase start` / `db reset` / `functions serve`), poi deploy sul progetto hosted.

**Tech Stack:** Supabase (Postgres 15, Auth, Edge Functions/Deno), Supabase CLI. Riferimento spec: `backlog/docs/shared-library-design.md` (Sezioni A, B, E).

---

## Setup checklist Supabase (UTENTE — fare prima dei task)

- [ ] **Installa la Supabase CLI**: `npm i -D supabase` (oppure binario globale). Verifica: `npx supabase --version`.
- [ ] **Crea il progetto hosted** su https://supabase.com → New project. **Region: EU** (es. `eu-central-1`). Annota:
  - `Project URL` (es. `https://abc.supabase.co`)
  - `anon` public key
  - `service_role` key (SEGRETA — non finirà mai nel client)
- [ ] **Auth → Providers → Email**: abilita **Email** con **Magic Link**. **Disabilita "Allow new users to sign up"** (signup pubblici OFF: gli account si creano solo via Edge Function).
- [ ] **Auth → URL Configuration**: aggiungi i redirect URL dell'app (in dev `http://localhost:3000`, in prod il dominio TrekTrak).
- [ ] **Docker Desktop attivo** (richiesto da `supabase start` per lo stack locale).
- [ ] Fornisci all'agente: `Project URL`, `anon key`. La `service_role` key e il token di invito si impostano come **secret** delle Edge Functions (Task 7), non vanno nel repo.

> Finché questa checklist non è completa, i Task 7-8 (deploy hosted) restano bloccati; i Task 1-6 si possono fare interamente in locale con la CLI.

---

## File Structure

Tutto sotto una nuova cartella `supabase/` versionata nel repo:
- `supabase/config.toml` — generato da `supabase init`.
- `supabase/migrations/0001_shared_library_schema.sql` — tabelle.
- `supabase/migrations/0002_shared_library_rls.sql` — policy RLS.
- `supabase/functions/claim-username/index.ts` — Edge Function.
- `supabase/functions/request-access/index.ts` — Edge Function.
- `supabase/functions/_shared/cors.ts` — header CORS condivisi.
- `.env.example` — aggiunta placeholder client (`NEXT_PUBLIC_SUPABASE_*`).

---

## Task 1: Scaffold `supabase/` nel repo

**Files:**
- Create: `supabase/config.toml` (+ struttura) via CLI

- [ ] **Step 1: Inizializza Supabase nel repo**

Run: `npx supabase init`
Expected: crea `supabase/config.toml` e la cartella `supabase/`. Risponde "Finished supabase init".

- [ ] **Step 2: Avvia lo stack locale (verifica Docker)**

Run: `npx supabase start`
Expected: scarica le immagini e stampa le credenziali locali (`API URL: http://127.0.0.1:54321`, `anon key`, `service_role key`, `DB URL`). Annotale per i test locali.

- [ ] **Step 3: Aggiungi `supabase/.branches` e volumi al `.gitignore`**

Aggiungi a `.gitignore`:
```
# Supabase local
supabase/.branches
supabase/.temp
```

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml .gitignore
git commit -m "chore(shared-library): scaffold supabase project (phase 1)"
```
End commit con: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 2: Migration schema (4 tabelle)

**Files:**
- Create: `supabase/migrations/0001_shared_library_schema.sql`

- [ ] **Step 1: Scrivi la migration**

`supabase/migrations/0001_shared_library_schema.sql`:
```sql
-- Members: profilo applicativo legato a auth.users. L'email resta in auth.users.
create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

-- Invites: token segreto (hash) che abilita la registrazione. Per ora una riga (link unico).
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Routes: l'Itinerary (JSONB) senza completamenti.
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_by uuid not null references public.members(id) on delete cascade,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Completions: diario comunitario, difficoltà percepita 1-5.
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
```

- [ ] **Step 2: Applica la migration in locale**

Run: `npx supabase db reset`
Expected: applica tutte le migration su DB locale; termina senza errori ("Applying migration 0001_shared_library_schema.sql...").

- [ ] **Step 3: Verifica le tabelle**

Run: `npx supabase db reset` poi apri Studio locale (`http://127.0.0.1:54323`) → Table Editor, oppure:
Run: `echo "\dt public.*" | npx supabase db psql`
Expected: elenca `members`, `invites`, `routes`, `completions`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_shared_library_schema.sql
git commit -m "feat(shared-library): schema tables members/invites/routes/completions"
```

---

## Task 3: Row-Level Security

**Files:**
- Create: `supabase/migrations/0002_shared_library_rls.sql`

- [ ] **Step 1: Scrivi le policy**

`supabase/migrations/0002_shared_library_rls.sql`:
```sql
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

-- invites: nessun accesso client (solo service-role / Edge Functions bypassano RLS).
-- (Nessuna policy = deny-all per anon/authenticated.)

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
```

- [ ] **Step 2: Applica e verifica deny-by-default**

Run: `npx supabase db reset`
Expected: applica `0002`. Poi verifica che un ruolo `anon` NON legga le routes:
Run: `echo "set role anon; select * from public.routes;" | npx supabase db psql`
Expected: 0 righe / permesso negato dalla RLS (nessun dato esposto all'anon). `set role postgres` (service) invece le vede.

> Nota: la verifica RLS *completa* (membro autenticato che vede, non-membro che no) richiede JWT reali con `auth.uid()`, quindi sarà ricontrollata in Fase 2 con il client. Qui basta confermare che senza membership non si legge nulla.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_shared_library_rls.sql
git commit -m "feat(shared-library): RLS policies (member-gated, collaborative, owner/admin writes)"
```

---

## Task 4: Seed del token di invito (hash)

**Files:**
- Create: `supabase/migrations/0003_seed_invite.sql`

- [ ] **Step 1: Genera un token e il suo hash**

Genera un token segreto e calcola lo SHA-256 (lo userai nel link `#invite=<token>`):
Run (bash): `TOKEN=$(openssl rand -hex 16); echo "TOKEN=$TOKEN"; printf "%s" "$TOKEN" | openssl dgst -sha256 | awk '{print $2}'`
Expected: stampa il token in chiaro (da conservare/condividere) e l'hash SHA-256 (da inserire nel DB).

- [ ] **Step 2: Scrivi la migration di seed con l'HASH (non il token in chiaro)**

`supabase/migrations/0003_seed_invite.sql` (sostituisci `<SHA256_HASH>` con l'hash del passo 1):
```sql
insert into public.invites (token_hash, active)
values ('<SHA256_HASH>', true);
```

- [ ] **Step 3: Applica e verifica**

Run: `npx supabase db reset`
Run: `echo "select id, active from public.invites;" | npx supabase db psql`
Expected: una riga con `active = t`. Il token in chiaro NON è nel DB.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_seed_invite.sql
git commit -m "feat(shared-library): seed single shared invite token (hashed)"
```
> Il token in chiaro NON va committato. Conservalo a parte (password manager): è il `#invite=<token>` che condividerai.

---

## Task 5: Edge Function `claim-username`

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/claim-username/index.ts`

- [ ] **Step 1: Header CORS condivisi**

`supabase/functions/_shared/cors.ts`:
```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

- [ ] **Step 2: Scrivi la funzione**

`supabase/functions/claim-username/index.ts`. Riceve un utente autenticato (JWT nel header) + `{ username }`; verifica unicità, crea la riga `members`; il PRIMO membro diventa `admin`.
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    const { username } = await req.json();
    const name = (username ?? '').trim();
    if (name.length < 3 || name.length > 30) return json({ error: 'invalid_username' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Identifica l'utente dal JWT
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    // Già membro?
    const { data: existing } = await admin.from('members').select('id').eq('id', userId).maybeSingle();
    if (existing) return json({ error: 'already_member' }, 409);

    // Username già preso? (case-insensitive)
    const { data: taken } = await admin.from('members').select('id').ilike('username', name).maybeSingle();
    if (taken) return json({ error: 'username_taken' }, 409);

    // Primo membro → admin
    const { count } = await admin.from('members').select('id', { count: 'exact', head: true });
    const role = (count ?? 0) === 0 ? 'admin' : 'member';

    const { error: insErr } = await admin.from('members').insert({ id: userId, username: name, role });
    if (insErr) return json({ error: 'insert_failed', detail: insErr.message }, 500);

    return json({ ok: true, username: name, role }, 200);
  } catch (e) {
    return json({ error: 'bad_request', detail: String(e) }, 400);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: Servi le funzioni in locale e testa**

Run: `npx supabase functions serve --no-verify-jwt`
In un altro terminale, simula una chiamata (senza JWT → 401):
Run: `curl -s -i -X POST http://127.0.0.1:54321/functions/v1/claim-username -H "Content-Type: application/json" -d '{"username":"gio"}'`
Expected: `HTTP/1.1 401` con `{"error":"unauthorized"}` (manca il Bearer JWT).

> Il test del percorso "felice" (con JWT valido + primo membro = admin) richiede un utente auth reale: viene coperto in Fase 2 quando il client autentica. Qui verifichiamo i guard di base (401 senza JWT, validazione username).

- [ ] **Step 4: Test validazione username**

Run: `curl -s -X POST http://127.0.0.1:54321/functions/v1/claim-username -H "Authorization: Bearer faketoken" -H "Content-Type: application/json" -d '{"username":"ab"}'`
Expected: la lunghezza <3 dà `{"error":"invalid_username"}` **oppure** `unauthorized` se il token fasullo viene rifiutato prima — entrambi accettabili; l'importante è che NON crei membri.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/claim-username/index.ts
git commit -m "feat(shared-library): claim-username edge function (unique, first=admin)"
```

---

## Task 6: Edge Function `request-access`

**Files:**
- Create: `supabase/functions/request-access/index.ts`

- [ ] **Step 1: Scrivi la funzione**

Riceve `{ email, token }`; verifica l'hash del token contro `invites` (attivo); se l'email è già membro → magic-link di login; altrimenti → admin invite (crea utente). Signup pubblici disabilitati lato Auth, quindi questa è l'unica via.
`supabase/functions/request-access/index.ts`:
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { email, token } = await req.json();
    if (!email || !token) return json({ error: 'missing_fields' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) Verifica token invito
    const hash = await sha256Hex(String(token));
    const { data: invite } = await admin
      .from('invites').select('id').eq('token_hash', hash).eq('active', true).maybeSingle();
    if (!invite) return json({ error: 'invalid_invite' }, 403);

    const redirectTo = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

    // 2) Email già di un utente esistente?
    const { data: list } = await admin.auth.admin.listUsers();
    const exists = list?.users?.some((u) => u.email?.toLowerCase() === String(email).toLowerCase());

    if (exists) {
      // login: magic link senza creare nuovo utente
      const { error } = await admin.auth.admin.generateLink({
        type: 'magiclink', email, options: { redirectTo },
      });
      if (error) return json({ error: 'send_failed', detail: error.message }, 500);
    } else {
      // nuovo utente: invito (crea l'utente e invia il link)
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error) return json({ error: 'invite_failed', detail: error.message }, 500);
    }
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: 'bad_request', detail: String(e) }, 400);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

> Nota implementativa: `generateLink`/`inviteUserByEmail` inviano l'email solo se l'SMTP è configurato sul progetto hosted (in locale le email finiscono in Inbucket: `http://127.0.0.1:54324`). In dev usa Inbucket per leggere il magic-link.

- [ ] **Step 2: Testa il rifiuto con token errato (in locale)**

Con `npx supabase functions serve` attivo e una env locale che imposti `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (dalle credenziali di `supabase start`):
Run: `curl -s -X POST http://127.0.0.1:54321/functions/v1/request-access -H "Content-Type: application/json" -d '{"email":"x@y.it","token":"sbagliato"}'`
Expected: `{"error":"invalid_invite"}` (403). Nessuna email inviata.

- [ ] **Step 3: Testa il percorso valido (token corretto → email in Inbucket)**

Run: stesso curl ma con `"token":"<TOKEN_IN_CHIARO_del_Task_4>"`.
Expected: `{"ok":true}`. Apri Inbucket (`http://127.0.0.1:54324`): è arrivata un'email con il magic-link per `x@y.it`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/request-access/index.ts
git commit -m "feat(shared-library): request-access edge function (verify invite, magic-link/invite)"
```

---

## Task 7: Deploy sul progetto hosted + secret (richiede setup checklist)

**Files:** nessun file nuovo (operazioni CLI/dashboard).

- [ ] **Step 1: Collega il repo al progetto hosted**

Run: `npx supabase link --project-ref <PROJECT_REF>`
Expected: chiede la password DB; collega. (`PROJECT_REF` è nell'URL del progetto.)

- [ ] **Step 2: Applica le migration sul DB hosted**

Run: `npx supabase db push`
Expected: applica `0001`,`0002`,`0003` sul progetto remoto.

- [ ] **Step 3: Imposta i secret delle Edge Functions**

Run:
```
npx supabase secrets set SITE_URL=<URL_PROD_O_LOCALHOST>
```
(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono iniettati automaticamente nelle functions hosted — NON serve impostarli a mano e NON vanno nel repo.)

- [ ] **Step 4: Deploy delle funzioni**

Run: `npx supabase functions deploy claim-username` e `npx supabase functions deploy request-access`
Expected: entrambe deployate; URL `https://<ref>.functions.supabase.co/...`.

- [ ] **Step 5: Verifica hosted**

Run: `curl -s -X POST https://<ref>.supabase.co/functions/v1/request-access -H "Content-Type: application/json" -d '{"email":"tu@example.it","token":"<TOKEN>"}'`
Expected: `{"ok":true}` e arrivo del magic-link nella casella reale (se SMTP/Auth email configurati). Token errato → 403.

- [ ] **Step 6: (nessun commit di codice)** — annota nel CHANGELOG/worklog che il backend è live. I secret e le chiavi NON si committano.

---

## Task 8: Placeholder env client

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Aggiungi i placeholder client**

In `.env.example` aggiungi:
```
# Supabase (libreria condivisa) — Fase 2 client
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(shared-library): document Supabase client env vars (phase 1)"
```

---

## Self-Review (esito)

**Copertura spec (Fase 1):** Sezione B tabelle → Task 2; RLS → Task 3; invito (token hash) → Task 4 + verifica in `request-access` Task 6; Edge Functions `request-access`/`claim-username` (gating, signup OFF, primo=admin) → Task 5-6; deploy + Auth settings → Setup checklist + Task 7; env client → Task 8. ✔

**Limiti dichiarati (no placeholder nascosti):** la verifica RLS completa e il percorso "felice" delle funzioni (JWT reale, primo membro=admin, scelta username end-to-end) dipendono dall'autenticazione client e sono coperti in **Fase 2** — qui sono testati i guard di base (deny-by-default, 401 senza JWT, 403 token errato, magic-link in Inbucket). Esplicitato nei task, non è un buco di piano.

**Coerenza:** nomi funzioni `request-access`/`claim-username` coerenti con lo spec aggiornato; colonne/tipi allineati a Sezione B (`difficulty smallint 1-5`, `created_by → members.id`, `data jsonb`).

**Note per le fasi successive:** la Fase 2 (auth client) userà `request-access`/`claim-username`, `NEXT_PUBLIC_SUPABASE_*`, e completerà i test RLS end-to-end. La Fase 3 (sync) sostituirà il backend del `routeLibraryStore`. La Fase 4 aggiungerà UI sociale (header, scarponi, creato-da, colonna completamenti).
