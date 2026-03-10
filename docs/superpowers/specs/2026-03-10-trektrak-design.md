# TrekTrak — Design Specification

## Scopo

App web didattica per l'apprendimento della cartografia manuale, con supporto alla creazione di itinerari di trekking tracciati su mappa. L'utente inserisce manualmente tutti i dati cartografici (coordinate, altitudini, distanze, azimuth) e l'app li valida confrontandoli con dati reali su richiesta.

## Stack Tecnologico

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Mappa**: React-Leaflet + tile OpenStreetMap (gratuito, nessun API key)
- **Elevazione**: OpenTopoData API (self-hosted friendly, CORS-safe) con fallback a Open-Elevation
- **PDF**: jsPDF + html2canvas
- **Grafici**: Recharts (profilo altimetrico)
- **Persistenza**: localStorage con schema versioning
- **State management**: Zustand (leggero, no boilerplate)
- **Styling**: Tailwind CSS (mobile-first)
- **GPX**: generazione client-side (formato GPX 1.1)
- **Griglia UTM**: proj4js per proiezioni + overlay custom Leaflet

## Layout

Layout a due colonne (desktop) con comportamento stacked su mobile:

- **Desktop (1280px+)**: Pannello sinistro (380px) con form waypoint, lista tratte, riepilogo totali, azioni export. Pannello destro con mappa interattiva e profilo altimetrico in basso.
- **Mobile (<768px)**: Mappa in alto, contenuto sotto con tab bar (Waypoint / Profilo / Export). Footer sticky con riepilogo totali (visibile su tutti i tab).

## Flusso Dati (Didattico)

Il flusso e' progettato per l'apprendimento della cartografia manuale:

1. **Input manuale completo** (default): l'utente inserisce tutti i dati per ogni waypoint (nome, latitudine, longitudine, altitudine) e per ogni tratta (distanza, dislivello positivo/negativo, azimuth)
2. **Calcoli derivati automatici**: dai dati inseriti l'app calcola automaticamente tempo di percorrenza, pendenza percentuale, difficolta'
3. **Verifica su richiesta**: pulsante "Verifica" che confronta i dati inseriti con quelli reali (API elevazione, calcolo geodesico) mostrando scostamenti

## Features Core

### 1. Gestione Waypoint
- Aggiungi / rimuovi / riordina waypoint con drag-and-drop
- Campi input: nome, latitudine, longitudine, altitudine
- Click sulla mappa posiziona il marker e auto-compila SOLO lat/lon nel form (l'utente vede le coordinate reali come riferimento). L'altitudine resta sempre da compilare manualmente.
- Drag marker sulla mappa: aggiorna lat/lon nel form (coerenza visiva), ma NON tocca altitudine o dati tratta
- Quando i waypoint vengono riordinati, i dati delle tratte vengono resettati e marcati come "da ricompilare" (l'utente deve reinserirli per il nuovo ordine)
- Minimo 2 waypoint per generare tratte, profilo altimetrico, ed export

### 2. Gestione Tratte
- Per ogni coppia di waypoint consecutivi, campi input: distanza (km), dislivello positivo (m), dislivello negativo (m), azimuth (gradi)
- I dislivelli sono input indipendenti dalle altitudini dei waypoint (l'utente li stima dalla carta). La validazione confrontera' entrambi con i dati reali.
- Calcolo automatico derivato: tempo di percorrenza (Munter), pendenza %

### 3. Mappa Interattiva
- Click per aggiungere waypoint
- Marker draggabili per riposizionare (aggiorna lat/lon nel form)
- Linea del percorso tra waypoint consecutivi
- Zoom / pan standard

### 4. Tabella Itinerario
- Riepilogo tutte le tratte con dati inseriti e calcolati
- Riga totali in fondo (distanza totale, dislivello totale +/-, tempo totale)

### 5. Profilo Altimetrico
- Grafico del dislivello lungo il percorso basato sui dati inseriti dall'utente
- Waypoint evidenziati sul grafico con label

### 6. Export PDF
- **Formato sintetico** (1 pagina): tabella riassuntiva + mappa statica del percorso
- **Formato roadbook** (multi-pagina): dettaglio per ogni tratta con:
  - Azimuth e direzione cardinale (es. "245° SW")
  - Variazione di azimuth rispetto alla tratta precedente (es. "svolta a destra di 30°")
  - Distanza e tempo stimato
  - Dislivello e pendenza
  - Mini-mappa della tratta
- Profilo altimetrico completo in ultima pagina

### 7. Export GPX
- Formato GPX 1.1 con waypoint (`<wpt>`) e traccia (`<trk>` con `<trkseg>`)
- Elevazione inclusa nei track point (`<ele>`)
- Metadati itinerario nel tag `<metadata>`
- Compatibile con dispositivi GPS (Garmin, ecc.) e app (Komoot, Wikiloc, ecc.)

### 8. Salvataggio Locale
- CRUD itinerari in localStorage
- Lista itinerari salvati con nome, data, riepilogo
- Import/export JSON per backup
- Schema versioning: chiave `trektrak_schema_version` in localStorage, migrazione automatica all'avvio se la versione e' obsoleta
- Chiavi localStorage: `trektrak_itineraries`, `trektrak_settings`, `trektrak_learning_history`, `trektrak_schema_version`
- Limite: notifica utente quando localStorage si avvicina al limite (~4MB), suggerendo export JSON e pulizia

## Features Didattiche

### 9. Validazione con Feedback Visivo
- Per ogni dato inserito, dopo "Verifica":
  - **Verde**: corretto (entro tolleranza stretta)
  - **Giallo**: margine accettabile (entro tolleranza larga, es. 2x la soglia stretta)
  - **Rosso**: errore significativo (oltre tolleranza larga)
- Mostra il valore reale e il delta (differenza)
- Icone e colori chiari, non intrusivi
- **Valori di riferimento per la validazione**:
  - Altitudine: OpenTopoData API (GET `/v1/test-dataset?locations=lat,lon`)
  - Distanza: formula di Haversine tra le coordinate dei due waypoint
  - Azimuth: bearing iniziale geodesico (formula forward azimuth)
  - Dislivello: differenza tra altitudini reali dei waypoint (da API)
- **Fallback se API non disponibile**: mostra messaggio "Servizio di verifica non disponibile, riprova piu' tardi" — la verifica non e' bloccante

### 10. Quiz Mode
- Pagina/route separata (`/quiz`)
- L'app seleziona un punto casuale sulla mappa visibile (all'interno del viewport corrente)
- L'utente deve stimare:
  - Coordinate (lat/lon)
  - Altitudine
  - Distanza da un altro punto (selezionato dall'app)
  - Azimuth verso un altro punto
- 5 domande per sessione (configurabile)
- Punteggio 0-100 per domanda basato sulla precisione (lineare rispetto alla tolleranza)
- Feedback immediato con spiegazione e valore corretto
- Risultati salvati nel report di apprendimento (Feature 12)

### 11. Suggerimenti Didattici Contestuali
- Quando l'utente sbaglia, mostra spiegazioni contestuali:
  - Formula per il calcolo dell'azimuth
  - Come leggere le curve di livello
  - Come stimare distanze dalla scala
  - Concetti di proiezione e coordinate
- Tooltip o pannello espandibile, non invasivo

### 12. Report di Apprendimento
- Tracking degli errori piu' frequenti tra sessioni (salvato in localStorage)
- Categorie: altitudine, coordinate, distanza, azimuth, dislivello
- Trend di miglioramento nel tempo
- Riepilogo statistico (% accuratezza per categoria)

### 13. Margini di Tolleranza Configurabili
- Soglie personalizzabili per ogni tipo di dato:
  - Altitudine: default +/- 20m
  - Coordinate: default +/- 0.001 gradi (~100m)
  - Distanza: default +/- 10%
  - Azimuth: default +/- 5 gradi
  - Dislivello: default +/- 15%
- Pannello impostazioni accessibile

### 14. Overlay Griglia UTM/Coordinate
- Toggle per mostrare/nascondere griglia sulla mappa
- Griglia UTM e/o gradi decimali
- Aiuto visivo per la lettura delle coordinate

## Features Extra

### 15. Stima Difficolta'
- Calcolo automatico scala T1-T6 basato sulla pendenza massima tra tutte le tratte
- Visualizzato nel riepilogo e nel PDF

### 16. Link Meteo
- Link rapido a servizio meteo esterno per le coordinate del percorso
- Nessuna API necessaria, semplice link parametrizzato

### 17. Condivisione via URL
- Itinerario codificato in URL hash con compressione LZ-string
- Limite pratico: ~15 waypoint (oltre, mostra messaggio "Itinerario troppo grande per URL, usa export JSON")
- Nessun server necessario, il destinatario apre il link e vede l'itinerario

### 18. Waypoint Card Stampabili
- Mini-schede ritagliabili per ogni waypoint con:
  - Nome, coordinate, altitudine
  - Direzione e distanza al prossimo waypoint
  - Azimuth, tempo stimato
- Layout ottimizzato per stampa su A4

## Formula Tempi di Percorrenza (Munter)

- Velocita' orizzontale: 4 km/h
- Velocita' verticale salita: 400 m/h
- Velocita' verticale discesa: 800 m/h
- **T_verticale** = max(dislivello_positivo / 400, dislivello_negativo / 800)
- **Tempo totale** = max(T_orizzontale, T_verticale) + 0.5 * min(T_orizzontale, T_verticale)

## Scala Difficolta' (SAC T1-T6)

Basata sulla **pendenza massima** tra tutte le tratte dell'itinerario:

| Scala | Pendenza | Descrizione |
|-------|----------|-------------|
| T1 | < 15% | Escursione facile |
| T2 | 15-25% | Escursione media |
| T3 | 25-35% | Escursione impegnativa |
| T4 | 35-45% | Percorso alpino |
| T5 | 45-55% | Percorso alpino impegnativo |
| T6 | > 55% | Percorso alpino difficile |

## Stato di Validazione

Ogni campo validabile ha quattro stati:
- `unverified` — dato inserito, non ancora verificato
- `valid` — verificato, entro tolleranza
- `warning` — verificato, margine accettabile
- `error` — verificato, errore significativo

Lo stato include: `{ status, userValue, realValue, delta, tolerance }`.

## Data Model

```typescript
interface Waypoint {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  altitude: number | null;  // input manuale
  order: number;
  validationState?: {
    altitude?: ValidationResult;
  };
}

interface Leg {
  id: string;
  fromWaypointId: string;
  toWaypointId: string;
  distance: number | null;       // km, input manuale
  elevationGain: number | null;  // m, input manuale
  elevationLoss: number | null;  // m, input manuale
  azimuth: number | null;        // gradi, input manuale
  // Calcolati automaticamente dai dati inseriti:
  estimatedTime?: number;        // minuti (Munter)
  slope?: number;                // percentuale
  validationState?: {
    distance?: ValidationResult;
    elevationGain?: ValidationResult;
    elevationLoss?: ValidationResult;
    azimuth?: ValidationResult;
  };
}

interface Itinerary {
  id: string;
  name: string;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  waypoints: Waypoint[];
  legs: Leg[];
}

interface ValidationResult {
  status: 'unverified' | 'valid' | 'warning' | 'error';
  userValue: number;
  realValue?: number;
  delta?: number;
  tolerance: { strict: number; loose: number };
}

interface QuizSession {
  id: string;
  date: string;
  questions: QuizQuestion[];
  totalScore: number;
}

interface QuizQuestion {
  type: 'coordinates' | 'altitude' | 'distance' | 'azimuth';
  targetPoint: { lat: number; lon: number };
  referencePoint?: { lat: number; lon: number };
  userAnswer: number;
  correctAnswer: number;
  score: number;  // 0-100
}

interface LearningHistory {
  sessions: {
    date: string;
    category: string;
    attempts: number;
    accurateCount: number;
  }[];
}

interface AppSettings {
  tolerances: {
    altitude: number;      // default 20 (meters)
    coordinates: number;   // default 0.001 (degrees)
    distance: number;      // default 10 (percent)
    azimuth: number;       // default 5 (degrees)
    elevation: number;     // default 15 (percent)
  };
  quizQuestionsPerSession: number;  // default 5
}
```

## API Elevazione

Endpoint primario: **OpenTopoData**
- `GET https://api.opentopodata.org/v1/eudem25m?locations={lat},{lon}`
- Rate limit: 1 richiesta/secondo, max 100 locations per richiesta
- Risposta: `{ "results": [{ "elevation": 1450.2, "location": { "lat": 46.123, "lng": 11.456 } }] }`
- CORS: supportato

Fallback: **Open-Elevation**
- `GET https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}`
- Nessun rate limit documentato, ma meno affidabile

Strategia: prova OpenTopoData, se fallisce (timeout 5s o errore) prova Open-Elevation, se entrambi falliscono mostra messaggio all'utente.

## Phasing

### MVP (Phase 1)
Features 1-9, 13, 15: gestione waypoint/tratte, mappa, tabella, profilo altimetrico, export PDF/GPX, salvataggio locale, validazione, tolleranze, difficolta'

### Phase 2
Features 10-12, 14: quiz mode, suggerimenti didattici, report apprendimento, griglia UTM

### Phase 3
Features 16-18: link meteo, condivisione URL, waypoint card stampabili

## Edge Cases

- **0-1 waypoint**: la mappa mostra i marker ma tabella, profilo, export sono disabilitati con placeholder "Aggiungi almeno 2 waypoint"
- **Waypoint duplicati** (stesse coordinate): consentiti (es. percorso ad anello), distanza = 0 e azimuth = 0 per la tratta
- **localStorage pieno**: notifica utente con suggerimento di esportare in JSON e cancellare itinerari vecchi
- **Massimo waypoint**: 50 per itinerario (limite soft, mostra avviso)
- **Browser target**: Chrome, Firefox, Safari, Edge (ultime 2 versioni). Mobile: Chrome Android, Safari iOS
