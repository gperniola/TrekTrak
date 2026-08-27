---
id: TASK-57
title: Fase B — layer radar precipitazioni sulla mappa
status: Done
assignee: []
created_date: '2026-08-27 16:30'
labels:
  - weather
  - map
  - emergency-layers
dependencies: []
priority: medium
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fase B di [[storm-safety-design]]: tile radar RainViewer come layer di emergenza.

Misurato: 13 frame delle **ultime 2 h** a passo 10 min, `nowcast: 0` sul piano gratuito
(nessuna previsione), copertura Italia confermata. La legenda deve dire chiaramente che
si guarda il passato, non il futuro — altrimenti ricade nella classe di difetto
dominante della v0.11.0, cioe' dati presentati per cio' che non sono.

Stessa meccanica dei layer incendi: pane dedicato, orario di aggiornamento, attribuzione,
esclusione dalla cache del service worker, guardia di propagazione sugli overlay.
<!-- SECTION:DESCRIPTION:END -->

## Esito (2026-08-27)

Fatto: `lib/radar-api.ts` + `EmergencyRadarLayer` + controllo di animazione nel
pannello (play/pausa, slider, orario del fotogramma sempre visibile). Radar e
Open-Meteo esclusi dalla cache del service worker.

**Due cose misurate sui dati veri, che hanno cambiato l'implementazione:**

1. **La legenda.** RainViewer non pubblica la scala dei colori nella risposta. Invece di
   inventarla — l'errore delle legende EFFIS della v0.11.6 — ho campionato **40 tile
   globali**: blu `#88ddee` (21.809 px), giallo `#ffee00` (3.759), arancio `#ff9500`
   (1.273), rosso `#f23600` (2.077), viola `#ff4eff` (21), grigio `#706a5d` = neve. Il
   verde non compare affatto in questo schema. La direzione della scala e' confermata
   dai conteggi: l'evento raro sta all'estremo intenso.
2. **Lo zoom.** `maxNativeZoom` era a 12 per intuizione. Misurato: da **zoom 8** in su
   RainViewer restituisce sempre lo stesso PNG da 1370 byte, grigio al 100% — il
   placeholder "Zoom Not Supported", che si vedeva scritto sulla mappa a zoom da
   escursionista. Il limite vero e' **7** (tile validi, 334 byte sull'area di prova).

Limite dichiarato in interfaccia: sono **ultime 2 ore**, `nowcast` e' vuoto sul piano
gratuito, e il dettaglio e' ~1 km.
