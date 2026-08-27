---
id: TASK-56
title: Fase A — finestra temporali e raffiche sul percorso
status: Done
assignee: []
created_date: '2026-08-27 16:30'
labels:
  - weather
  - safety
  - didattica
dependencies: []
priority: high
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fase A di [[storm-safety-design]]: incrociare l'itinerario con l'ora.

Una chiamata Open-Meteo multi-punto (misurata: **6 waypoint x 48 h in 12 KB**, nessuna
chiave, CORS aperto) per `cape`, `weather_code`, `precipitation_probability`,
`wind_gusts_10m`. Banda oraria sul profilo altimetrico, riga per waypoint, avviso quando
l'orario stimato con Munter su un tratto esposto cade nella finestra critica.

Include il suggerimento **raffiche di vento**: arriva nella stessa chiamata.

Parte didattica: come si legge il CAPE, il ciclo diurno della convezione in montagna,
la regola 30/30.
<!-- SECTION:DESCRIPTION:END -->

## Esito (2026-08-27)

Fatta, e verificata sui dati veri. Struttura: `lib/weather-api.ts` (client Open-Meteo),
`lib/route-weather.ts` (tutto puro: campionamento, orari, classificazione, fasce,
verdetto), `components/weather/RouteWeatherPanel.tsx`.

Il pulsante **Meteo** ora apre il pannello del percorso invece di Meteoblue in una
scheda; il collegamento a Meteoblue vive dentro il pannello come "previsione completa".

**Tre difetti di progetto trovati provandolo, non dai test:**

1. **Fuso.** La finestra critica era `getUTCHours()` stampato cosi' com'era: in Italia
   mostrava "10-21" per una fascia che si legge 12-23. Due ore di errore su
   un'informazione di sicurezza, invisibile ai test perche' al loro interno tutto era
   coerentemente UTC. Ora la finestra porta **istanti** e il fuso si applica una volta
   sola, quando si scrive a schermo.
2. **Una fascia sola.** Min-max diventava "00:00-00:00" su una giornata realmente
   instabile (Abruzzo, CAPE sopra 800 quasi tutto il giorno): aritmeticamente giusto e
   inutile. Ora le fasce sono quelle vere, **contigue**, e possono essere piu' di una.
3. **Il messaggio diceva il falso.** Con la criticita' che cade fra due punti
   campionati, scriveva "verso le 11:00 sei a «X» e la previsione e' critica" mentre a
   quell'ora, in quel punto, era tranquilla. Ora nomina l'ora della **fascia**, non
   l'arrivo al punto, e dice inizio e fine.

Include il **suggerimento 2** (raffiche, stessa chiamata) e il **suggerimento 3**
(tramonto, [[task-59]]).
