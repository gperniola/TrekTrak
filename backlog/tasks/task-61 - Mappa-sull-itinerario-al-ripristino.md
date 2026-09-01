---
id: TASK-61
title: Al ripristino, la mappa deve guardare l'itinerario
status: To Do
assignee: []
created_date: '2026-09-01 18:00'
labels:
  - usability
  - map
  - offline
dependencies: []
priority: medium
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trovato mentre si verificava il pre-caricamento delle mattonelle (TASK-37).

Quando l'app riapre l'itinerario in lavorazione, `InteractiveMap` parte sempre da
`DEFAULT_CENTER` (42.351, 14.168) e **non si sposta sull'itinerario**. Poi
`GeolocateOnMount` la porta sulla posizione, se il permesso c'è.

Misurato: caricato un itinerario sul Gran Sasso (mattonella 4404,3026 allo zoom 13), la
mappa dopo il ricaricamento mostrava le mattonelle 4416-4420 / 3029-3031 — un altro posto.
I waypoint erano fuori campo.

### Perché conta, e perché conta di più adesso

Col GPS acceso non si nota: sei sul percorso, la mappa ti segue. Il caso che brucia è
l'altro, ed è proprio quello per cui esiste il pre-caricamento — apro l'app **senza
segnale e senza posizione** (permesso negato, GPS spento, dentro un rifugio), ho appena
scaricato le mattonelle del mio itinerario, e vedo la vista predefinita. Le mattonelle del
percorso ci sono, ma per arrivarci devo trascinare la mappa a mano fino a indovinare dove
sono — e ogni pezzo che attraverso fuori dall'area scaricata è grigio.

C'è già un precedente in casa: `PreviewRouteLayer` fa `fitBounds` sull'anteprima di un
percorso della libreria. È l'itinerario **in lavorazione** a non averlo.

## Task

- [ ] Al montaggio, se l'itinerario ripristinato ha almeno un waypoint con coordinate,
      inquadrarlo (`fitBounds` con padding, `maxZoom` ragionevole)
- [ ] Decidere il rapporto con `GeolocateOnMount`: chi arriva dopo vince, e non deve
      esserci un salto visibile. Probabilmente: si inquadra l'itinerario subito, e la
      posizione sposta la mappa **solo** se cade dentro (o vicino a) l'itinerario —
      altrimenti chi è a casa a preparare la gita si vede sbalzare via dal percorso
- [ ] Non inquadrare niente quando non c'è itinerario: la vista predefinita resta quella
- [ ] Scenario e2e: ricarico con un itinerario ripristinato → i marker dei waypoint sono
      a schermo

## Riferimenti

- `src/components/map/InteractiveMap.tsx:173` (`center={DEFAULT_CENTER}`)
- `src/components/map/GeolocateOnMount.tsx`
- `src/components/map/PreviewRouteLayer.tsx:43` (il `fitBounds` che esiste già)
- `src/lib/startup-itinerary.ts` (chi decide cosa si apre all'avvio)
<!-- SECTION:DESCRIPTION:END -->
