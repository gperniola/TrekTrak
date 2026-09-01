---
id: TASK-2
title: Generare icone PWA 144/256/384 px
status: Done
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

## Chiusura 2026-09-01 — non si fa (riconciliazione del backlog)

Chiuso come **rinuncia dichiarata**, non come lavoro svolto: le tre dimensioni non
esistono e non verranno generate.

Il motivo. `192×192` e `512×512` sono le due misure che i browser richiedono per
considerare installabile una PWA, e il manifest le dichiara entrambe in `purpose: any` e
`purpose: maskable`. Le intermedie servono a far scegliere al sistema una sorgente piu'
vicina al DPI invece di riscalare, che e' una differenza di nitidezza sull'icona della
schermata home — non su nulla che l'app faccia.

In quindici versioni, con l'app installata e usata sul campo, non e' mai mancata: nessuna
segnalazione, nessun rilievo Lighthouse (la a11y sta a 100 e l'installabilita' e' a
posto). Tenere aperta una voce che nessuno raccogliera' rende l'elenco meno leggibile, e
un elenco che mente e' peggio di un elenco corto.

**Se un giorno servisse**: `npx sharp-cli -i public/icons/icon-512.png -o public/icons/
resize 384` (e 256, 144), poi le entry nel manifest in coppia `any` + `maskable`. Il
lavoro e' di dieci minuti — questo non e' un debito nascosto, e' una cosa che non serve.

