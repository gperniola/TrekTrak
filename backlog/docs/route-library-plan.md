# Libreria percorsi + diario completamenti — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare il salva/carica itinerari in una Libreria percorsi con lista numerata e ordinabile, anteprima read-only sulla mappa, scheda metriche, note e diario dei completamenti (chi, data, tempo, note).

**Architecture:** Si estende il modello `Itinerary` esistente (campi opzionali retrocompatibili) con una migration localStorage v2→v3. Un nuovo `routeLibraryStore` Zustand gestisce la lista persistita e la selezione, separato dall'editor (`itineraryStore`). Uno switch top-level (`uiStore.mainView`) commuta il pannello sinistro tra Editor e Libreria; in modalità Libreria la mappa mostra un layer read-only del percorso selezionato.

**Tech Stack:** Next.js 15 / React 18 / TypeScript, Zustand, React-Leaflet, @dnd-kit, Jest + Testing Library. Riferimento spec: `backlog/docs/route-library-design.md`.

---

## File Structure

**Nuovi:**
- `src/stores/routeLibraryStore.ts` — stato libreria (lista, selezione, sort, CRUD wrapper).
- `src/components/panel/MainViewSwitch.tsx` — toggle Editor↔Libreria.
- `src/components/panel/RouteLibrary.tsx` — contenitore vista Libreria.
- `src/components/panel/RouteList.tsx` — lista numerata drag-sortable + sort-by.
- `src/components/panel/RouteDetailCard.tsx` — scheda metriche + note + azioni.
- `src/components/panel/CompletionList.tsx` — diario completamenti.
- `src/components/panel/CompletionForm.tsx` — form add/edit completamento.
- `src/components/panel/SaveRouteModal.tsx` — modal primo salvataggio (titolo+note).
- `src/components/map/PreviewRouteLayer.tsx` — render read-only del percorso selezionato.

**Modificati:** `src/lib/types.ts`, `src/lib/calculations.ts`, `src/lib/storage.ts`, `src/stores/uiStore.ts`, `src/components/panel/LeftPanel.tsx`, `src/components/panel/ItineraryHeader.tsx`, `src/components/map/InteractiveMap.tsx`, `src/components/map/ElevationProfile.tsx`.

**Rimosso:** `src/components/panel/SavedItinerariesModal.tsx`.

---

## Task 1: Tipi + `computeRouteMetrics`

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/calculations.ts`
- Test: `src/__tests__/calculations.test.ts`

- [ ] **Step 1: Aggiungi i tipi in `types.ts`**

Dopo l'interfaccia `Itinerary` (riga ~76) aggiungi:

```ts
export interface RouteCompletion {
  id: string;
  personName: string;
  date: string;              // ISO "YYYY-MM-DD"
  durationMinutes?: number;  // tempo impiegato (opzionale)
  notes: string;
}

export interface RouteMetrics {
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  minAltitude: number | null;
  maxAltitude: number | null;
  avgSlope: number;          // % media pesata sulla distanza
  maxSlope: number;          // % max pendenza di tratta
  estimatedTimeMin: number;  // stima Munter totale
}
```

E aggiungi i 4 campi opzionali all'interfaccia `Itinerary`:

```ts
export interface Itinerary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  waypoints: Waypoint[];
  legs: Leg[];
  notes?: string;
  completions?: RouteCompletion[];
  metrics?: RouteMetrics;
  sortIndex?: number;
}
```

- [ ] **Step 2: Scrivi il test di `computeRouteMetrics`**

In `src/__tests__/calculations.test.ts` aggiungi (importa `computeRouteMetrics` in cima):

```ts
import { computeRouteMetrics } from '../lib/calculations';
import type { Waypoint, Leg } from '../lib/types';

describe('computeRouteMetrics', () => {
  const wp = (id: string, altitude: number | null): Waypoint => ({
    id, name: id, lat: 45, lon: 9, altitude, order: 0,
  });
  const leg = (distance: number, gain: number, loss: number): Leg => ({
    id: `${distance}-${gain}-${loss}`, fromWaypointId: 'a', toWaypointId: 'b',
    distance, elevationGain: gain, elevationLoss: loss, azimuth: 0,
  });

  test('sums distance, gain, loss across legs', () => {
    const m = computeRouteMetrics([wp('a', 100), wp('b', 200)], [leg(2, 100, 0), leg(3, 50, 80)]);
    expect(m.distanceKm).toBeCloseTo(5);
    expect(m.elevationGain).toBe(150);
    expect(m.elevationLoss).toBe(80);
  });

  test('min/max altitude from waypoints', () => {
    const m = computeRouteMetrics([wp('a', 100), wp('b', 350), wp('c', 80)], []);
    expect(m.minAltitude).toBe(80);
    expect(m.maxAltitude).toBe(350);
  });

  test('min/max altitude null when no altitudes', () => {
    const m = computeRouteMetrics([wp('a', null)], []);
    expect(m.minAltitude).toBeNull();
    expect(m.maxAltitude).toBeNull();
  });

  test('avgSlope is distance-weighted, recomputed (ignores stripped leg.slope)', () => {
    // leg1: slope = max(100,0)/(2000)*100 = 5%; leg2: max(0,80)/(2000)*100 = 4%
    // weighted = (5*2 + 4*2)/4 = 4.5
    const m = computeRouteMetrics([], [leg(2, 100, 0), leg(2, 0, 80)]);
    expect(m.avgSlope).toBeCloseTo(4.5);
    expect(m.maxSlope).toBeCloseTo(5);
  });

  test('handles zero total distance without NaN', () => {
    const m = computeRouteMetrics([], [leg(0, 0, 0)]);
    expect(m.avgSlope).toBe(0);
    expect(m.estimatedTimeMin).toBe(0);
  });

  test('includes altitudes from leg elevationProfile when present', () => {
    const l = leg(2, 100, 0);
    l.elevationProfile = [{ distance: 0, altitude: 90 }, { distance: 2, altitude: 410 }];
    const m = computeRouteMetrics([wp('a', 100)], [l]);
    expect(m.minAltitude).toBe(90);
    expect(m.maxAltitude).toBe(410);
  });
});
```

- [ ] **Step 3: Esegui il test (deve fallire)**

Run: `npm test -- calculations`
Expected: FAIL — `computeRouteMetrics is not a function`.

- [ ] **Step 4: Implementa `computeRouteMetrics` in `calculations.ts`**

In fondo a `src/lib/calculations.ts` (usa `calculateSlope`/`calculateMunterTime` già nel file):

```ts
import type { RouteMetrics } from './types';

/**
 * Snapshot delle metriche aggregate di un percorso.
 * Ricalcola pendenza e tempo internamente (i campi derivati leg.slope/leg.estimatedTime
 * vengono eliminati nei dati persistiti, quindi non vanno letti).
 */
export function computeRouteMetrics(
  waypoints: Waypoint[],
  legs: Leg[],
  paceFactor: number = 1
): RouteMetrics {
  let distanceKm = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let estimatedTimeMin = 0;
  let maxSlope = 0;
  let slopeDistSum = 0; // Σ(slope·dist)
  let distSum = 0;      // Σ dist

  for (const leg of legs) {
    const d = leg.distance ?? 0;
    const g = leg.elevationGain ?? 0;
    const l = leg.elevationLoss ?? 0;
    distanceKm += d;
    elevationGain += g;
    elevationLoss += l;
    estimatedTimeMin += calculateMunterTime(d, g, l, paceFactor);
    const slope = calculateSlope(d, g, l);
    if (slope > maxSlope) maxSlope = slope;
    if (d > 0) { slopeDistSum += slope * d; distSum += d; }
  }

  const altitudes: number[] = [];
  for (const wp of waypoints) {
    if (wp.altitude != null) altitudes.push(wp.altitude);
  }
  for (const leg of legs) {
    if (leg.elevationProfile) {
      for (const p of leg.elevationProfile) {
        if (Number.isFinite(p.altitude)) altitudes.push(p.altitude);
      }
    }
  }

  return {
    distanceKm,
    elevationGain: Math.round(elevationGain),
    elevationLoss: Math.round(elevationLoss),
    minAltitude: altitudes.length ? Math.round(Math.min(...altitudes)) : null,
    maxAltitude: altitudes.length ? Math.round(Math.max(...altitudes)) : null,
    avgSlope: distSum > 0 ? slopeDistSum / distSum : 0,
    maxSlope,
    estimatedTimeMin,
  };
}
```

- [ ] **Step 5: Esegui i test (devono passare)**

Run: `npm test -- calculations`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/calculations.ts src/__tests__/calculations.test.ts
git commit -m "feat(library): add RouteCompletion/RouteMetrics types and computeRouteMetrics"
```

---

## Task 2: Storage schema v3 — migration + validatori

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/__tests__/storage.test.ts`

- [ ] **Step 1: Scrivi i test di migration e validazione**

In `src/__tests__/storage.test.ts` aggiungi (in fondo, riusando `localStorageMock` già definito):

```ts
describe('schema v3 migration and validation', () => {
  test('loadItineraries keeps old itineraries lacking new fields', () => {
    localStorage.setItem('trektrak_schema_version', '2');
    localStorage.setItem('trektrak_itineraries', JSON.stringify([
      { id: '1', name: 'Old', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [] },
    ]));
    const loaded = loadItineraries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].completions ?? []).toEqual([]);
  });

  test('migration v2->v3 backfills notes, completions, sortIndex, metrics', () => {
    localStorage.setItem('trektrak_schema_version', '2');
    localStorage.setItem('trektrak_itineraries', JSON.stringify([
      { id: 'a', name: 'A', createdAt: 'x', updatedAt: 'x',
        waypoints: [{ id: 'w1', name: 'w1', lat: 45, lon: 9, altitude: 100, order: 0 }],
        legs: [] },
    ]));
    loadItineraries();
    const raw = JSON.parse(localStorage.getItem('trektrak_itineraries')!);
    expect(raw[0].notes).toBe('');
    expect(raw[0].completions).toEqual([]);
    expect(raw[0].sortIndex).toBe(0);
    expect(raw[0].metrics.minAltitude).toBe(100);
    expect(localStorage.getItem('trektrak_schema_version')).toBe('3');
  });

  test('filters malformed completions on load', () => {
    localStorage.setItem('trektrak_schema_version', '3');
    localStorage.setItem('trektrak_itineraries', JSON.stringify([
      { id: '1', name: 'X', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [],
        completions: [
          { id: 'c1', personName: 'Gio', date: '2026-01-01', notes: 'ok' },
          { id: 'c2', date: '2026-01-02' }, // missing personName/notes -> dropped
          'garbage',
        ] },
    ]));
    const loaded = loadItineraries();
    expect(loaded[0].completions).toHaveLength(1);
    expect(loaded[0].completions![0].id).toBe('c1');
  });
});
```

- [ ] **Step 2: Esegui i test (devono fallire)**

Run: `npm test -- storage`
Expected: FAIL — `sortIndex`/`metrics` undefined, completions non filtrati.

- [ ] **Step 3: Bump versione e aggiungi la migration**

In `src/lib/storage.ts`: cambia `export const SCHEMA_VERSION = 2;` → `= 3;`.

Aggiungi import in cima: `import { computeRouteMetrics } from './calculations';`

Nel registry `migrations` aggiungi la chiave `2`:

```ts
  2: () => {
    try {
      const raw = localStorage.getItem(KEYS.itineraries);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const migrated = parsed.map((it: unknown, idx: number) => {
        if (!it || typeof it !== 'object') return it;
        const item = it as Record<string, unknown>;
        if (typeof item.notes !== 'string') item.notes = '';
        if (!Array.isArray(item.completions)) item.completions = [];
        if (typeof item.sortIndex !== 'number') item.sortIndex = idx;
        if (item.metrics == null && Array.isArray(item.waypoints) && Array.isArray(item.legs)) {
          item.metrics = computeRouteMetrics(item.waypoints as never, item.legs as never);
        }
        return item;
      });
      localStorage.setItem(KEYS.itineraries, JSON.stringify(migrated));
    } catch {
      // ignore migration errors; validators filter corrupted data on load
    }
  },
```

- [ ] **Step 4: Aggiungi `isValidCompletion` e filtra in `loadItineraries`**

Prima di `loadItineraries`, aggiungi:

```ts
function isValidCompletion(item: unknown): boolean {
  if (item == null || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.personName === 'string' &&
    typeof rec.date === 'string' &&
    typeof rec.notes === 'string' &&
    (rec.durationMinutes === undefined ||
      (typeof rec.durationMinutes === 'number' && Number.isFinite(rec.durationMinutes)))
  );
}
```

Dentro `loadItineraries`, nel `.filter(...)`, dopo aver verificato waypoints/legs e prima di `return true;`, sanifica i completamenti malformati senza scartare l'itinerario:

```ts
        if (Array.isArray(rec.completions)) {
          rec.completions = (rec.completions as unknown[]).filter(isValidCompletion);
        }
```

(`rec` è già `Record<string, unknown>` nel filtro esistente — la mutazione è sull'oggetto che verrà restituito.)

- [ ] **Step 5: Esegui i test**

Run: `npm test -- storage`
Expected: PASS (inclusi i test esistenti).

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts src/__tests__/storage.test.ts
git commit -m "feat(library): storage schema v3 migration + completion validation"
```

---

## Task 3: Storage helpers (update/reorder/completion CRUD/known people)

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/__tests__/storage.test.ts`

- [ ] **Step 1: Scrivi i test**

In `src/__tests__/storage.test.ts` aggiungi gli import necessari in cima:

```ts
import {
  updateSavedItinerary, reorderSavedItineraries,
  addCompletion, updateCompletion, deleteCompletion, getKnownPeople,
} from '../lib/storage';
```

E i test:

```ts
describe('library helpers', () => {
  test('updateSavedItinerary patches notes', () => {
    saveItinerary(makeItinerary('1', 'A'));
    updateSavedItinerary('1', { notes: 'bella gita' });
    expect(loadItineraries()[0].notes).toBe('bella gita');
  });

  test('reorderSavedItineraries rewrites sortIndex', () => {
    saveItinerary({ ...makeItinerary('1', 'A'), sortIndex: 0 });
    saveItinerary({ ...makeItinerary('2', 'B'), sortIndex: 1 });
    reorderSavedItineraries(['2', '1']);
    const byId = Object.fromEntries(loadItineraries().map((r) => [r.id, r.sortIndex]));
    expect(byId['2']).toBe(0);
    expect(byId['1']).toBe(1);
  });

  test('addCompletion / updateCompletion / deleteCompletion', () => {
    saveItinerary(makeItinerary('1', 'A'));
    addCompletion('1', { personName: 'Gio', date: '2026-01-01', durationMinutes: 120, notes: '' });
    let c = loadItineraries()[0].completions!;
    expect(c).toHaveLength(1);
    const cid = c[0].id;
    updateCompletion('1', cid, { notes: 'fango' });
    expect(loadItineraries()[0].completions![0].notes).toBe('fango');
    deleteCompletion('1', cid);
    expect(loadItineraries()[0].completions).toHaveLength(0);
  });

  test('getKnownPeople dedupes case-insensitively and trims', () => {
    saveItinerary(makeItinerary('1', 'A'));
    addCompletion('1', { personName: ' Gio ', date: '2026-01-01', notes: '' });
    addCompletion('1', { personName: 'gio', date: '2026-01-02', notes: '' });
    addCompletion('1', { personName: 'Anna', date: '2026-01-03', notes: '' });
    const people = getKnownPeople();
    expect(people).toContain('Gio');
    expect(people).toContain('Anna');
    expect(people.filter((p) => p.toLowerCase() === 'gio')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Esegui i test (devono fallire)**

Run: `npm test -- storage`
Expected: FAIL — funzioni non esportate.

- [ ] **Step 3: Implementa gli helper in `storage.ts`**

In fondo a `src/lib/storage.ts` aggiungi (riusa `loadItineraries`; importa `RouteCompletion` dai types):

```ts
import type { RouteCompletion } from './types';

function persistAll(all: Itinerary[]): void {
  try {
    localStorage.setItem(KEYS.itineraries, JSON.stringify(all));
  } catch {
    throw new Error('Spazio di archiviazione esaurito');
  }
}

export function updateSavedItinerary(id: string, patch: Partial<Itinerary>): void {
  const all = loadItineraries();
  const idx = all.findIndex((it) => it.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  persistAll(all);
}

export function reorderSavedItineraries(orderedIds: string[]): void {
  const all = loadItineraries();
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  for (const it of all) {
    const r = rank.get(it.id);
    if (r !== undefined) it.sortIndex = r;
  }
  persistAll(all);
}

function completionId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function addCompletion(routeId: string, c: Omit<RouteCompletion, 'id'>): void {
  const all = loadItineraries();
  const it = all.find((r) => r.id === routeId);
  if (!it) return;
  it.completions = [...(it.completions ?? []), { ...c, id: completionId() }];
  it.updatedAt = new Date().toISOString();
  persistAll(all);
}

export function updateCompletion(routeId: string, completionId: string, patch: Partial<RouteCompletion>): void {
  const all = loadItineraries();
  const it = all.find((r) => r.id === routeId);
  if (!it || !it.completions) return;
  it.completions = it.completions.map((c) => (c.id === completionId ? { ...c, ...patch, id: c.id } : c));
  it.updatedAt = new Date().toISOString();
  persistAll(all);
}

export function deleteCompletion(routeId: string, completionId: string): void {
  const all = loadItineraries();
  const it = all.find((r) => r.id === routeId);
  if (!it || !it.completions) return;
  it.completions = it.completions.filter((c) => c.id !== completionId);
  it.updatedAt = new Date().toISOString();
  persistAll(all);
}

export function getKnownPeople(): string[] {
  const all = loadItineraries();
  const seen = new Map<string, string>(); // lowercased -> first-seen display form
  for (const it of all) {
    for (const c of it.completions ?? []) {
      const name = c.personName.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'it'));
}
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/__tests__/storage.test.ts
git commit -m "feat(library): storage helpers for update/reorder/completion CRUD/known people"
```

---

## Task 4: `uiStore.mainView`

**Files:**
- Modify: `src/stores/uiStore.ts`
- Test: `src/__tests__/components/setupComponentTests.ts` non serve; test inline opzionale.

- [ ] **Step 1: Aggiungi `mainView` allo store**

In `src/stores/uiStore.ts`: nell'interfaccia `UIState` aggiungi:

```ts
  mainView: 'editor' | 'library';
  setMainView: (view: 'editor' | 'library') => void;
```

Nello stato iniziale aggiungi `mainView: 'editor',` e tra le azioni:

```ts
  setMainView: (view) => set({ mainView: view }),
```

- [ ] **Step 2: Verifica build/tipi**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/stores/uiStore.ts
git commit -m "feat(library): add mainView editor/library switch to uiStore"
```

---

## Task 5: `routeLibraryStore`

**Files:**
- Create: `src/stores/routeLibraryStore.ts`
- Test: `src/__tests__/routeLibraryStore.test.ts`

- [ ] **Step 1: Scrivi i test**

Crea `src/__tests__/routeLibraryStore.test.ts`:

```ts
import { describe, expect, test, beforeEach } from '@jest/globals';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import { useRouteLibraryStore } from '../stores/routeLibraryStore';
import { saveItinerary } from '../lib/storage';
import type { Itinerary } from '../lib/types';

const mk = (id: string, name: string, sortIndex: number): Itinerary => ({
  id, name, createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [], sortIndex,
});

beforeEach(() => {
  localStorageMock.clear();
  useRouteLibraryStore.setState({ routes: [], selectedRouteId: null, sortMode: 'manual' });
});

describe('routeLibraryStore', () => {
  test('refresh loads routes sorted by sortIndex when sortMode=manual', () => {
    saveItinerary(mk('1', 'B', 1));
    saveItinerary(mk('2', 'A', 0));
    useRouteLibraryStore.getState().refresh();
    expect(useRouteLibraryStore.getState().routes.map((r) => r.id)).toEqual(['2', '1']);
  });

  test('select sets selectedRouteId', () => {
    saveItinerary(mk('1', 'A', 0));
    const s = useRouteLibraryStore.getState();
    s.refresh();
    s.select('1');
    expect(useRouteLibraryStore.getState().selectedRouteId).toBe('1');
  });

  test('remove deletes and clears selection if it was selected', () => {
    saveItinerary(mk('1', 'A', 0));
    const s = useRouteLibraryStore.getState();
    s.refresh();
    s.select('1');
    s.remove('1');
    expect(useRouteLibraryStore.getState().routes).toHaveLength(0);
    expect(useRouteLibraryStore.getState().selectedRouteId).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)**

Run: `npm test -- routeLibraryStore`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementa lo store**

Crea `src/stores/routeLibraryStore.ts`:

```ts
import { create } from 'zustand';
import type { Itinerary, RouteCompletion } from '../lib/types';
import {
  loadItineraries, deleteItinerary, updateSavedItinerary, reorderSavedItineraries,
  addCompletion, updateCompletion, deleteCompletion,
} from '../lib/storage';

export type SortMode = 'manual' | 'name' | 'distance' | 'gain' | 'updated' | 'completions';

function sortRoutes(routes: Itinerary[], mode: SortMode): Itinerary[] {
  const r = [...routes];
  switch (mode) {
    case 'name': return r.sort((a, b) => a.name.localeCompare(b.name, 'it'));
    case 'distance': return r.sort((a, b) => (b.metrics?.distanceKm ?? 0) - (a.metrics?.distanceKm ?? 0));
    case 'gain': return r.sort((a, b) => (b.metrics?.elevationGain ?? 0) - (a.metrics?.elevationGain ?? 0));
    case 'updated': return r.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    case 'completions': return r.sort((a, b) => (b.completions?.length ?? 0) - (a.completions?.length ?? 0));
    case 'manual':
    default: return r.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  }
}

interface RouteLibraryState {
  routes: Itinerary[];
  selectedRouteId: string | null;
  sortMode: SortMode;
  refresh: () => void;
  select: (id: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  reorder: (orderedIds: string[]) => void;
  remove: (id: string) => void;
  updateNotes: (id: string, notes: string) => void;
  addCompletion: (routeId: string, c: Omit<RouteCompletion, 'id'>) => void;
  updateCompletion: (routeId: string, completionId: string, patch: Partial<RouteCompletion>) => void;
  deleteCompletion: (routeId: string, completionId: string) => void;
}

export const useRouteLibraryStore = create<RouteLibraryState>((set, get) => ({
  routes: [],
  selectedRouteId: null,
  sortMode: 'manual',

  refresh: () => set({ routes: sortRoutes(loadItineraries(), get().sortMode) }),
  select: (id) => set({ selectedRouteId: id }),
  setSortMode: (mode) => set({ sortMode: mode, routes: sortRoutes(get().routes, mode) }),

  reorder: (orderedIds) => {
    reorderSavedItineraries(orderedIds);
    set({ routes: sortRoutes(loadItineraries(), 'manual'), sortMode: 'manual' });
  },
  remove: (id) => {
    deleteItinerary(id);
    set((s) => ({
      routes: sortRoutes(loadItineraries(), s.sortMode),
      selectedRouteId: s.selectedRouteId === id ? null : s.selectedRouteId,
    }));
  },
  updateNotes: (id, notes) => {
    updateSavedItinerary(id, { notes });
    set((s) => ({ routes: sortRoutes(loadItineraries(), s.sortMode) }));
  },
  addCompletion: (routeId, c) => {
    addCompletion(routeId, c);
    set((s) => ({ routes: sortRoutes(loadItineraries(), s.sortMode) }));
  },
  updateCompletion: (routeId, completionId, patch) => {
    updateCompletion(routeId, completionId, patch);
    set((s) => ({ routes: sortRoutes(loadItineraries(), s.sortMode) }));
  },
  deleteCompletion: (routeId, completionId) => {
    deleteCompletion(routeId, completionId);
    set((s) => ({ routes: sortRoutes(loadItineraries(), s.sortMode) }));
  },
}));
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- routeLibraryStore`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/routeLibraryStore.ts src/__tests__/routeLibraryStore.test.ts
git commit -m "feat(library): routeLibraryStore with sort/select/CRUD wrappers"
```

---

## Task 6: Salvataggio arricchito + `SaveRouteModal`

**Files:**
- Create: `src/components/panel/SaveRouteModal.tsx`
- Modify: `src/components/panel/ItineraryHeader.tsx`

- [ ] **Step 1: Crea `SaveRouteModal.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';

export function SaveRouteModal({
  initialName, onConfirm, onClose,
}: {
  initialName: string;
  onConfirm: (name: string, notes: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200]" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-green-400 mb-4">Salva in libreria</h3>
        <label className="block text-xs text-gray-400 mb-1">Titolo</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)} maxLength={200}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm mb-3 focus:border-green-500 focus:outline-none"
          autoFocus
        />
        <label className="block text-xs text-gray-400 mb-1">Note (opzionali)</label>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm mb-4 focus:border-green-500 focus:outline-none resize-none"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600">Annulla</button>
          <button
            onClick={() => onConfirm(name.trim() || 'Senza nome', notes)}
            className="flex-1 py-2 bg-green-600 text-black rounded text-sm font-bold hover:bg-green-500"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Aggiorna il flusso di salvataggio in `ItineraryHeader.tsx`**

Aggiungi import in cima:

```ts
import { loadItineraries } from '@/lib/storage';
import { computeRouteMetrics } from '@/lib/calculations';
import { SaveRouteModal } from './SaveRouteModal';
import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
```

Aggiungi stato e selettori nel componente:

```ts
  const [showSaveModal, setShowSaveModal] = useState(false);
  const settings = useItineraryStore((s) => s.settings);
  const setMainView = useUIStore((s) => s.setMainView);
  const refreshLibrary = useRouteLibraryStore((s) => s.refresh);
```

Sostituisci `handleSave` con la logica: snapshot metriche, preserva i campi su re-salvataggio, apri il modal al primo salvataggio.

```ts
  const persist = (name: string, notes: string | undefined) => {
    const existing = loadItineraries().find((it) => it.id === itineraryId);
    const metrics = computeRouteMetrics(waypoints, legs, settings.pace?.factor ?? 1);
    const maxSort = loadItineraries().reduce((m, it) => Math.max(m, it.sortIndex ?? 0), -1);
    try {
      saveItinerary({
        id: itineraryId,
        name,
        createdAt,
        updatedAt: new Date().toISOString(),
        waypoints: waypoints.map(({ validationState, ...wp }) => wp),
        legs: legs.map(slimLeg),
        metrics,
        notes: notes ?? existing?.notes ?? '',
        completions: existing?.completions ?? [],
        sortIndex: existing?.sortIndex ?? maxSort + 1,
      });
      if (name !== itineraryName) setItineraryName(name);
      refreshLibrary();
      toast.success('Itinerario salvato');
      if (isStorageNearLimit()) {
        toast.warning('Spazio di archiviazione quasi esaurito. Esporta in JSON i vecchi itinerari.', 6000);
      }
    } catch {
      toast.error('Errore nel salvataggio. Lo spazio potrebbe essere pieno.');
    }
  };

  const handleSave = () => {
    const existing = loadItineraries().find((it) => it.id === itineraryId);
    if (existing) {
      persist(itineraryName || existing.name, undefined);
    } else {
      setShowSaveModal(true);
    }
  };
```

Cambia il pulsante **Carica** per aprire la Libreria:

```tsx
        <button onClick={() => setMainView('library')} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" aria-label="Apri libreria percorsi">
          Carica
        </button>
```

Rimuovi l'import e l'uso di `SavedItinerariesModal` e lo stato `showSaved`. In fondo al JSX, al posto di `{showSaved && <SavedItinerariesModal .../>}`, metti:

```tsx
      {showSaveModal && (
        <SaveRouteModal
          initialName={itineraryName}
          onClose={() => setShowSaveModal(false)}
          onConfirm={(name, notes) => { persist(name, notes); setShowSaveModal(false); }}
        />
      )}
```

- [ ] **Step 3: Verifica tipi e build**

Run: `npx tsc --noEmit`
Expected: nessun errore (l'import di `SavedItinerariesModal` non deve più esserci).

- [ ] **Step 4: Commit**

```bash
git add src/components/panel/SaveRouteModal.tsx src/components/panel/ItineraryHeader.tsx
git commit -m "feat(library): enriched save flow with metrics snapshot and SaveRouteModal"
```

---

## Task 7: `MainViewSwitch` + integrazione `LeftPanel`

**Files:**
- Create: `src/components/panel/MainViewSwitch.tsx`
- Create: `src/components/panel/RouteLibrary.tsx` (placeholder funzionante, riempito nei task 8-10)
- Modify: `src/components/panel/LeftPanel.tsx`

- [ ] **Step 1: Crea `MainViewSwitch.tsx`**

```tsx
'use client';

import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';

export function MainViewSwitch() {
  const mainView = useUIStore((s) => s.mainView);
  const setMainView = useUIStore((s) => s.setMainView);
  const refresh = useRouteLibraryStore((s) => s.refresh);

  const go = (view: 'editor' | 'library') => {
    if (view === 'library') refresh();
    setMainView(view);
  };

  return (
    <div className="flex border-b border-gray-700" role="tablist" aria-label="Vista principale">
      <button
        onClick={() => go('editor')} role="tab" aria-selected={mainView === 'editor'}
        className={`flex-1 py-2 text-xs font-medium ${mainView === 'editor' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
      >
        Editor
      </button>
      <button
        onClick={() => go('library')} role="tab" aria-selected={mainView === 'library'}
        className={`flex-1 py-2 text-xs font-medium ${mainView === 'library' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
      >
        Libreria
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Crea `RouteLibrary.tsx` (scheletro)**

```tsx
'use client';

import { RouteList } from './RouteList';
import { RouteDetailCard } from './RouteDetailCard';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';

export function RouteLibrary() {
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <RouteList />
      {selectedId && <RouteDetailCard />}
    </div>
  );
}
```

- [ ] **Step 3: Integra in `LeftPanel.tsx`**

Aggiungi import: `import { MainViewSwitch } from './MainViewSwitch';`, `import { RouteLibrary } from './RouteLibrary';`, `import { useUIStore } from '@/stores/uiStore';`.

Nel componente, in cima: `const mainView = useUIStore((s) => s.mainView);`

Inserisci `<MainViewSwitch />` subito dopo il titolo TrekTrak e prima di `<ModeSwitch />`. Avvolgi tutto il contenuto editor in una condizione:

```tsx
      <MainViewSwitch />
      {mainView === 'library' ? (
        <RouteLibrary />
      ) : (
        <>
          <ModeSwitch />
          <ItineraryHeader />
          <div className="flex border-b border-gray-700" role="tablist">
            {/* ...tab Modifica/Tabella esistenti... */}
          </div>
          {view === 'edit' ? <WaypointList /> : <ItineraryTable />}
          <SummaryBar />
          <ActionBar />
        </>
      )}
```

(Mantieni invariato il contenuto interno delle tab Modifica/Tabella già presente.)

- [ ] **Step 4: Verifica tipi/build**

Run: `npx tsc --noEmit`
Expected: errori solo per `RouteList`/`RouteDetailCard` non ancora creati → li crei nei task 8-9. Per sbloccare il build subito, crea due stub temporanei `export function RouteList(){return null;}` / `export function RouteDetailCard(){return null;}` e committa; verranno sostituiti.

> Nota per l'esecutore: se usi subagent-driven, esegui i task 7→8→9→10 in sequenza ravvicinata e committa il task 7 solo dopo aver creato gli stub, per non lasciare il build rotto.

- [ ] **Step 5: Commit**

```bash
git add src/components/panel/MainViewSwitch.tsx src/components/panel/RouteLibrary.tsx src/components/panel/LeftPanel.tsx
git commit -m "feat(library): MainViewSwitch + LeftPanel editor/library integration"
```

---

## Task 8: `RouteList` (numerata, drag-sortable, sort-by)

**Files:**
- Create: `src/components/panel/RouteList.tsx`
- Test: `src/__tests__/components/RouteList.test.tsx`

- [ ] **Step 1: Scrivi lo smoke test**

```tsx
import { describe, expect, test, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteList } from '@/components/panel/RouteList';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import type { Itinerary } from '@/lib/types';

const mk = (id: string, name: string, sortIndex: number): Itinerary => ({
  id, name, createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [], sortIndex,
  metrics: { distanceKm: 5, elevationGain: 300, elevationLoss: 200, minAltitude: 100,
    maxAltitude: 600, avgSlope: 6, maxSlope: 12, estimatedTimeMin: 120 },
  completions: [],
});

beforeEach(() => {
  useRouteLibraryStore.setState({
    routes: [mk('1', 'Primo', 0), mk('2', 'Secondo', 1)],
    selectedRouteId: null, sortMode: 'manual',
  });
});

describe('RouteList', () => {
  test('renders numbered routes', () => {
    render(<RouteList />);
    expect(screen.getByText('Primo')).toBeInTheDocument();
    expect(screen.getByText('Secondo')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('clicking a route selects it', () => {
    render(<RouteList />);
    fireEvent.click(screen.getByText('Primo'));
    expect(useRouteLibraryStore.getState().selectedRouteId).toBe('1');
  });

  test('empty state when no routes', () => {
    useRouteLibraryStore.setState({ routes: [] });
    render(<RouteList />);
    expect(screen.getByText(/nessun percorso/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)**

Run: `npm test -- RouteList`
Expected: FAIL — componente inesistente.

- [ ] **Step 3: Implementa `RouteList.tsx`**

Usa @dnd-kit (già in `package.json`) per il riordino verticale. Pattern: `DndContext` + `SortableContext` con `verticalListSortingStrategy`, ogni riga è un `useSortable`.

```tsx
'use client';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouteLibraryStore, type SortMode } from '@/stores/routeLibraryStore';
import type { Itinerary } from '@/lib/types';

const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Posizione', name: 'Nome', distance: 'Distanza',
  gain: 'Dislivello +', updated: 'Aggiornato', completions: 'Completamenti',
};

function Row({ route, index }: { route: Itinerary; index: number }) {
  const select = useRouteLibraryStore((s) => s.select);
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  const sortMode = useRouteLibraryStore((s) => s.sortMode);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: route.id, disabled: sortMode !== 'manual',
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const km = route.metrics?.distanceKm ?? 0;
  const gain = route.metrics?.elevationGain ?? 0;
  const completions = route.completions?.length ?? 0;

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${selectedId === route.id ? 'bg-green-900/40 border border-green-600' : 'bg-gray-900 hover:bg-gray-800'}`}
      onClick={() => select(route.id)}
    >
      <span className="text-xs text-gray-500 w-5 text-right tabular-nums">{index + 1}</span>
      {sortMode === 'manual' && (
        <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
          className="text-gray-600 hover:text-gray-300 cursor-grab touch-none" aria-label="Trascina per riordinare">⠿</button>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{route.name || 'Senza nome'}</div>
        <div className="text-[11px] text-gray-500">{km.toFixed(1)} km · +{gain}m · 🥾{completions}</div>
      </div>
    </div>
  );
}

export function RouteList() {
  const routes = useRouteLibraryStore((s) => s.routes);
  const sortMode = useRouteLibraryStore((s) => s.sortMode);
  const setSortMode = useRouteLibraryStore((s) => s.setSortMode);
  const reorder = useRouteLibraryStore((s) => s.reorder);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = routes.map((r) => r.id);
    const next = arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string));
    reorder(next);
  };

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-400">{routes.length} percorsi</span>
        <select
          value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="bg-gray-800 border border-gray-600 rounded text-xs px-1.5 py-1 text-gray-300"
          aria-label="Ordina per"
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
            <option key={m} value={m}>{SORT_LABELS[m]}</option>
          ))}
        </select>
      </div>
      {routes.length === 0 ? (
        <p className="text-gray-500 text-sm px-2 py-4">Nessun percorso salvato. Crea un itinerario e premi “Salva”.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={routes.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {routes.map((r, i) => <Row key={r.id} route={r} index={i} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- RouteList`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/panel/RouteList.tsx src/__tests__/components/RouteList.test.tsx
git commit -m "feat(library): numbered drag-sortable RouteList with sort-by"
```

---

## Task 9: `RouteDetailCard`

**Files:**
- Create: `src/components/panel/RouteDetailCard.tsx`
- Test: `src/__tests__/components/RouteDetailCard.test.tsx`

- [ ] **Step 1: Scrivi lo smoke test**

```tsx
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteDetailCard } from '@/components/panel/RouteDetailCard';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import type { Itinerary } from '@/lib/types';

const route: Itinerary = {
  id: '1', name: 'Monte Test', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [],
  notes: 'bella', sortIndex: 0, completions: [],
  metrics: { distanceKm: 8.4, elevationGain: 620, elevationLoss: 600, minAltitude: 800,
    maxAltitude: 1420, avgSlope: 7.4, maxSlope: 18, estimatedTimeMin: 215 },
};

beforeEach(() => {
  useRouteLibraryStore.setState({ routes: [route], selectedRouteId: '1', sortMode: 'manual' });
});

describe('RouteDetailCard', () => {
  test('renders metrics', () => {
    render(<RouteDetailCard />);
    expect(screen.getByText('Monte Test')).toBeInTheDocument();
    expect(screen.getByText(/8.4 km/)).toBeInTheDocument();
    expect(screen.getByText(/620/)).toBeInTheDocument();
    expect(screen.getByText(/1420/)).toBeInTheDocument();
  });

  test('Carica nell\'editor loads route and switches to editor view', () => {
    const loadSpy = jest.spyOn(useItineraryStore.getState(), 'loadItinerary');
    render(<RouteDetailCard />);
    fireEvent.click(screen.getByRole('button', { name: /carica nell'editor/i }));
    expect(useUIStore.getState().mainView).toBe('editor');
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)**

Run: `npm test -- RouteDetailCard`
Expected: FAIL.

- [ ] **Step 3: Implementa `RouteDetailCard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { exportItineraryJSON } from '@/lib/export-json';
import { formatTime } from '@/lib/format';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';
import { CompletionList } from './CompletionList';

export function RouteDetailCard() {
  const routes = useRouteLibraryStore((s) => s.routes);
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  const updateNotes = useRouteLibraryStore((s) => s.updateNotes);
  const remove = useRouteLibraryStore((s) => s.remove);
  const loadItinerary = useItineraryStore((s) => s.loadItinerary);
  const setMainView = useUIStore((s) => s.setMainView);
  const route = routes.find((r) => r.id === selectedId);
  const [notes, setNotes] = useState(route?.notes ?? '');

  if (!route) return null;
  const m = route.metrics;

  const handleLoad = async () => {
    const currentWps = useItineraryStore.getState().waypoints;
    if (currentWps.length > 0) {
      const ok = await appConfirm({
        title: 'Caricare questo percorso?',
        message: 'Le modifiche non salvate nell\'editor andranno perse.',
        confirmText: 'Carica',
      });
      if (!ok) return;
    }
    loadItinerary(route.id, route.name, route.waypoints, route.legs, route.createdAt);
    setMainView('editor');
  };

  const handleDelete = async () => {
    const ok = await appConfirm({
      title: 'Eliminare questo percorso?', message: 'L\'azione è irreversibile.',
      variant: 'error', confirmText: 'Elimina',
    });
    if (!ok) return;
    remove(route.id);
    toast.success('Percorso eliminato');
  };

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-gray-900 rounded px-2 py-1.5">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );

  return (
    <div className="border-t border-gray-700 p-3 space-y-3">
      <h3 className="text-base font-bold text-green-400">{route.name || 'Senza nome'}</h3>
      {m && (
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Distanza" value={`${m.distanceKm.toFixed(1)} km`} />
          <Stat label="Stima" value={formatTime(m.estimatedTimeMin)} />
          <Stat label="Dislivello +" value={`+${m.elevationGain} m`} />
          <Stat label="Dislivello -" value={`-${m.elevationLoss} m`} />
          <Stat label="Alt. min" value={m.minAltitude != null ? `${m.minAltitude} m` : '—'} />
          <Stat label="Alt. max" value={m.maxAltitude != null ? `${m.maxAltitude} m` : '—'} />
          <Stat label="Pend. media" value={`${m.avgSlope.toFixed(1)}%`} />
          <Stat label="Pend. max" value={`${m.maxSlope.toFixed(1)}%`} />
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Note del percorso</label>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (route.notes ?? '')) updateNotes(route.id, notes); }}
          rows={2} maxLength={2000} placeholder="Aggiungi note..."
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none resize-none"
        />
      </div>
      <CompletionList route={route} />
      <div className="flex gap-2">
        <button onClick={handleLoad} className="flex-1 py-2 bg-green-600 text-black rounded text-xs font-bold hover:bg-green-500">
          Carica nell&apos;editor
        </button>
        <button onClick={() => exportItineraryJSON(route)} className="px-3 py-2 bg-gray-700 rounded text-xs hover:bg-gray-600" aria-label="Esporta JSON">↓</button>
        <button onClick={handleDelete} className="px-3 py-2 bg-red-600 rounded text-xs hover:bg-red-500">Elimina</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- RouteDetailCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/panel/RouteDetailCard.tsx src/__tests__/components/RouteDetailCard.test.tsx
git commit -m "feat(library): RouteDetailCard with metrics, notes, load/export/delete"
```

---

## Task 10: `CompletionList` + `CompletionForm`

**Files:**
- Create: `src/components/panel/CompletionForm.tsx`
- Create: `src/components/panel/CompletionList.tsx`
- Test: `src/__tests__/components/CompletionForm.test.tsx`

- [ ] **Step 1: Scrivi lo smoke test del form**

```tsx
import { describe, expect, test, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompletionForm } from '@/components/panel/CompletionForm';

describe('CompletionForm', () => {
  test('requires a person name', () => {
    const onSubmit = jest.fn();
    render(<CompletionForm knownPeople={[]} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('submits with hours+minutes converted to total minutes', () => {
    const onSubmit = jest.fn();
    render(<CompletionForm knownPeople={[]} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/chi/i), { target: { value: 'Gio' } });
    fireEvent.change(screen.getByLabelText(/ore/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/minuti/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ personName: 'Gio', durationMinutes: 150 }));
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)**

Run: `npm test -- CompletionForm`
Expected: FAIL.

- [ ] **Step 3: Implementa `CompletionForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { RouteCompletion } from '@/lib/types';

export function CompletionForm({
  knownPeople, initial, onSubmit, onCancel,
}: {
  knownPeople: string[];
  initial?: RouteCompletion;
  onSubmit: (c: Omit<RouteCompletion, 'id'>) => void;
  onCancel: () => void;
}) {
  const [personName, setPersonName] = useState(initial?.personName ?? '');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(initial?.durationMinutes != null ? String(Math.floor(initial.durationMinutes / 60)) : '');
  const [minutes, setMinutes] = useState(initial?.durationMinutes != null ? String(initial.durationMinutes % 60) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const submit = () => {
    const name = personName.trim();
    if (!name) return;
    const h = parseInt(hours, 10);
    const mm = parseInt(minutes, 10);
    const total = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
    onSubmit({
      personName: name,
      date,
      durationMinutes: total > 0 ? total : undefined,
      notes: notes.trim(),
    });
  };

  return (
    <div className="bg-gray-900 rounded p-2 space-y-2">
      <div>
        <label className="block text-[10px] text-gray-500 uppercase" htmlFor="cf-person">Chi</label>
        <input id="cf-person" list="known-people" value={personName} onChange={(e) => setPersonName(e.target.value)}
          maxLength={120} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        <datalist id="known-people">{knownPeople.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor="cf-date">Data</label>
          <input id="cf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div className="w-16">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor="cf-hours">Ore</label>
          <input id="cf-hours" type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div className="w-16">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor="cf-min">Minuti</label>
          <input id="cf-min" type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Note aggiuntive..."
        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none resize-none" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 bg-gray-700 rounded text-xs hover:bg-gray-600">Annulla</button>
        <button onClick={submit} className="flex-1 py-1.5 bg-green-600 text-black rounded text-xs font-bold hover:bg-green-500">Salva</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implementa `CompletionList.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { Itinerary, RouteCompletion } from '@/lib/types';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { getKnownPeople } from '@/lib/storage';
import { formatTime } from '@/lib/format';
import { CompletionForm } from './CompletionForm';

function fmtDate(iso: string): string {
  const d = Date.parse(iso);
  return Number.isNaN(d) ? iso : new Date(d).toLocaleDateString('it-IT');
}

function deltaLabel(actual: number, estimate: number): string {
  const diff = Math.round(actual - estimate);
  const sign = diff > 0 ? '+' : '';
  return `stima ${formatTime(estimate)} → ${sign}${diff}m`;
}

export function CompletionList({ route }: { route: Itinerary }) {
  const addCompletion = useRouteLibraryStore((s) => s.addCompletion);
  const updateCompletion = useRouteLibraryStore((s) => s.updateCompletion);
  const deleteCompletion = useRouteLibraryStore((s) => s.deleteCompletion);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const completions = route.completions ?? [];
  const estimate = route.metrics?.estimatedTimeMin;

  const lastDate = completions.length
    ? completions.map((c) => c.date).sort().at(-1)
    : null;

  return (
    <div className="border-t border-gray-700 pt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">🥾 {completions.length} completament{completions.length === 1 ? 'o' : 'i'}{lastDate ? ` · ultima ${fmtDate(lastDate)}` : ''}</span>
        {!adding && editingId === null && (
          <button onClick={() => setAdding(true)} className="text-xs text-green-400 hover:text-green-300">+ Aggiungi</button>
        )}
      </div>

      {adding && (
        <CompletionForm
          knownPeople={getKnownPeople()}
          onCancel={() => setAdding(false)}
          onSubmit={(c) => { addCompletion(route.id, c); setAdding(false); }}
        />
      )}

      <div className="space-y-1">
        {completions.map((c: RouteCompletion) => (
          editingId === c.id ? (
            <CompletionForm key={c.id} knownPeople={getKnownPeople()} initial={c}
              onCancel={() => setEditingId(null)}
              onSubmit={(patch) => { updateCompletion(route.id, c.id, patch); setEditingId(null); }} />
          ) : (
            <div key={c.id} className="bg-gray-900 rounded px-2 py-1.5 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-medium">{c.personName}</span>
                  <span className="text-gray-500"> · {fmtDate(c.date)}</span>
                  {c.durationMinutes != null && (
                    <span className="text-gray-400"> · {formatTime(c.durationMinutes)}
                      {estimate != null && <span className="text-gray-600"> ({deltaLabel(c.durationMinutes, estimate)})</span>}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditingId(c.id)} className="text-gray-500 hover:text-gray-300" aria-label="Modifica completamento">✎</button>
                  <button onClick={() => deleteCompletion(route.id, c.id)} className="text-gray-500 hover:text-red-400" aria-label="Elimina completamento">✕</button>
                </div>
              </div>
              {c.notes && <div className="text-gray-500 mt-0.5">{c.notes}</div>}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Esegui i test**

Run: `npm test -- CompletionForm`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/panel/CompletionForm.tsx src/components/panel/CompletionList.tsx src/__tests__/components/CompletionForm.test.tsx
git commit -m "feat(library): completion diary (form + list) with autocomplete and real-vs-estimate"
```

---

## Task 11: `PreviewRouteLayer` + integrazione mappa + placeholder profilo

**Files:**
- Create: `src/components/map/PreviewRouteLayer.tsx`
- Modify: `src/components/map/InteractiveMap.tsx`
- Modify: `src/components/map/ElevationProfile.tsx`

- [ ] **Step 1: Studia i pattern esistenti**

Leggi `src/components/map/LegPolylines.tsx` e `src/lib/map-icons.ts` per riusare lo stile di polilinea e i marker numerati. Replica quegli stili nel preview (sola lettura, nessun handler di drag/click di editing).

- [ ] **Step 2: Implementa `PreviewRouteLayer.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Itinerary } from '@/lib/types';

function numberedIcon(n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="background:#16a34a;color:#000;border-radius:9999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #052e16">${n}</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

export function PreviewRouteLayer({ route }: { route: Itinerary }) {
  const map = useMap();
  const pts = route.waypoints
    .filter((w) => w.lat != null && w.lon != null)
    .map((w) => [w.lat as number, w.lon as number] as [number, number]);

  useEffect(() => {
    if (pts.length === 0) return;
    if (pts.length === 1) { map.setView(pts[0], 14); return; }
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id]);

  if (pts.length === 0) return null;

  return (
    <>
      {pts.length >= 2 && <Polyline positions={pts} pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.85 }} />}
      {pts.map((p, i) => <Marker key={i} position={p} icon={numberedIcon(i + 1)} interactive={false} />)}
    </>
  );
}
```

- [ ] **Step 3: Integra in `InteractiveMap.tsx`**

Aggiungi gli import:

```ts
import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { PreviewRouteLayer } from './PreviewRouteLayer';
```

Dentro il componente, leggi lo stato e renderizza condizionatamente:

```ts
  const mainView = useUIStore((s) => s.mainView);
  const selectedRouteId = useRouteLibraryStore((s) => s.selectedRouteId);
  const previewRoute = useRouteLibraryStore((s) => s.routes.find((r) => r.id === s.selectedRouteId));
  const libraryPreview = mainView === 'library' && selectedRouteId != null && previewRoute != null;
```

Avvolgi i layer di editing esistenti (waypoint markers, LegPolylines, ecc.) in `{!libraryPreview && ( ... )}` e aggiungi, dopo il `TileLayer`:

```tsx
        {libraryPreview && previewRoute && <PreviewRouteLayer route={previewRoute} />}
```

(I controlli mappa — tile, grid, hiking overlay — restano sempre montati.)

- [ ] **Step 4: Placeholder profilo in `ElevationProfile.tsx`**

In cima al render del componente, aggiungi un early-return quando si è in modalità Libreria:

```ts
import { useUIStore } from '@/stores/uiStore';
// ...
  const mainView = useUIStore((s) => s.mainView);
  if (mainView === 'library') {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-500 px-3 text-center">
        Profilo non disponibile per i percorsi salvati — vedi le metriche nella scheda.
      </div>
    );
  }
```

- [ ] **Step 5: Verifica build + esegui la suite mappa**

Run: `npx tsc --noEmit`
Run: `npm test -- InteractiveMap`
Expected: nessun errore di tipo; i test esistenti di InteractiveMap passano (in editor view il comportamento è invariato).

- [ ] **Step 6: Commit**

```bash
git add src/components/map/PreviewRouteLayer.tsx src/components/map/InteractiveMap.tsx src/components/map/ElevationProfile.tsx
git commit -m "feat(library): read-only map preview of selected route + profile placeholder"
```

---

## Task 12: Rimozione modale + banner mobile + cleanup

**Files:**
- Delete: `src/components/panel/SavedItinerariesModal.tsx`
- Modify: `src/app/page.tsx` (banner anteprima mobile)
- Modify: `src/components/panel/LeftPanel.tsx` (sostituzione stub, già fatta nel task 7)

- [ ] **Step 1: Elimina il file della modale**

```bash
git rm src/components/panel/SavedItinerariesModal.tsx
```

Verifica che non resti alcun import:

Run: `npm test -- LeftPanel` e cerca riferimenti con la ricerca del progetto a `SavedItinerariesModal`. Expected: nessun risultato.

- [ ] **Step 2: Banner anteprima su mobile in `page.tsx`**

Aggiungi import:

```ts
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
```

Nel componente `Home`:

```ts
  const mainView = useUIStore((s) => s.mainView);
  const setMainView = useUIStore((s) => s.setMainView);
  const previewRoute = useRouteLibraryStore((s) => s.routes.find((r) => r.id === s.selectedRouteId));
  const clearSelection = useRouteLibraryStore((s) => s.select);
```

Quando l'utente seleziona un percorso in Libreria su mobile, il drawer va chiuso per mostrare la mappa. Aggiungi un effetto che chiude il drawer quando cambia la selezione in modalità libreria:

```ts
  const selectedRouteId = useRouteLibraryStore((s) => s.selectedRouteId);
  useEffect(() => {
    if (mainView === 'library' && selectedRouteId) setDrawerOpen(false);
  }, [selectedRouteId, mainView, setDrawerOpen]);
```

Sopra la mappa (dentro il contenitore `flex-1 relative`), aggiungi il banner solo su mobile in modalità libreria:

```tsx
          {mainView === 'library' && previewRoute && (
            <div className="lg:hidden absolute top-2 left-2 right-2 z-[1000] bg-gray-900/95 border border-gray-700 rounded px-3 py-2 flex items-center justify-between text-xs">
              <span className="truncate text-gray-200">Anteprima: {previewRoute.name || 'Senza nome'}</span>
              <div className="flex gap-2 shrink-0 ml-2">
                <button onClick={() => setDrawerOpen(true)} className="text-green-400">Apri libreria</button>
                <button onClick={() => clearSelection(null)} className="text-gray-400">Chiudi</button>
              </div>
            </div>
          )}
```

- [ ] **Step 3: Esegui l'intera suite e il build**

Run: `npm test`
Run: `npm run build`
Expected: tutti i test passano; build senza errori.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(library): remove SavedItinerariesModal, add mobile preview banner"
```

---

## Self-Review (esito)

**Copertura spec:** A (tipi/metriche → Task 1; storage/migration → Task 2-3) · B (switch → Task 4/7; lista → Task 8; scheda → Task 9; diario → Task 10) · C (anteprima → Task 11; salvataggio → Task 6; mobile → Task 12) · D (test distribuiti in ogni task). ✔

**Consistenza tipi:** `RouteCompletion`/`RouteMetrics`/`Itinerary` (Task 1) usati identici in storage (2-3), store (5), componenti (6,9,10). Helper storage (3) → wrapper store (5) → UI (9,10). `computeRouteMetrics(waypoints, legs, paceFactor)` invocato con default 1 nella migration (2) e con `settings.pace?.factor` nel salvataggio (6). ✔

**Note operative:** Task 7 lascia il build temporaneamente dipendente dagli stub di `RouteList`/`RouteDetailCard` — eseguire 7→10 ravvicinati. Verificare che eventuali test esistenti di `ItineraryHeader`/`LeftPanel` che referenziano la vecchia modale vengano aggiornati nel Task 12.
