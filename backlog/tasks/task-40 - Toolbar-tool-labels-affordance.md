---
id: TASK-40
title: Etichette/affordance ai tool della toolbar (bussola/righello/quiz)
status: Done
assignee: []
created_date: '2026-06-05 18:30'
labels:
  - ux
  - mobile
  - usability
  - mobile-cleanup-A
dependencies: []
priority: high
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Audit usabilità mobile (TASK-39, `backlog/docs/mobile-usability-analysis.md` §2.4). I tool della toolbar (`ModeSwitch`) sono **icon-only e ambigui**: ◎ bussola, ↕ righello, **? quiz** — la "?" sembra "aiuto", non "quiz". Discoverability bassa, sia su mobile che desktop.

Fa parte del **riordino A** (componenti condivisi → migliora anche il desktop). Non tocca la shell di navigazione mobile (quella è di B).

## Task

- [ ] Dare a ciascun tool un'affordance testuale chiara: etichetta accanto all'icona (o icona meno ambigua per il quiz) mantenendo l'ingombro accettabile su mobile.
- [ ] Verificare `aria-label`/`title` coerenti con l'etichetta visibile.
- [ ] Mantenere lo stato attivo/selezionato ben visibile.

## Acceptance criteria

- [ ] Ogni tool è riconoscibile senza doverci cliccare sopra (etichetta o icona inequivocabile).
- [ ] Nessuna regressione di layout su mobile (390px) e desktop.
- [ ] Test aggiornati per `ModeSwitch`.

## Riferimenti
- `src/components/panel/ModeSwitch.tsx`
- `backlog/docs/mobile-usability-analysis.md` §2.4, §4 (A)
- Umbrella: [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
