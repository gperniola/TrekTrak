---
id: TASK-2
title: Generare icone PWA 144/256/384 px
status: To Do
assignee: []
created_date: '2026-05-15 17:30'
labels:
  - pwa
  - assets
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Il manifest PWA (`public/manifest.json`) dichiara solo `192×192` e `512×512`. Le icone in dimensioni intermedie (`144`, `256`, `384`) migliorano:

- Qualità della splash screen su dispositivi con DPI intermedi (alcuni Android)
- Selezione automatica della dimensione "più vicina" da parte del browser

## Origine

Deferred da campagna polish/v0.6.2, bug **R4-03**.

## Task

- [ ] Generare le 3 dimensioni mancanti partendo da `public/icons/icon-512.png` (downscale di qualità con tool come `sharp` o ImageMagick)
- [ ] Aggiungere le entry corrispondenti in `public/manifest.json` (sia `purpose: any` sia `purpose: maskable`)
- [ ] Verificare con Lighthouse/Application tab del browser che il PWA usa le icone corrette per ogni DPI

## Riferimenti

- `public/manifest.json`
- `backlog/docs/polish-v0.6.2-bug-log.md` row R4-03
<!-- SECTION:DESCRIPTION:END -->
