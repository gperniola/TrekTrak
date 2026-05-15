---
id: TASK-34
title: Modalità triangolazione (no GPS, posizione da azimuth a 2 punti noti)
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - didactic
  - advanced
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Skill cartografico avanzato** (feature suggestion **C1**) — disabilita GPS. L'utente deve trovare la propria posizione **solo da osservazioni cartografiche**:

1. Identifica 2-3 punti noti sulla mappa (cima, rifugio, campanile)
2. Misura l'azimuth verso ognuno con una bussola
3. L'app esegue la triangolazione e calcola la posizione probabile

Skill che separa l'escursionista esperto dal principiante. Per chi ha il GPS scarico o vuole esercitarsi senza.

## Task

### Math
- [ ] In `lib/triangulation.ts` implementare:
  - Da 2 punti noti A, B e relativi azimuth `αA`, `αB` osservati dalla posizione X
  - Calcolare X come intersezione delle due rette uscenti da A e B con angoli `αA` e `αB`
  - Per 3 punti: minimi quadrati sugli incroci possibili (gestire incertezza)

### UI
- [ ] Nuovo tool "🧭⊿ Triangolazione" accanto a bussola/righello
- [ ] Workflow:
  1. Click su 2-3 punti noti sulla mappa
  2. Per ognuno, input azimuth osservato (slider o NumberInput)
  3. Mostra il punto stimato sulla mappa con error ellipse

### Didattica
- [ ] Tutorial step inline al primo uso: "La triangolazione è come usano i marinai..."
- [ ] Glossario entry "Triangolazione"

## Acceptance criteria

- [ ] 2 punti + azimuth → punto stimato con error visualizzato
- [ ] 3 punti → error ellipse calcolata
- [ ] Funziona offline (niente API)

## Riferimenti

- `src/components/map/CompassTool.tsx` (pattern simile da cui partire)
- `backlog/docs/feature-suggestions.md` C1
<!-- SECTION:DESCRIPTION:END -->
