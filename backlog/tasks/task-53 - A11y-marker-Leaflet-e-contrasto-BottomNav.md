---
id: TASK-53
title: A11y — nome accessibile dei marker Leaflet e contrasto della BottomNav
status: Done
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

- [x] Nessuna failure `aria-command-name` con bussola attiva, righello attivo, quiz attivo e
      itinerario con waypoint
      → **la causa era un'altra**: tutti i marker decorativi avevano già `interactive={false}`,
      ma `keyboard` è `true` per default e NON dipende da `interactive` — Leaflet mette
      comunque `tabIndex=0` e `role="button"` (leaflet-src.js:7914). Serviva `keyboard={false}`.
      È la ragione per cui il difetto era sopravvissuto: sembrava già gestito.
- [x] I marker decorativi non sono più nell'ordine di tabulazione
      → verificato a mappa popolata: 5 marker, **0 tabulabili senza nome**
- [x] I marker interattivi hanno un nome accessibile che dice *quale* marker sono
      → "Waypoint 1" invece di "1", con testo di supporto nascosto alla vista
- [x] Nessuna failure `color-contrast` sulla BottomNav
      → `text-gray-500` su `bg-gray-900` misurava **3,67** (soglia AA 4,5 per testo normale,
      e le etichette sono a 11px); `text-gray-400` misura **6,99**
- [x] Lighthouse a11y ≥ 97 con mappa popolata e bottom nav visibile
      → **100**, zero failure, sia in snapshot a mappa popolata sia in navigazione
- [x] Nessuna regressione sui test → 789 verdi

Resta aperto, ma fuori da questo task: `image-size-responsive` (peso 1) in best-practices,
che sono i tile raster della mappa.

## Riferimenti

- Misure e analisi: `backlog/docs/emergency-layers-plan.md`, checklist manuale pre-merge
- Il 97 storico è in CHANGELOG v0.6.2, misurato in condizioni diverse
<!-- SECTION:DESCRIPTION:END -->
