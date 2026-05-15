---
id: TASK-17
title: Quick-action popup su tap del marker (rinomina, elimina, copia coord)
status: To Do
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - ux
  - mobile
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Oggi i waypoint marker sulla mappa sono solo:
- Visualizzabili (numero verde)
- Trascinabili (drag per riposizionare)

Per **rinominare, eliminare, copiare coordinate** di un waypoint l'utente deve aprire la `WaypointCard` nel pannello (su mobile = aprire il drawer, perdendo la vista della mappa).

## Origine

Top-5 cross-persona + feature suggestion B1. Cfr. `backlog/docs/feature-suggestions.md` B1 + persona test B.2 / C.

## Task

- [ ] In `InteractiveMap.tsx` aggiungere un `<Popup>` a ogni `<Marker>`:
  - Click sul marker → apre popup (`marker.bindPopup` di Leaflet)
  - Contenuto: nome WP (editabile inline su click), 3 bottoni icona (Rinomina, Elimina, Copia coord), coordinate in piccolo
- [ ] L'editing inline del nome deve sincronizzare con `updateWaypoint`
- [ ] Il bottone "Elimina" mostra una micro-conferma inline (non `confirm()` nativo) prima di rimuovere
- [ ] Il bottone "Copia coord" copia `lat, lon` negli appunti con feedback toast (dipende da TASK-5)
- [ ] Popup chiude su tap fuori, ESC, o click su altro marker

### Mobile-specific
- [ ] Su mobile il popup deve essere abbastanza grande per touch (≥120px wide, padding adeguato)
- [ ] Considerare di passare attraverso un component custom (`<Popup>` di react-leaflet) invece dello stile default Leaflet che non rispetta la dark theme

## Acceptance criteria

- [ ] Tap su un marker apre il popup con 3 azioni
- [ ] Rinomina inline aggiorna il nome nel pannello in tempo reale
- [ ] Su mobile il popup è leggibile (touch target ≥44px su ogni azione)
- [ ] Niente perdita del drag (drag rimane funzionante su long-press)

## Riferimenti

- `src/components/map/InteractiveMap.tsx:91-101` (Marker rendering attuale)
- `backlog/docs/feature-suggestions.md` B1
- `backlog/docs/persona-usability-tests.md` Persona B.2 / Persona C.3

## Dipendenze

- [[task-5-in-app-modal-and-toast]] per Toast su copia coord
<!-- SECTION:DESCRIPTION:END -->
