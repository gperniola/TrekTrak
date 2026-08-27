---
id: TASK-57
title: Fase B — layer radar precipitazioni sulla mappa
status: To Do
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
