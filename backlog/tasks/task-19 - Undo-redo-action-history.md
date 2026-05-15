---
id: TASK-19
title: Undo / Redo con stack di history sull'itinerario
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - ux
  - architecture
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona B (B.4 — Verifica per sbaglio) + Persona D (D.7 — cancello waypoint per errore) + feature suggestion **B2**. Mancanza di undo è una delle frustrazioni più ricorrenti.

Oggi ogni azione (add/remove waypoint, edit name, reorder, edit field) è immediata e non-undo-able. Solo "Carica" di un itinerario salvato rimette in pristine.

## Task

### Architettura store
- [ ] Aggiungere a `itineraryStore.ts` uno stack di history:
  ```typescript
  history: Array<{ waypoints: Waypoint[]; legs: Leg[]; itineraryName: string }>;
  historyCursor: number; // -1 = nessuna undo disponibile
  ```
- [ ] Wrapping di tutte le mutazioni (addWaypoint, removeWaypoint, updateWaypoint, updateLeg, reorderWaypoints, setItineraryName, clearAllValidation) con push automatico sullo stack
- [ ] Cap a 50 step (FIFO eviction sul push se oltrepassato)
- [ ] Snapshot deep-clone via `structuredClone` (disponibile in browser moderni)

### Azioni undo/redo
- [ ] `undo()`: se cursor > 0 → cursor--, applica snapshot al cursor
- [ ] `redo()`: se cursor < history.length-1 → cursor++, applica snapshot al cursor
- [ ] Una nuova mutazione mentre cursor < history.length-1 → tronca il "future" della history

### UI
- [ ] Aggiungere bottoni Undo/Redo nella top bar (icone ↶/↷)
- [ ] Disabilitati quando non disponibili
- [ ] Keyboard shortcuts: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
- [ ] Tooltip mostra descrizione dell'azione che verrà undone (es. "Annulla: rimozione waypoint 3")

### Casi speciali
- [ ] La validazione (post-Verifica) NON va in history (è "computed", non user-action). Documentare scelta.
- [ ] Switch Learn↔Track NON va in history (è view change, non data change). NB: dopo TASK-15 sarà ancora più giustificato.

## Acceptance criteria

- [ ] Aggiungere → undo → waypoint rimosso ✓
- [ ] Cancellare → undo → waypoint torna ✓
- [ ] Rinominare → undo → vecchio nome ✓
- [ ] Drag posizione → undo → vecchia posizione ✓
- [ ] Limite 50 step rispettato

## Riferimenti

- `src/stores/itineraryStore.ts`
- `backlog/docs/persona-usability-tests.md` B.4, D.7
- `backlog/docs/feature-suggestions.md` B2
<!-- SECTION:DESCRIPTION:END -->
