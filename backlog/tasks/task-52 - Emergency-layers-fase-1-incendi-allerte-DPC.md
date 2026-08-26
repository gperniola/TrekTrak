---
id: TASK-52
title: Layer emergenza fase 1 — incendi + allerte meteo-idro DPC (v0.11.0)
status: In Progress
assignee: []
created_date: '2026-08-25 15:00'
labels:
  - map
  - emergency-layers
  - feature
dependencies: []
priority: high
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prima fase dei layer di emergenza sulla mappa: infrastruttura layer (registry + pannello + renderer
generici) + 4 layer — focolai FIRMS (points via proxy), aree bruciate EFFIS (WMS), pericolo FWI EFFIS
(WMS), allerte meteo-idro/frane DPC (zones da GitHub ufficiale). Design completo e approvato in
`backlog/docs/emergency-layers-design.md`.

La fase 2 (valanghe/neve/sismi, v0.12.0) è [[task-51]] e riusa l'infrastruttura di questa fase.

## Avanzamento

- [x] Ricerca fonti con verifica endpoint reali (report 2026-08-25)
- [x] Brainstorming requisiti + design approvato a sezioni
- [x] Spec scritta: `backlog/docs/emergency-layers-design.md`
- [x] Piano di implementazione (writing-plans)
- [x] Implementazione TDD su `feature/emergency-layers`
- [x] Campagna di code review: 3 round, 29 problemi distinti, chiusi in 4 ondate (2026-08-26)
- [ ] Release v0.11.0

## Acceptance criteria

- [x] I 4 layer attivabili dal pannello sulla mappa, con popup, legenda, timestamp e disclaimer
- [x] `FIRMS_MAP_KEY` mai esposta nel client; proxy con cache funzionante
- [x] Dati emergenza esclusi dal caching del service worker (regole `NetworkOnly` verificate;
      la prova a runtime richiede build di produzione, Serwist è disabilitato in dev)
- [x] Nessuna regressione sui 563 test; First Load invariato (dynamic import)
      → 706 test, First Load 317 kB contro 316 kB di `develop`
- [x] Lighthouse a11y: **spostato su [[task-53]]**. Il target ≥97 non è raggiunto (92-96), ma le
      due failure sono preesistenti ed estranee a questo task (`aria-command-name` sui marker
      Leaflet, `color-contrast` sulla BottomNav) e toccano componenti condivisi

## Riferimenti

- `backlog/docs/emergency-layers-design.md` (spec autoritativa)
<!-- SECTION:DESCRIPTION:END -->
