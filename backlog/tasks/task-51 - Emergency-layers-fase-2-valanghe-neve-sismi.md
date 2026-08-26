---
id: TASK-51
title: Layer emergenza fase 2 — valanghe, copertura nevosa, terremoti/GDACS (v0.12.0)
status: To Do
assignee: []
created_date: '2026-08-25 15:00'
labels:
  - map
  - emergency-layers
  - feature
dependencies:
  - task-52
priority: medium
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seconda fase dei layer di emergenza (la fase 1 — incendi + allerte DPC — è la v0.11.0).
Da rilasciare **prima dell'inverno**: valanghe e neve sono le categorie stagionali.

Tutte le fonti sono **già validate** (fetch reali, CORS aperto, client-side) — dettagli completi con
endpoint in `backlog/docs/emergency-layers-design.md` **Appendice B**. In sintesi:

- **Valanghe**: aggregato EAWS su `static.avalanche.report` (rating 1–5 per micro-regione, tutte le
  regioni italiane incluso `IT-MeteoMont`/Appennini) + geometrie da `regions.avalanches.org`.
  Gestire stagionalità (404 = nessun bollettino) e fallback data odierna→ieri.
- **Copertura nevosa**: NASA GIBS WMTS `MODIS_Terra_NDSI_Snow_Cover`, senza chiave, maxNativeZoom 8.
- **Terremoti**: INGV FDSN event (GeoJSON, CC-BY).
- **GDACS multi-hazard**: opzionale, soglia di rilevanza globale.

Grazie al registry della fase 1, il lavoro dovrebbe ridursi a: nuove entry `EMERGENCY_LAYERS`
(+ categoria `neve`/`sismi`), un fetcher/parser per i ratings valanghe con join id→GeoJSON, popup
dedicati (valanga: rating am/pm e quota; sisma: magnitudo/profondità/ora), voci legenda scala EAWS.

## Task

- [ ] Layer valanghe (zones): fetch ratings + join micro-regioni, colori scala EAWS 1–5, popup, stagionalità
- [ ] Layer copertura nevosa (tile WMTS GIBS con data, maxNativeZoom 8)
- [ ] Layer terremoti INGV (points, ultime 48h, minmag configurato, popup)
- [ ] Valutare layer GDACS (decidere se il rapporto segnale/rumore per l'Italia lo giustifica)
- [ ] Estendere registry/pannello con le nuove categorie
- [ ] Test secondo il pattern della fase 1

## Acceptance criteria

- [ ] Rating valanghe visibile su Alpi e Appennini quando i bollettini sono in stagione
- [ ] Fuori stagione il layer mostra "nessun bollettino", non un errore
- [ ] Nessuna nuova API key richiesta (tutte le fonti sono open)

## Riferimenti

- `backlog/docs/emergency-layers-design.md` (Appendice B — endpoint verificati il 2026-08-25)
- Fase 1: [[task-52]]
<!-- SECTION:DESCRIPTION:END -->
