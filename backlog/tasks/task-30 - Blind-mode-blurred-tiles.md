---
id: TASK-30
title: Modalità "sfida cieca" — tile sfocate finché non risolvi
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - didactic
  - challenge
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Idea didattica audace** (feature suggestion **A2**) — nasconde le tile lungo il path tracciato dall'utente, lasciando visibile solo la griglia/curve di livello. L'utente deve indovinare distanza/azimuth/D+/D- **leggendo solo i simboli cartografici** (curve di livello, simboli CAI), non confrontando "visivamente la lunghezza".

## Origine

Feature suggestion **A2**. Cfr. `backlog/docs/feature-suggestions.md` A2.

## Task

### Concept
- [ ] Switch "Modalità sfida" in `ToleranceSettings` o ModeSwitch (terzo tab oltre Learn/Track?)
- [ ] Quando attiva, lungo i tratti tra waypoint applicare un blur CSS o sostituire le tile con versione monocromatica
- [ ] Solo curve di livello + griglia + simboli essenziali rimangono visibili

### Implementazione tecnica
- [ ] Probabilmente un overlay SVG/canvas sopra il path che maschera l'area circostante
- [ ] Considerare di scaricare tile specifiche di solo curve di livello (alcuni provider hanno tile dedicate)

### UI/UX
- [ ] Mostrare un timer (tempo trascorso) e bottone "Rivela" che mostra le tile complete
- [ ] Score basato su precisione + tempo

## Acceptance criteria

- [ ] Toggle funziona — tile attorno al path mascherate
- [ ] Verifica funziona ugualmente: il calcolo D+/D- usa dati reali (non blurred)
- [ ] Performance OK su itinerari fino a 20 leg

## Note

Feature ambiziosa e creativa. Potrebbe richiedere prototyping prima di task pieno. Cost stimato M-L.

## Riferimenti

- `backlog/docs/feature-suggestions.md` A2
<!-- SECTION:DESCRIPTION:END -->
