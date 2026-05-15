---
id: TASK-33
title: Import GPX da Komoot / Wikiloc / Strava
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - import
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Feature** (suggestion **B4**) — oggi l'utente parte sempre da zero. Per accelerare l'onboarding e dare valore agli esperti, importare un GPX da Komoot/Wikiloc/Strava e usarlo come base di pianificazione/studio.

## Task

### Parser GPX
- [ ] Creare `lib/import-gpx.ts`:
  - Parser di file GPX 1.1 (DOMParser)
  - Estrai waypoint (`<wpt>`) e/o segmenti di traccia (`<trkseg>`)
  - Per traccia, semplificare con Douglas-Peucker se > 50 punti (cap waypoint a 50)
  - Genera nomi auto (preserva quelli del GPX se presenti)

### UI
- [ ] In `ItineraryHeader.tsx` aggiungere bottone "Importa GPX" (accanto a "Importa JSON")
- [ ] Modale di preview con:
  - Numero di waypoint trovati
  - Lunghezza percorso
  - Anteprima mini-mappa
- [ ] Conferma → caricamento via `loadItinerary`

### Track simplification
- [ ] Per traccia continua, scegliere automaticamente waypoint significativi:
  - Cima/passo (sentire altitudine locale max)
  - Cambio di direzione importante (azimuth Δ > 45°)
  - Distanza minima 200m fra waypoint

## Acceptance criteria

- [ ] Import di un GPX standard di Komoot funziona
- [ ] Track > 50 punti viene semplificato a max 50
- [ ] Cancel del modale non sovrascrive itinerario attuale

## Riferimenti

- `src/lib/export-gpx.ts` (encoder esistente, simmetrico)
- `backlog/docs/feature-suggestions.md` B4
<!-- SECTION:DESCRIPTION:END -->
