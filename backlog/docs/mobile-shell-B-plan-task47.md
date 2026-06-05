# Mobile Shell B — TASK-47 (map tools speed-dial FAB) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the map tools (compass / ruler / quiz) into a speed-dial FAB on the map for mobile (`<lg`), and hide the in-panel tools on mobile — keeping the desktop sidebar tools exactly as they are.

**Architecture:** A new `MapToolsFab` (mobile-only, `lg:hidden`) sits on the map and toggles the three tools via the existing `uiStore` actions (`toggleCompass/Ruler/Quiz`, which already enforce mutual exclusion). The tools `<div role="toolbar">` inside `ModeSwitch` is wrapped in `hidden lg:flex` so it shows only on desktop; `ModeSwitch` keeps Learn/Track always (in the Editor header). `page.tsx` renders `<MapToolsFab />` in the map container.

**Tech Stack:** Next.js 15 + TS + Zustand + Tailwind + Jest. Branch: `develop`. Spec: `backlog/docs/mobile-shell-B-design.md`. Depends on TASK-46 (shell) — already landed.

---

## File Structure
- **Create** `src/components/map/MapToolsFab.tsx` — speed-dial FAB (mobile).
- **Create** `src/__tests__/components/MapToolsFab.test.tsx`.
- **Modify** `src/components/panel/ModeSwitch.tsx` — wrap the tools toolbar in `hidden lg:flex` (desktop-only); Learn/Track unchanged.
- **Modify** `src/app/page.tsx` — render `<MapToolsFab />` inside the map container.

---

## Task 47.1: `MapToolsFab` component

**Files:**
- Create: `src/components/map/MapToolsFab.tsx`
- Test: `src/__tests__/components/MapToolsFab.test.tsx`

- [ ] **Step 1: Write the failing test** — `src/__tests__/components/MapToolsFab.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { MapToolsFab } from '@/components/map/MapToolsFab';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useUIStore.setState({ compassActive: false, rulerActive: false, quizActive: false });
});

describe('MapToolsFab', () => {
  test('di default mostra solo il FAB, i tool sono nascosti', () => {
    render(<MapToolsFab />);
    expect(screen.getByRole('button', { name: /strumenti mappa/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^bussola$/i })).toBeNull();
  });

  test('toccando il FAB si espandono i tre tool', () => {
    render(<MapToolsFab />);
    fireEvent.click(screen.getByRole('button', { name: /strumenti mappa/i }));
    expect(screen.getByRole('button', { name: /bussola/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /righello/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quiz/i })).toBeInTheDocument();
  });

  test('scegliere un tool lo attiva nello store e richiude il dial', () => {
    render(<MapToolsFab />);
    fireEvent.click(screen.getByRole('button', { name: /strumenti mappa/i }));
    fireEvent.click(screen.getByRole('button', { name: /bussola/i }));
    expect(useUIStore.getState().compassActive).toBe(true);
    // dial richiuso → il pulsante Bussola non è più nel DOM
    expect(screen.queryByRole('button', { name: /^bussola$/i })).toBeNull();
  });

  test('quando un tool è attivo il FAB mostra lo stato attivo (aria-pressed)', () => {
    useUIStore.setState({ compassActive: true });
    render(<MapToolsFab />);
    expect(screen.getByRole('button', { name: /strumenti mappa/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run, confirm FAIL** — `npx jest MapToolsFab --silent` → module not found.

- [ ] **Step 3: Implement** `src/components/map/MapToolsFab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';

const TOOLS = [
  { key: 'compass', label: 'Bussola', icon: '🧭', activeBg: 'bg-amber-500' },
  { key: 'ruler', label: 'Righello', icon: '📏', activeBg: 'bg-blue-500' },
  { key: 'quiz', label: 'Quiz', icon: '❓', activeBg: 'bg-purple-500' },
] as const;

/**
 * Speed-dial FAB degli strumenti mappa (bussola/righello/quiz), solo mobile (<lg).
 * Su desktop i tool restano nella toolbar di ModeSwitch. Bottom-left per non
 * collidere col controllo "La mia posizione" (bottom-right di Leaflet).
 */
export function MapToolsFab() {
  const [open, setOpen] = useState(false);
  const compassActive = useUIStore((s) => s.compassActive);
  const rulerActive = useUIStore((s) => s.rulerActive);
  const quizActive = useUIStore((s) => s.quizActive);
  const toggleCompass = useUIStore((s) => s.toggleCompass);
  const toggleRuler = useUIStore((s) => s.toggleRuler);
  const toggleQuiz = useUIStore((s) => s.toggleQuiz);

  const active: Record<string, boolean> = { compass: compassActive, ruler: rulerActive, quiz: quizActive };
  const toggle: Record<string, () => void> = { compass: toggleCompass, ruler: toggleRuler, quiz: toggleQuiz };
  const anyActive = compassActive || rulerActive || quizActive;

  const pick = (key: 'compass' | 'ruler' | 'quiz') => {
    toggle[key]();
    setOpen(false);
  };

  return (
    <div className="lg:hidden absolute left-3 bottom-3 z-[1000] flex flex-col items-start gap-2">
      {open && TOOLS.map((t) => (
        <button
          key={t.key}
          onClick={() => pick(t.key)}
          aria-label={t.label}
          aria-pressed={active[t.key]}
          className="flex items-center gap-2"
        >
          <span className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center text-lg ${active[t.key] ? `${t.activeBg} text-white` : 'bg-gray-800 text-gray-100'}`}>
            <span aria-hidden="true">{t.icon}</span>
          </span>
          <span className="text-xs font-medium text-white bg-black/60 rounded px-2 py-1">{t.label}</span>
        </button>
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Chiudi strumenti' : 'Strumenti mappa'}
        aria-expanded={open}
        aria-pressed={anyActive}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-xl transition-colors ${
          anyActive && !open ? 'bg-amber-500 text-white' : 'bg-green-500 text-black'
        }`}
      >
        <span aria-hidden="true">{open ? '✕' : '🧭'}</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm PASS** — `npx jest MapToolsFab --silent` → 4 passing.
- [ ] **Step 5: Full suite** — `npx jest --silent` → all green (expect 547).
- [ ] **Step 6: (no commit — controller commits after review)**

---

## Task 47.2: Hide in-panel tools on mobile + render FAB

**Files:**
- Modify: `src/components/panel/ModeSwitch.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: ModeSwitch — desktop-only tools.** In `src/components/panel/ModeSwitch.tsx`, change the tools toolbar container from:
  `<div role="toolbar" aria-label="Strumenti mappa" className="flex items-center gap-1">`
  to:
  `<div role="toolbar" aria-label="Strumenti mappa" className="hidden lg:flex items-center gap-1">`
  (Only that className changes. Learn/Track segmented stays unchanged — visible on both.)

- [ ] **Step 2: page.tsx — render the FAB.** Add import `import { MapToolsFab } from '@/components/map/MapToolsFab';`. Inside the map container (`{/* Map */}` block, after `<MapWrapper />`, before the mobile panel sheet), add `<MapToolsFab />`.

- [ ] **Step 3: Full suite** — `npx jest --silent` → all green. (Existing `ModeSwitch.test` still passes: the tool buttons remain in the DOM — jsdom ignores the `hidden lg:flex` media class — so `getByText('Bussola')` etc. still find them.)

- [ ] **Step 4: Build** — `npm run build` → ✓ Compiled successfully.

- [ ] **Step 5: Visual check (controller).** On a mobile viewport: the FAB shows bottom-left on the map; tapping it reveals Bussola/Righello/Quiz; picking one activates it (and closes the dial); the Editor sheet header no longer shows the tools (only Learn/Track). On desktop the sidebar still shows the tools in ModeSwitch.

---

## Self-review notes (author)
- **Spec coverage:** tools in speed-dial FAB (47.1), labeled + ≥44px targets (w-11/h-11 = 44px tool buttons, w-14 FAB; ✓ TASK-44 for these), active highlight (FAB `aria-pressed`/amber + per-tool activeBg), dedup (tools removed from mobile panel via `hidden lg:flex`; desktop keeps them). FAB→✕ on open.
- **Placeholders:** none — full component + exact edits.
- **Type consistency:** tool keys `'compass'|'ruler'|'quiz'` consistent; uses existing uiStore actions verbatim.
- **Collision:** FAB placed bottom-LEFT to avoid Leaflet's bottom-right "La mia posizione" control.
