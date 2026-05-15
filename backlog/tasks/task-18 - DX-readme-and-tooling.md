---
id: TASK-18
title: README, .env.example, e cleanup tooling (ts-jest deprecation, docs structure)
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - dx
  - documentation
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona A (programmatrice senior), findings **A.1, A.2, A.6b** — chi atterra dal link GitHub trova un repo senza README. La struttura `docs/superpowers/` legacy + `backlog/` corrente non è ovvia. Test config emette deprecation warning.

## Task

### A. README (A.1)
- [ ] Creare `README.md` alla root con:
  - Una riga intro: "App didattica per imparare la cartografia manuale tramite la creazione di itinerari di trekking"
  - Badge (build status se aggiungiamo CI, license, version)
  - 1-2 screenshot (mobile + desktop) presi da `backlog/docs/screenshots/`
  - Quick start: `npm install`, `cp .env.example .env.local`, `npm run dev`
  - Stack tecnologico (Next.js 14, Leaflet, Zustand, Recharts, jsPDF, @serwist/next)
  - Link a CHANGELOG.md
  - Link a `backlog/` per tasks attivi e `backlog/docs/` per analisi
  - Nota su `docs/superpowers/` come archivio storico
- [ ] Creare `.env.example` con:
  ```
  # OpenRouteService API key for trail routing (foot-hiking).
  # Get one free at https://openrouteservice.org
  NEXT_PUBLIC_ORS_API_KEY=
  
  # Thunderforest API key for the Outdoors basemap (optional).
  # Without it, the app falls back to OpenTopoMap / CyclOSM / OSM.
  NEXT_PUBLIC_THUNDERFOREST_API_KEY=
  ```

### B. Documenta la separazione docs/superpowers vs backlog (A.2)
- [ ] Aggiungere `docs/README.md` (1 paragrafo): "Questa cartella contiene gli spec/plan storici delle versioni 0.1.0 – 0.6.0. Il workflow attivo è in `backlog/`."

### C. ts-jest deprecation (A.6b)
- [ ] Aggiornare `jest.config.js` dal pattern `globals: { 'ts-jest': {...} }` deprecato al pattern moderno:
  ```javascript
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { /* options */ }],
  }
  ```
- [ ] Verificare che i 437 test continuino a passare
- [ ] Console pulita da deprecation warning

## Acceptance criteria

- [ ] README.md presente e leggibile, copre setup e contesto del progetto
- [ ] `.env.example` documenta le 2 API key
- [ ] Test verdi senza warning ts-jest

## Riferimenti

- `backlog/docs/persona-usability-tests.md` A.1, A.2, A.6b
<!-- SECTION:DESCRIPTION:END -->
