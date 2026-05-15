---
id: TASK-32
title: Grafico storico personale del miglioramento (trend chart in ProgressOverlay)
status: To Do
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
- [ ] In `learning-stats.ts`, helper `computeTrendData(category, history)` che ritorna array `{ date, validPercent }[]` ordinato cronologicamente
- [ ] Considerare il rolling-average a 5 sessioni per appianare la curva

### Grafico
- [ ] In `ProgressOverlay` aggiungere una sezione "Andamento":
  - Selettore categoria (altitude/distance/azimuth/elevationGain/elevationLoss)
  - LineChart Recharts con asse X = data, Y = `validPercent`
  - Linea di trend (slope semplice)
  - Annotazione "Miglioramento +N% negli ultimi 30 giorni"

### Empty state
- [ ] Se < 3 sessioni: messaggio "Completa qualche verifica per vedere il tuo andamento"

## Acceptance criteria

- [ ] Grafico visibile in `ProgressOverlay` se ci sono ≥ 3 sessioni
- [ ] Cambio categoria aggiorna il grafico
- [ ] Coerente con stats numeriche già presenti

## Riferimenti

- `src/components/panel/ProgressOverlay.tsx`
- `src/lib/learning-stats.ts`
- `backlog/docs/feature-suggestions.md` A4
<!-- SECTION:DESCRIPTION:END -->
