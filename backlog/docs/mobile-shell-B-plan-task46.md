# Mobile Shell B — TASK-46 (bottom navigation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile (`<lg`) navigation — dense 2-row top bar + hamburger + full-screen drawer — with a 3-tab bottom navigation (Mappa · Editor · Libreria) plus a single ⚙️ settings entry, leaving the desktop sidebar untouched.

**Architecture:** Add a mobile-only `mobileTab` state to `uiStore` (the single source of truth for the bottom nav), keeping the existing `mainView` (editor|library) in sync so all current `mainView`-driven logic (route preview, `RouteLibrary`, `LeftPanel` content) keeps working unchanged. A new `BottomNav` component drives `mobileTab`. `page.tsx` mobile layout is reworked: the map is always rendered; `LeftPanel` appears as a sheet above the map when the tab is Editor/Libreria; the hamburger, full-screen drawer, and the top-bar's second row (`ModeSwitch`) are removed on mobile. Learn/Track + tools stay inside `LeftPanel`'s editor header (dedup: `ModeSwitch` is no longer mounted in the top bar). The FAB for tools is TASK-47; until then tools remain reachable in the Editor panel — no broken intermediate state.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Zustand, Tailwind, Jest + Testing Library. Branch: `develop`. Spec: `backlog/docs/mobile-shell-B-design.md`.

**Out of scope (separate plans):** TASK-47 (tools speed-dial FAB), TASK-48 (library list↔detail views), TASK-49 (tap-friendly diary), TASK-44 (≥44px audit pass — applied opportunistically here for new controls).

---

## File Structure

- **Modify** `src/stores/uiStore.ts` — add `mobileTab` + `setMobileTab` (keeps `mainView` in sync).
- **Create** `src/components/panel/BottomNav.tsx` — 3-tab bottom navigation (mobile).
- **Modify** `src/app/page.tsx` — mobile layout: always-on map, `LeftPanel` as sheet driven by `mobileTab`, `BottomNav`, remove hamburger/drawer/top-bar row 2; keep slim top row (brand + search + ⚙️).
- **Create** `src/__tests__/uiStore.test.ts` *(or extend if present)* — `mobileTab` behavior.
- **Create** `src/__tests__/components/BottomNav.test.tsx` — render + switching.

Desktop path (`src/components/panel/LeftPanel.tsx` rendered in the `hidden lg:flex` sidebar) is **unchanged**; `MainViewSwitch` keeps working there.

---

## Task 46.1: `mobileTab` state in uiStore

**Files:**
- Modify: `src/stores/uiStore.ts`
- Test: `src/__tests__/uiStore.test.ts` (create if missing)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/uiStore.test.ts`:

```ts
import { describe, expect, test, beforeEach } from '@jest/globals';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useUIStore.setState({ mobileTab: 'map', mainView: 'editor' });
});

describe('uiStore.mobileTab', () => {
  test('default tab is map', () => {
    expect(useUIStore.getState().mobileTab).toBe('map');
  });

  test('setMobileTab(library) selects tab and syncs mainView', () => {
    useUIStore.getState().setMobileTab('library');
    expect(useUIStore.getState().mobileTab).toBe('library');
    expect(useUIStore.getState().mainView).toBe('library');
  });

  test('setMobileTab(editor) selects tab and syncs mainView', () => {
    useUIStore.getState().setMobileTab('editor');
    expect(useUIStore.getState().mainView).toBe('editor');
  });

  test('setMobileTab(map) does not change mainView', () => {
    useUIStore.setState({ mainView: 'library' });
    useUIStore.getState().setMobileTab('map');
    expect(useUIStore.getState().mobileTab).toBe('map');
    expect(useUIStore.getState().mainView).toBe('library');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest uiStore --silent`
Expected: FAIL — `mobileTab`/`setMobileTab` undefined.

- [ ] **Step 3: Implement in `src/stores/uiStore.ts`**

In the `UIState` interface, add after `mainView`:

```ts
  mobileTab: 'map' | 'editor' | 'library';
```

and in the actions section of the interface:

```ts
  setMobileTab: (tab: 'map' | 'editor' | 'library') => void;
```

In the store object, add to initial state (next to `mainView: 'editor',`):

```ts
  mobileTab: 'map',
```

and add the action (next to `setMainView`):

```ts
  // Bottom-nav tab (mobile only). 'map' lascia il pannello chiuso; editor/library
  // sincronizzano anche mainView così la logica esistente (preview, RouteLibrary,
  // LeftPanel) continua a funzionare senza modifiche.
  setMobileTab: (tab) => set(tab === 'map' ? { mobileTab: tab } : { mobileTab: tab, mainView: tab }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest uiStore --silent`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/uiStore.ts src/__tests__/uiStore.test.ts
git commit -m "feat(ux): add mobileTab state to uiStore for bottom nav (TASK-46)"
```

---

## Task 46.2: `BottomNav` component

**Files:**
- Create: `src/components/panel/BottomNav.tsx`
- Test: `src/__tests__/components/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/BottomNav.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';

// La libreria si aggiorna al passaggio di tab: mock per non toccare la rete.
jest.mock('@/lib/sync', () => ({ fetchRoutes: jest.fn(() => Promise.resolve([])) }));

import { BottomNav } from '@/components/panel/BottomNav';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useUIStore.setState({ mobileTab: 'map', mainView: 'editor' });
});

describe('BottomNav', () => {
  test('mostra le tre schede', () => {
    render(<BottomNav />);
    expect(screen.getByRole('tab', { name: /mappa/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /editor/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });

  test('cliccare una scheda aggiorna mobileTab', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('tab', { name: /editor/i }));
    expect(useUIStore.getState().mobileTab).toBe('editor');
  });

  test('la scheda attiva è segnata aria-selected', () => {
    useUIStore.setState({ mobileTab: 'library', mainView: 'library' });
    render(<BottomNav />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toHaveAttribute('aria-selected', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest BottomNav --silent`
Expected: FAIL — cannot resolve `@/components/panel/BottomNav`.

- [ ] **Step 3: Implement `src/components/panel/BottomNav.tsx`**

```tsx
'use client';

import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';

const TABS = [
  { key: 'map', label: 'Mappa', icon: '🗺️' },
  { key: 'editor', label: 'Editor', icon: '✏️' },
  { key: 'library', label: 'Libreria', icon: '📚' },
] as const;

/** Bottom navigation mobile (solo <lg). Desktop usa la sidebar fissa. */
export function BottomNav() {
  const mobileTab = useUIStore((s) => s.mobileTab);
  const setMobileTab = useUIStore((s) => s.setMobileTab);
  const refresh = useRouteLibraryStore((s) => s.refresh);

  const go = (key: 'map' | 'editor' | 'library') => {
    if (key === 'library') refresh();
    setMobileTab(key);
  };

  return (
    <nav
      className="lg:hidden flex border-t border-gray-700 bg-gray-900 shrink-0"
      role="tablist"
      aria-label="Navigazione principale"
    >
      {TABS.map((t) => {
        const active = mobileTab === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => go(t.key)}
            className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              active ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span aria-hidden="true" className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest BottomNav --silent`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/panel/BottomNav.tsx src/__tests__/components/BottomNav.test.tsx
git commit -m "feat(ux): BottomNav 3-tab mobile navigation (TASK-46)"
```

---

## Task 46.3: Wire the mobile layout in `page.tsx`

Rework the mobile branch of `src/app/page.tsx`: render the map always, show `LeftPanel` as a sheet when `mobileTab !== 'map'`, mount `BottomNav`, and remove the hamburger + full-screen drawer + the top bar's second row (`ModeSwitch`). Keep a slim top row (brand · 🔍 · ⚙️). Desktop branch (`hidden lg:flex` sidebar) is untouched.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read the current mobile layout**

Run: `sed -n '129,250p' src/app/page.tsx` (or open in editor). Confirm the structure: desktop sidebar (`hidden lg:flex`), right panel with mobile top bar (2 rows) + map + elevation, and the `{drawerOpen && (...)}` full-screen drawer.

- [ ] **Step 2: Import BottomNav and mobileTab**

At the import block add:

```tsx
import { BottomNav } from '@/components/panel/BottomNav';
```

In the component body, add near the other `useUIStore` selectors:

```tsx
  const mobileTab = useUIStore((s) => s.mobileTab);
```

- [ ] **Step 3: Replace the mobile top bar's second row (remove ModeSwitch from the top bar)**

In the mobile top bar block, delete the line that renders `<ModeSwitch />` as "Row 2" (around the `{/* Row 2: Mode switch (Learn / Track) */}` comment). The brand/search/settings row stays. (Learn/Track now lives in the Editor panel via `LeftPanel` → `ModeSwitch`, already rendered there.)

- [ ] **Step 4: Render LeftPanel as a mobile sheet driven by mobileTab**

Inside the map container (`{/* Map */}` block), after `<MapWrapper />`, add a sheet that overlays the lower part of the screen when a panel tab is active:

```tsx
          {/* Mobile panel sheet — shown when a panel tab is active (Editor/Libreria) */}
          {mobileTab !== 'map' && (
            <div className="lg:hidden absolute inset-x-0 bottom-0 top-0 z-[1100] bg-gray-950 flex flex-col">
              <LeftPanel className="w-full h-full" />
            </div>
          )}
```

(The sheet covers the map area while leaving the top row and bottom nav visible, because it's inside the map container which sits between them.)

- [ ] **Step 5: Remove the hamburger button and the full-screen drawer**

- In the top bar, replace the hamburger `<button … aria-label="Apri menu">☰</button>` with nothing (delete it); keep brand + the search/settings group. If the row becomes unbalanced, wrap brand on the left and the icon group on the right (already the case).
- Delete the entire `{drawerOpen && ( … )}` block (the full-screen drawer overlay) and its related `drawerRef`/focus-trap/`useBodyScrollLock(drawerOpen)` usage **only if** no longer referenced. (Leave `setDrawerOpen`/`drawerOpen` in the store; just stop using them here. A later cleanup task can remove dead store fields.)

- [ ] **Step 6: Mount BottomNav at the bottom of the mobile column**

Immediately after the elevation-profile block (the `<div className="h-[100px] lg:h-[120px] …">…</div>`), still inside the right-panel flex column, add:

```tsx
        <BottomNav />
```

- [ ] **Step 7: Make the ⚙️ a real settings entry**

The existing top-bar ⚙️ button already calls `setShowMapSettings(true)`. Keep it. (Consolidating map + tolerances + tutorial + info behind a single settings sheet is a small follow-up; for TASK-46 the gear opening Map Settings is acceptable and tolerances remain reachable from there or from the editor settings entry. Do NOT add a second settings entry.)

- [ ] **Step 8: Verify the full suite still passes**

Run: `npx jest --silent`
Expected: PASS. If `LeftPanel.test`/`MainViewSwitch.test` reference removed behavior, update them to the new structure (they should be unaffected — they render `LeftPanel`/`MainViewSwitch` directly, not `page.tsx`).

- [ ] **Step 9: Verify the production build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 10: Visual check on mobile viewport**

Start dev server (`npm run dev`) and, with a mobile viewport (390×844), confirm: bottom nav with 3 tabs; tapping Editor/Libreria slides the panel over the map; tapping Mappa shows the clean map; no hamburger, no full-screen drawer; Learn/Track present in the Editor panel header. (Use the chrome-devtools companion or a real phone.)

- [ ] **Step 11: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ux): mobile bottom-nav shell - map always-on, panel sheet, no hamburger/drawer (TASK-46)"
```

---

## Task 46.4: Preserve invite flow + first-login landing

The v0.9.1 fix opened the drawer on the Library at first mobile login (no username). With the drawer gone, the equivalent is selecting the **Libreria** tab.

**Files:**
- Modify: `src/app/page.tsx` (the onboarding effect added in v0.9.1)

- [ ] **Step 1: Update the first-login effect**

Find the effect with `onboardingDrawerShown` (added v0.9.1). Replace the body so that, on mobile, instead of `setDrawerOpen(true)` it selects the Library tab:

```tsx
  const onboardingShown = useRef(false);
  useEffect(() => {
    if (onboardingShown.current || authLoading) return;
    if (authSession && !isMember) {
      onboardingShown.current = true;
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        useUIStore.getState().setMobileTab('library');
      }
    }
  }, [authLoading, authSession, isMember]);
```

- [ ] **Step 2: Verify the InviteModal still shows**

Confirm the `{!authLoading && justInvited && !authSession && <InviteModal />}` line is unchanged and renders over the new shell (the modal is `z-[1200]`, above the panel sheet `z-[1100]`).

- [ ] **Step 3: Run tests + build**

Run: `npx jest --silent` then `npm run build`
Expected: PASS / compiled.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix(ux): first mobile login lands on Library tab in new shell (TASK-46)"
```

---

## Task 46.5: Mark task done + housekeeping

- [ ] **Step 1:** Set `status: Done` in `backlog/tasks/task-46 - B-bottom-navigation-mobile.md`.
- [ ] **Step 2:** If `drawerOpen`/`setDrawerOpen` are now unused anywhere (grep), note it for a follow-up cleanup (do not remove store fields in this task to avoid touching unrelated tests).

Run: `npx grep -rn "drawerOpen" src` → record findings in the commit message if any remain.

- [ ] **Step 3: Commit**

```bash
git add "backlog/tasks/task-46 - B-bottom-navigation-mobile.md"
git commit -m "docs(backlog): mark TASK-46 done"
```

---

## Self-review notes (author)

- **Spec coverage:** bottom nav (✓ 46.2/46.3), map always-on (✓ 46.3), Learn/Track in Editor header (✓ — stays in `LeftPanel`/`ModeSwitch`, removed from top bar in 46.3 step 3), single ⚙️ (✓ 46.3 step 7), dedup `ModeSwitch` (✓ removed from top bar), invite/first-login preserved (✓ 46.4). FAB tools, library list↔detail, tap-friendly diary, full ≥44px pass → **separate plans** (47/48/49/44), as scoped.
- **No placeholders:** store and component code is complete; `page.tsx` steps reference concrete existing anchors (comments/labels present in the current file).
- **Type consistency:** `mobileTab` union `'map'|'editor'|'library'` used identically in store, action, `BottomNav`, and `setMobileTab` calls.
