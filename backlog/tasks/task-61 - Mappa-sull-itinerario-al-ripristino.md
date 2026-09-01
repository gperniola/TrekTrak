---
id: TASK-61
title: Al ripristino, la mappa deve guardare l'itinerario
status: Done
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

- [x] Al montaggio, se l'itinerario ripristinato ha almeno un waypoint con coordinate,
      inquadrarlo (`fitBounds` con padding, `maxZoom` ragionevole)
- [x] Rapporto con `GeolocateOnMount`: si inquadra l'itinerario subito; la posizione
      sposta la mappa solo se cade **entro 5 km** dal percorso. Cinque perché il
      parcheggio dista dall'attacco del sentiero meno di così, e casa molto di più
- [x] Non inquadrare niente quando non c'è itinerario: la vista predefinita resta quella
- [x] Scenario e2e: ricarico con un itinerario ripristinato → i marker dei waypoint sono
      a schermo

## Riferimenti

- `src/components/map/InteractiveMap.tsx:173` (`center={DEFAULT_CENTER}`)
- `src/components/map/GeolocateOnMount.tsx`
- `src/components/map/PreviewRouteLayer.tsx:43` (il `fitBounds` che esiste già)
- `src/lib/startup-itinerary.ts` (chi decide cosa si apre all'avvio)
<!-- SECTION:DESCRIPTION:END -->

## Com'è stato fatto

Le decisioni stanno in `lib/vista-iniziale.ts`, senza Leaflet: quale vista vince
all'apertura (salvata → itinerario → predefinita) e se seguire il fix GPS quando arriva.
In `GeolocateOnMount` resta solo il fare.

## Le tre cose scoperte facendolo

1. **`tt_map_view` non è «dove sta la mappa»**: è dove l'utente *ha scelto* di guardare, ed
   è anche il segnale che fa saltare la geolocalizzazione. Avevo "sistemato" l'ordine degli
   ascoltatori per registrare anche l'inquadramento automatico, e il risultato — misurato
   con una sonda, non dedotto — era che **il GPS non veniva più interrogato affatto**: sul
   sentiero la mappa avrebbe smesso di seguire chi cammina. Ora l'inquadramento di apertura
   si fa `senzaRegistrare`.

2. **Ascoltare i waypoint non è ascoltare il ripristino.** La prima stesura inquadrava a
   ogni cambio dei waypoint, quindi anche quando l'utente ne mette il **primo** a mano: la
   mappa gli sarebbe saltata sotto le dita, centrandosi su quel punto allo zoom 15. Ora lo
   store espone `ripristiniItinerario`, un conteggio che dice esattamente «è tornato un
   itinerario da prima». Il test che lo protegge fallisce se si torna ad ascoltare i
   waypoint — verificato per mutazione.

3. **Il nostro `fitBounds` faceva scattare `movestart`** e l'app lo avrebbe scambiato per un
   gesto dell'utente, sopprimendo per sempre il GPS. Serve distinguere due cose che
   sembrano una: «questo movimento è nostro» e «questa vista non va registrata».

## Verifica

Cinque scenari in `e2e/vista-iniziale.spec.ts`: waypoint a schermo senza posizione;
posizione lontana che non porta via; posizione vicina che viene seguita (è anche il
controllo di non-vacuità del precedente); vista scelta a mano che sopravvive alla ricarica;
primo waypoint messo a mano che non sposta la mappa.
