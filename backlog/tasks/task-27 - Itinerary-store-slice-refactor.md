---
id: TASK-27
title: Refactor itineraryStore in slice (waypoints / legs / settings / profileHover)
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - refactor
  - architecture
  - tech-debt
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona A (programmatrice) A.3 — `itineraryStore.ts` ha ~290 LOC con molte action. Border-line "fat store". Dopo TASK-15 (Learn↔Track parallel data) e TASK-19 (undo/redo history) crescerà a 400+ LOC.

## Task

- [ ] Splittare in slice Zustand:
  - `createWaypointsSlice`: waypoints + addWaypoint/removeWaypoint/updateWaypoint/reorderWaypoints
  - `createLegsSlice`: legs + updateLeg + recalculateLeg
  - `createSettingsSlice`: settings + updateSettings + appMode + setAppMode
  - `createProfileSlice`: profileHover + profileFlyTo + setters
  - `createItinerarySlice`: itineraryId + itineraryName + createdAt + loadItinerary + resetItinerary
- [ ] Combinare in `useItineraryStore` con pattern slice
- [ ] Aggiornare consumer per estrarre sub-slice (`useItineraryStore((s) => s.waypoints)` invariato grazie a shallow merge)

## Acceptance criteria

- [ ] Ogni slice file ≤ 100 LOC
- [ ] Test invariati (437/437)
- [ ] Nessun cambio di API per i consumer

## Riferimenti

- `src/stores/itineraryStore.ts`
- Pattern: https://docs.pmnd.rs/zustand/guides/slices-pattern
- `backlog/docs/persona-usability-tests.md` A.3

## Dipendenze

- Ideale prima di [[task-15-non-destructive-learn-track-switch]] (rende meno doloroso espandere il modello)
- Ideale prima di [[task-19-undo-redo-action-history]]
<!-- SECTION:DESCRIPTION:END -->

## Chiusura 2026-09-01 (v0.16.0)

Fatto, con una deviazione dichiarata: **waypoint e tratte non sono divisi**. Una tratta
esiste *fra* due waypoint consecutivi, quindi ogni aggiunta o rimozione e' per forza un
fatto di entrambi, e separarli avrebbe prodotto due pezzi che si chiamano a vicenda a
ogni gesto.

Quello che si poteva davvero estrarre — ed e' il guadagno vero — era la ricostruzione
della catena delle tratte, scritta **tre volte** quasi identica, con una differenza
silenziosa fra le copie. Ora e' `catenaTratte`, con la differenza resa esplicita da un
parametro e nove test suoi. Nessun cambio di API: i 1335 test sono passati invariati.
