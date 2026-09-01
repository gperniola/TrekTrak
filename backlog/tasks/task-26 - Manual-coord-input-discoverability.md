---
id: TASK-26
title: Discoverability dell'input manuale coordinate (per esperti)
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - ux
  - power-user
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona C (esperta) C.3 — un escursionista esperto conosce già le coordinate del rifugio/cima dalla sua cartina IGM. Vuole **incollarle** invece di cercare il punto sulla mappa.

Oggi i campi Lat/Lon nella `WaypointCard` sono editabili in **modalità Learn** (`readOnly={isTrack}`), ma:
- Non discoverable in modalità Track (default)
- Niente "Incolla coordinate" come azione esplicita
- Niente parsing di formati alternativi (DMS, UTM)

## Task

### A. Editabilità in Track mode (opt-in)
- [ ] Permettere di editare Lat/Lon anche in Track mode, ma con conferma: "Modificare le coordinate manualmente sostituirà i dati del trail routing per questo waypoint. Continuare?"
- [ ] Triggererà autoFill ricalcolo automaticamente

### B. Bottone "Incolla coordinate" sul WaypointCard
- [ ] Bottone 📋 accanto al label Coordinate
- [ ] Apre un input field/modal con placeholder "46.7659, 10.5726" o "46° 45' 57\" N, 10° 34' 21\" E"
- [ ] Parser supporta:
  - Decimal: `46.7659, 10.5726`
  - DMS: `46° 45' 57" N, 10° 34' 21" E`
  - UTM (più complesso, opzionale): `32T 626089 5179234`
- [ ] On valid → updateWaypoint con coord parsed

### C. Documentare nel tutorial e glossario
- [ ] Glossario (TASK-16) entry: "WGS84, DMS, UTM"

## Acceptance criteria

- [ ] Incolla "42.4768, 13.5602" → waypoint posizionato a Corno Grande (Abruzzo)
- [ ] Incolla "42° 28' 36\" N, 13° 33' 37\" E" → stesso punto

## Riferimenti

- `src/components/panel/WaypointCard.tsx`
- `backlog/docs/persona-usability-tests.md` C.3
<!-- SECTION:DESCRIPTION:END -->

## Riconciliazione 2026-09-01

Due cose sono cambiate sotto questo piano, e chi lo raccogliesse com'e' scritto si
troverebbe a cercare pezzi di schermo che non esistono piu'.

**A parte da una premessa superata.** Dice «permettere di editare Lat/Lon anche in Track
mode»: dalla v0.15.2 in Track **i campi non ci sono affatto**, perche' un campo in cui non
si puo' scrivere non e' un campo — waypoint e tratta sono una riga di valori con il
dettaglio a fisarmonica (`TrackWaypointRow.tsx`). Se si vuole ancora l'inserimento a mano
in Track, il punto non e' «sbloccare il campo con una conferma» ma «aggiungere un comando
di modifica nel dettaglio della riga», accanto a «rinomina».

**C e' quasi assolto.** Il glossario della v0.15.3 ha `wgs84` e `gradi-decimali`, e
quest'ultima spiega la conversione da gradi/primi/secondi con l'esempio numerico. Manca
solo UTM, che nessuna parte dell'app usa.

B (incolla coordinate con parser DMS) resta il cuore del task ed e' intatto.

