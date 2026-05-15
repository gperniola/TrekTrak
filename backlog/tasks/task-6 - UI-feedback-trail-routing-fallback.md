---
id: TASK-6
title: UI feedback quando il trail routing fallisce e si usa linea d'aria
status: Done
assignee: []
created_date: '2026-05-15 17:30'
labels:
  - ux
  - networking
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In modalità Track con trail routing attivo, se `fetchTrailRoute` fallisce (ORS non risponde, rate limit, no path trovato), `auto-fill.ts:142-146` fa fallback al calcolo classico in linea d'aria. **L'utente non ha alcun feedback visivo**: vede il path lineare grigio sulla mappa e potrebbe non capire perché.

L'unica traccia attuale è un `console.warn`.

## Origine

Deferred da campagna polish/v0.6.2, bug **R7-04**.

## Task

- [ ] Distinguere a livello di tipo o flag se un leg è in modalità "classic forzato" (fallback) vs "classic richiesto dall'utente" — aggiungere `Leg.routingMode?: 'trail' | 'fallback' | 'classic'`
- [ ] In `LegPolylines` / `ColoredLegSegments` mostrare uno styling diverso per fallback (es. dashed line + colore arancione attenuato anziché grigio)
- [ ] Mostrare un `Toast` informativo (dipende da TASK-5) al termine dell'auto-fill se ci sono fallback: "Sentiero non trovato per N tratte, usata linea d'aria"
- [ ] Aggiungere un'icona warning ⚠ sul LegCard per i leg in fallback con tooltip "Sentiero non trovato — distanza calcolata in linea d'aria"

## Riferimenti

- `src/lib/auto-fill.ts:142-146` (fallback silenzioso)
- `backlog/docs/polish-v0.6.2-bug-log.md` row R7-04

## Dipendenze

- [[task-5-in-app-modal-and-toast]] per il Toast
<!-- SECTION:DESCRIPTION:END -->
