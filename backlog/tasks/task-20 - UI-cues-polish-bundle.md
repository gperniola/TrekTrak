---
id: TASK-20
title: Bundle UI cues — Progresso disabled, T1-T6 tooltip, maxZoom badge, positive feedback
status: In Progress
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - ux
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bundle di piccoli "UI cues" emersi dai persona test. Ognuno isolato è banale, insieme fanno una release coerente.

## Sotto-task

### A. "Progresso" disabled finché non ci sono dati (B.7)
- [ ] In `panel/ActionBar.tsx` il bottone `📊 Progresso` apre `ProgressOverlay`. Oggi è sempre attivo, l'overlay aperto a freddo mostra empty state
- [ ] Disabilitare il bottone se `loadValidationHistory().length === 0 && loadQuizHistory().length === 0`
- [ ] Tooltip sul disabled: "Completa una verifica o un quiz per vedere il tuo progresso"

### B. Tooltip scala SAC sulla "Difficoltà: T1" (B.6)
- [ ] In `panel/SummaryBar.tsx:25-27`, rendere "Difficoltà: T1" un bottone/span con `title=` o popover dettagliato:
  - T1 — Sentiero ben segnato, camminata semplice
  - T2 — Sentiero di montagna con tratti meno definiti
  - T3 — Sentiero alpino impegnativo, possibili passaggi esposti
  - T4 — Sentiero alpino, capacità di lettura del terreno richiesta
  - T5 — Alpinismo facile, passaggi tecnici
  - T6 — Alpinismo difficile
- [ ] Versione concisa nel tooltip; link al glossario (TASK-16) per la descrizione completa

### C. Banner "zoom oltre dettaglio nativo" (C.2)
- [ ] In `InteractiveMap.tsx` o in un nuovo `MaxZoomHint.tsx`: ascolta `zoomend` event di Leaflet
- [ ] Se `map.getZoom() > baseMap.maxNativeZoom`, mostra un piccolo banner discreto sopra la mappa: "Zoom oltre il dettaglio nativo della mappa ({baseMap.label} max {maxNativeZoom})"
- [ ] Banner dismissibile, ricompare cambiando mappa

### D. Positive reinforcement nelle verifiche (D.5)
- [ ] In `ActionBar.tsx` verify-flow, dopo aver calcolato il count valid/warning/error confrontare con l'ultima `ValidationSession` salvata
- [ ] Se `validPercent` è migliorato rispetto all'ultima sessione, aggiungere al banner di Verifica un "📈 +N% rispetto alla precedente"
- [ ] Anche nei tip didattici dei badge: "Stai migliorando su questo tipo di errore!" se la storia mostra un trend positivo (logic già in `learning-stats.computeTrendDirection`)

## Acceptance criteria

- [ ] Tutti e 4 i sotto-task verificabili manualmente sul dev server
- [ ] Niente regressione su 437 test

## Riferimenti

- `backlog/docs/persona-usability-tests.md` B.6, B.7, C.2, D.5
- Glossario in [[task-16-tutorial-glossary-profile-choice]] (T1-T6 può linkare là)
- Toast in [[task-5-in-app-modal-and-toast]] (per banner zoom)
<!-- SECTION:DESCRIPTION:END -->
