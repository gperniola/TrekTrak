---
id: TASK-58
title: Suggerimento 1 — rifugi, bivacchi e ricoveri
status: Done
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

## Esito (2026-08-27)

Fatto: `lib/shelters-api.ts` + `EmergencyShelterLayer`, nuovo tipo di layer
`viewport` (si interroga sull'area inquadrata, nessun refresh a tempo — Overpass e' un
servizio pubblico condiviso).

**Misurato sui dati veri** su una bbox di Dolomiti: 110 ripari, di cui 66 rifugi, 39
ricoveri, 5 bivacchi; 78 con nome, 17 con capienza. E il dato che ha deciso
l'implementazione: **92 su 110 non sono nodi ma way**, tutte con `center` grazie a
`out center` — senza quel parametro si perdeva l'84% dei ripari.

Fragilita' confermata due volte: `overpass-api.de` ha risposto **504** da riga di
comando e **200 con 110 elementi** dal browser a un minuto di distanza; i mirror kumi e
private.coffee non sono raggiungibili in CORS, quindi **niente ripiego**: si dice che il
servizio e' occupato e si invita a riprovare. Sotto zoom 11 non si interroga affatto e
si scrive "avvicinati", che non e' un errore.

Il popup dichiara che apertura e stato **non sono verificati**: un ricovero mappato puo'
essere chiuso o diroccato, e scoprirlo sotto la pioggia e' peggio che saperlo prima.
