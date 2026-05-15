---
id: TASK-12
title: Debounce reverseGeocode su drag rapido del marker
status: To Do
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - networking
  - ux
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Quando l'utente trascina un marker rapidamente (es. 5 spostamenti in 2 secondi), `MapEvents`/`InteractiveMap` non riemette reverseGeocode su drag (giustamente — solo al `dragend` finale). Tuttavia, considerato che dopo R3-01 le chiamate Nominatim sono serializzate a 1 req/s, e considerando che ogni `dragend` (clic-rilascio-clic) può accumularsi, il nome del waypoint si aggiorna con lag visibile.

**Test live R8-08:** percezione che "i nomi si aggiornino lentamente" durante una sessione di micro-correzioni del marker.

## Origine

Deferred da live persona test, finding **R8-08**.

## Task

- [ ] In `InteractiveMap.tsx` `handleDragEnd`, NON chiamare immediatamente reverseGeocode. Invece:
  - Lanciare un setTimeout di 800ms
  - Se prima del timeout arriva un altro `dragend` dello stesso wp, cancellare e ri-pianificare
  - Al timeout: chiamare reverseGeocode una sola volta con le coordinate finali
- [ ] Mantenere il dedup per nomi duplicati (TASK-1 R8-01 già fixato)
- [ ] Considerare di sostituire il nome del waypoint con "Caricamento..." durante il debounce per UX feedback

## Acceptance criteria

- [ ] Spostando rapidamente lo stesso marker 5 volte in 2s, viene fatta 1 sola chiamata Nominatim 800ms dopo l'ultimo drag
- [ ] Spostando marker diversi, ognuno riceve la propria chiamata (debounce è per-marker)
- [ ] Nessuna regressione su click → add waypoint (quello rimane immediato)

## Riferimenti

- `src/components/map/InteractiveMap.tsx:47-57` (handleDragEnd)
- `backlog/docs/persona-usability-tests.md` R8-08
<!-- SECTION:DESCRIPTION:END -->
