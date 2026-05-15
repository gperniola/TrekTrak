---
id: TASK-8
title: Y-axis padding intelligente nel profilo altimetrico
status: Done
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - chart
  - ux
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In `src/components/map/ElevationProfile.tsx:127-131`, il padding sulla scala Y è calcolato come:

```typescript
const padding = Math.max(10, (maxAlt - minAlt) * 0.1);
const yMin = Math.floor((minAlt - padding) / 10) * 10;
const yMax = Math.ceil((maxAlt + padding) / 10) * 10;
```

**Problema (emerso nel test live R8-02).** Per range di altitudine piccoli (es. 4 waypoint a 2531-2558m, Δ=27m), il padding minimo di 10m + arrotondamento a multipli di 10 porta a un grafico che mostra 2520-2600m (range visivo 80m vs range dati 27m → il grafico appare "schiacciato").

## Origine

Deferred da live persona test, finding **R8-02**.

## Task

- [ ] Sostituire la logica con una funzione di padding adattivo basata su soglie:
  - Range < 50m → padding fisso 5m
  - 50m ≤ Range < 200m → padding 5-10% (interpolato)
  - Range ≥ 200m → padding 10%
- [ ] Considerare anche di abbandonare l'arrotondamento "a 10m" per range piccoli e usare "a 5m"
- [ ] Aggiornare i test in `src/__tests__/calculations.test.ts` (se ci sono) o aggiungerli
- [ ] Verificare visualmente sul dev server: scenari (range 27m, range 100m, range 1000m)

## Acceptance criteria

- [ ] Per il caso 2531-2558m il grafico mostra un range visivo ≤ 50m
- [ ] Per il caso 0-3000m (escursione lunga) il padding non supera 10%
- [ ] I tick label restano leggibili (non troppi decimali, non troppi tick)

## Riferimenti

- `src/components/map/ElevationProfile.tsx:127-131`
- `backlog/docs/persona-usability-tests.md` R8-02
- `backlog/docs/polish-v0.6.2-bug-log.md` R8-02
<!-- SECTION:DESCRIPTION:END -->
