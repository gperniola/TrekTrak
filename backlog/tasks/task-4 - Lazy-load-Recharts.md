---
id: TASK-4
title: Lazy-load Recharts in ProgressOverlay
status: To Do
assignee: []
created_date: '2026-05-15 17:30'
labels:
  - performance
  - bundle
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/components/panel/ProgressOverlay.tsx` importa `recharts` staticamente, anche se l'overlay viene mostrato solo quando `progressOpen === true`. Recharts pesa ~150kB minified+gzip e contribuisce al First Load.

Nota: `ElevationProfile.tsx` invece **deve** importare Recharts in modo eager perché è sempre visibile.

## Origine

Deferred da campagna polish/v0.6.2, bug **R6-02**.

## Task

- [ ] Convertire l'import di `ProgressOverlay` (nel render di `app/page.tsx`) in `next/dynamic` con `{ ssr: false }`
- [ ] Verificare con `npm run build` che `recharts` non sia nel main chunk ma in un chunk separato
- [ ] Verificare che l'overlay si apra ancora correttamente al click su "📊 Progresso"

## Stima impatto

Riduzione First Load JS attesa: 50-100kB (Recharts già condiviso fra `ElevationProfile` e `ProgressOverlay`, quindi il guadagno dipende dal tree-shaking effettivo).

## Riferimenti

- `src/components/panel/ProgressOverlay.tsx`
- `src/app/page.tsx`
- `backlog/docs/polish-v0.6.2-bug-log.md` row R6-02
<!-- SECTION:DESCRIPTION:END -->
