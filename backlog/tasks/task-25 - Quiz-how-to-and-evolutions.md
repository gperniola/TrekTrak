---
id: TASK-25
title: Quiz — how-to azimuth, modalità raggio, adattivo
status: In Progress
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - quiz
  - didactic
  - feature
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona D (principiante) D.4 + feature suggestions **C2** (radius), **C3** (adattivo) — il quiz è una feature chiave per il "learn" ma manca di scaffolding per i principianti e di evoluzione per i ricorrenti.

## Sotto-task

### A. How-to per primo quiz azimuth (D.4)
- [ ] Al primo lancio di un quiz "azimuth" mostrare una mini-guida pre-domanda:
  - "Per stimare l'azimuth:
    1. Orienta mentalmente la mappa al Nord
    2. Conta i gradi dal Nord in senso orario verso il punto target
    3. 0°=N, 90°=E, 180°=S, 270°=W"
  - Link "Usa la bussola interna per riferimento" → attiva CompassOverlay
- [ ] Salva `localStorage.quizHowToSeen.azimuth = true` per non rimostrarla
- [ ] Stesso pattern per "distance" (linea d'aria vs sentiero) e "altitude" (curve di livello) al primo lancio

### B. Modalità quiz "raggio dalla posizione corrente" (C2)
- [ ] Aggiungere toggle "Quiz da posizione corrente" in `QuizOverlay`
- [ ] Se ON e GPS disponibile: i punti del quiz vengono generati entro `radius` km dalla posizione (default 5 km, configurabile)
- [ ] Più rilevante per chi sta pianificando una specifica escursione

### C. Quiz adattivo basato su debolezze (C3)
- [ ] In `lib/quiz.ts` `generateQuestionSet`, invece di `[altitude, distance, azimuth] + 2 random`, leggere `categoryStats` da `loadValidationHistory()` + `loadQuizHistory()`
- [ ] Pesare le domande inversamente a `validPercent`/`avgScore` per ogni tipo
- [ ] Garantire comunque 1 domanda di ogni tipo (anche se debole) per non monotonizzare

## Acceptance criteria

- [ ] Al primo quiz azimuth viene mostrata la mini-guida
- [ ] Toggle radius funziona con GPS, fallback a bounds-of-map senza GPS
- [ ] Quiz adattivo: se l'utente ha 30% di errori azimuth e 0% altitudine, il prossimo quiz pesca 60% azimuth

## Riferimenti

- `src/lib/quiz.ts:89-101` (generateQuestionSet)
- `src/components/quiz/QuizOverlay.tsx`
- `src/lib/learning-stats.ts` (categoryStats)
- `backlog/docs/persona-usability-tests.md` D.4
- `backlog/docs/feature-suggestions.md` C2, C3
<!-- SECTION:DESCRIPTION:END -->
