# Libreria condivisa — Fase 1 (Backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline guidato) — questa fase è infra Supabase + API routes Next.js, non TDD-Jest puro. Steps con checkbox (`- [ ]`).
>
> **PREREQUISITO UMANO:** completare la "Setup checklist Supabase" prima dei task. L'utente fornisce Project URL + anon key + project ref; imposta la `service_role` key in env server (non la condivide). **Niente Docker:** sviluppo con `next dev` contro il Supabase hosted.

**STATO: ✅ COMPLETATA (2026-06-04)** — schema/RLS/seed applicati su Supabase hosted; API routes verificate end-to-end (token errato → 403, token valido → magic-link `ok:true`); 8 test Jest verdi (suite 481).

**Goal:** Predisporre il backend della libreria condivisa: 4 tabelle Postgres con RLS su Supabase hosted, due **API routes Next.js** per il gating a invito (`request-access`, `claim-username`), client admin server-only. Migrazioni versionate nel repo.

**Architecture:** Postgres + Auth gestiti da Supabase hosted. Schema e RLS in migrazioni SQL applicate via Supabase CLI (`db push`). La logica privilegiata vive in API routes Next.js server-side (come l'esistente `api/elevation`) che usano un client admin con la `service_role` key (solo env server). Il client browser userà la anon key (Fase 2). La RLS è la garanzia a livello DB.

**Tech Stack:** Supabase (Postgres 15, Auth magic-link), `@supabase/supabase-js`, Next.js API routes, Supabase CLI (solo per `link`/`db push`), Jest per i test delle route.

---

## Setup checklist Supabase (UTENTE)

- [x] Account + progetto Supabase creati.
- [ ] **Project Settings → API:** annota **Project URL**, **anon key** (pubblica), **service_role key** (segreta), **Project Ref**.
- [ ] **Authentication → Providers → Email:** Email + **Magic Link** abilitati.
- [ ] **Authentication → Settings:** **"Allow new users to sign up" = OFF** (signup pubblici disabilitati).
- [ ] **Authentication → URL Configuration:** Site URL `http://localhost:3000` (+ dominio prod); Redirect URLs idem.
- [ ] Fornisci all'agente: **Project URL**, **anon key**, **Project Ref**. La **service_role key** la metti tu in `.env.local` (non in chat, non nel repo).

---

## File Structure

- `.env.local` (NON committato) — chiavi reali. `.env.example` — placeholder documentati.
- `src/lib/supabase-admin.ts` — client server-only (service-role).
- `src/app/api/shared/request-access/route.ts` — route gating registrazione/login.
- `src/app/api/shared/claim-username/route.ts` — route creazione membro.
- `src/__tests__/api/request-access.test.ts`, `src/__tests__/api/claim-username.test.ts`.
- `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_seed_invite.sql` — versionate; applicate hosted via CLI.

---

## Task 1: Dipendenze, env, client admin

**Files:**
- Modify: `package.json` (install `@supabase/supabase-js`)
- Create: `src/lib/supabase-admin.ts`
- Modify: `.env.example`; Create: `.env.local` (locale, non committato)

- [ ] **Step 1: Installa il client Supabase**

Run: `npm i @supabase/supabase-js`
Expected: aggiunto a `dependencies`.

- [ ] **Step 2: Crea `.env.local`** (con i valori reali forniti dall'utente; NON committare)

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
INVITE_TOKEN=<token in chiaro generato al Task 4>
SITE_URL=http://localhost:3000
```
Verifica che `.env.local` sia in `.gitignore` (Next.js lo ignora di default).

- [ ] **Step 3: Aggiorna `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Server-only (mai NEXT_PUBLIC):
SUPABASE_SERVICE_ROLE_KEY=
INVITE_TOKEN=
SITE_URL=http://localhost:3000
```

- [ ] **Step 4: Client admin server-only `src/lib/supabase-admin.ts`**

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Client con privilegi elevati: USARE SOLO nelle API routes server-side.
// La service_role bypassa la RLS — non importare mai questo modulo in codice client.
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin env mancante');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
```
(Installa anche `server-only`: `npm i server-only` — impedisce l'import accidentale lato client.)

- [ ] **Step 5: Verifica build/tipi**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/supabase-admin.ts .env.example
git commit -m "feat(shared-library): supabase-js + server-only admin client + env (phase 1)"
```
End commit con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. `.env.local` NON committato.

---

## Task 2: Schema (migration 0001) + push hosted

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

- [ ] **Step 1: Init supabase nel repo (solo config, niente Docker)**

Run: `npx supabase init`
Expected: crea `supabase/config.toml`. (Non eseguiamo `supabase start`.)

- [ ] **Step 2: Collega il progetto hosted**

Run: `npx supabase link --project-ref <PROJECT_REF>`
Expected: chiede la password del DB (dalla dashboard → Settings → Database); collega.

- [ ] **Step 3: Scrivi la migration schema**

`supabase/migrations/0001_schema.sql`:
```sql
create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_by uuid not null references public.members(id) on delete cascade,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
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

- [ ] **Step 4: Applica al DB hosted**

Run: `npx supabase db push`
Expected: applica `0001`; conferma migrazione sul remoto.

- [ ] **Step 5: Verifica** (Supabase dashboard → Table Editor): esistono `members`, `invites`, `routes`, `completions`.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/migrations/0001_schema.sql .gitignore
git commit -m "feat(shared-library): schema tables (phase 1)"
```

---

## Task 3: RLS (migration 0002) + push

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: Scrivi le policy** (identiche allo spec Sezione B)

`supabase/migrations/0002_rls.sql`:
```sql
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.id = auth.uid());
$$;

alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.routes enable row level security;
alter table public.completions enable row level security;

create policy members_select on public.members for select using (public.is_member());
create policy members_insert_self on public.members for insert with check (id = auth.uid());
create policy members_update_self on public.members for update using (id = auth.uid()) with check (id = auth.uid());

create policy routes_select on public.routes for select using (public.is_member());
create policy routes_insert on public.routes for insert with check (created_by = auth.uid());
create policy routes_update on public.routes for update using (
  created_by = auth.uid() or exists (select 1 from public.members m where m.id = auth.uid() and m.role='admin'));
create policy routes_delete on public.routes for delete using (
  created_by = auth.uid() or exists (select 1 from public.members m where m.id = auth.uid() and m.role='admin'));

create policy completions_select on public.completions for select using (public.is_member());
create policy completions_insert on public.completions for insert with check (created_by = auth.uid());
create policy completions_update on public.completions for update using (
  created_by = auth.uid() or exists (select 1 from public.members m where m.id = auth.uid() and m.role='admin'));
create policy completions_delete on public.completions for delete using (
  created_by = auth.uid() or exists (select 1 from public.members m where m.id = auth.uid() and m.role='admin'));
-- invites: nessuna policy = deny-all per anon/authenticated (solo service-role la legge).
```

- [ ] **Step 2: Applica** — Run: `npx supabase db push`. Expected: applica `0002`.

- [ ] **Step 3: Verifica deny-by-default** (dashboard → SQL editor, come ruolo non privilegiato, oppure col client anon in Fase 2): `select * from routes` da non-membro → 0 righe. La verifica end-to-end con JWT membro è in Fase 2.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat(shared-library): RLS policies (phase 1)"
```

---

## Task 4: Seed token invito (migration 0003)

**Files:**
- Create: `supabase/migrations/0003_seed_invite.sql`

- [ ] **Step 1: Genera token + hash**

Run (PowerShell):
```
$t = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) }); $t
$sha = [System.BitConverter]::ToString((New-Object System.Security.Cryptography.SHA256Managed).ComputeHash([Text.Encoding]::UTF8.GetBytes($t))) -replace '-',''; $sha.ToLower()
```
Expected: stampa il token in chiaro (da conservare/condividere come `#invite=<token>` e da mettere in `.env.local` come `INVITE_TOKEN`) e il suo hash SHA-256.

- [ ] **Step 2: Migration di seed con l'HASH**

`supabase/migrations/0003_seed_invite.sql` (sostituisci `<SHA256>`):
```sql
insert into public.invites (token_hash, active) values ('<SHA256>', true);
```

- [ ] **Step 3: Applica** — Run: `npx supabase db push`. Verifica (dashboard): una riga in `invites`, `active=true`. Il token in chiaro NON è nel DB.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_seed_invite.sql
git commit -m "feat(shared-library): seed shared invite token hash (phase 1)"
```
Il token in chiaro NON va committato (sta solo in `.env.local` + password manager).

---

## Task 5: API route `claim-username`

**Files:**
- Create: `src/app/api/shared/claim-username/route.ts`
- Test: `src/__tests__/api/claim-username.test.ts`

- [ ] **Step 1: Scrivi il test (mock del client admin)**

`src/__tests__/api/claim-username.test.ts`:
```ts
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock('@/lib/supabase-admin', () => ({
  getAdminClient: () => ({ from: mockFrom, auth: { getUser: mockGetUser } }),
}));

import { POST } from '@/app/api/shared/claim-username/route';

function req(body: unknown, auth = 'Bearer jwt') {
  return new Request('http://x/api/shared/claim-username', {
    method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => { mockFrom.mockReset(); mockGetUser.mockReset(); });

describe('claim-username', () => {
  test('401 senza JWT', async () => {
    const res = await POST(req({ username: 'gio' }, ''));
    expect(res.status).toBe(401);
  });

  test('400 username troppo corto', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await POST(req({ username: 'ab' }));
    expect(res.status).toBe(400);
  });

  test('crea membro, primo = admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    // members: esistenza(no) -> username preso(no) -> count(0) -> insert(ok)
    const maybeSingle = jest.fn()
      .mockResolvedValueOnce({ data: null })   // già membro?
      .mockResolvedValueOnce({ data: null });  // username preso?
    const select = jest.fn(() => ({
      eq: () => ({ maybeSingle }),
      ilike: () => ({ maybeSingle }),
    }));
    const selectCount = jest.fn(() => ({ count: 0 }));
    const insert = jest.fn(() => ({ error: null }));
    mockFrom.mockImplementation(() => ({
      select: (cols: string, opts?: { count?: string; head?: boolean }) =>
        opts?.head ? selectCount() : select(),
      insert,
    }));
    const res = await POST(req({ username: 'gio' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.role).toBe('admin');
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)** — Run: `npm test -- claim-username`. Expected: modulo route inesistente.

- [ ] **Step 3: Implementa `src/app/api/shared/claim-username/route.ts`**

```ts
import { getAdminClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    const { username } = await req.json();
    const name = (username ?? '').trim();
    if (name.length < 3 || name.length > 30) return json({ error: 'invalid_username' }, 400);

    const admin = getAdminClient();
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    const { data: existing } = await admin.from('members').select('id').eq('id', userId).maybeSingle();
    if (existing) return json({ error: 'already_member' }, 409);

    const { data: taken } = await admin.from('members').select('id').ilike('username', name).maybeSingle();
    if (taken) return json({ error: 'username_taken' }, 409);

    const { count } = await admin.from('members').select('id', { count: 'exact', head: true });
    const role = (count ?? 0) === 0 ? 'admin' : 'member';

    const { error: insErr } = await admin.from('members').insert({ id: userId, username: name, role });
    if (insErr) return json({ error: 'insert_failed' }, 500);

    return json({ ok: true, username: name, role }, 200);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 4: Esegui i test** — Run: `npm test -- claim-username`. Expected: PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/shared/claim-username/route.ts src/__tests__/api/claim-username.test.ts
git commit -m "feat(shared-library): claim-username API route (unique, first=admin)"
```

---

## Task 6: API route `request-access`

**Files:**
- Create: `src/app/api/shared/request-access/route.ts`
- Test: `src/__tests__/api/request-access.test.ts`

- [ ] **Step 1: Scrivi il test**

`src/__tests__/api/request-access.test.ts`:
```ts
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockFrom = jest.fn();
const mockListUsers = jest.fn();
const mockGenerateLink = jest.fn();
const mockInvite = jest.fn();
jest.mock('@/lib/supabase-admin', () => ({
  getAdminClient: () => ({
    from: mockFrom,
    auth: { admin: { listUsers: mockListUsers, generateLink: mockGenerateLink, inviteUserByEmail: mockInvite } },
  }),
}));

import { POST } from '@/app/api/shared/request-access/route';

function req(body: unknown) {
  return new Request('http://x/api/shared/request-access', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => { mockFrom.mockReset(); mockListUsers.mockReset(); mockGenerateLink.mockReset(); mockInvite.mockReset(); });

describe('request-access', () => {
  test('403 token invito non valido', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null });
    mockFrom.mockImplementation(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }));
    const res = await POST(req({ email: 'a@b.it', token: 'wrong' }));
    expect(res.status).toBe(403);
    expect(mockInvite).not.toHaveBeenCalled();
  });

  test('nuovo utente → inviteUserByEmail', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'i1' } });  // invito valido
    mockFrom.mockImplementation(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }));
    mockListUsers.mockResolvedValue({ data: { users: [] } });
    mockInvite.mockResolvedValue({ error: null });
    // token in chiaro che hashato combacia col seed di test non serve: la query è mockata a "valido"
    const res = await POST(req({ email: 'new@b.it', token: 'whatever' }));
    expect(res.status).toBe(200);
    expect(mockInvite).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)** — Run: `npm test -- request-access`.

- [ ] **Step 3: Implementa `src/app/api/shared/request-access/route.ts`**

```ts
import { getAdminClient } from '@/lib/supabase-admin';
import { createHash } from 'crypto';

export async function POST(req: Request) {
  try {
    const { email, token } = await req.json();
    if (!email || !token) return json({ error: 'missing_fields' }, 400);

    const admin = getAdminClient();
    const hash = createHash('sha256').update(String(token)).digest('hex');
    const { data: invite } = await admin
      .from('invites').select('id').eq('token_hash', hash).eq('active', true).maybeSingle();
    if (!invite) return json({ error: 'invalid_invite' }, 403);

    const redirectTo = process.env.SITE_URL ?? 'http://localhost:3000';
    const { data: list } = await admin.auth.admin.listUsers();
    const exists = list?.users?.some((u: { email?: string }) => u.email?.toLowerCase() === String(email).toLowerCase());

    if (exists) {
      const { error } = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } });
      if (error) return json({ error: 'send_failed' }, 500);
    } else {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error) return json({ error: 'invite_failed' }, 500);
    }
    return json({ ok: true }, 200);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 4: Esegui i test** — Run: `npm test -- request-access`. Expected: PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/shared/request-access/route.ts src/__tests__/api/request-access.test.ts
git commit -m "feat(shared-library): request-access API route (verify invite, magic-link/invite)"
```

---

## Task 7: Verifica end-to-end (reale)

**Files:** nessuno (manuale).

- [ ] **Step 1: Avvia l'app** — Run: `npm run dev`. (Legge `.env.local`.)

- [ ] **Step 2: Token errato → 403**

Run: `curl -s -X POST http://localhost:3000/api/shared/request-access -H "Content-Type: application/json" -d '{"email":"tu@example.it","token":"sbagliato"}'`
Expected: `{"error":"invalid_invite"}`.

- [ ] **Step 3: Token giusto → magic-link reale**

Run: stesso curl con `"token":"<INVITE_TOKEN reale>"`.
Expected: `{"ok":true}` e arrivo del magic-link nella casella (richiede email Auth configurata su Supabase; col sender di default Supabase funziona per pochi invii).

- [ ] **Step 4: Conferma signup pubblici OFF** — verifica in dashboard che un signup diretto non sia possibile fuori dalla route.

- [ ] **Step 5:** (nessun commit di codice) — la verifica del claim-username end-to-end (con sessione reale) e della RLS lato membro avviene in **Fase 2** col client browser.

---

## Self-Review (esito)

**Copertura spec (Fase 1):** tabelle → Task 2; RLS → Task 3; seed invito (hash) → Task 4; gating server (verifica token, magic-link/invite, primo=admin, signup OFF) → Task 5-6 + Setup checklist; client admin server-only + env → Task 1; verifica reale → Task 7. ✔

**Cambi vs versione precedente:** Edge Functions Deno → **API routes Next.js** (testabili con Jest mockando il client admin); **niente Docker** (sviluppo `next dev` su Supabase hosted); migrazioni applicate via `db push`. La `service_role` resta server-only (`server-only` + `.env.local`).

**Limiti dichiarati:** claim-username end-to-end con sessione reale e verifica RLS lato membro autenticato → **Fase 2** (richiede il client browser). Qui: guard di base testati (401/400/403, unicità, primo=admin, token errato).

**Note fasi successive:** Fase 2 userà queste route + `NEXT_PUBLIC_SUPABASE_*`; Fase 3 sostituirà il backend del `routeLibraryStore` con `lib/sync`; Fase 4 aggiungerà UI sociale.
