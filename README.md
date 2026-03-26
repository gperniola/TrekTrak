# TrekTrak

App web didattica per l'apprendimento della cartografia manuale attraverso la creazione di itinerari di trekking. L'utente inserisce manualmente i dati cartografici (coordinate, altitudini, distanze, azimuth) e l'app li valida confrontandoli con dati reali.

## Stack Tecnologico

| Tecnologia | Ruolo |
|---|---|
| **Next.js 14** (App Router) | Framework React con SSR, routing, API routes |
| **TypeScript** | Type safety su tutto il codebase |
| **React-Leaflet** + Leaflet | Mappa interattiva con tile, marker, polyline |
| **Zustand** | State management leggero (itinerario, impostazioni) |
| **Recharts** | Profilo altimetrico con gradiente pendenza |
| **jsPDF** | Generazione PDF (sintetico + roadbook) |
| **@dnd-kit** | Drag-and-drop per riordinamento waypoint |
| **lz-string** | Compressione URL per condivisione itinerari |
| **next-pwa** + Workbox | Service worker, caching offline, installabilita' PWA |
| **Tailwind CSS** | Styling mobile-first, dark theme |
| **Jest** | 325 test unitari e di integrazione |

### API Esterne

| Servizio | Utilizzo |
|---|---|
| **OpenTopoData** (EU-DEM 25m) | Dati altimetrici, con fallback a Open-Elevation |
| **OpenRouteService** | Trail routing (percorso su sentiero), opzionale |
| **Nominatim** (OpenStreetMap) | Ricerca localita' sulla mappa |
| **Meteoblue** | Link diretto a previsioni meteo per la zona dell'itinerario |

---

## Feature

### Modalita' Learn e Track

L'app ha due modalita' operative:

- **Learn**: l'utente inserisce manualmente tutti i dati (coordinate, altitudine, distanza, dislivello, azimuth). Il pulsante "Verifica" confronta i dati inseriti con quelli reali e mostra feedback colorato (verde/giallo/rosso) con il valore corretto e lo scostamento.
- **Track**: i dati vengono calcolati automaticamente quando l'utente posiziona i waypoint sulla mappa. Profilo altimetrico, distanze e dislivelli vengono fetchati dalle API.

### Gestione Waypoint e Tratte

- Click sulla mappa per aggiungere waypoint (max 50)
- Marker draggabili per riposizionare
- Drag-and-drop nel pannello per riordinare
- Per ogni tratta: distanza, dislivello D+/D-, azimuth
- Calcoli automatici derivati: tempo di percorrenza (formula Munter), pendenza %, difficolta' SAC T1-T6

### Mappe

4 mappe di base selezionabili dalle Impostazioni Mappa:

| Mappa | Descrizione |
|---|---|
| **Thunderforest Outdoors** | Sentieri, curve di livello, rifugi (richiede API key) |
| **OpenTopoMap** | Topografica con curve di livello dettagliate |
| **CyclOSM** | Sentieri, superfici, fonti d'acqua |
| **OpenStreetMap** | Mappa standard, sempre disponibile |

Overlay aggiuntivo:
- **Waymarked Trails**: sentieri escursionistici ufficiali (CAI, GR, Via Alpina)

### Profilo Altimetrico Interattivo

Il grafico in basso mostra il profilo altimetrico con colorazione per pendenza:
- Verde (< 10%), Giallo (10-20%), Arancione (20-30%), Rosso (> 30%)

**Interazione bidirezionale**:
- Hover sul grafico → marker giallo sulla mappa nel punto corrispondente
- Hover sul percorso in mappa → linea di riferimento gialla sul grafico
- Click sul grafico → la mappa vola al punto cliccato

### Griglia Coordinate

Overlay attivabile dalle Impostazioni Mappa che mostra una griglia in gradi decimali (WGS84) con intervallo adattivo al livello di zoom:

| Zoom | Intervallo |
|---|---|
| 1-8 | 1° |
| 9-11 | 0.1° |
| 12-14 | 0.01° |
| 15+ | 0.001° |

### Strumento Righello

Misuratore interattivo a due punti:
1. Clicca il primo punto (marker verde A)
2. Clicca il secondo punto (marker rosso B)
3. Visualizza: distanza, azimuth (gradi + cardinale), differenza di quota
4. Terzo click: resetta e ricomincia

Attivabile dal pulsante nella barra modalita'. Mutualmente esclusivo con bussola e quiz.

### Bussola / Compass Tool

Strumento GPS in tempo reale:
- Mostra la posizione dell'utente sulla mappa (marker verde)
- Calcola azimuth, distanza e differenza di quota verso il centro della mappa
- Aggiornamento continuo tramite `navigator.geolocation.watchPosition`

### Pulsante "La Mia Posizione"

Pulsante sulla mappa (icona mirino, in basso a destra) che:
- Centra la mappa sulla posizione GPS dell'utente
- Mostra popup con latitudine, longitudine, altitudine (DEM), precisione GPS
- Pulsante "Copia coordinate" per copiare negli appunti

### Quiz Mode

Modalita' quiz per testare le proprie competenze cartografiche:

**3 tipi di domanda**:
- **Altitudine**: stima la quota di un punto sulla mappa
- **Distanza**: stima la distanza in linea d'aria tra due punti
- **Azimuth**: stima l'azimuth tra due punti (con gestione circolare 350° ↔ 10°)

**Meccanica**:
- 5 domande per sessione, mix bilanciato (almeno 1 per tipo)
- Punteggio 0-100 per domanda, basato sulla precisione
- Tolleranze: ±100m altitudine, ±20% distanza, ±30° azimuth
- Marker viola/arancione sulla mappa per i punti del quiz
- Riepilogo fine sessione con media per categoria

**Storico**:
- Le sessioni vengono salvate in localStorage (ultime 50)
- Visualizzazione trend per categoria nelle ultime 10 sessioni

### Condivisione via URL

Pulsante "Copia link" che genera un URL contenente l'intero itinerario compresso:
- Serializzazione compatta con lz-string
- L'URL si apre nel browser e carica automaticamente l'itinerario
- Limite: 15 waypoint / 2000 caratteri

### Link Meteo

Pulsante "Meteo" che apre Meteoblue in una nuova tab, centrato sulle coordinate medie dell'itinerario. Visibile con 2+ waypoint.

### Export

- **PDF Sintetico**: tabella riassuntiva in una pagina
- **PDF Roadbook**: dettaglio per ogni tratta con azimuth, variazione direzione, mini-mappa
- **GPX**: formato 1.1 compatibile con GPS e app (Garmin, Komoot, Wikiloc)
- **JSON**: import/export per backup completo

### PWA Offline

L'app e' installabile come Progressive Web App:
- **App shell**: caricamento istantaneo anche offline (stale-while-revalidate)
- **Tile mappa**: le zone navigate vengono cachate automaticamente (cache-first, 1000 tile per provider, TTL 30 giorni)
- **Banner offline**: notifica amber quando la connessione non e' disponibile
- **Funzionamento offline**: creazione itinerari, export PDF/GPX, navigazione mappa (zone cachate), griglia, righello

Non funzionano offline: fetch altitudini, verifica, quiz altitudine, ricerca localita', trail routing.

---

## Setup

### Prerequisiti

- Node.js 18+
- npm

### Installazione

```bash
git clone https://github.com/gperniola/TrekTrak.git
cd TrekTrak
npm install
```

### Variabili d'ambiente

Crea un file `.env.local` nella root del progetto:

```env
# Opzionale: Thunderforest Outdoors (mappa hiking)
# Registrati su https://www.thunderforest.com/ per ottenere una API key gratuita (150k tile/mese)
NEXT_PUBLIC_THUNDERFOREST_API_KEY=la_tua_api_key

# Opzionale: OpenRouteService (trail routing su sentiero)
# Registrati su https://openrouteservice.org/ per ottenere una API key gratuita
NEXT_PUBLIC_ORS_API_KEY=la_tua_api_key
```

Senza API key, l'app funziona comunque con OpenTopoMap come mappa e calcoli in linea d'aria.

### Avvio

```bash
# Sviluppo
npm run dev

# Build produzione
npm run build
npm start

# Test
npm test
```

---

## Guida all'Uso

### Primo Avvio

1. Apri l'app nel browser (default: `http://localhost:3000`)
2. Un tutorial interattivo ti guida attraverso le funzionalita' principali
3. Inizia in modalita' **Learn** (viola) per esercitarti nella cartografia manuale

### Creare un Itinerario

1. **Dai un nome** all'itinerario nel campo in alto a sinistra
2. **Aggiungi waypoint** cliccando sulla mappa (o dal pulsante + nel pannello)
3. I waypoint appaiono come cerchi verdi numerati
4. **Inserisci i dati** per ogni waypoint (latitudine, longitudine, altitudine) e per ogni tratta (distanza, dislivello, azimuth)
5. Clicca **Verifica** per confrontare i tuoi dati con quelli reali

### Usare la Modalita' Track

1. Passa a **Track** (verde) con il selettore in alto
2. Clicca sulla mappa per aggiungere waypoint
3. Distanza, altitudine, dislivello e azimuth vengono calcolati automaticamente
4. Attiva "Percorso su sentiero" nelle Impostazioni Mappa per tracciati lungo sentieri reali

### Configurare la Mappa

1. Clicca **Mappa** (icona ingranaggio) per aprire le impostazioni
2. Seleziona la mappa di base (Thunderforest, OpenTopoMap, CyclOSM, OSM)
3. Attiva/disattiva: sentieri escursionistici, griglia coordinate, percorso colorato
4. Scegli l'intervallo di campionatura altimetrica (20-200m)

### Usare il Righello

1. Clicca il pulsante **↕** nella barra modalita'
2. Clicca un primo punto sulla mappa (marker A verde)
3. Clicca un secondo punto (marker B rosso)
4. Leggi distanza, azimuth e differenza di quota nel pannello in basso
5. Un terzo click resetta la misura. Premi **Esc** per uscire.

### Fare un Quiz

1. Clicca il pulsante **?** nella barra modalita'
2. Rispondi alle 5 domande: stima altitudine, distanza o azimuth
3. Dopo ogni risposta vedi il valore corretto e il punteggio
4. A fine sessione: riepilogo per categoria e accesso allo storico

### Condividere un Itinerario

1. Crea un itinerario con almeno 2 waypoint
2. Clicca **Copia link** nella barra azioni
3. Incolla il link: chi lo apre vedra' il tuo itinerario

### Usare Offline

1. Naviga sulla mappa nelle zone di interesse (i tile si cachano automaticamente)
2. L'app e' installabile: su mobile clicca "Aggiungi alla schermata Home"
3. Senza rete: la mappa mostra le zone gia' visitate, puoi creare itinerari e esportare

---

## Struttura del Progetto

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout, meta PWA
│   ├── page.tsx            # Pagina principale
│   └── api/elevation/      # Proxy API elevazione
├── components/
│   ├── map/                # Mappa e overlay
│   │   ├── InteractiveMap  # Mappa principale Leaflet
│   │   ├── ElevationProfile # Profilo altimetrico Recharts
│   │   ├── CompassTool     # Bussola GPS
│   │   ├── RulerTool       # Strumento righello
│   │   ├── CoordinateGrid  # Griglia coordinate
│   │   ├── MyLocationButton # Pulsante posizione GPS
│   │   ├── LocationSearch  # Ricerca localita'
│   │   └── QuizMarkers     # Marker quiz sulla mappa
│   ├── panel/              # Pannello sinistro
│   │   ├── WaypointCard    # Card singolo waypoint
│   │   ├── LegCard         # Card singola tratta
│   │   ├── ActionBar       # Pulsanti export/verifica
│   │   ├── ModeSwitch      # Selettore Learn/Track + tools
│   │   └── SummaryBar      # Totali itinerario
│   ├── quiz/               # Componenti quiz
│   │   ├── QuizOverlay     # Orchestratore sessione
│   │   ├── QuizQuestion    # Singola domanda
│   │   └── QuizSummary     # Riepilogo + storico
│   ├── settings/           # Impostazioni
│   └── shared/             # Componenti condivisi
├── stores/
│   └── itineraryStore.ts   # Zustand store principale
├── lib/
│   ├── types.ts            # Tipi TypeScript + configurazione mappe
│   ├── calculations.ts     # Haversine, azimuth, Munter, pendenza, interpolazione
│   ├── quiz.ts             # Logica quiz: punteggio, generazione, storico
│   ├── grid.ts             # Calcolo linee griglia coordinate
│   ├── elevation-api.ts    # Client API elevazione (batch, multi-request)
│   ├── routing-api.ts      # Client OpenRouteService
│   ├── share-url.ts        # Serializzazione/deserializzazione URL
│   ├── meteo.ts            # Generazione URL Meteoblue
│   ├── validation.ts       # Logica validazione con tolleranze
│   ├── export-pdf.ts       # Generazione PDF
│   ├── export-gpx.ts       # Generazione GPX
│   ├── export-json.ts      # Import/export JSON
│   └── storage.ts          # Persistenza localStorage
└── __tests__/              # 325 test (17 suite)
```

---

## Sviluppo

### Test

```bash
npm test              # Esegui tutti i test
npm run test:watch    # Watch mode
```

### Convenzioni

- Branch `develop` per lo sviluppo, `master` per produzione
- Commit con prefisso convenzionale: `feat:`, `fix:`, `chore:`
- Coordinate in WGS84 (EPSG:4326), gradi decimali
- UI in italiano, codice/commenti in inglese
- Tailwind CSS con approccio mobile-first, dark theme

---

## Licenza

Progetto personale / didattico.
