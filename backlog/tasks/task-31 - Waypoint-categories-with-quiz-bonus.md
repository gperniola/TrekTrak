---
id: TASK-31
title: Categorie waypoint (rifugio/cima/passo/guado) con bonus didattico
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - didactic
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Feature didattica** (suggestion **A3**) — l'utente in Learn deve classificare ogni waypoint come tipo cartografico (rifugio / cima / passo / guado / sentiero / borgo). La risposta corretta viene da Overpass (POI tipologia).

Insegna il vocabolario cartografico, non solo la trigonometria.

## Task

### Modello
- [ ] Estendere `Waypoint` con `category?: 'rifugio' | 'cima' | 'passo' | 'guado' | 'sentiero' | 'borgo' | 'altro'`

### UI Learn
- [ ] In `WaypointCard` (Learn mode), aggiungere un select "Tipo" sotto il nome
- [ ] In Verifica, confrontare con la categoria reale dedotta da Overpass (es. `peak` → `cima`, `alpine_hut` → `rifugio`)
- [ ] Badge ✓/✗ per la categoria, accanto agli altri

### Quiz
- [ ] Aggiungere `QuestionType = 'category'` al quiz: "Che tipo di luogo è il punto evidenziato?" con 4 opzioni multiple choice

### Glossario
- [ ] In `lib/glossary.ts` (TASK-16), entry per ogni categoria con descrizione e simbolo cartografico standard

## Acceptance criteria

- [ ] Utente può assegnare categoria
- [ ] Verifica confronta con Overpass
- [ ] Nuova question type nel quiz

## Riferimenti

- `backlog/docs/feature-suggestions.md` A3
- `src/lib/overpass-api.ts` (Overpass query già esistente per tipologie POI)
<!-- SECTION:DESCRIPTION:END -->
