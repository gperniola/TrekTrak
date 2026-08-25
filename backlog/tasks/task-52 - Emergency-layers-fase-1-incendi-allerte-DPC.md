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
- [ ] Piano di implementazione (writing-plans)
- [ ] Implementazione TDD su `feature/emergency-layers`
- [ ] Release v0.11.0

## Acceptance criteria

- [ ] I 4 layer attivabili dal pannello sulla mappa, con popup, legenda, timestamp e disclaimer
- [ ] `FIRMS_MAP_KEY` mai esposta nel client; proxy con cache funzionante
- [ ] Dati emergenza esclusi dal caching del service worker
- [ ] Nessuna regressione sui 563 test; First Load invariato (dynamic import)

## Riferimenti

- `backlog/docs/emergency-layers-design.md` (spec autoritativa)
<!-- SECTION:DESCRIPTION:END -->
