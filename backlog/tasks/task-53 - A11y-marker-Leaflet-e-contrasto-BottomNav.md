---
id: TASK-53
title: A11y — nome accessibile dei marker Leaflet e contrasto della BottomNav
status: To Do
assignee: []
created_date: '2026-08-26 16:00'
labels:
  - a11y
  - map
  - mobile
dependencies: []
priority: medium
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Due failure Lighthouse **preesistenti**, emerse misurando l'accessibilità durante la campagna di
review di [[task-52]] e tenute fuori da quella release perché toccano componenti condivisi e non
hanno nulla a che vedere coi layer di emergenza.

Con l'app in uso reale (mappa popolata, bottom nav mobile) il punteggio a11y è **92-96**, non il 97
registrato ai tempi della v0.6.2: quel 97 è stato misurato prima che esistessero la bottom nav
(v0.10.0) e diversi marker sulla mappa. Le due voci sotto pesano 7 ciascuna.

### 1. `aria-command-name` — marker Leaflet senza nome accessibile

**Causa a monte, una sola:** `L.Marker` ha `keyboard: true` per default, e Leaflet mette
`role="button"` + `tabindex="0"` sull'elemento icona. Ogni marker `divIcon` dell'app eredita quindi
un ruolo interattivo **senza nome accessibile**, e finisce nell'ordine di tabulazione.

Verificato in browser: i due nodi segnalati da Lighthouse sono le crocine di `CompassTool`
(SVG 20×20), presenti quando la bussola è attiva. Lo stesso vale per gli altri marker quando i
rispettivi strumenti sono accesi o ci sono waypoint.

La correzione non è "aggiungere aria-label a tutti", ma decidere **marker per marker** se è davvero
operabile da tastiera:

| Componente | Marker | Proposta |
|---|---|---|
| `InteractiveMap` (`greenIcon`) | waypoint numerati | interattivi (draggable + popup): `keyboard: true` + nome tipo "Waypoint 3, Mellitto" |
| `CompassTool` | crocine bussola | decorativi → `keyboard: false` |
| `CoordinateGrid` | etichette coordinate | decorativi (già `pointer-events: none`) → `keyboard: false` |
| `PreviewRouteLayer` | numeri anteprima | anteprima read-only → `keyboard: false` |
| `RulerTool` | capi A e B | da verificare se draggable; se sì, nome "Capo A del righello" |
| `QuizMarkers` | A e B del quiz | da verificare se cliccabili; se sì, nome descrittivo |

### 2. `color-contrast` — voci inattive della BottomNav

`BottomNav` usa `text-gray-500` su `bg-gray-900` per le destinazioni non attive: sotto la soglia
AA. Una riga (`text-gray-400` o simile), ma cambia l'aspetto della navigazione mobile su tutta
l'app, quindi va guardata a occhio prima di darla per buona.

## Acceptance criteria

- [ ] Nessuna failure `aria-command-name` con bussola attiva, righello attivo, quiz attivo e
      itinerario con waypoint (i quattro casi vanno provati, non solo lo stato vuoto)
- [ ] I marker decorativi non sono più nell'ordine di tabulazione
- [ ] I marker interattivi hanno un nome accessibile che dice *quale* marker sono
- [ ] Nessuna failure `color-contrast` sulla BottomNav, aspetto approvato a occhio
- [ ] Lighthouse a11y ≥ 97 con mappa popolata e bottom nav visibile — la condizione in cui il
      punteggio è stato misurato a 92-96, non a mappa vuota
- [ ] Nessuna regressione sui 708 test

## Riferimenti

- Misure e analisi: `backlog/docs/emergency-layers-plan.md`, checklist manuale pre-merge
- Il 97 storico è in CHANGELOG v0.6.2, misurato in condizioni diverse
<!-- SECTION:DESCRIPTION:END -->
