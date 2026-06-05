---
id: TASK-42
title: Separare "Progresso" dagli export nella ActionBar
status: Done
assignee: []
created_date: '2026-06-05 18:30'
labels:
  - ux
  - usability
  - mobile-cleanup-A
dependencies: []
priority: medium
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Audit usabilità mobile (TASK-39, §2.6). Il pulsante **"Progresso"** (statistiche/report didattico) è mescolato con gli export (PDF/GPX/Copia link) nella stessa `ActionBar`, ma è un **concetto diverso** (apprendimento, non condivisione/output del percorso). Confonde il raggruppamento mentale.

Parte del **riordino A**. Nota: la collocazione *finale* su mobile sarà rifinita da B (bottom nav); qui basta **toglierlo dal gruppo export** e dargli una collocazione propria coerente su desktop+mobile.

## Task

- [ ] Estrarre "Progresso" dalla barra export.
- [ ] Collocarlo in un punto che ne comunichi la natura (es. vicino alle metriche/summary o tra gli strumenti didattici), senza introdurre nuove duplicazioni.
- [ ] Preservare il comportamento (apre `ProgressOverlay`, lazy-loaded) e lo stato disabled quando non ci sono dati (vedi TASK-20 già fatto).

## Acceptance criteria

- [ ] "Progresso" non è più visivamente parte degli export.
- [ ] Apertura overlay invariata; nessuna regressione.
- [ ] Test aggiornati.

## Riferimenti
- `src/components/panel/ActionBar.tsx`, `src/components/panel/ProgressOverlay.tsx`
- `backlog/docs/mobile-usability-analysis.md` §2.6, §4 (A)
- Coordinare con [[task-41-actionbar-hide-exports-when-empty]]
- Umbrella: [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
