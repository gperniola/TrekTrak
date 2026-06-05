# Mobile Shell B — TASK-44 (touch targets, legacy controls) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Bring the remaining legacy in-panel controls to ≥44px touch targets **on mobile only**, leaving the desktop sidebar byte-for-byte unchanged.

**Approach:** Use Tailwind's `max-lg:` variant so the enlargement applies only below the `lg` breakpoint. Add `max-lg:min-h-[44px]` to small interactive controls (and `max-lg:min-w-[44px]` for icon-only ones). No structural/layout changes, no behavior changes, all aria-labels/ids/text preserved. (Tailwind 3.4 supports `max-*` variants.)

**Tech Stack:** Next.js 15 + TS + Tailwind 3.4 + Jest. Branch `develop`. Audit: `backlog/docs/mobile-usability-analysis.md` §7. Cosmetic a11y pass → no new unit tests (size isn't meaningfully testable in jsdom); verification is "suite stays green + build ok + visual".

---

## Controls to enlarge (`max-lg:min-h-[44px]`, plus `max-lg:min-w-[44px]` where icon-only)

- **`src/components/panel/ModeSwitch.tsx`** — the Learn and Track tab buttons (the two `role="tab"` buttons, currently `py-1.5`).
- **`src/components/panel/ItineraryHeader.tsx`** — Salva / Carica / Nuovo buttons and the two icon buttons (import ↓ / export ↑). Icon ones also `max-lg:min-w-[44px]`.
- **`src/components/panel/LeftPanel.tsx`** — the Modifica / Tabella sub-tab buttons (currently `py-2`).
- **`src/components/panel/ActionBar.tsx`** — the action buttons: PDF Sintetico, PDF Roadbook, GPX, Meteo, Copia link, Verifica, Progresso (currently `py-2`).
- **`src/components/panel/RouteList.tsx`** — the drag handle button (⠿, currently no size) → `max-lg:min-w-[44px] max-lg:min-h-[44px]` + center its glyph; the sort `<select>` → `max-lg:min-h-[44px]`.
- **`src/components/panel/RouteDetailCard.tsx`** — the buttons in the actions row: "Carica nell'editor", PDF, Meteo, JSON ↓, Elimina (currently `py-2`).

For each: ADD the `max-lg:` class(es) to the existing `className`; do not remove existing classes; do not change `flex-1`, grids, handlers, text, or aria.

---

## Task 44.1: Apply mobile touch targets

**Files:** the six components above.

- [ ] **Step 1:** For every control listed, append `max-lg:min-h-[44px]` to its `className` (and `max-lg:min-w-[44px]` to icon-only buttons: ItineraryHeader ↓/↑, RouteList drag handle). For the drag handle, also add `flex items-center justify-center` so the glyph stays centered.
- [ ] **Step 2: Full suite** — `npx jest --silent` → all green (553; no test changes expected — controls keep text/role/aria).
- [ ] **Step 3: Build** — `npm run build` → ✓ Compiled successfully.
- [ ] **Step 4: Visual check (controller)** — mobile: Salva/Carica/Nuovo, Learn/Track, Modifica/Tabella, export buttons, library detail buttons are comfortably tappable (≥44px tall). Desktop: sidebar identical to before (the `max-lg:` classes don't apply at `lg`+).

## Self-review notes (author)
- **Spec coverage (§7):** all remaining sub-44 legacy controls enlarged on mobile; desktop unchanged via `max-lg:`. Completes TASK-44 (the new B surfaces were already ≥44px in 46–49).
- **No placeholders / no behavior change / aria preserved.**
- **Risk:** purely additive className changes; if any control already has a conflicting min-h, keep the larger. Verify build for typos in the arbitrary value `max-lg:min-h-[44px]`.
