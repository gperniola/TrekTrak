# Mobile Shell B — TASK-48 (library list ↔ detail views) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** On mobile (`<lg`), make the shared library show **either** the route list **or** the route detail (with a back affordance), instead of stacking the long `RouteDetailCard` under the list. Add a "show on map" shortcut. Desktop keeps list + detail stacked, unchanged.

**Architecture:** All changes live in `RouteLibrary.tsx` (the wrapper that renders `RouteList` + `RouteDetailCard`). Selection state is the existing `useRouteLibraryStore.selectedRouteId` / `select`. On mobile, when a route is selected we hide the list (`hidden lg:block`) and show a detail header (back + "show on map") above `RouteDetailCard`; the header is `lg:hidden` so desktop is untouched (list always visible, no header). "Show on map" uses `useUIStore.setMobileTab('map')` so the user can see the route preview on the map (the preview banner + `PreviewElevationProfile` already render when `mainView==='library' && previewRoute`, and `mainView` stays `'library'` while the map tab is active).

**Tech Stack:** Next.js 15 + TS + Zustand + Tailwind + Jest. Branch `develop`. Spec `backlog/docs/mobile-shell-B-design.md`. Depends on TASK-46/47 (landed).

---

## File Structure
- **Modify** `src/components/panel/RouteLibrary.tsx` — list/detail view split + mobile header.
- **Create** `src/__tests__/components/RouteLibrary.test.tsx`.

---

## Task 48.1: List ↔ detail split in RouteLibrary

**Files:**
- Modify: `src/components/panel/RouteLibrary.tsx`
- Test: `src/__tests__/components/RouteLibrary.test.tsx`

Current component:
```tsx
'use client';

import { RouteList } from './RouteList';
import { RouteDetailCard } from './RouteDetailCard';
import { LibraryAuthGate } from '@/components/auth/LibraryAuthGate';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';

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

- [ ] **Step 1: Write the failing test** — `src/__tests__/components/RouteLibrary.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';

// Isola RouteLibrary: mocka lista e dettaglio (testati altrove) e l'auth gate (passa i figli).
jest.mock('@/components/panel/RouteList', () => ({ RouteList: () => <div data-testid="route-list" /> }));
jest.mock('@/components/panel/RouteDetailCard', () => ({ RouteDetailCard: () => <div data-testid="route-detail" /> }));
jest.mock('@/components/auth/LibraryAuthGate', () => ({ LibraryAuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { RouteLibrary } from '@/components/panel/RouteLibrary';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useRouteLibraryStore.setState({ selectedRouteId: null });
  useUIStore.setState({ mobileTab: 'library', mainView: 'library' });
});

describe('RouteLibrary (TASK-48 list <-> detail)', () => {
  test('senza selezione mostra la lista e nessun pulsante Indietro', () => {
    render(<RouteLibrary />);
    expect(screen.getByTestId('route-list')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tutti i percorsi/i })).toBeNull();
  });

  test('con selezione mostra il dettaglio e il pulsante Indietro', () => {
    useRouteLibraryStore.setState({ selectedRouteId: 'r1' });
    render(<RouteLibrary />);
    expect(screen.getByTestId('route-detail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tutti i percorsi/i })).toBeInTheDocument();
  });

  test('Indietro deseleziona il percorso', () => {
    useRouteLibraryStore.setState({ selectedRouteId: 'r1' });
    render(<RouteLibrary />);
    fireEvent.click(screen.getByRole('button', { name: /tutti i percorsi/i }));
    expect(useRouteLibraryStore.getState().selectedRouteId).toBeNull();
  });

  test('"Sulla mappa" porta alla scheda Mappa', () => {
    useRouteLibraryStore.setState({ selectedRouteId: 'r1' });
    render(<RouteLibrary />);
    fireEvent.click(screen.getByRole('button', { name: /sulla mappa/i }));
    expect(useUIStore.getState().mobileTab).toBe('map');
  });
});
```

- [ ] **Step 2: Run, confirm FAIL** — `npx jest RouteLibrary --silent` (the back/"sulla mappa" buttons don't exist yet).

- [ ] **Step 3: Implement** — replace `RouteLibrary.tsx` with:

```tsx
'use client';

import { RouteList } from './RouteList';
import { RouteDetailCard } from './RouteDetailCard';
import { LibraryAuthGate } from '@/components/auth/LibraryAuthGate';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useUIStore } from '@/stores/uiStore';

export function RouteLibrary() {
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  const select = useRouteLibraryStore((s) => s.select);
  const setMobileTab = useUIStore((s) => s.setMobileTab);

  return (
    <LibraryAuthGate>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Lista: sempre su desktop; su mobile solo quando nessun percorso è selezionato. */}
        <div className={selectedId ? 'hidden lg:block' : undefined}>
          <RouteList />
        </div>
        {selectedId && (
          <>
            {/* Header del dettaglio — solo mobile (su desktop la lista resta affiancata sopra). */}
            <div className="lg:hidden flex items-center justify-between border-b border-gray-700">
              <button
                onClick={() => select(null)}
                className="flex items-center gap-1 px-3 min-h-[44px] text-sm text-green-400 hover:text-green-300"
                aria-label="Torna alla lista dei percorsi"
              >
                &larr; Tutti i percorsi
              </button>
              <button
                onClick={() => setMobileTab('map')}
                className="px-3 min-h-[44px] text-sm text-gray-300 hover:text-white"
                aria-label="Vedi il percorso sulla mappa"
              >
                Sulla mappa &#128506;&#65039;
              </button>
            </div>
            <RouteDetailCard key={selectedId} />
          </>
        )}
      </div>
    </LibraryAuthGate>
  );
}
```

- [ ] **Step 4: Run, confirm PASS** — `npx jest RouteLibrary --silent` → 4 passing.
- [ ] **Step 5: Full suite** — `npx jest --silent` → all green (expect 551).
- [ ] **Step 6: Build** — `npm run build` → ✓ Compiled successfully.
- [ ] **Step 7: Visual check (controller)** — mobile: Libreria → list; tap a route → detail with "← Tutti i percorsi" + "Sulla mappa"; back returns to list; "Sulla mappa" switches to Mappa tab showing the preview. Desktop: list + detail stacked as before, no extra header.

---

## Self-review notes (author)
- **Spec coverage (§6 #1):** list↔detail as separate mobile views (✓ list `hidden lg:block` when selected), explicit back (✓ "← Tutti i percorsi", `lg:hidden`), map-preview access (✓ "Sulla mappa" → `setMobileTab('map')`). Desktop unchanged (header is `lg:hidden`; list `lg:block` always). RouteDetailCard untouched.
- **Placeholders:** none.
- **Type consistency:** uses existing `selectedRouteId`/`select` and `setMobileTab` verbatim; touch targets `min-h-[44px]` (TASK-44).
