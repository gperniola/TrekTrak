# TrekTrak — Architecture & Development Notes

Documento interno per lo sviluppo futuro. Cattura decisioni architetturali, limitazioni note, debito tecnico e roadmap.

Ultimo aggiornamento: 2026-03-26

---

## Decisioni Architetturali

### State Management

**Zustand store singolo** (`itineraryStore.ts`) gestisce tutto lo stato dell'itinerario: waypoint, tratte, impostazioni, modalita' app. Lo store cresce ma resta gestibile perche' le azioni sono atomiche e lo stato e' piatto (no nested objects profondi).

**Stato transiente fuori dallo store**: compass, ruler e quiz usano stato locale nei rispettivi componenti (`useState`/`useRef`), non Zustand. Motivazione: sono tool temporanei il cui stato non serve persistere o condividere con altri componenti. L'eccezione e' `profileHover`/`profileFlyTo` che sono nello store perche' devono essere letti sia da `ElevationProfile` che da `InteractiveMap`.

**Mutua esclusione compass/ruler/quiz**: gestita in `page.tsx` con `useState` + callback toggle che disattivano gli altri. Il pattern funziona ma il prop drilling attraverso LeftPanel → ModeSwitch e MapWrapper → InteractiveMap → MapEvents sta diventando verboso.

### Comunicazione Quiz ↔ Mappa

Il quiz ha un problema architetturale: `QuizOverlay` (renderizzato in `page.tsx`) deve comunicare punti da mostrare sulla mappa (renderizzata in `InteractiveMap` dentro `MapContainer`). Non possono condividere lo Zustand store direttamente per i punti quiz perche' lo store non e' il posto giusto per stato cosi' transiente.

**Soluzione adottata**: `CustomEvent` su `window`.
- `QuizOverlay` emette `window.dispatchEvent(new CustomEvent('quiz-points', { detail }))` quando cambia la domanda
- `QuizBoundsSync` (dentro `MapContainer`) ascolta l'evento e renderizza `QuizMarkers`
- `setQuizMapBounds()` e' una funzione esportata con variabile module-level che `QuizBoundsSync` chiama per passare i bounds della mappa al quiz

Pro: nessuna dipendenza circolare, nessun prop drilling aggiuntivo. Contro: pattern non-React, la variabile module-level (`mapBoundsRef`) non e' reattiva e potrebbe andare stale se la mappa si smonta/rimonta.

### Caching Elevazione

Il fetch elevazione usa un **proxy server-side** (`/api/elevation`) che chiama OpenTopoData con fallback a Open-Elevation. Il client (`elevation-api.ts`) supporta **batch multi-request**: quando i punti superano 95 (limite API), vengono splittati in richieste sequenziali. Sequenziale (non parallelo) per rispettare il rate limit di OpenTopoData.

La cache elevazione e' **per-sessione in-memory** (`Map<string, number | null>` locale alle funzioni), non persistente. Ogni volta che si ricalcola un itinerario, i punti vengono ri-fetchati. Questo e' accettabile perche' il fetching avviene solo in modalita' Track o durante Verifica.

### Tile Caching (PWA)

Ogni provider mappa ha la sua **cache Workbox separata** (es. `tiles-osm`, `tiles-opentopomap`), ognuna con max 1000 entries e TTL 30 giorni. Strategia CacheFirst: il tile viene servito dalla cache se presente, altrimenti fetchato dalla rete e cachato. Questo significa che le zone gia' navigate sono disponibili offline.

Il service worker e' generato da `next-pwa` (wrapper Workbox) ed e' disabilitato in development per evitare problemi di caching durante lo sviluppo.

### Profilo Altimetrico

Il profilo usa due sorgenti dati:
1. **Modalita' Classic**: campiona N punti equidistanti lungo la linea retta tra waypoint, fetcha altitudini dal DEM. L'intervallo e' configurabile (20/50/100/200m).
2. **Modalita' Trail Routing**: OpenRouteService restituisce coordinate con altitudine lungo il sentiero reale. Le distanze nel profilo vengono scalate per matchare la distanza ORS.

Lo smoothing a 5 punti (media pesata [1,2,3,2,1]) riduce il rumore DEM. L'epsilon sulla soglia pendenza e' stato rimosso (era 0.5%, causava falsi gialli su tratti piatti).

### URL Sharing

L'itinerario viene serializzato in un formato compatto: `{ n: nome, w: [nome,lat,lon,alt,...], l: [dist,gain,loss,az,...] }`. Questo viene compresso con lz-string e messo nell'hash fragment dell'URL. Al caricamento, `page.tsx` controlla l'hash e deserializza.

Limiti: max 15 waypoint, max 2000 char nell'hash. La validazione in `decodeItinerary` include: `Number.isFinite()` per tutti i numeri, lunghezza massima stringhe (200 char nome itinerario, 100 char nome waypoint), struttura array verificata.

---

## Limitazioni Note

### Calcoli Geografici

- **`distanceToPosition`** interpola in linea retta tra waypoint, **non lungo la `routeGeometry`**. In modalita' trail routing, il marker hover sulla mappa potrebbe non cadere esattamente sul sentiero ma sulla linea d'aria. Accettabile per UX hover.

- **`positionToDistance`** usa proiezione equirectangolare con correzione `cos(lat)`. E' accurata per tratte corte (< 50 km) alle latitudini europee. Per tratte molto lunghe o vicino ai poli, la proiezione introduce errore.

- **Interpolazione punti DEM** in `interpolatePoints()` usa interpolazione lineare in lat/lon, non geodesica. Per tratte < 100 km la differenza e' trascurabile (< 0.1%).

- **DEM noise amplification**: con campionatura a 20m, il rumore DEM (~0.5m) puo' creare pendenze false fino al 5%. Lo smoothing mitiga il problema ma non lo elimina completamente su profili molto densi.

### Mappe

- **OpenTopoMap** ha max zoom nativo 17. A zoom 18-19 i tile vengono upscalati (leggermente sfocati).
- **Thunderforest** richiede API key. Senza, il default fallback e' OpenTopoMap.
- Le mappe **non sono cachate preventivamente**: solo le zone navigate vengono cachate. Per uso offline, l'utente deve navigare la zona con rete prima.

### Quiz

- Le domande **altitudine** richiedono connessione internet (fetch DEM). Offline, vengono skippate (retry 3x, poi la domanda non viene generata).
- I punti vengono generati nel **viewport corrente**: se l'utente e' zoomato su un'area piccola, le domande distanza/azimuth potrebbero avere punti molto vicini.
- Lo storico quiz **non valida** i dati al caricamento. Dati corrotti in localStorage producono visualizzazione degradata ma non crash.

### PWA

- `next-pwa` (v5.6.0) e' in **maintenance mode**. Funziona con Next.js 14 ma potrebbe non essere compatibile con versioni future. L'alternativa e' `@serwist/next`.
- Le icone PWA sono **placeholder** generati programmaticamente (triangolo verde su sfondo nero). Andrebbero sostituite con icone disegnate professionalmente.

---

## Debito Tecnico

### InteractiveMap.tsx

Il file e' il piu' grande del progetto (~650 righe) e contiene troppa logica:
- Auto-fill waypoint (classic + guided)
- Colored leg segments con smoothing
- Profile hover marker
- Polyline hover events
- Quiz bounds sync
- Coordinate grid
- My location button
- Map events handler
- Geolocation on mount
- Track mode auto-fill trigger

**Proposta refactor**: estrarre in file separati `autoFillLogic.ts`, `ColoredLegSegments.tsx` (gia' componente ma inline), `MapEventsHandler.tsx`.

### Prop Drilling Tools

`compassActive`, `rulerActive`, `quizActive` + i rispettivi toggle/deactivate vengono passati da `page.tsx` → `LeftPanel` → `ModeSwitch` e `page.tsx` → `MapWrapper` → `InteractiveMap` → `MapEvents`. Ogni nuovo tool richiede aggiornare 5-6 file.

**Proposta**: creare un `ToolContext` React che wrappa la pagina e fornisce lo stato dei tool a tutti i figli senza prop drilling. Lo Zustand store potrebbe anche ospitare questi valori, dato che sono gia' condivisi tra mappa e pannello.

### Test Coverage

I test coprono bene la **logica pura** (calculations, quiz scoring, grid, share-url, elevation-api, storage, validation). Ma **non ci sono test per i componenti React** (nessun test con `@testing-library/react` per WaypointCard, ActionBar, ElevationProfile, etc.). La libreria `@testing-library/react` e' installata ma non usata.

**Proposta**: aggiungere test di rendering per i componenti critici, almeno:
- `ActionBar`: verifica che i pulsanti appaiano/scompaiano in base allo stato
- `WaypointCard`: verifica rendering con dati validi e nulli
- `ElevationProfile`: verifica rendering con profilo dati

### Validazione localStorage

`loadQuizHistory()` non valida gli elementi individuali dell'array (solo `Array.isArray`). `loadItineraries()` in `storage.ts` fa validazione approfondita. Sarebbe coerente portare lo stesso livello di validazione anche allo storico quiz.

### Chiave `learningHistory` in storage.ts

La chiave `learningHistory` in `KEYS` e' usata da `saveValidationSession()`, `loadValidationHistory()`, e `clearValidationHistory()` in `storage.ts` per persistere lo storico delle sessioni di verifica (Feature 12 — Report di Apprendimento, implementata in v0.4.0). I dati sono validati strutturalmente al caricamento con `isValidSession()`. Max 100 sessioni (FIFO).

---

## Roadmap — Feature Non Implementate

Dalla spec originale (`docs/superpowers/specs/2026-03-10-trektrak-design.md`):

### Phase 2 (priorita' media)

| # | Feature | Note |
|---|---|---|
| 11 | **Suggerimenti Didattici Contestuali** | Implementata in v0.4.0. Tip didattici adattivi nel popover dei badge di validazione (`didactic-tips.ts`). |
| 12 | **Report di Apprendimento** | Implementata in v0.4.0. ProgressOverlay con summary cards, grafico trend, dettaglio categorie (`learning-stats.ts`, `ProgressOverlay.tsx`). |
| 14 | **Overlay Griglia UTM** | La griglia decimale e' implementata. Aggiungere UTM richiederebbe `proj4js` per la proiezione. La griglia decimale copre il caso d'uso didattico base. |

### Phase 3 (priorita' bassa)

| # | Feature | Note |
|---|---|---|
| 17 | **Condivisione via URL** | Implementata. |
| 18 | **Waypoint Card Stampabili** | Mini-schede ritagliabili per ogni waypoint con coordinate, direzione, distanza. Layout A4 ottimizzato per stampa. Implementabile con jsPDF. |
| - | **Import GPX** | Caricare un file GPX esistente e popolare i waypoint. Parsing XML client-side. |

### Miglioramenti Tecnici

| Miglioramento | Impatto |
|---|---|
| Migrazione a `@serwist/next` da `next-pwa` | Maintainability — next-pwa non e' piu' mantenuto |
| React Context per tool state | Developer experience — elimina prop drilling |
| Split InteractiveMap.tsx | Maintainability — file troppo grande |
| Test componenti React | Confidence — zero test rendering attualmente |
| Icone PWA professionali | UX — placeholder attuali |
| Aggiornamento Next.js 15 | Le dipendenze sono su Next.js 14.2.35 |

---

## Convenzioni Codebase

### Naming

- Componenti: PascalCase (`WaypointCard.tsx`)
- Utility/lib: camelCase (`calculations.ts`)
- Test: stessa struttura di `src/` sotto `__tests__/`
- Tipi: interfacce in `types.ts`, esportate singolarmente

### Stato

- Stato globale persistente: Zustand store (`itineraryStore.ts`)
- Impostazioni: Zustand + localStorage (`storage.ts`)
- Stato tool transiente: `useState`/`useRef` locale al componente
- Hover/interazione cross-componente: Zustand (`profileHover`, `profileFlyTo`)

### API Pattern

- Proxy server-side per API esterne (`/api/elevation`)
- Client functions in `lib/` (`elevation-api.ts`, `routing-api.ts`, `geocoding-api.ts`)
- Batch support con splitting automatico (elevation-api)
- Fallback graceful: se API fallisce, il campo resta null/vuoto

### Coordinate

- Tutto in **WGS84** (EPSG:4326), gradi decimali
- Raggio terrestre: 6371 km (costante in `calculations.ts`)
- Precision: 4 decimali per coordinate (~ 11m), 3 per distanze km
- Badge "WGS84 — gradi decimali" visibile sul primo waypoint

### Git

- Branch `develop` per sviluppo attivo
- Branch `master` per deploy produzione
- Semantic versioning: attualmente v0.4.0
- Commit con prefisso convenzionale (`feat:`, `fix:`, `chore:`)
