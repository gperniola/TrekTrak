---
id: TASK-32
title: Grafico storico personale del miglioramento (trend chart in ProgressOverlay)
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - didactic
  - motivation
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Feature** (suggestion **A4**) — `ProgressOverlay` già mostra statistiche numeriche (verifiche totali, ultimo quiz, ecc.). Manca un grafico visuale di "andamento nel tempo": vedo che la mia precisione su azimuth è migliorata?

## Task

### Dati
- [x] In `learning-stats.ts`, helper `computeTrendData(category, history)` che ritorna array `{ date, validPercent }[]` ordinato cronologicamente
- [x] Considerare il rolling-average a 5 sessioni per appianare la curva

### Grafico
- [x] In `ProgressOverlay` aggiungere una sezione "Andamento":
  - Selettore categoria (altitude/distance/azimuth/elevationGain/elevationLoss)
  - LineChart Recharts con asse X = data, Y = `validPercent`
  - Linea di trend (slope semplice)
  - Annotazione "Miglioramento +N% negli ultimi 30 giorni"

### Empty state
- [x] Se < 3 sessioni: messaggio "Completa qualche verifica per vedere il tuo andamento"

## Acceptance criteria

- [x] Grafico visibile in `ProgressOverlay` se ci sono ≥ 3 sessioni
- [x] Cambio categoria aggiorna il grafico
- [x] Coerente con stats numeriche già presenti

## Riferimenti

- `src/components/panel/ProgressOverlay.tsx`
- `src/lib/learning-stats.ts`
- `backlog/docs/feature-suggestions.md` A4
<!-- SECTION:DESCRIPTION:END -->

## Chiusura 2026-09-01 (riconciliazione del backlog)

**Era gia' fatto, con tutte le caselle vuote.** Verificato nel codice, non a memoria:

- `computeTrendData(validations, quizzes, categoryFilter)` esiste in `lib/learning-stats.ts`
  ed e' chiamata da `ProgressOverlay.tsx:95`;
- la sezione «Andamento» disegna un `LineChart` di Recharts con due serie —
  `verifyPercent` (blu) e `quizScore` (verde) — con `connectNulls`, asse delle date
  formattato e legenda (`ProgressOverlay.tsx:170-180`);
- il filtro per categoria alimenta il grafico, quindi il cambio categoria lo aggiorna;
- il verso della tendenza ha gia' icone e colori (`TREND_ICONS`, `TREND_COLORS`).

E' arrivato insieme a una delle release sul report di apprendimento senza che nessuno
tornasse a spuntare le caselle. Chiuso.

