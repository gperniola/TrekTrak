# Layer di emergenza sulla mappa — Design (fase 1, v0.11.0)

**Data:** 2026-08-25 · **Stato:** approvato in brainstorming, in attesa di piano di implementazione
**Fase 2 (v0.12.0):** valanghe + copertura nevosa + terremoti/GDACS → vedi [[task-51]] e Appendice B.

## 1. Obiettivo

Aggiungere alla mappa layer overlay attivabili con dati di emergenza per l'Italia: **incendi**
(tempo reale e previsionale) e **allerte meteo-idro della Protezione Civile** (alluvioni **e frane**:
la criticità idrogeologica DPC include esplicitamente i fenomeni franosi). Scenari d'uso alla pari:
pianificazione a casa (rischio previsionale) e consultazione sul campo (cosa succede ora).

**Fuori scope (deciso, YAGNI):** incrocio automatico layer↔itinerario (falsa sicurezza), notifiche
push, FWI multi-giorno, Copernicus EMS (serve proxy, valore basso), precache offline dei dati di
emergenza, layer fase 2 (in v0.12.0).

## 2. Fonti dati (verificate con fetch reali il 2026-08-25)

### 2.1 NASA FIRMS — focolai attivi (hotspot satellitari)

- Endpoint: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{bbox}/{giorni}`
- Sorgenti usate: `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT` (MODIS escluso, risoluzione 1 km vs 375 m)
- Bbox Italia fissa: `6.6,35.4,18.6,47.1` (ordine `west,south,east,north`), 1 giorno
- Risposta CSV: `latitude, longitude, frp, confidence, acq_date, acq_time, satellite, …`
- **MAP_KEY gratuita, server-only** (`FIRMS_MAP_KEY`, mai `NEXT_PUBLIC_`). Limite 5000 transazioni/10 min
  (il nostro consumo: 3 richieste ogni 15 min di cache → irrilevante)
- Aggiornamento upstream: near-real-time, ~3h di latenza

### 2.2 EFFIS (Copernicus) — WMS raster

- Endpoint WMS: `https://maps.effis.emergency.copernicus.eu/effis?service=WMS`
- Layer usati (nomi confermati dal GetCapabilities):
  - `effis.nrt.ba.poly` — perimetri aree bruciate near-real-time (solo incendi >30 ha)
  - `mf010.fwi` — Fire Weather Index previsionale (per la fase 1: solo il giorno corrente)
- **Trappola: parametro `TIME=YYYY-MM-DD` obbligatorio** (altrimenti default indefinito).
  Aree bruciate: `TIME` = intervallo da inizio anno a oggi. FWI: `TIME` = oggi.
- Nessuna auth; CORS `*` verificato (comunque irrilevante: i tile WMS viaggiano come `<img>`)
- Attribution: Copernicus / EFFIS

### 2.3 DPC — bollettino di criticità idrogeologica/idraulica (GitHub ufficiale)

- Repo: `pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica` — **attivo** (push verificato in
  giornata), licenza **CC-BY 4.0**, aggiornamento giornaliero entro le ~16:00 (+ eventuali aggiornamenti)
- File (via `raw.githubusercontent.com`, CORS `*` verificato):
  - Indice: `files/{YYYYMMDD_HHMM}.json`
  - Geometrie: `files/topojson/{YYYYMMDD_HHMM}_today.json` e `_tomorrow.json` (TopoJSON, ~1,2 MB,
    156 zone di allerta)
- Properties per zona: `"Nome zona"`, `"Per rischio idraulico"`, `"Per rischio temporali"`,
  `"Per rischio idrogeologico"` — valori testuali tipo `"ORDINARIA CRITICITA' / ALLERTA GIALLA"`
- **Trappola: non esiste `latest.json`** (404 verificato) e il filename contiene l'orario di emissione,
  variabile → discovery dell'ultimo bollettino via GitHub API commits (`GET /repos/pcm-dpc/…/commits/master`,
  rate limit 60 req/h/IP senza token) → **va fatta server-side con cache**
- Il rischio **frane** è coperto: la criticità idrogeologica DPC = "attivazione di fenomeni franosi
  (crolli, colate detritiche, scivolamenti), ruscellamento superficiale, piene improvvise del reticolo minore"

### 2.4 Fonti valutate e scartate (evidenza nel report di ricerca)

EFAS real-time (solo partner registrati) · geoportale DPC ArcGIS (nessun REST pubblico, 404) ·
IT-alert (nessun feed CAP pubblico) · Copernicus EMS (no CORS, valore basso) · bollettino
suscettività incendi DPC (solo PDF) · ISPRA IFFI (inventario storico, non live) ·
`geoservices.isprambiente.it` (irraggiungibile nei test).

## 3. Requisiti (dalle risposte utente)

1. Layer previsionali E in tempo reale, l'utente sceglie cosa attivare
2. Toggle rapido sulla mappa; scelta persistita in `settings.mapDisplay` (nessuna UI duplicata in Impostazioni)
3. Elementi **interattivi**: popup con dettagli; nessun incrocio con l'itinerario
4. Rilascio in due fasi stagionali: fase 1 = incendi + alluvioni/frane; fase 2 = valanghe/neve/sismi
5. Architettura a **registry** estensibile: la fase 2 deve ridursi (quasi) a nuove entry

## 4. Architettura

### 4.1 Registry e tipi — `src/lib/emergency-layers.ts`

```ts
export type EmergencyLayerId = 'fires-hotspots' | 'fires-burned' | 'fires-fwi' | 'dpc-alerts';
export type EmergencyLayerKind = 'wms' | 'points' | 'zones';
export type EmergencyCategory = 'incendi' | 'alluvioni';

export interface EmergencyLayerDef {
  id: EmergencyLayerId;
  category: EmergencyCategory;
  label: string;              // es. "Focolai attivi (24h)"
  description: string;        // una riga per il pannello
  kind: EmergencyLayerKind;
  attribution: string;        // aggiunta all'attribution Leaflet quando attivo
  refreshMinutes: number | null; // null = niente polling (WMS)
  legend: LegendEntry[];      // { color, label }
  // config specifica per kind (wms: url/layer/timeMode/opacity; points|zones: fetcher id)
}

export const EMERGENCY_LAYERS: EmergencyLayerDef[] = [ /* 4 entry fase 1 */ ];
```

Entry fase 1:

| id | kind | dati | refresh |
|---|---|---|---|
| `fires-hotspots` | `points` | proxy `/api/fires` | 15 min |
| `fires-burned` | `wms` | EFFIS `effis.nrt.ba.poly`, TIME = anno corrente→oggi | — |
| `fires-fwi` | `wms` | EFFIS `mf010.fwi`, TIME = oggi, opacity 0.55 | — |
| `dpc-alerts` | `zones` | discovery `/api/dpc-alerts` + TopoJSON da raw GitHub | 30 min |

### 4.2 Parsing — `src/lib/firms.ts` e `src/lib/dpc.ts`

- `firms.ts`: parse CSV → `FirePoint { lat, lon, frp, confidence, acquiredAt (ISO UTC), satellite }`;
  merge multi-sensore; tollerante a righe malformate (skip, non throw). Usato dal proxy (server-side).
- `dpc.ts`: TopoJSON → GeoJSON via `topojson-client` (client-side); parsing del livello di allerta dal
  testo (`NESSUNA` → verde, `GIALLA`, `ARANCIONE`, `ROSSA`); livello zona = **max dei 3 rischi**;
  estrazione dettaglio per popup.

### 4.3 API route proxy (pattern `api/elevation` + `lib/elevation-proxy`)

- **`/api/fires`** (`src/app/api/fires/route.ts` + `src/lib/fires-proxy.ts`): chiama FIRMS per i 3
  sensori VIIRS, merge, risponde `{ points: FirePoint[], fetchedAt }`. Cache in-memory a livello di
  modulo, TTL 15 min (best-effort su serverless: ogni istanza ha la sua — accettabile dato il limite
  FIRMS). Upstream in errore → 502 `{ error }`; senza `FIRMS_MAP_KEY` → 503 con messaggio chiaro
  (layer marcato "non disponibile" nel pannello).
- **`/api/dpc-alerts`** (`+ src/lib/dpc-discovery.ts`): SOLO discovery — GitHub API commits con cache
  30 min → `{ bulletinId, topojsonUrls: { today, tomorrow }, issuedAt }`. Il client scarica il TopoJSON
  **direttamente** da `raw.githubusercontent.com` (CORS ok, CDN). Se GitHub API è rate-limited, serve
  l'ultimo `bulletinId` cacheato.

### 4.4 Stato

- **Persistito**: `settings.mapDisplay.emergencyLayers?: EmergencyLayerId[]` (default `[]`).
  Campo nuovo opzionale → retrocompatibile, **nessuna migration**; id sconosciuti al load vengono
  ignorati (rimozione futura di layer safe).
- **Runtime**: nuovo `src/stores/emergencyStore.ts` (Zustand): per layer `{ data, loading, error,
  lastFetch }` + `dpcDay: 'today' | 'tomorrow'`; azioni `activate/deactivate/refresh`; auto-refresh con
  `setInterval` finché il layer è attivo (cleanup alla disattivazione); staleness = `lastFetch` più
  vecchio di 2× `refreshMinutes`.

### 4.5 Componenti — `src/components/map/emergency/`

- `EmergencyLayersButton.tsx` — pulsante controllo mappa (sotto zoom/GPS), badge count layer attivi
- `EmergencyLayersPanel.tsx` — popover desktop / bottom sheet mobile `<lg`; gruppi per categoria;
  per layer attivo: legenda, "aggiornato alle HH:MM", attribution; selettore Oggi/Domani per DPC;
  link disclaimer. Su mobile si registra nello stack di `lib/back-nav.ts` (Indietro lo chiude).
- `EmergencyWmsLayer.tsx` — wrapper `WMSTileLayer` react-leaflet con gestione `TIME`
- `EmergencyPointsLayer.tsx` — `CircleMarker` su renderer canvas + `Popup` FIRMS
- `EmergencyZonesLayer.tsx` — `GeoJSON` poligoni DPC + `Popup` zona
- `EmergencyLayers.tsx` — orchestratore montato in `InteractiveMap`, **dynamic import** (pattern
  lazy-Recharts) per non toccare il First Load (~253 kB)

Unica modifica a `InteractiveMap.tsx`: montare `EmergencyLayers` + `EmergencyLayersButton`.

## 5. UI/UX

- **Popup focolaio FIRMS**: data/ora rilevamento (UTC→locale), satellite, FRP in MW, confidenza
  (VIIRS: low/nominal/high). Colore punto per recency: <6h rosso vivo, più vecchio arancio.
- **Popup zona DPC**: nome zona + i 3 rischi ciascuno col suo livello colorato + giorno di riferimento
  e ora di emissione del bollettino.
- **Resa**: colori allerta ufficiali (giallo/arancione/rosso); zone verdi NON disegnate; FWI
  semi-trasparente sotto i tracciati; tutti i layer emergenza sotto marker/polilinee dell'itinerario
  (pane dedicato Leaflet con zIndex sotto `overlayPane` dei tracciati).
- **Disclaimer** alla prima attivazione (Modal esistente, flag localStorage): dati satellitari/bollettini
  possono essere incompleti o in ritardo; non sostituiscono i canali ufficiali; in emergenza 112.
- **A11y**: toggle `aria-pressed`, touch target ≥44px mobile, popup leggibili (standard Lighthouse 97).

## 6. Errori e offline

- Fallimenti **indipendenti per layer**: badge errore sulla riga + toast (una volta), retry al refresh
  successivo. I dati stantii restano visibili con avviso "dati delle HH:MM".
- DPC prima delle ~16:00: si usa il bollettino di ieri (il suo "domani" copre oggi) con data di
  emissione ben visibile. **Regola di mapping del selettore**: le opzioni non sono etichette fisse
  "Oggi/Domani" ma i giorni **effettivamente coperti dal bollettino**, etichettati con la data reale
  (es. bollettino di ieri → opzioni "Oggi 25/08" = file `_tomorrow` di ieri, mentre "Ieri 24/08" =
  `_today`, mostrata disabilitata); il giorno di default selezionato è sempre la data odierna se coperta.
- 404 dalle fonti = "nessun dato disponibile", non errore (pattern riusato in fase 2 per la
  stagionalità valanghe).
- **Service worker**: escludere esplicitamente dal runtime caching `/api/fires`, `/api/dpc-alerts`,
  `maps.effis.emergency.copernicus.eu`, `raw.githubusercontent.com` — niente dati di emergenza
  serviti da cache offline. Offline: righe "non disponibile offline".

## 7. Testing (TDD)

- **Unit**: parser FIRMS (malformato/vuoto/merge), `dpc.ts` (topojson→GeoJSON, parsing livelli,
  max-rischio, popup data), discovery (GitHub API mockata, cache, rate-limit fallback), staleness,
  validazione registry (id univoci, config per kind).
- **Store**: attivazione/disattivazione, auto-refresh con fake timers, stati errore, `dpcDay`.
- **Componenti**: toggle pannello (aria-pressed), popup FIRMS/DPC, disclaimer once, badge errore.
- **API route**: fires (merge+cache+errori upstream+key mancante), dpc-alerts (cache discovery).
- **Checklist manuale** (endpoint reali su dev server): TIME EFFIS, bollettino del giorno, chiave FIRMS
  vera, Indietro mobile chiude il pannello, resa su mobile reale.

## 8. Rollout

- Branch `feature/emergency-layers` → develop → master **solo su richiesta esplicita**
- Versione **v0.11.0**, CHANGELOG, voce WhatsNew
- Env: `FIRMS_MAP_KEY` (server-only) in `.env.example` + sezione README (registrazione key FIRMS)
- Nuova dipendenza: `topojson-client` (~4 kB)
- Attribution Leaflet aggiornata dinamicamente coi layer attivi

## Appendice A — Trappole note (riassunto operativo)

1. EFFIS: `TIME` obbligatorio sui layer NRT/FWI
2. DPC: niente `latest`, filename con orario variabile → discovery server-side cacheata; TopoJSON 1,2 MB
3. FIRMS: key mai nel client; CSV con possibili righe sporche
4. Cache in-memory su serverless = best-effort (per-istanza)
5. GitHub API senza token = 60 req/h/IP → la cache della discovery è obbligatoria, non un'ottimizzazione

## Appendice B — Fase 2 (v0.12.0): fonti già validate dal report 2026-08-25

Da NON perdere — tutte verificate con fetch reali, tutte client-side (CORS `*`):

- **Valanghe** (aggregato EAWS, copre TUTTE le regioni italiane incluso `IT-MeteoMont`/Appennini):
  - Rating 1–5 per micro-regione: `https://static.avalanche.report/eaws_bulletins/{YYYY-MM-DD}/{YYYY-MM-DD}-{regione}.ratings.json` (~3 KB; varianti am/pm e alta/bassa quota; CAAML v6 nel file `.json`)
  - Geometrie micro-regioni: `https://regions.avalanches.org/micro-regions/{codice}_micro-regions.geojson.json`
  - Stagionalità: 404 fuori stagione = "nessun bollettino"; niente `/latest` → data odierna con fallback a ieri
  - Regioni IT: `IT-21, IT-23, IT-25, IT-32-BZ, IT-32-TN, IT-34, IT-36, IT-57, IT-MeteoMont`
  - AINEVA/Meteomont diretti scartati (PDF/API deprecate) — i loro dati confluiscono nell'aggregato
- **Copertura nevosa**: NASA GIBS WMTS, senza chiave:
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDSI_Snow_Cover/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png` (maxNativeZoom 8, daily, latenza ~1 giorno; attribution "NASA GIBS/Worldview")
- **Terremoti INGV** (GeoJSON, CC-BY 4.0): `https://webservices.ingv.it/fdsnws/event/1/query?format=geojson&starttime=…&minmag=…&limit=…`
- **GDACS multi-hazard** (GeoJSON): `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=FL;WF;EQ&fromdate=…&todate=…` — max 100/pagina, soglia di rilevanza globale (eventi italiani minori assenti), dati "indicativi" per ToU
