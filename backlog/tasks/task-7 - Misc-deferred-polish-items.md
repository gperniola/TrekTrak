---
id: TASK-7
title: Misc deferred polish items (ORS key docs, copy link tooltip, leaflet markers)
status: In Progress
assignee: []
created_date: '2026-05-15 17:30'
labels:
  - polish
  - documentation
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Raggruppa i deferred minori della campagna polish/v0.6.2 che non meritano una task dedicata.

## Sotto-task

### R3-05 — Documentare ORS API key client-side
- [ ] Aggiungere sezione in `README.md` (o creare `docs/setup.md`) che spiega:
  - Perché `NEXT_PUBLIC_ORS_API_KEY` è esposta nel bundle client (pattern standard per ORS via CORS)
  - Come ottenere e limitare la propria key (dashboard ORS, restrizioni domain/referrer)
  - Cosa succede se manca (`isRoutingAvailable()` ritorna false, fallback a classic)
- [x] Aggiornare `.env.example` con commento esplicativo

### R7-05 — Tooltip su "Copia link" disabilitato
- [x] In `panel/ActionBar.tsx`, quando il bottone "Copia link" è disabilitato, aggiungere `title="Servono almeno 2 waypoint con coordinate valide"` (e `aria-describedby` per screen reader) — fatto via `title` (`ActionBar.tsx:415`), senza `aria-describedby`

### R5-08 — Leaflet marker aria-label
- [ ] Indagare se Leaflet espone un'API per impostare `aria-label` sui marker creati via `L.marker(..., { icon })`. Probabilmente serve un wrapper custom o usare `Marker.bindTooltip()` con `permanent: false` per fornire un nome accessibile
- [ ] Se non fattibile in modo pulito, archiviare come limitazione nota

## Riferimenti

- `backlog/docs/polish-v0.6.2-bug-log.md` righe R3-05, R5-08, R7-05

## Stato audit 2026-08-25

R7-05 e il commento in `.env.example` risultano già fatti (spuntati retroattivamente). **Resta da fare: la sezione README di R3-05 (perché la key ORS è esposta client-side e come limitarla per dominio — oggi il README copre solo il setup) e l'indagine R5-08 sugli aria-label dei marker Leaflet.**
<!-- SECTION:DESCRIPTION:END -->
