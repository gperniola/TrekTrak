# Sicurezza temporali e pericoli in quota — analisi delle fonti e piano

Stato: analisi conclusa il 2026-08-27, fonti **verificate a mano** quello stesso giorno.
Origine: richiesta dell'utente di valutare un layer dei fenomeni temporaleschi tra gli
overlay di emergenza, più suggerimenti su cos'altro abbia senso in quel contesto.

## Il punto di partenza: "temporali" sono due domande diverse

1. **Prima di partire** — a che ora, sul *mio* percorso, il rischio sale? Risposta per
   punto e per ora.
2. **Sul posto, adesso** — dove è la cella e dove sta andando? Risposta per immagine.

Sono due prodotti diversi, con fonti diverse, e conviene non confonderli in un unico
"layer meteo".

## Fonti verificate il 2026-08-27

| Fonte | Cosa dà | Chiave | CORS | Esito misurato |
|---|---|---|---|---|
| **Open-Meteo** `api.open-meteo.com/v1/forecast` | `cape`, `weather_code` (95/96/99 = temporale), `wind_gusts_10m`, `precipitation_probability`, orario | no | `*` | **6 waypoint × 48 h in 12 KB in una sola chiamata**; restituisce anche `elevation` del modello (2520 m sul punto di prova in Dolomiti). CAPE con ciclo diurno da manuale: 20 J/kg alle 10:00 → 660 alle 18:00 |
| **RainViewer** `api.rainviewer.com/public/weather-maps.json` | tile radar precipitazioni | no | `*` | 13 frame = **ultime 2 h a passo 10 min**; `nowcast: 0`, cioè **nessun frame di previsione** sul piano gratuito. Copertura Italia confermata (tile z5/z6 da 2,8–4,9 KB, quindi con contenuto) |
| **EUMETSAT** `view.eumetsat.int/geoserver/wms` | Lifted Index MSG (instabilità da satellite) | no | `*` | GetCapabilities: 255 strati, `msg_gii_li` / `gii_liftedindex` presenti |
| **Meteoalarm CAP** `feeds.meteoalarm.org/api/v1/warnings/feeds-italy` | avvisi ufficiali europei, temporali inclusi | no | **assente** | 200 ma **1.021.948 byte**: servirebbe proxy server + filtro. Si sovrappone in parte al bollettino DPC già integrato |
| **Radar DPC (VMI)** `radar-api.protezionecivile.it` | radar nazionale ufficiale | — | — | **403 Access Denied**, anche con user-agent da browser e `Referer` del loro sito. Non utilizzabile senza accordo |
| **Fulmini in tempo reale** (Blitzortung, LightningMaps) | scariche | — | — | nessuna API libera ridistribuibile: **escluso**. È la cosa che l'utente si aspetta da un "layer temporali", e va detto che non c'è |
| **INGV** `webservices.ingv.it/fdsnws/event/1/query` | terremoti, GeoJSON | no | `*` | 200, risposta piccola. Serve a [[task-51]] |
| **Overpass** `overpass-api.de/api/interpreter` | rifugi, bivacchi, ricoveri OSM | no | `*` | 200 dal browser, risposta ~1,2 KB per una bbox di valle. L'istanza pubblica ha dato 504/502 da riga di comando: **serve tollerare l'indisponibilità** |

## Perché la fase A viene prima del layer

TrekTrak sa tre cose che nessuna app meteo sa: **i waypoint, le loro quote, e la stima
Munter dei tempi**. Incrociandole con Open-Meteo può dire *"al waypoint 5, dove arrivi
verso le 14:40, il CAPE è a 540 e la probabilità di temporale è al 60%"*. È esattamente
la regola pratica dell'andare in montagna — in vetta presto, giù prima del pomeriggio —
e nessun'altra app può darla, perché non conosce il passo di chi cammina.

Il radar gratuito, da solo, mostra **il passato** (ultime 2 h) e offline non esiste,
perché i dati di emergenza sono esclusi dalla cache del service worker per scelta. Da
solo rischia di essere il layer che si guarda quando è già tardi.

## Piano

### Fase A — finestra temporali sul percorso → [[task-56]]
Una chiamata Open-Meteo multi-punto per l'itinerario corrente. Banda oraria sul profilo
altimetrico, una riga per waypoint, e un avviso quando l'orario stimato su un tratto
esposto cade nella finestra critica. Include le **raffiche di vento** (suggerimento 2),
che arrivano nella stessa chiamata senza costo aggiuntivo.
Didattico: leggere il CAPE, il ciclo diurno della convezione, la regola 30/30.

### Fase B — layer radar sulla mappa → [[task-57]]
Stessa meccanica dei layer incendi: tile RainViewer con animazione delle ultime 2 h,
orario in legenda, e la legenda che dice **chiaramente** che è passato e non previsione.

### Suggerimento 1 — rifugi e ricoveri → [[task-58]]
Overpass/OSM: `tourism=alpine_hut|wilderness_hut`, `amenity=shelter`. È il layer che
rende *azionabile* il temporale: non "sta arrivando" ma "dove mi metto". Da progettare
tollerando il 502/504 dell'istanza pubblica.

### Suggerimento 3 — tramonto e crepuscolo → [[task-59]]
Nessuna fonte esterna: si calcola in locale. Incrociato con la stima Munter dice
"arrivi al buio". Costo quasi zero, valore alto.

### Fase C — instabilità satellitare (da decidere)
EUMETSAT WMS, gemello tecnico del FWI: costo di sviluppo quasi nullo perché la
meccanica WMS è già in casa. **Decisione rinviata** a dopo il rilascio di A e B.

### Escluse
Fulmini in tempo reale (nessuna licenza), radar DPC (403), livelli idrometrici
(frammentati per regione). Frane IFFI/ISPRA: plausibile come WMS ma **non verificato**.

## Avvertimento che vale per tutte le fasi

Ogni layer in più allarga la superficie di due classi di difetto che in questo progetto
si sono già presentate:

1. **dati vecchi o rotti presentati come freschi** — la classe dominante della campagna
   di review della v0.11.0. Disciplina: orario di aggiornamento e stato di errore
   visibili su ogni layer, e mai un layer vuoto spacciato per aggiornato.
2. **il tocco su un overlay che diventa un waypoint** — presentatasi due volte
   (v0.11.0 e v0.11.7). Ora c'è una rete automatica
   (`MapOverlayGuardCoverage.test.ts`), ma va tenuta viva.

Vale anche il posizionamento già scelto per i layer di emergenza: non sostituiscono i
canali ufficiali di allerta. Per i temporali conta ancora di più, perché la conseguenza
è immediata.
