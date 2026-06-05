# Libreria condivisa — Fase 2 (Auth client) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Steps con checkbox (`- [ ]`). La logica si testa con mock (client Supabase + `fetch`); la verifica e2e (magic-link reale) è manuale (Task 9).

**Goal:** Aggiungere il livello di autenticazione client della libreria condivisa: gate a invito, flusso magic-link, scelta username, header utente e gating della tab "Libreria" — sopra il backend della Fase 1 (già live).

**Architecture:** Un client Supabase browser (anon/publishable key) gestisce sessione e lettura `members`; uno store Zustand `authStore` espone stato (`invited`/`session`/`member`) e azioni (`requestAccess`/`claimUsername`/`updateUsername`/`signOut`). Le due operazioni privilegiate passano dalle API routes della Fase 1. La tab "Libreria" è visibile solo a invitati/membri; dentro, un gate mostra form-email → scelta-username → libreria. In Fase 2 il *contenuto* della libreria resta quello locale v0.8.0 (lo swap a cloud è la Fase 3).

**Tech Stack:** `@supabase/supabase-js` (browser), Zustand, Next.js, Jest + Testing Library. Riferimento spec: `backlog/docs/shared-library-design.md` (Sezioni A, C, D).

---

## Prerequisito

Fase 1 completa (backend live). `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable), `SUPABASE_SERVICE_ROLE_KEY` (secret), `SITE_URL`. Branch `feature/shared-library`.

## File Structure

- `supabase/migrations/20260604000004_members_select_self.sql` — policy: leggi la propria riga `members`.
- `src/lib/supabase.ts` — client browser (anon key).
- `src/stores/authStore.ts` — sessione, membership, invito, azioni.
- `src/components/auth/RequestAccessForm.tsx` — form email post-invito.
- `src/components/auth/ChooseUsername.tsx` — scelta username primo accesso.
- `src/components/auth/UserHeader.tsx` — username + menu (cambia username, logout).
- `src/components/auth/LibraryAuthGate.tsx` — sceglie cosa mostrare nell'area Libreria.
- Modifiche: `MainViewSwitch.tsx` (gating tab), `RouteLibrary.tsx` (wrappa in gate + header), `app/page.tsx` (init authStore).
- Test in `src/__tests__/` per store e componenti.

---

## Task 1: Policy `members_select_self` (migration 0004)

**Files:**
- Create: `supabase/migrations/20260604000004_members_select_self.sql`

- [ ] **Step 1: Scrivi la migration**

`supabase/migrations/20260604000004_members_select_self.sql`:
```sql
-- Permette a un utente autenticato (anche non ancora membro) di leggere la PROPRIA riga,
-- così il client può distinguere "devo scegliere username" da "sono membro".
create policy members_select_self on public.members
  for select using (id = auth.uid());
```
(Si aggiunge alla policy `members_select` esistente: PostgreSQL combina le policy SELECT in OR, quindi i membri continuano a leggere tutti, e ognuno legge comunque sé stesso.)

- [ ] **Step 2: Applica all'hosted** — Run (terminale vero): `npx supabase db push`. Expected: applica `0004`.

- [ ] **Step 3: Verifica** (dashboard → Authentication → Policies su `members`): esiste `members_select_self`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260604000004_members_select_self.sql
git commit -m "feat(shared-library): RLS members_select_self for pending users (phase 2)"
```
End commit con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 2: Client Supabase browser

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Implementa il client**

`src/lib/supabase.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Client Supabase lato browser (anon/publishable key). Singleton lazy. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase client env mancante (NEXT_PUBLIC_SUPABASE_*)');
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
```

- [ ] **Step 2: Verifica tipi** — Run: `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(shared-library): browser supabase client (phase 2)"
```

---

## Task 3: `authStore` — stato, invito, membership

**Files:**
- Create: `src/stores/authStore.ts`
- Test: `src/__tests__/authStore.test.ts`

- [ ] **Step 1: Scrivi il test**

`src/__tests__/authStore.test.ts`:
```ts
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
const mockSignOut = jest.fn();
const mockMaybeSingle = jest.fn();
const mockFrom = jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange, signOut: mockSignOut },
    from: mockFrom,
  }),
}));

import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  mockGetSession.mockReset(); mockMaybeSingle.mockReset(); mockSignOut.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  useAuthStore.setState({ loading: true, invited: false, inviteToken: null, session: null, member: null });
  window.location.hash = '';
  localStorage.clear();
});

describe('authStore', () => {
  test('init: parse #invite dal hash, setta invited e persiste', async () => {
    window.location.hash = '#invite=beta-test';
    await useAuthStore.getState().init();
    const s = useAuthStore.getState();
    expect(s.invited).toBe(true);
    expect(s.inviteToken).toBe('beta-test');
    expect(localStorage.getItem('trektrak_invited')).toBe('1');
    expect(window.location.hash).toBe(''); // hash ripulito
  });

  test('init: invited ripristinato da localStorage', async () => {
    localStorage.setItem('trektrak_invited', '1');
    localStorage.setItem('trektrak_invite_token', 'beta-test');
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().invited).toBe(true);
  });

  test('init: sessione presente + riga member → member popolato', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'u1', username: 'gio', role: 'admin' } });
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().member?.username).toBe('gio');
    expect(useAuthStore.getState().loading).toBe(false);
  });

  test('init: sessione presente ma nessuna riga member → member null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u2' }, access_token: 't' } } });
    mockMaybeSingle.mockResolvedValue({ data: null });
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().member).toBeNull();
  });

  test('signOut azzera la sessione ma mantiene invited', async () => {
    useAuthStore.setState({ invited: true, session: { user: { id: 'u1' } } as never, member: { id: 'u1', username: 'g', role: 'member' } });
    mockSignOut.mockResolvedValue({ error: null });
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().member).toBeNull();
    expect(useAuthStore.getState().invited).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui (fallisce)** — Run: `npm test -- authStore`.

- [ ] **Step 3: Implementa `src/stores/authStore.ts`**

```ts
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

export interface Member { id: string; username: string; role: 'member' | 'admin'; }

interface AuthState {
  loading: boolean;
  invited: boolean;
  inviteToken: string | null;
  session: Session | null;
  member: Member | null;
  init: () => Promise<void>;
  refreshMember: () => Promise<void>;
  requestAccess: (email: string) => Promise<{ ok: boolean; error?: string }>;
  claimUsername: (username: string) => Promise<{ ok: boolean; error?: string }>;
  updateUsername: (username: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

function readInviteFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/[#&]invite=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  loading: true,
  invited: false,
  inviteToken: null,
  session: null,
  member: null,

  init: async () => {
    // 1) invito da URL hash o da localStorage
    let invited = false;
    let inviteToken: string | null = null;
    const fromHash = readInviteFromHash();
    if (fromHash) {
      invited = true; inviteToken = fromHash;
      try {
        localStorage.setItem('trektrak_invited', '1');
        localStorage.setItem('trektrak_invite_token', fromHash);
      } catch { /* storage non disponibile */ }
      // ripulisci il token dall'URL
      if (typeof window !== 'undefined') {
        window.location.hash = '';
      }
    } else {
      try {
        invited = localStorage.getItem('trektrak_invited') === '1';
        inviteToken = localStorage.getItem('trektrak_invite_token');
      } catch { /* ignore */ }
    }
    set({ invited, inviteToken });

    // 2) sessione + membership
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    set({ session: data.session ?? null });
    if (data.session) await get().refreshMember();

    // 3) sottoscrizione ai cambi auth
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session: session ?? null });
      if (session) void get().refreshMember();
      else set({ member: null });
    });

    set({ loading: false });
  },

  refreshMember: async () => {
    const supabase = getSupabase();
    const uid = get().session?.user?.id;
    if (!uid) { set({ member: null }); return; }
    const { data } = await supabase.from('members').select('id, username, role').eq('id', uid).maybeSingle();
    set({ member: (data as Member) ?? null });
  },

  requestAccess: async (email) => {
    const token = get().inviteToken;
    const res = await fetch('/api/shared/request-access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); return { ok: false, error: b.error ?? 'error' }; }
    return { ok: true };
  },

  claimUsername: async (username) => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return { ok: false, error: 'no_session' };
    const res = await fetch('/api/shared/claim-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ username }),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: b.error ?? 'error' };
    await get().refreshMember();
    return { ok: true };
  },

  updateUsername: async (username) => {
    const supabase = getSupabase();
    const uid = get().session?.user?.id;
    if (!uid) return { ok: false, error: 'no_session' };
    const { error } = await supabase.from('members').update({ username: username.trim() }).eq('id', uid);
    if (error) return { ok: false, error: error.code === '23505' ? 'username_taken' : 'error' };
    await get().refreshMember();
    return { ok: true };
  },

  signOut: async () => {
    await getSupabase().auth.signOut();
    set({ session: null, member: null });
  },
}));
```

- [ ] **Step 4: Esegui (passa)** — Run: `npm test -- authStore`. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/stores/authStore.ts src/__tests__/authStore.test.ts
git commit -m "feat(shared-library): authStore (invite parse, session, membership, actions)"
```

---

## Task 4: `RequestAccessForm`

**Files:**
- Create: `src/components/auth/RequestAccessForm.tsx`
- Test: `src/__tests__/components/RequestAccessForm.test.tsx`

- [ ] **Step 1: Test**

`src/__tests__/components/RequestAccessForm.test.tsx`:
```tsx
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RequestAccessForm } from '@/components/auth/RequestAccessForm';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({
    requestAccess: jest.fn(async () => ({ ok: true })) as never,
  });
});

describe('RequestAccessForm', () => {
  test('email vuota → non chiama requestAccess', () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ requestAccess: spy as never });
    render(<RequestAccessForm />);
    fireEvent.click(screen.getByRole('button', { name: /invia/i }));
    expect(spy).not.toHaveBeenCalled();
  });

  test('email valida → chiama requestAccess e mostra conferma', async () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ requestAccess: spy as never });
    render(<RequestAccessForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.it' } });
    fireEvent.click(screen.getByRole('button', { name: /invia/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('a@b.it'));
    expect(await screen.findByText(/controlla la (tua )?mail/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Esegui (fallisce)** — Run: `npm test -- RequestAccessForm`.

- [ ] **Step 3: Implementa `src/components/auth/RequestAccessForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RequestAccessForm() {
  const requestAccess = useAuthStore((s) => s.requestAccess);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) { setError('Inserisci un\'email valida'); return; }
    setBusy(true);
    const res = await requestAccess(email.trim());
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.error === 'invalid_invite' ? 'Invito non valido' : 'Errore, riprova');
  };

  if (sent) {
    return (
      <div className="p-4 text-center text-sm text-gray-300">
        📧 Controlla la tua mail: ti abbiamo inviato un link per accedere.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-bold text-green-400">Accesso area condivisa</h3>
      <p className="text-xs text-gray-400">Inserisci la tua email: riceverai un link per entrare.</p>
      <label className="block text-xs text-gray-400" htmlFor="ra-email">Email</label>
      <input
        id="ra-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
        autoComplete="email"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={submit} disabled={busy}
        className="w-full py-2 bg-green-600 text-black rounded text-sm font-bold hover:bg-green-500 disabled:opacity-50"
      >
        {busy ? 'Invio…' : 'Invia link'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Esegui (passa)** — Run: `npm test -- RequestAccessForm`.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/RequestAccessForm.tsx src/__tests__/components/RequestAccessForm.test.tsx
git commit -m "feat(shared-library): RequestAccessForm (email → magic-link request)"
```

---

## Task 5: `ChooseUsername`

**Files:**
- Create: `src/components/auth/ChooseUsername.tsx`
- Test: `src/__tests__/components/ChooseUsername.test.tsx`

- [ ] **Step 1: Test**

`src/__tests__/components/ChooseUsername.test.tsx`:
```tsx
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChooseUsername } from '@/components/auth/ChooseUsername';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({ claimUsername: jest.fn(async () => ({ ok: true })) as never });
});

describe('ChooseUsername', () => {
  test('username < 3 caratteri → non invia', () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ claimUsername: spy as never });
    render(<ChooseUsername />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    expect(spy).not.toHaveBeenCalled();
  });

  test('username valido → chiama claimUsername', async () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ claimUsername: spy as never });
    render(<ChooseUsername />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'gio' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('gio'));
  });

  test('errore username_taken mostrato', async () => {
    useAuthStore.setState({ claimUsername: (jest.fn(async () => ({ ok: false, error: 'username_taken' }))) as never });
    render(<ChooseUsername />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'gio' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    expect(await screen.findByText(/gi.* in uso|già in uso/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Esegui (fallisce)** — Run: `npm test -- ChooseUsername`.

- [ ] **Step 3: Implementa `src/components/auth/ChooseUsername.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function ChooseUsername() {
  const claimUsername = useAuthStore((s) => s.claimUsername);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const name = username.trim();
    if (name.length < 3 || name.length > 30) { setError('Lo username deve avere 3-30 caratteri'); return; }
    setBusy(true);
    const res = await claimUsername(name);
    setBusy(false);
    if (!res.ok) {
      setError(res.error === 'username_taken' ? 'Username già in uso' : 'Errore, riprova');
    }
    // on ok: il member viene popolato dallo store → il gate mostra la libreria
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-bold text-green-400">Scegli il tuo username</h3>
      <p className="text-xs text-gray-400">Sarà il nome visibile a tutti nel gruppo.</p>
      <label className="block text-xs text-gray-400" htmlFor="cu-name">Username</label>
      <input
        id="cu-name" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30}
        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
        autoComplete="off"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={submit} disabled={busy}
        className="w-full py-2 bg-green-600 text-black rounded text-sm font-bold hover:bg-green-500 disabled:opacity-50"
      >
        {busy ? 'Salvataggio…' : 'Conferma'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Esegui (passa)** — Run: `npm test -- ChooseUsername`.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/ChooseUsername.tsx src/__tests__/components/ChooseUsername.test.tsx
git commit -m "feat(shared-library): ChooseUsername (claim member username)"
```

---

## Task 6: `UserHeader`

**Files:**
- Create: `src/components/auth/UserHeader.tsx`
- Test: `src/__tests__/components/UserHeader.test.tsx`

- [ ] **Step 1: Test**

`src/__tests__/components/UserHeader.test.tsx`:
```tsx
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserHeader } from '@/components/auth/UserHeader';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({
    member: { id: 'u1', username: 'gio', role: 'admin' },
    signOut: jest.fn(async () => {}) as never,
  });
});

describe('UserHeader', () => {
  test('mostra lo username', () => {
    render(<UserHeader />);
    expect(screen.getByText(/gio/)).toBeInTheDocument();
  });

  test('logout chiama signOut', () => {
    const spy = jest.fn(async () => {});
    useAuthStore.setState({ signOut: spy as never });
    render(<UserHeader />);
    fireEvent.click(screen.getByRole('button', { name: /menu utente|gio/i }));
    fireEvent.click(screen.getByRole('button', { name: /esci|logout/i }));
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Esegui (fallisce)** — Run: `npm test -- UserHeader`.

- [ ] **Step 3: Implementa `src/components/auth/UserHeader.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function UserHeader() {
  const member = useAuthStore((s) => s.member);
  const signOut = useAuthStore((s) => s.signOut);
  const updateUsername = useAuthStore((s) => s.updateUsername);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member?.username ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!member) return null;

  const saveName = async () => {
    setError(null);
    const v = name.trim();
    if (v.length < 3 || v.length > 30) { setError('3-30 caratteri'); return; }
    const res = await updateUsername(v);
    if (res.ok) { setEditing(false); setOpen(false); }
    else setError(res.error === 'username_taken' ? 'Già in uso' : 'Errore');
  };

  return (
    <div className="relative flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900">
      <span className="text-xs text-gray-400">Libreria condivisa</span>
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-xs text-green-400 font-medium"
        aria-label="Menu utente"
        aria-expanded={open}
      >
        @{member.username} ▾
      </button>
      {open && (
        <div className="absolute right-2 top-full mt-1 z-[1300] bg-gray-800 border border-gray-600 rounded shadow-lg p-2 w-56 space-y-2">
          {editing ? (
            <>
              <input
                value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Nuovo username"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-1">
                <button onClick={() => { setEditing(false); setName(member.username); }} className="flex-1 py-1 bg-gray-700 rounded text-xs">Annulla</button>
                <button onClick={saveName} className="flex-1 py-1 bg-green-600 text-black rounded text-xs font-bold">Salva</button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="w-full text-left text-xs text-gray-300 hover:text-white py-1">Cambia username</button>
              <button onClick={() => signOut()} className="w-full text-left text-xs text-red-400 hover:text-red-300 py-1" aria-label="Esci">Esci</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Esegui (passa)** — Run: `npm test -- UserHeader`.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/UserHeader.tsx src/__tests__/components/UserHeader.test.tsx
git commit -m "feat(shared-library): UserHeader (username + change/logout menu)"
```

---

## Task 7: `LibraryAuthGate` + gating tab + init

**Files:**
- Create: `src/components/auth/LibraryAuthGate.tsx`
- Modify: `src/components/panel/MainViewSwitch.tsx`
- Modify: `src/components/panel/RouteLibrary.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/__tests__/components/MainViewSwitch.test.tsx`

- [ ] **Step 1: Crea `LibraryAuthGate.tsx`**

Decide cosa mostrare nell'area Libreria in base allo stato auth. In Fase 2 il contenuto "membro" è la libreria locale esistente (children).
```tsx
'use client';

import { useAuthStore } from '@/stores/authStore';
import { RequestAccessForm } from './RequestAccessForm';
import { ChooseUsername } from './ChooseUsername';
import { UserHeader } from './UserHeader';

export function LibraryAuthGate({ children }: { children: React.ReactNode }) {
  const loading = useAuthStore((s) => s.loading);
  const session = useAuthStore((s) => s.session);
  const member = useAuthStore((s) => s.member);

  if (loading) return <div className="p-4 text-xs text-gray-500">Caricamento…</div>;
  if (!session) return <RequestAccessForm />;
  if (!member) return <ChooseUsername />;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <UserHeader />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Test gating tab** `src/__tests__/components/MainViewSwitch.test.tsx`

```tsx
import { describe, expect, test, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MainViewSwitch } from '@/components/panel/MainViewSwitch';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useUIStore.setState({ mainView: 'editor' });
  useAuthStore.setState({ invited: false, member: null });
});

describe('MainViewSwitch gating', () => {
  test('tab Libreria assente per anonimo non invitato', () => {
    render(<MainViewSwitch />);
    expect(screen.queryByRole('tab', { name: /libreria/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /editor/i })).toBeInTheDocument();
  });

  test('tab Libreria presente se invitato', () => {
    useAuthStore.setState({ invited: true, member: null });
    render(<MainViewSwitch />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });

  test('tab Libreria presente se membro', () => {
    useAuthStore.setState({ invited: false, member: { id: 'u', username: 'g', role: 'member' } });
    render(<MainViewSwitch />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Modifica `MainViewSwitch.tsx`** — mostra la tab "Libreria" solo se `invited || member`.

Aggiungi import `import { useAuthStore } from '@/stores/authStore';` e dentro il componente:
```tsx
  const invited = useAuthStore((s) => s.invited);
  const isMember = useAuthStore((s) => s.member != null);
  const showLibrary = invited || isMember;
```
Avvolgi il bottone "Libreria" in `{showLibrary && ( ... )}`. Se `!showLibrary` e `mainView==='library'`, forza editor: aggiungi in cima al componente un effetto difensivo:
```tsx
  // se la libreria non è più accessibile, torna all'editor
  if (!showLibrary && mainView === 'library') setMainView('editor');
```
(usa i selettori `mainView`/`setMainView` già presenti o aggiungili.)

- [ ] **Step 4: Modifica `RouteLibrary.tsx`** — avvolgi il contenuto nel gate:
```tsx
import { LibraryAuthGate } from '@/components/auth/LibraryAuthGate';
// ...
export function RouteLibrary() {
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  return (
    <LibraryAuthGate>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <RouteList />
        {selectedId && <RouteDetailCard key={selectedId} />}
      </div>
    </LibraryAuthGate>
  );
}
```

- [ ] **Step 5: Init authStore in `app/page.tsx`** — aggiungi:
```tsx
import { useAuthStore } from '@/stores/authStore';
// dentro Home, con gli altri useEffect:
useEffect(() => { void useAuthStore.getState().init(); }, []);
```

- [ ] **Step 6: Esegui** — Run: `npm test` (suite intera). Aggiorna i test esistenti di `MainViewSwitch`/`LeftPanel` se ora si aspettano la tab Libreria sempre presente (dovranno settare `invited`/`member` in `beforeEach`). `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/auth/LibraryAuthGate.tsx src/components/panel/MainViewSwitch.tsx src/components/panel/RouteLibrary.tsx src/app/page.tsx src/__tests__/components/MainViewSwitch.test.tsx
git commit -m "feat(shared-library): library auth gate + tab gating + authStore init"
```

---

## Task 8: Verifica end-to-end (reale)

**Files:** nessuno (manuale).

- [ ] **Step 1:** `npm run dev`, apri `http://localhost:3000/#invite=beta-test`.
- [ ] **Step 2:** Compare la tab **Libreria** → cliccandola vedi il **form email**. Inserisci la tua email → "controlla la mail".
- [ ] **Step 3:** Apri il magic-link dalla mail → l'app si riapre autenticata → compare **"Scegli username"**. Scegline uno → confermi.
- [ ] **Step 4:** Vedi l'**header con @username** e la libreria (locale, per ora). Verifica in dashboard `members`: la tua riga c'è con `role='admin'` (primo membro).
- [ ] **Step 5:** Ricarica la pagina senza `#invite` → resti loggato e membro (sessione persistente). In una finestra **senza** mai aver aperto l'invito → la tab Libreria **non** compare.
- [ ] **Step 6:** (nessun commit) — riporta gli esiti.

---

## Self-Review (esito)

**Copertura spec (Fase 2):** client browser → Task 2; authStore (invito/sessione/membership/azioni) → Task 3; form email → Task 4; scelta username → Task 5; header utente (+ cambio username/logout) → Task 6; gate area + gating tab + init → Task 7; verifica reale → Task 8. RLS per utente pending → Task 1. ✔

**Coerenza tipi:** `Member {id, username, role}` definito in `authStore` (Task 3) e usato in `UserHeader`/`LibraryAuthGate`/test (Task 6-7). Azioni `requestAccess(email)`, `claimUsername(username)`, `updateUsername`, `signOut` coerenti tra store e componenti. Le route `/api/shared/*` sono quelle della Fase 1.

**Limiti / note:** in Fase 2 il *contenuto* della libreria (RouteList/RouteDetailCard) resta quello **locale v0.8.0** dietro il gate; lo swap al backend cloud (`lib/sync`) è la **Fase 3**. Conseguenza voluta (da spec): i non-invitati non vedono più la tab Libreria. I test esistenti di `MainViewSwitch`/`LeftPanel` che assumevano la tab sempre visibile vanno aggiornati a impostare `invited`/`member` (Task 7 Step 6).
