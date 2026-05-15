---
id: TASK-37
title: Pre-cache tile della mappa per uso offline (escursioni senza segnale)
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - pwa
  - offline
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Feature** (suggestion **E2**) — il service worker (`app/sw.ts`) già fa caching runtime delle tile (CacheFirst). Funziona quando l'utente le ha visualizzate almeno una volta. Per uso "offline pianificato" (escursione senza segnale) serve un pre-caching esplicito.

## Task

### Trigger
- [ ] Aggiungere bottone "Scarica per offline" nella `SavedItinerariesModal` o nell'`ActionBar` quando l'itinerario ha bounds calcolabili
- [ ] Calcolare i bounds dell'itinerario + un buffer del 20%

### Pre-fetch
- [ ] Generare gli URL delle tile per i livelli zoom 13-17 dentro i bounds (per ogni base map disponibile o solo quella corrente)
- [ ] `fetch(url)` per ognuna → il service worker le mette in cache automaticamente
- [ ] Progress bar nel modale: "Scaricamento tile 124/600..."

### Storage management
- [ ] Mostrare lo spazio usato per offline (StorageManager API)
- [ ] Bottone "Pulisci cache offline" per liberare

### Limiti
- [ ] Cap a ~500 tile per evitare abuso dei provider (rispettoso di tile usage policy)
- [ ] Warning se i bounds sono troppo grandi (es. > 100 km²)

## Acceptance criteria

- [ ] Scarico le tile per un itinerario → metto offline (DevTools network: offline) → la mappa funziona ancora
- [ ] Progress feedback durante download
- [ ] Cache size accessibile e cancellabile

## Riferimenti

- `src/app/sw.ts` (cache strategy esistente)
- `backlog/docs/feature-suggestions.md` E2
<!-- SECTION:DESCRIPTION:END -->
