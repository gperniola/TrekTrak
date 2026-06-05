# Libreria condivisa — Fase 3 (Sync cloud) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Steps con checkbox (`- [ ]`). Logica testata con mock del client Supabase; verifica e2e (lettura/scrittura reale) manuale.

**STATO: ✅ COMPLETATA (2026-06-05)** — `lib/sync.ts` + `routeLibraryStore` async su Supabase; Save editor→cloud (solo membri); completamenti/note/riordino sincronizzati; verificato e2e (salvataggio, libreria, completamenti, riordino, gating non-membri). 507 test verdi.

**Goal:** Sostituire il backend della libreria da localStorage a **Supabase cloud**, dietro l'interfaccia esistente del `routeLibraryStore`. I membri leggono/scrivono percorsi e completamenti condivisi; il "Salva" dell'editor pubblica nel cloud ed è riservato ai membri.

**Architecture:** Un nuovo `lib/sync.ts` incapsula l'accesso dati Supabase (routes JSONB + completions + risoluzione username dei membri). Le azioni del `routeLibraryStore` diventano **async** e usano `lib/sync` invece di `lib/storage`. localStorage resta come cache offline (read-through) e per settings/quiz/validation (non toccati). Conflitti: last-write-wins su `updated_at`. Scritture solo online (toast se offline). Decisione: **Salva = solo membri** (non-membri: pulsante disabilitato con CTA).

**Tech Stack:** Supabase JS (browser, RLS), Zustand, Next.js, Jest. Riferimento spec: `backlog/docs/shared-library-design.md` (Sez. B, C, E).

---

## Prerequisito
Fasi 1-2 complete (backend live, auth + membership funzionanti). Membro autenticato disponibile per i test e2e.

## Mappatura dati
- `routes.data` (JSONB) = `{ name, createdAt, waypoints, legs(slim), notes, metrics }`. **NO** completamenti (tabella a parte), **NO** id (è `routes.id`).
- `routes.id` (uuid) = id canonico del percorso lato UI/store. L'editor, dopo "Carica nell'editor", usa questo id come `itineraryId`.
- `completions` (riga) → `RouteCompletion` client: `{ id, personName: person, date, durationMinutes: duration_minutes ?? undefined, notes }`. (Il campo `difficulty` esiste in DB ma la UI arriva in Fase 4: in Fase 3 non lo si scrive.)
- Username creatore: risolto da `members` e attaccato come `createdByUsername` (campo client opzionale).

## File Structure
- `src/lib/sync.ts` — NEW: accesso dati Supabase.
- `src/stores/routeLibraryStore.ts` — azioni async su `lib/sync`; `knownPeople` derivato dai dati caricati.
- `src/components/panel/ItineraryHeader.tsx` — "Salva" → cloud (solo membri; disabilitato per non-membri).
- `src/components/panel/CompletionList.tsx` — `guard` async; `getKnownPeople` dallo store.
- `src/components/panel/RouteDetailCard.tsx` — `updateNotes`/azioni async.
- `src/lib/types.ts` — `Itinerary.createdByUsername?`, `RouteCompletion` invariato.
- Test: `src/__tests__/sync.test.ts`, aggiornare `routeLibraryStore.test.ts`.

---

## Task 1: Tipo `createdByUsername`

**Files:** Modify `src/lib/types.ts`

- [ ] **Step 1:** All'interfaccia `Itinerary` aggiungi il campo client opzionale (non persistito in JSONB):
```ts
  /** Username del creatore (risolto dal cloud, solo per visualizzazione). */
  createdByUsername?: string;
```
- [ ] **Step 2:** `npx tsc --noEmit` → clean.
- [ ] **Step 3:** Commit
```bash
git add src/lib/types.ts
git commit -m "feat(sync): add Itinerary.createdByUsername (phase 3)"
```
End con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 2: `lib/sync.ts`

**Files:** Create `src/lib/sync.ts`, Test `src/__tests__/sync.test.ts`

- [ ] **Step 1: Test** (mock del client browser `@/lib/supabase`)

`src/__tests__/sync.test.ts`:
```ts
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const tables: Record<string, unknown> = {};
function makeQuery(rows: unknown[]) {
  // catena minima: select().order() -> Promise; select().eq().maybeSingle(); insert/update/delete().eq()
  const result = { data: rows, error: null };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => Promise.resolve(result);
  chain.eq = () => chain;
  chain.in = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  chain.then = (res: (v: typeof result) => void) => res(result); // thenable per await diretto
  return chain;
}
const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
const mockUpdate = jest.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
const mockDelete = jest.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
const from = jest.fn((table: string) => ({
  ...makeQuery((tables[table] as unknown[]) ?? []),
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ from }) }));

import { fetchRoutes } from '@/lib/sync';

beforeEach(() => { mockInsert.mockClear(); for (const k in tables) delete tables[k]; });

describe('fetchRoutes', () => {
  test('assembla routes + completions + username creatore', async () => {
    tables['routes'] = [{
      id: 'r1', sort_index: 0, updated_at: '2026-06-05T00:00:00Z', created_at: '2026-06-01T00:00:00Z',
      created_by: 'm1', data: { name: 'Monte X', waypoints: [], legs: [], notes: 'bella', metrics: { distanceKm: 5 } },
    }];
    tables['completions'] = [{ id: 'c1', route_id: 'r1', created_by: 'm1', person: 'Gio', date: '2026-05-01', duration_minutes: 120, notes: '' }];
    tables['members'] = [{ id: 'm1', username: 'gio' }];
    const routes = await fetchRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].id).toBe('r1');
    expect(routes[0].name).toBe('Monte X');
    expect(routes[0].notes).toBe('bella');
    expect(routes[0].createdByUsername).toBe('gio');
    expect(routes[0].completions).toHaveLength(1);
    expect(routes[0].completions![0].personName).toBe('Gio');
    expect(routes[0].completions![0].durationMinutes).toBe(120);
  });
});
```
> Nota: il mock della catena Supabase è semplificato (thenable). Se l'implementazione usa forme diverse (`.select('*').order(...)`), adatta il mock di conseguenza mantenendo gli assert.

- [ ] **Step 2: Esegui (fallisce)** — `npm test -- sync`.

- [ ] **Step 3: Implementa `src/lib/sync.ts`**
```ts
import { getSupabase } from './supabase';
import type { Itinerary, RouteCompletion } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteRow { id: string; data: Record<string, unknown>; created_by: string; sort_index: number; created_at: string; updated_at: string; }
interface CompletionRow { id: string; route_id: string; created_by: string; person: string; date: string; duration_minutes: number | null; notes: string; }

function mapCompletion(r: CompletionRow): RouteCompletion {
  return {
    id: r.id,
    personName: r.person,
    date: r.date,
    durationMinutes: r.duration_minutes ?? undefined,
    notes: r.notes ?? '',
  };
}

/** Carica tutti i percorsi condivisi con completamenti e username del creatore. */
export async function fetchRoutes(): Promise<Itinerary[]> {
  const supabase = getSupabase();
  const [{ data: routeRows }, { data: compRows }, { data: memberRows }] = await Promise.all([
    supabase.from('routes').select('*').order('sort_index'),
    supabase.from('completions').select('*'),
    supabase.from('members').select('id, username'),
  ]);
  const members = new Map<string, string>((memberRows ?? []).map((m: { id: string; username: string }) => [m.id, m.username]));
  const compsByRoute = new Map<string, RouteCompletion[]>();
  for (const c of (compRows ?? []) as CompletionRow[]) {
    const list = compsByRoute.get(c.route_id) ?? [];
    list.push(mapCompletion(c));
    compsByRoute.set(c.route_id, list);
  }
  return ((routeRows ?? []) as RouteRow[]).map((row) => {
    const d = row.data ?? {};
    return {
      id: row.id,
      name: (d.name as string) ?? 'Senza nome',
      createdAt: (d.createdAt as string) ?? row.created_at,
      updatedAt: row.updated_at,
      waypoints: (d.waypoints as Itinerary['waypoints']) ?? [],
      legs: (d.legs as Itinerary['legs']) ?? [],
      notes: (d.notes as string) ?? '',
      metrics: d.metrics as Itinerary['metrics'],
      sortIndex: row.sort_index,
      completions: compsByRoute.get(row.id) ?? [],
      createdByUsername: members.get(row.created_by),
    };
  });
}

function dataPayload(it: Itinerary): Record<string, unknown> {
  return { name: it.name, createdAt: it.createdAt, waypoints: it.waypoints, legs: it.legs, notes: it.notes ?? '', metrics: it.metrics };
}

/** Salva (insert o update) un percorso. Aggiorna solo se posseduto dal membro; altrimenti
 *  crea una nuova copia di proprietà del membro. Ritorna l'id (uuid) del percorso nel cloud. */
export async function saveRouteToCloud(it: Itinerary, memberId: string): Promise<string> {
  const supabase = getSupabase();
  if (UUID_RE.test(it.id)) {
    const { data: row } = await supabase.from('routes').select('id, created_by').eq('id', it.id).maybeSingle();
    if (row && (row as { created_by: string }).created_by === memberId) {
      const { error } = await supabase.from('routes').update({ data: dataPayload(it), updated_at: new Date().toISOString() }).eq('id', it.id);
      if (error) throw new Error(error.message);
      return it.id;
    }
  }
  // insert nuovo (id generato lato client per poterlo restituire subito)
  const id = crypto.randomUUID();
  const { data: maxRows } = await supabase.from('routes').select('sort_index').order('sort_index', { ascending: false });
  const maxSort = (maxRows && maxRows[0] ? (maxRows[0] as { sort_index: number }).sort_index : -1);
  const { error } = await supabase.from('routes').insert({ id, data: dataPayload(it), created_by: memberId, sort_index: maxSort + 1 });
  if (error) throw new Error(error.message);
  return id;
}

export async function deleteRoute(id: string): Promise<void> {
  const { error } = await getSupabase().from('routes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateRouteNotes(id: string, notes: string): Promise<void> {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('routes').select('data').eq('id', id).maybeSingle();
  const data = ((row as { data?: Record<string, unknown> } | null)?.data) ?? {};
  const { error } = await supabase.from('routes').update({ data: { ...data, notes }, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderRoutes(orderedIds: string[]): Promise<void> {
  const supabase = getSupabase();
  // aggiornamenti sequenziali del sort_index
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('routes').update({ sort_index: i }).eq('id', orderedIds[i]);
    if (error) throw new Error(error.message);
  }
}

export async function addCompletion(routeId: string, memberId: string, c: Omit<RouteCompletion, 'id'>): Promise<void> {
  const { error } = await getSupabase().from('completions').insert({
    route_id: routeId, created_by: memberId, person: c.personName, date: c.date,
    duration_minutes: c.durationMinutes ?? null, notes: c.notes ?? '',
  });
  if (error) throw new Error(error.message);
}

export async function updateCompletion(completionId: string, patch: Partial<RouteCompletion>): Promise<void> {
  const upd: Record<string, unknown> = {};
  if (patch.personName !== undefined) upd.person = patch.personName;
  if (patch.date !== undefined) upd.date = patch.date;
  if (patch.durationMinutes !== undefined) upd.duration_minutes = patch.durationMinutes ?? null;
  if (patch.notes !== undefined) upd.notes = patch.notes;
  const { error } = await getSupabase().from('completions').update(upd).eq('id', completionId);
  if (error) throw new Error(error.message);
}

export async function deleteCompletion(completionId: string): Promise<void> {
  const { error } = await getSupabase().from('completions').delete().eq('id', completionId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4:** `npm test -- sync` → PASS. `npx tsc --noEmit` → clean. (Adatta il mock della catena se necessario.)

- [ ] **Step 5: Commit**
```bash
git add src/lib/sync.ts src/__tests__/sync.test.ts
git commit -m "feat(sync): Supabase data access for routes/completions (phase 3)"
```

---

## Task 3: `routeLibraryStore` async su `lib/sync`

**Files:** Modify `src/stores/routeLibraryStore.ts`, Modify `src/__tests__/routeLibraryStore.test.ts`

- [ ] **Step 1: Riscrivi il test** mockando `@/lib/sync` (non più `@/lib/storage`) e `@/stores/authStore` per `memberId`.

`src/__tests__/routeLibraryStore.test.ts`:
```ts
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockFetch = jest.fn();
const mockDelete = jest.fn(async () => {});
const mockReorder = jest.fn(async () => {});
jest.mock('@/lib/sync', () => ({
  fetchRoutes: () => mockFetch(),
  deleteRoute: (id: string) => mockDelete(id),
  reorderRoutes: (ids: string[]) => mockReorder(ids),
  updateRouteNotes: jest.fn(async () => {}),
  saveRouteToCloud: jest.fn(async () => 'r1'),
  addCompletion: jest.fn(async () => {}),
  updateCompletion: jest.fn(async () => {}),
  deleteCompletion: jest.fn(async () => {}),
}));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ member: { id: 'm1' } }) } }));

import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import type { Itinerary } from '@/lib/types';

const mk = (id: string, name: string, sortIndex: number): Itinerary => ({
  id, name, createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [], sortIndex, completions: [],
});

beforeEach(() => {
  mockFetch.mockReset(); mockDelete.mockClear(); mockReorder.mockClear();
  useRouteLibraryStore.setState({ routes: [], selectedRouteId: null, sortMode: 'manual' });
});

describe('routeLibraryStore (cloud)', () => {
  test('refresh carica da fetchRoutes ordinato per sortIndex', async () => {
    mockFetch.mockResolvedValue([mk('1', 'B', 1), mk('2', 'A', 0)]);
    await useRouteLibraryStore.getState().refresh();
    expect(useRouteLibraryStore.getState().routes.map((r) => r.id)).toEqual(['2', '1']);
  });

  test('remove chiama deleteRoute e ricarica, azzera selezione', async () => {
    mockFetch.mockResolvedValue([]);
    useRouteLibraryStore.setState({ selectedRouteId: '1' });
    await useRouteLibraryStore.getState().remove('1');
    expect(mockDelete).toHaveBeenCalledWith('1');
    expect(useRouteLibraryStore.getState().selectedRouteId).toBeNull();
  });

  test('reorder chiama reorderRoutes e ricarica', async () => {
    mockFetch.mockResolvedValue([]);
    await useRouteLibraryStore.getState().reorder(['2', '1']);
    expect(mockReorder).toHaveBeenCalledWith(['2', '1']);
  });
});
```

- [ ] **Step 2: Esegui (fallisce)** — `npm test -- routeLibraryStore`.

- [ ] **Step 3: Riscrivi `src/stores/routeLibraryStore.ts`**

Sostituisci gli import e rendi le azioni async. `sortRoutes` invariato.
```ts
import { create } from 'zustand';
import type { Itinerary, RouteCompletion } from '../lib/types';
import {
  fetchRoutes, deleteRoute, reorderRoutes, updateRouteNotes,
  addCompletion as syncAddCompletion,
  updateCompletion as syncUpdateCompletion,
  deleteCompletion as syncDeleteCompletion,
} from '../lib/sync';
import { useAuthStore } from './authStore';

export type SortMode = 'manual' | 'name' | 'distance' | 'gain' | 'updated' | 'completions';

function sortRoutes(routes: Itinerary[], mode: SortMode): Itinerary[] { /* INVARIATO (vedi file attuale) */ }

interface RouteLibraryState {
  routes: Itinerary[];
  selectedRouteId: string | null;
  sortMode: SortMode;
  loading: boolean;
  refresh: () => Promise<void>;
  select: (id: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  reorder: (orderedIds: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  addCompletion: (routeId: string, c: Omit<RouteCompletion, 'id'>) => Promise<void>;
  updateCompletion: (routeId: string, completionId: string, patch: Partial<RouteCompletion>) => Promise<void>;
  deleteCompletion: (routeId: string, completionId: string) => Promise<void>;
  knownPeople: () => string[];
}

export const useRouteLibraryStore = create<RouteLibraryState>((set, get) => ({
  routes: [],
  selectedRouteId: null,
  sortMode: 'manual',
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const routes = await fetchRoutes();
      set({ routes: sortRoutes(routes, get().sortMode) });
    } finally {
      set({ loading: false });
    }
  },

  select: (id) => set({ selectedRouteId: id }),
  setSortMode: (mode) => set({ sortMode: mode, routes: sortRoutes(get().routes, mode) }),

  reorder: async (orderedIds) => {
    await reorderRoutes(orderedIds);
    await get().refresh();
    set({ sortMode: 'manual' });
  },

  remove: async (id) => {
    await deleteRoute(id);
    set((s) => ({ selectedRouteId: s.selectedRouteId === id ? null : s.selectedRouteId }));
    await get().refresh();
  },

  updateNotes: async (id, notes) => { await updateRouteNotes(id, notes); await get().refresh(); },

  addCompletion: async (routeId, c) => {
    const memberId = useAuthStore.getState().member?.id;
    if (!memberId) throw new Error('not_member');
    await syncAddCompletion(routeId, memberId, c);
    await get().refresh();
  },
  updateCompletion: async (routeId, completionId, patch) => { await syncUpdateCompletion(completionId, patch); await get().refresh(); },
  deleteCompletion: async (routeId, completionId) => { await syncDeleteCompletion(completionId); await get().refresh(); },

  knownPeople: () => {
    const seen = new Map<string, string>();
    for (const r of get().routes) for (const c of r.completions ?? []) {
      const n = c.personName.trim(); if (!n) continue;
      const k = n.toLowerCase(); if (!seen.has(k)) seen.set(k, n);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'it'));
  },
}));
```
(Copia il corpo reale di `sortRoutes` dal file attuale.)

- [ ] **Step 4:** `npm test -- routeLibraryStore` → PASS. `npx tsc --noEmit`.

- [ ] **Step 5: Commit**
```bash
git add src/stores/routeLibraryStore.ts src/__tests__/routeLibraryStore.test.ts
git commit -m "feat(sync): routeLibraryStore async over Supabase sync (phase 3)"
```

---

## Task 4: Save editor → cloud (solo membri) in `ItineraryHeader`

**Files:** Modify `src/components/panel/ItineraryHeader.tsx`

- [ ] **Step 1:** Sostituisci `saveItinerary` (localStorage) con `saveRouteToCloud`. Aggiungi selettori membership.

Import: aggiungi `import { saveRouteToCloud } from '@/lib/sync';` e `import { useAuthStore } from '@/stores/authStore';`. Rimuovi gli import non più usati di `loadItineraries`/`saveItinerary`/`isStorageNearLimit` se diventano inutilizzati (verifica con tsc).

Selettori nel componente:
```ts
  const member = useAuthStore((s) => s.member);
  const setItineraryId = useItineraryStore((s) => s.loadItinerary); // per reimpostare l'id dopo insert (vedi sotto)
```
> Per reimpostare l'`itineraryId` dopo un insert serve un setter. Se `itineraryStore` non espone `setItineraryId`, aggiungilo (azione `setItineraryId: (id) => set({ itineraryId: id })`). Aggiungilo allo store con un test minimo se assente.

Riscrivi `persist`/`handleSave`:
```ts
  const persist = async (name: string, notes: string | undefined) => {
    if (!member) return;
    const metrics = computeRouteMetrics(waypoints, legs, settings.pace?.factor ?? 1);
    const existing = useRouteLibraryStore.getState().routes.find((r) => r.id === itineraryId);
    const itinerary = {
      id: itineraryId, name, createdAt, updatedAt: new Date().toISOString(),
      waypoints: waypoints.map(({ validationState, ...wp }) => wp),
      legs: legs.map(slimLeg), metrics,
      notes: notes ?? existing?.notes ?? '',
    } as Parameters<typeof saveRouteToCloud>[0];
    try {
      const newId = await saveRouteToCloud(itinerary, member.id);
      if (newId !== itineraryId) useItineraryStore.getState().setItineraryId(newId);
      if (name !== itineraryName) setItineraryName(name);
      await useRouteLibraryStore.getState().refresh();
      toast.success('Percorso salvato nella libreria');
    } catch {
      toast.error('Errore nel salvataggio. Riprova quando sei online.');
    }
  };

  const handleSave = () => {
    if (!member) { toast.warning('Accedi alla libreria condivisa per salvare i percorsi'); return; }
    const existing = useRouteLibraryStore.getState().routes.find((r) => r.id === itineraryId);
    if (existing) persist(itineraryName || existing.name, undefined);
    else setShowSaveModal(true);
  };
```
Il pulsante "Salva" per non-membri: disabilitato con tooltip.
```tsx
        <button onClick={handleSave} disabled={!member}
          title={!member ? 'Accedi alla libreria condivisa per salvare' : undefined}
          className={member
            ? 'px-2.5 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-gray-950 font-semibold rounded-lg text-xs shadow-sm transition-all active:scale-[0.97] hover:from-green-400 hover:to-emerald-500'
            : 'px-2.5 py-1 bg-gray-700/60 text-gray-500 rounded-lg text-xs cursor-not-allowed'}
          aria-label="Salva itinerario">
          Salva
        </button>
```
(Mantieni Carica/Nuovo/Export/Import invariati. "Carica" continua ad aprire la Libreria.)

- [ ] **Step 2:** `npx tsc --noEmit` → clean (rimuovi import morti). `npm test` → aggiorna eventuali test che assumevano il salvataggio in localStorage.

- [ ] **Step 3: Commit**
```bash
git add src/components/panel/ItineraryHeader.tsx src/stores/itineraryStore.ts
git commit -m "feat(sync): editor Save publishes to cloud (members only) (phase 3)"
```

---

## Task 5: Componenti — async handling + known people

**Files:** Modify `src/components/panel/CompletionList.tsx`, `src/components/panel/RouteDetailCard.tsx`

- [ ] **Step 1: `CompletionList`** — `guard` async + known people dallo store:
```ts
  const knownPeople = useRouteLibraryStore((s) => s.knownPeople);
  // ... rimuovi import getKnownPeople da '@/lib/storage'
  const guard = async (fn: () => Promise<void>) => { try { await fn(); } catch { toast.error('Errore nel salvataggio. Riprova quando sei online.'); } };
```
Sostituisci `getKnownPeople()` con `knownPeople()` nelle due `CompletionForm`. I callback diventano async: `onSubmit={(c) => { void guard(() => addCompletion(route.id, c)); setAdding(false); }}` (le azioni dello store ora ritornano Promise).

- [ ] **Step 2: `RouteDetailCard`** — `handleNotesBlur` async:
```ts
  const handleNotesBlur = async () => {
    if (notes === (route.notes ?? '')) return;
    try { await updateNotes(route.id, notes); } catch { toast.error('Errore nel salvataggio. Riprova quando sei online.'); }
  };
```
(handleLoad/handleDelete: `remove` ora è async → `await remove(route.id)`.)

- [ ] **Step 3:** `npx tsc --noEmit` → clean. `npm test` → i test di `CompletionForm`/`RouteDetailCard`/`RouteList` mockano le azioni dello store: assicurati che ora ritornino Promise nei mock (o restino compatibili). Aggiorna dove serve.

- [ ] **Step 4: Commit**
```bash
git add src/components/panel/CompletionList.tsx src/components/panel/RouteDetailCard.tsx
git commit -m "feat(sync): async completion/notes handling + cloud-derived known people (phase 3)"
```

---

## Task 6: Verifica e2e (reale)

**Files:** nessuno (manuale).

- [ ] **Step 1:** Con membro autenticato (dalla Fase 2), crea un itinerario nell'editor (≥2 waypoint) e premi **Salva** → toast "Percorso salvato nella libreria".
- [ ] **Step 2:** Apri **Libreria** → il percorso compare nella lista. Verifica in Supabase `routes` (1 riga, `created_by` = tuo id).
- [ ] **Step 3:** Seleziona il percorso → aggiungi un **completamento** → verifica in `completions` (riga con `created_by` tuo, `person`, `date`).
- [ ] **Step 4:** Riordina/elimina un percorso → verifica `sort_index` aggiornato / riga rimossa.
- [ ] **Step 5:** (multi-utente, se possibile) registra un secondo membro su altro browser → vede gli stessi percorsi e completamenti.
- [ ] **Step 6:** Non-membro: il pulsante **Salva** è disabilitato con tooltip; Export JSON / Copia link restano funzionanti.

---

## Self-Review (esito)
**Copertura spec Fase 3:** sync cloud (routes+completions+username) → Task 2; store async last-write-wins/refresh → Task 3; Save membri-only → Task 4; async UI + known people → Task 5; verifica → Task 6; tipo creatore → Task 1. ✔

**Note/limiti:** scritture solo online (toast in errore); RLS limita update/delete di routes al creatore/admin → salvare un percorso altrui modificato crea una **copia** di proprietà del membro (saveRouteToCloud). `difficulty` nei completamenti arriva in **Fase 4** (colonna già presente, non scritta ora). localStorage resta per settings/quiz/validation (non toccati) e cache. Aggiornare i test esistenti che assumevano persistenza locale della libreria.
