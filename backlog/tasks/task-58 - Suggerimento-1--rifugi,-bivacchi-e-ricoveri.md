---
id: TASK-58
title: Suggerimento 1 — rifugi, bivacchi e ricoveri
status: To Do
assignee: []
created_date: '2026-08-27 16:30'
labels:
  - map
  - safety
  - osm
dependencies: []
priority: medium
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Layer dei ripari da OSM via Overpass: `tourism=alpine_hut|wilderness_hut`,
`amenity=shelter`. E' il layer che rende **azionabile** un avviso di temporale: non
"sta arrivando" ma "dove mi metto".

Verificato: CORS aperto, risposta ~1,2 KB per una bbox di valle. **Ma l'istanza pubblica
ha risposto 504 e il mirror kumi 502 durante la verifica**: il progetto deve tollerare
l'indisponibilita' senza sembrare rotto, e non deve interrogare a ogni pan della mappa.
<!-- SECTION:DESCRIPTION:END -->
