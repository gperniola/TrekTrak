# TrekTrak Android Native Port — Design Specification

## Scopo

Porting completo di TrekTrak da PWA (Next.js + React) ad app Android nativa (Kotlin + Jetpack Compose). Parità funzionale con la PWA v0.6.0 — tutte le 17 feature attualmente implementate.

L'app resta un'applicazione didattica per l'apprendimento della cartografia manuale. Nessun backend, nessun account utente nella v1 — ma l'architettura è predisposta per aggiungerli in futuro (Repository pattern con data source sostituibile).

---

## Stack Tecnologico

| Componente | Tecnologia |
|------------|-----------|
| Linguaggio | Kotlin 2.0+ |
| UI Framework | Jetpack Compose + Material 3 |
| Mappa | osmdroid (tile raster, overlay custom, offline nativo) |
| Chart | Vico (Compose-native, AreaChart + LineChart) |
| Persistenza | Room (SQLite) |
| Networking | Retrofit + OkHttp |
| DI | Koin |
| Async | Kotlin Coroutines + Flow |
| State | ViewModel + StateFlow |
| PDF | Android PdfDocument API (nativo) |
| Serialization | Kotlin Serialization (JSON) |
| Compressione URL | LZ-string (port Kotlin) |
| Min SDK | 26 (Android 8.0, ~95% dispositivi) |
| Target SDK | 35 (Android 15) |

---

## Architettura

**Pattern**: MVVM con Repository pattern, single Gradle module.

**Flusso dati**: `UI (Compose) → ViewModel (StateFlow) → Repository → Room / API Service`

Il ViewModel espone `StateFlow<UiState>` che la UI osserva con `collectAsState()`. Le mutazioni passano attraverso il Repository che decide se persistere in Room o chiamare API remote.

**Navigazione**: Single-Activity con Compose Navigation.

### Package Structure

```
it.trektrak/
├── data/
│   ├── local/
│   │   ├── AppDatabase.kt
│   │   ├── dao/
│   │   │   ├── ItineraryDao.kt
│   │   │   ├── QuizDao.kt
│   │   │   └── LearningDao.kt
│   │   └── entity/
│   │       ├── ItineraryEntity.kt
│   │       ├── WaypointEntity.kt
│   │       ├── LegEntity.kt
│   │       ├── QuizSessionEntity.kt
│   │       ├── LearningSessionEntity.kt
│   │       └── SettingsEntity.kt
│   ├── remote/
│   │   ├── ElevationService.kt
│   │   ├── GeocodingService.kt
│   │   ├── RoutingService.kt
│   │   └── OverpassService.kt
│   └── repository/
│       ├── ItineraryRepository.kt
│       ├── ItineraryRepositoryImpl.kt
│       ├── QuizRepository.kt
│       ├── LearningRepository.kt
│       └── SettingsRepository.kt
│
├── domain/
│   ├── model/
│   │   ├── Waypoint.kt
│   │   ├── Leg.kt
│   │   ├── Itinerary.kt
│   │   ├── ValidationResult.kt
│   │   ├── QuizSession.kt
│   │   ├── LearningHistory.kt
│   │   └── AppSettings.kt
│   ├── calculation/
│   │   ├── GeoCalculations.kt
│   │   ├── ValidationLogic.kt
│   │   ├── DifficultyRating.kt
│   │   ├── ProfileSampling.kt
│   │   └── AutoFillPipeline.kt
│   └── export/
│       ├── GpxExporter.kt
│       ├── PdfSummaryExporter.kt
│       ├── PdfRoadbookExporter.kt
│       └── UrlShareCodec.kt
│
├── ui/
│   ├── map/
│   │   ├── TrekMapView.kt
│   │   ├── MapViewModel.kt
│   │   ├── overlay/
│   │   │   ├── WaypointOverlay.kt
│   │   │   ├── LegPolylineOverlay.kt
│   │   │   ├── CompassOverlay.kt
│   │   │   ├── RulerOverlay.kt
│   │   │   ├── CoordinateGridOverlay.kt
│   │   │   └── QuizMarkerOverlay.kt
│   │   └── TileProviders.kt
│   ├── panel/
│   │   ├── PanelScreen.kt
│   │   ├── PanelViewModel.kt
│   │   ├── WaypointList.kt
│   │   ├── WaypointCard.kt
│   │   ├── LegCard.kt
│   │   ├── SummaryBar.kt
│   │   ├── ActionBar.kt
│   │   ├── ItineraryHeader.kt
│   │   └── SavedItinerariesDialog.kt
│   ├── quiz/
│   │   ├── QuizScreen.kt
│   │   ├── QuizViewModel.kt
│   │   ├── QuizQuestion.kt
│   │   └── QuizSummary.kt
│   ├── learn/
│   │   ├── ProgressScreen.kt
│   │   ├── ProgressViewModel.kt
│   │   └── ValidationBadge.kt
│   ├── chart/
│   │   ├── ElevationProfileChart.kt
│   │   └── TrendChart.kt
│   ├── settings/
│   │   ├── MapSettingsSheet.kt
│   │   ├── ToleranceSettingsSheet.kt
│   │   └── SettingsViewModel.kt
│   ├── onboarding/
│   │   ├── TutorialOverlay.kt
│   │   └── WhatsNewDialog.kt
│   ├── common/
│   │   ├── NumberInputField.kt
│   │   ├── ModeSwitch.kt
│   │   └── OfflineBanner.kt
│   ├── navigation/
│   │   └── TrekTrakNavigation.kt
│   └── theme/
│       ├── Theme.kt
│       └── Color.kt
│
├── di/
│   ├── AppModule.kt
│   └── ViewModelModule.kt
│
└── TrekTrakApplication.kt
```

---

## Data Model (Room)

### Entità principali

```kotlin
@Entity
data class ItineraryEntity(
    @PrimaryKey val id: String,          // UUID
    val name: String,
    val createdAt: String,               // ISO 8601
    val updatedAt: String,
    val appMode: String                  // "learn" | "track"
)

@Entity(foreignKeys = [ForeignKey(
    entity = ItineraryEntity::class,
    parentColumns = ["id"],
    childColumns = ["itineraryId"],
    onDelete = ForeignKey.CASCADE
)])
data class WaypointEntity(
    @PrimaryKey val id: String,
    val itineraryId: String,
    val name: String,
    val lat: Double?,
    val lon: Double?,
    val altitude: Double?,
    val order: Int,
    val validationJson: String?          // ValidationResult serializzato
)

@Entity(foreignKeys = [ForeignKey(
    entity = ItineraryEntity::class,
    parentColumns = ["id"],
    childColumns = ["itineraryId"],
    onDelete = ForeignKey.CASCADE
)])
data class LegEntity(
    @PrimaryKey val id: String,
    val itineraryId: String,
    val fromWaypointId: String,
    val toWaypointId: String,
    val distance: Double?,               // km
    val elevationGain: Double?,          // m
    val elevationLoss: Double?,          // m
    val azimuth: Double?,                // gradi
    val legOrder: Int,
    val elevationProfileJson: String?,   // Array<[distance, elevation]>
    val routeGeometryJson: String?,      // Array<LatLon>
    val validationJson: String?          // Map<field, ValidationResult>
)
```

### Entità didattiche

```kotlin
@Entity
data class QuizSessionEntity(
    @PrimaryKey val id: String,
    val date: String,
    val totalScore: Int,
    val questionsJson: String            // Array<QuizQuestion> serializzato
)

@Entity
data class LearningSessionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val date: String,
    val category: String,                // altitude|distance|azimuth|elevationGain|elevationLoss
    val attempts: Int,
    val accurateCount: Int
)
```

### Settings

```kotlin
@Entity
data class SettingsEntity(
    @PrimaryKey val id: Int = 1,         // singleton row
    val toleranceAltitude: Double,       // default 20
    val toleranceDistance: Double,        // default 10 (%)
    val toleranceAzimuth: Double,        // default 5
    val toleranceElevation: Double,      // default 15 (%)
    val quizQuestionsPerSession: Int,    // default 5
    val baseMap: String,                 // "osm" | "opentopomap" | "cyclosm" | "thunderforest"
    val showHikingTrails: Boolean,
    val showCoordinateGrid: Boolean,
    val sampleInterval: Int,             // 20|50|100|200 meters
    val tutorialSeen: Boolean,
    val lastWhatsNewVersion: String
)
```

### Design decisions

- **ValidationResult e QuizQuestion come JSON**: strutture annidiate non queryate direttamente. TypeConverter con Kotlin Serialization.
- **ElevationProfile come JSON blob**: array `[distance, elevation]` potenzialmente grande. Escluso dalle query lista, caricato on-demand.
- **Settings singleton row**: `id=1`, stessa logica di `trektrak_settings` in localStorage.
- **Schema migration**: gestita da Room `Migration(n, n+1)`, non serve campo versione manuale.
- **Domain model separato dalle Entity**: `domain/model/` contiene data class pure senza annotazioni Room. Il Repository mappa Entity ↔ Domain.

---

## Network Layer

Nessun proxy server-side. L'app chiama direttamente le API esterne (nessun CORS su Android nativo). Retrofit + OkHttp condiviso.

### Elevation Service

```
ElevationService
├── fetchElevation(lat, lon) → Double?
├── fetchElevationProfile(points: List<LatLon>) → List<Double?>
│   ├── Batch splitting: max 95 punti per richiesta (limite API OpenTopoData)
│   ├── Richieste sequenziali con delay(1000) tra batch (rate limit 1 req/s)
│   └── Cache in-memory: ConcurrentHashMap<Pair<Double,Double>, Double?>
├── Primary: OpenTopoData (eudem25m) — timeout 5s
└── Fallback: Open-Elevation — timeout 5s
```

### Geocoding Service (Nominatim)

```
GeocodingService
├── search(query: String) → List<GeocodingResult>
│   └── Debounce gestito nel ViewModel, non nel service
├── reverse(lat, lon) → String?
└── Headers: User-Agent obbligatorio per Nominatim ToS
```

### Routing Service (OpenRouteService)

```
RoutingService
├── fetchRoute(from: LatLon, to: LatLon) → RouteResult?
│   ├── RouteResult: geometry (List<LatLon>), distance, elevations
│   └── Profile: foot-hiking
└── API key in BuildConfig (da local.properties)
```

### Overpass Service

```
OverpassService
├── fetchPOIs(bounds: BoundingBox) → List<POI>
│   └── Query Overpass QL: huts, peaks, springs nel viewport
└── Timeout: 10s
```

### Pattern comuni

- **Nessun retry automatico** — fallback graceful a null (stessa filosofia PWA)
- **Timeout per-service** via OkHttp client
- **API key** in `BuildConfig`, iniettata via `local.properties` (non committato)
- **Offline graceful**: ogni service ritorna nullable, ViewModel gestisce il caso null
- **OkHttp condiviso**: singolo client con cache HTTP disco (10 MB)

---

## UI Layer

### Gerarchia schermate

```
MainActivity
└── TrekTrakNavigation (NavHost)
    └── MainScreen (unica route)
        ├── TrekMapView (osmdroid, full-screen)
        │   ├── WaypointOverlay
        │   ├── LegPolylineOverlay
        │   ├── CompassOverlay (attivabile)
        │   ├── RulerOverlay (attivabile)
        │   ├── CoordinateGridOverlay (attivabile)
        │   └── QuizMarkerOverlay (durante quiz)
        │
        ├── ElevationProfileChart (bottom bar, collassabile)
        │
        ├── PanelDrawer (lateral tablet, bottom sheet phone)
        │   ├── ItineraryHeader
        │   ├── ModeSwitch
        │   ├── WaypointList + WaypointCard
        │   ├── LegCard (per ogni tratta)
        │   ├── SummaryBar
        │   └── ActionBar
        │
        └── Overlay/Dialog
            ├── QuizScreen (overlay full-screen)
            ├── ProgressScreen (ModalBottomSheet)
            ├── MapSettingsSheet (ModalBottomSheet)
            ├── ToleranceSettingsSheet (ModalBottomSheet)
            ├── SavedItinerariesDialog
            ├── TutorialOverlay
            └── WhatsNewDialog
```

### Layout responsivo

Rilevamento via `WindowSizeClass` di Material 3:

- **Compact (phone portrait)**: mappa full-screen, pannello come `ModalBottomSheet` trascinabile (peek: SummaryBar, expanded: lista completa). Profilo altimetrico come barra sopra il bottom sheet.
- **Medium (phone landscape)**: mappa 60%, pannello laterale 40%.
- **Expanded (tablet)**: layout a due colonne fisso — pannello 380dp a sinistra, mappa a destra. Identico al desktop della PWA.

### Comunicazione tra componenti

**Map ↔ Chart (hover sync):**

`MapViewModel` condiviso tra `TrekMapView`, `ElevationProfileChart`, e `PanelDrawer` tramite `activityViewModels()`:

```kotlin
data class SharedMapState(
    val profileHoverDistance: Float? = null,  // chart → mappa: mostra marker
    val profileFlyToIndex: Int? = null,       // chart click → mappa anima
    val selectedLegIndex: Int? = null          // polyline hover → chart evidenzia
)
```

Puro StateFlow osservato da tutti. Nessun CustomEvent, nessuna variabile module-level.

**Quiz ↔ Mappa:**

`QuizViewModel` emette i punti quiz. `MapViewModel` li espone come `StateFlow<List<QuizPoint>>`. L'overlay sulla mappa li osserva. Risolve il problema architetturale della PWA (CustomEvent su window).

**Tool mutua esclusione:**

```kotlin
// Nel MapViewModel
data class ActiveTool(val type: ToolType?) // COMPASS, RULER, QUIZ, null
```

Niente prop drilling — ViewModel condiviso, ogni componente osserva `activeTool`.

**Drag-and-drop waypoint list:**

`LazyColumn` con libreria `reorderable` (Compose-native). Reorder → ViewModel resetta e ricalcola tratte.

---

## Feature Mapping (PWA → Android)

### Feature 1: Gestione Waypoint

- Compose `TextField` con `NumberInputField` custom (keyboard numerica, validazione inline)
- Click su mappa → `MapEventsReceiver` osmdroid → ViewModel aggiorna lat/lon
- Marker drag → `OnMarkerDragListener` osmdroid → ViewModel aggiorna lat/lon
- Reorder → `LazyColumn` reorderable → ViewModel resetta tratte
- Limite 50 waypoint

### Feature 2: Gestione Tratte

- Campi: distanza (km), D+ (m), D- (m), azimuth (gradi)
- Calcolo derivato automatico: tempo Munter, pendenza %
- Dislivelli indipendenti dalle altitudini waypoint (input didattico)

### Feature 3: Mappa Interattiva

- osmdroid `MapView` in `AndroidView` Compose wrapper
- 4 tile provider + hiking trails overlay, switch runtime
- Zoom/pan multi-touch nativi
- `WaypointOverlay`: marker custom (icona verde) con drag
- `LegPolylineOverlay`: polyline colorate per tratta

### Feature 4: Tabella Itinerario

- `LazyColumn` con righe per tratta
- `SummaryBar` sticky: distanza totale, D+ totale, D- totale, tempo totale

### Feature 5: Profilo Altimetrico

- Vico `CartesianChart` con `AreaStyle` gradient fill
- Touch → `SharedMapState.profileHoverDistance` → marker su mappa
- Tap waypoint → `SharedMapState.profileFlyTo` → mappa anima al punto
- Smoothing 5 punti [1,2,3,2,1]

### Feature 6: Export PDF

- `PdfDocument` nativo, Canvas drawing
- Sintetico (1 pagina): tabella + metadati
- Roadbook (multi-pagina): dettaglio per tratta con azimuth, direzione, dislivello
- Salvataggio: `Intent.ACTION_CREATE_DOCUMENT` (SAF)
- Condivisione: `ShareCompat.IntentBuilder`

### Feature 7: Export GPX

- String builder Kotlin, formato GPX 1.1
- Waypoint (`<wpt>`), traccia (`<trk><trkseg>`), elevazione (`<ele>`)
- Salvataggio e condivisione come PDF

### Feature 8: Salvataggio Locale

- Room CRUD via `ItineraryRepository`
- Lista itinerari in `SavedItinerariesDialog`
- Nessun limite 4MB (SQLite gestisce volumi superiori)
- Schema migration gestite da Room

### Feature 9: Validazione con Feedback Visivo

- `ValidationBadge` Composable: cerchio colorato (verde/giallo/rosso) + icona
- Stesse tolleranze e calcoli (port di `calculations.ts`)
- Popover con delta e valore reale: Compose `Popup`

### Feature 10: Quiz Mode

- `QuizScreen` overlay full-screen semitrasparente
- Domande generate dal viewport corrente (bounds da `MapViewModel`)
- POI da Overpass per punti riferimento
- Tipi: coordinate, altitudine, distanza, azimuth
- Punteggio 0-100, stessa formula PWA

### Feature 11: Suggerimenti Didattici

- Port di `didactic-tips.ts` → `DidacticTips.kt` in `domain/`
- Mostrati nel popover `ValidationBadge` dopo verifica

### Feature 12: Report Apprendimento

- `ProgressScreen`: summary cards + Vico `LineChart` trend
- Dati da `LearningRepository` → Room query aggregate
- Categorie: altitude, distance, azimuth, elevationGain, elevationLoss

### Feature 13: Tolleranze Configurabili

- `ToleranceSettingsSheet`: slider Material 3
- Persist in Room (`SettingsEntity`)
- Stessi default PWA

### Feature 14: Overlay Griglia Coordinate

- `CoordinateGridOverlay` osmdroid: griglia decimale (lat/lon) come nella PWA
- Toggle on/off da `MapSettingsSheet`
- UTM fuori scope (come nella PWA)

### Feature 15: Stima Difficoltà

- Scala SAC T1-T6 da pendenza massima
- Mostrata in `SummaryBar` e nei PDF

### Feature 16: Link Meteo

- `Intent.ACTION_VIEW` con URL Meteoblue parametrizzato
- Apre browser esterno

### Feature 17: Condivisione URL

- `UrlShareCodec.kt`: formato compatto + compressione LZ-string
- Share via `ShareCompat` (share sheet Android)
- Ricezione: deep link `trektrak://itinerary/{hash}` con Intent filter

### Feature non portate (non applicabili)

- **PWA / Service Worker**: l'app è nativa, sempre "installata"
- **Tile caching via Serwist**: sostituito da cache tile built-in di osmdroid

---

## Auto-Fill Pipeline

Port di `auto-fill.ts` in `AutoFillPipeline.kt`. Logica più complessa dell'app.

### Flusso

```
Trigger (waypoint drag / add / reorder)
    │
    ▼
AutoFillPipeline.execute(leg, from, to)
    │
    ├─ 1. Fetch elevation per from e to (cache in-memory)
    │     └─ ElevationService.fetchElevation()
    │
    ├─ 2. Fetch route geometry (modalità Trail)
    │     └─ RoutingService.fetchRoute()
    │     └─ Fallback: linea retta (modalità Classic)
    │
    ├─ 3. Campiona profilo altimetrico
    │     ├─ Classic: interpolatePoints() linea retta, fetch DEM batch
    │     └─ Trail: altitudini ORS, distanze scalate
    │
    ├─ 4. Smoothing 5 punti [1,2,3,2,1]
    │
    ├─ 5. Calcola D+/D- cumulativo dal profilo
    │
    └─ 6. Aggiorna Leg nel ViewModel
```

### Gestione concorrenza

```kotlin
class AutoFillPipeline(...) {
    private var currentJob: Job? = null

    fun execute(scope: CoroutineScope, leg: Leg, from: Waypoint, to: Waypoint,
                onResult: (AutoFillResult) -> Unit) {
        currentJob?.cancel()
        currentJob = scope.launch(Dispatchers.IO) {
            // pipeline steps con ensureActive() tra ogni step
            withContext(Dispatchers.Main) { onResult(result) }
        }
    }
}
```

`currentJob?.cancel()` + `ensureActive()` sostituisce il generation counter della PWA.

### Elevation cache

```kotlin
private val cache = ConcurrentHashMap<Pair<Double, Double>, Double?>()
```

In-memory, per sessione. Stessa strategia della PWA.

### Batch con rate limiting

```kotlin
points.chunked(95).flatMap { batch ->
    val result = elevationService.fetchBatch(batch)
    delay(1000)  // rate limit OpenTopoData 1 req/s
    result
}
```

---

## Tile Caching e Offline

### Cache tile osmdroid

osmdroid gestisce il tile caching nativamente con `SqlTileWriter` (SQLite su disco):

```kotlin
Configuration.getInstance().apply {
    osmdroidTileCache = File(context.cacheDir, "osmdroid")
    tileFileSystemCacheMaxBytes = 100L * 1024 * 1024   // 100 MB
    tileFileSystemCacheTrimBytes = 80L * 1024 * 1024    // trim a 80 MB
    expirationOverrideDuration = 30L * 24 * 60 * 60 * 1000  // 30 giorni TTL
}
```

Sostituisce completamente Serwist e le 6 cache Workbox della PWA.

### Comportamento offline

| Feature | Online | Offline |
|---------|--------|---------|
| Mappa (tile) | Fetch + cache | Solo tile già cachate |
| Waypoint CRUD | Locale | Locale |
| Elevation | API call | null (campo vuoto) |
| Geocoding | API call | Disabilitato + banner |
| Routing | API call | Fallback Classic (linea retta) |
| Validazione | API elevation | Solo calcoli locali (distanza, azimuth) |
| Quiz (altitudine) | API call | Domanda skippata |
| Export PDF/GPX | Locale | Funziona |
| Salvataggio | Room | Funziona |

### Rilevamento connettività

```kotlin
class NetworkMonitor(context: Context) {
    val isOnline: StateFlow<Boolean>  // ConnectivityManager callback
}
```

`OfflineBanner` osserva `isOnline`. I ViewModel degradano subito se offline.

---

## Testing Strategy

### Unit Test JVM (~60% copertura)

Tutto `domain/` gira su JVM pura:

```
domain/calculation/
├── GeoCalculationsTest.kt
├── ValidationLogicTest.kt
├── DifficultyRatingTest.kt
├── ProfileSamplingTest.kt
├── AutoFillPipelineTest.kt (service mockati)
└── MunterTimeTest.kt

domain/export/
├── GpxExporterTest.kt
├── PdfExporterTest.kt (mock Canvas)
└── UrlShareCodecTest.kt
```

Port diretto dei 28 test file della PWA.

### Integration Test (~25%)

Room + Repository con database in-memory:

```
data/repository/
├── ItineraryRepositoryTest.kt
├── QuizRepositoryTest.kt
├── LearningRepositoryTest.kt
└── SettingsRepositoryTest.kt
```

JVM con `Room.inMemoryDatabaseBuilder`.

### UI Test (~15%)

Compose test con `createComposeRule()`:

```
ui/
├── WaypointCardTest.kt
├── LegCardTest.kt
├── ActionBarTest.kt
├── ValidationBadgeTest.kt
├── ModeSwitchTest.kt
├── NumberInputFieldTest.kt
└── QuizQuestionTest.kt
```

### Non testato (v1)

- osmdroid MapView (test manuale)
- Vico chart (test manuale)
- Chiamate API reali (mockate)
- Layout responsivo (test manuale su emulatore phone + tablet)

### Tool

JUnit 5 + MockK + Compose Testing.

---

## Build e Distribuzione

### Build setup

```
Gradle (Kotlin DSL)
├── compileSdk = 35
├── minSdk = 26
├── targetSdk = 35
├── Kotlin 2.0+
├── Compose BOM (ultima stabile)
└── Variants: debug | release (R8 minificato)
```

### API key

```properties
# local.properties (in .gitignore)
ORS_API_KEY=...
THUNDERFOREST_API_KEY=...
```

Iniettate in `BuildConfig` via Gradle.

### Signing

- Debug: keystore auto-generato
- Release: keystore dedicato, conservato fuori dal repo
- Google Play App Signing attivato

### APK size stimato

~8-12 MB post R8 (app + osmdroid + Vico + Retrofit + OkHttp + Room + Koin).

### Versioning

- Android parte da **v1.0.0**
- `versionCode` incrementale per Play Store
- `versionName` = semantic version

### Play Store listing

- Titolo: "TrekTrak — Cartografia Manuale"
- Categoria: Education
- Content rating: IARC → Everyone
- Asset: icona 512x512, feature graphic 1024x500, min 2 screenshot
- Privacy policy URL obbligatoria
- Data safety declaration

---

## Costi

| Voce | Costo |
|------|-------|
| Strumenti (Android Studio, SDK) | Gratuito |
| Account Google Play | $25 una tantum |
| API (OpenTopoData, Nominatim, Overpass) | Gratuito |
| OpenRouteService | Gratuito (free tier) |
| Server backend | $0 (nessun backend in v1) |

---

## Predisposizione per il futuro

L'architettura Repository pattern permette di aggiungere in futuro:

- **Account utente**: nuovo `RemoteDataSource` accanto a `LocalDataSource`, senza toccare ViewModel o UI
- **Sync cloud**: logica di merge/conflict nel Repository
- **Backend**: qualsiasi backend (Firebase, custom API) si innesta come data source aggiuntivo

Il costo architetturale di questa predisposizione è ~10 ore in più di interfacce Repository pulite.
