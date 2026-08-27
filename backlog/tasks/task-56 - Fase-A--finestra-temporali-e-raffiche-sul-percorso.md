---
id: TASK-56
title: Fase A — finestra temporali e raffiche sul percorso
status: To Do
assignee: []
created_date: '2026-08-27 16:30'
labels:
  - weather
  - safety
  - didattica
dependencies: []
priority: high
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fase A di [[storm-safety-design]]: incrociare l'itinerario con l'ora.

Una chiamata Open-Meteo multi-punto (misurata: **6 waypoint x 48 h in 12 KB**, nessuna
chiave, CORS aperto) per `cape`, `weather_code`, `precipitation_probability`,
`wind_gusts_10m`. Banda oraria sul profilo altimetrico, riga per waypoint, avviso quando
l'orario stimato con Munter su un tratto esposto cade nella finestra critica.

Include il suggerimento **raffiche di vento**: arriva nella stessa chiamata.

Parte didattica: come si legge il CAPE, il ciclo diurno della convezione in montagna,
la regola 30/30.
<!-- SECTION:DESCRIPTION:END -->
