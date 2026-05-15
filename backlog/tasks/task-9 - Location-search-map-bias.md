---
id: TASK-9
title: Map-bias e disambiguazione nei risultati di ricerca località
status: Done
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - search
  - ux
  - networking
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La ricerca località (`src/lib/geocoding-api.ts`, `src/components/map/LocationSearch.tsx`) chiama Nominatim con `limit=5` ma senza `viewbox`/`bounded` né `countrycodes`. Per query ambigue, Nominatim restituisce un unico risultato (quello con score più alto globalmente), che spesso non è quello vicino all'utente.

**Esempio reale (test live R8-03):** cercando "Corno Grande" l'unico risultato era il Corno Grande di Curon Venosta (Bolzano), mancando il celebre Corno Grande del Gran Sasso d'Italia (Abruzzo, 2912m).

## Origine

Deferred da live persona test, finding **R8-03**.

## Task

- [ ] In `LocationSearch.tsx` passare il `bounds` correnti della mappa (`map.getBounds()`) a `searchLocation`
- [ ] In `searchLocation` aggiungere parametro `viewbox=west,south,east,north` e `bounded=0` (preferenza ma non vincolante)
- [ ] Aumentare `limit` a 8-10 per dare più scelta su query ambigue
- [ ] Considerare di aggiungere `category` o `class`/`type` dalla risposta Nominatim accanto al display name (es. "Corno Grande (peak)" vs "Corno Grande (residential)")
- [ ] (Opzionale) Aggiungere `countrycodes=it,fr,ch,at,si` per limitare a paesi alpini più rilevanti per escursionismo

## Acceptance criteria

- [ ] Cercando "Corno Grande" con mappa centrata su Abruzzo, il primo risultato è il Corno Grande di L'Aquila
- [ ] Cercando un toponimo fuori dal viewbox, il risultato globale è comunque mostrato (bounded=0)
- [ ] Test esistenti `src/__tests__/geocoding-api.test.ts` aggiornati e verdi

## Riferimenti

- `src/lib/geocoding-api.ts:12-73`
- `src/components/map/LocationSearch.tsx:56-85`
- `backlog/docs/persona-usability-tests.md` R8-03 / Persona C
<!-- SECTION:DESCRIPTION:END -->
