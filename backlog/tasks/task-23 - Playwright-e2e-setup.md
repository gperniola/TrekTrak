---
id: TASK-23
title: Setup Playwright per test end-to-end
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - testing
  - dx
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona A (programmatrice) A.6 + feature suggestion **E3** — 437 unit/component test ma niente E2E. I refactor pesanti (es. TASK-15 Learn↔Track) sono rischiosi senza copertura integration-level.

## Task

### Setup
- [ ] `npm install -D @playwright/test`
- [ ] `npx playwright install` (browsers chromium/firefox/webkit)
- [ ] Aggiungere `e2e/playwright.config.ts` con `webServer` che lancia `npm run dev` su porta dinamica
- [ ] Script `npm run test:e2e` e `npm run test:e2e:ui` (mode interattivo)

### Scenari minimi (5-7 test)
- [ ] **E2E-01: First visit → tutorial → skip → mappa visible**
- [ ] **E2E-02: Click mappa → waypoint creato con nome auto-geocoded**
- [ ] **E2E-03: 2 waypoint → leg con distance/D+/D- calcolati → profilo altimetrico visible**
- [ ] **E2E-04: Switch Learn → input manuale → Verifica → badge visibili**
- [ ] **E2E-05: Save itinerary → New → Load → itinerario torna (con routeGeometry rigenerato)**
- [ ] **E2E-06: Quiz flow completo (5 domande) → summary visibile**
- [ ] **E2E-07: Share link → copy → decode → load**

### Documentazione
- [ ] Update README (TASK-18) con sezione "Testing": unit + e2e

### CI (futuro)
- [ ] Considerare GitHub Actions workflow che lancia E2E su PR. Non bloccante per questa task.

## Acceptance criteria

- [ ] `npm run test:e2e` lancia tutti i 5-7 scenari e passa in < 90 secondi
- [ ] Niente regressione su unit test (437/437 invariati)

## Riferimenti

- `backlog/docs/persona-usability-tests.md` A.6
- `backlog/docs/feature-suggestions.md` E3
<!-- SECTION:DESCRIPTION:END -->

## Chiusura 2026-09-01 (v0.17.0)

Fatto: Playwright + Chromium, dieci scenari, **84 secondi** (il criterio diceva sotto i
90). La rete si finge tutta — mattonelle, geocodifica, quote, Overpass, layer — perche'
questi test devono dire se l'app funziona, non se oggi Nominatim risponde.

Due scenari **riscritti** rispetto al piano: E2E-05 («salva → nuovo → carica») non e'
riproducibile offline da quando salvare significa Supabase, ed e' diventato «una ricarica
non deve far perdere il lavoro»; E2E-06 (quiz) e' diventato «toccare un pannello non crea
waypoint sotto di se'», che non era nel piano ma e' la classe di difetto arrivata **tre
volte in produzione**.

Cosa ha insegnato scriverli: al primo giro sette scenari su dieci dicevano «il waypoint
non nasce», e la causa era il **popup delle novita'** aperto davanti. Il conteggio dei
waypoint contava marker che non erano waypoint. E il link condiviso va aperto in un
CONTESTO nuovo, non in una scheda nuova, perche' le schede condividono lo storage.
