---
id: TASK-11
title: Eliminare warning Recharts width(-1) height(-1) al primo render
status: To Do
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - chart
  - performance
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Al primo render di `ElevationProfile.tsx`, prima che il container abbia dimensioni misurabili, `ResponsiveContainer` di Recharts logga:

```
The width(-1) and height(-1) of chart should be greater than 0,
       please check the style of container, or the props width(100%) and height(85%),
       or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
       height and width.
```

Comportamento visibile come **flash/flicker** del chart in alcune condizioni.

## Origine

Deferred da live persona test, finding **R8-06**.

## Task

- [ ] Indagare la causa: probabilmente `<ResponsiveContainer width="100%" height="85%">` con parent flex che inizialmente è 0×0
- [ ] Soluzioni alternative:
  - Aggiungere `minWidth={0}` come suggerito dal warning
  - Usare `aspect` invece di `height="85%"`
  - Renderizzare il chart solo dopo `useLayoutEffect` con misurazione del container (`ResizeObserver`)
- [ ] Verificare che il warning sparisca su mobile (390×844) e desktop (1280×800)
- [ ] Verificare che nessuna regressione visiva si introduca

## Acceptance criteria

- [ ] Console pulita dal warning Recharts al primo load
- [ ] Tempo al primo render del chart invariato (< 100ms)

## Riferimenti

- `src/components/map/ElevationProfile.tsx:160`
- `backlog/docs/persona-usability-tests.md` R8-06
<!-- SECTION:DESCRIPTION:END -->
