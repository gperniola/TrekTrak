# TrekTrak Android — M1 "Core didattico" — Design Specification

> **Stato:** ri-validazione (2026-06-09) della spec `docs/superpowers/specs/2026-04-16-android-native-port-design.md`, che era ferma alla PWA v0.6.0. Questo documento la **supera** per la milestone M1. La PWA di riferimento è ora **v0.10.10**.
>
> **Repository:** il porting Android va in un **repository separato** (`git@github.com-personal:gperniola/TrekTrak-Android.git` o nome equivalente). Nessuna condivisione di codice con la PWA (stack diverso). Questa spec e i piani vengono copiati nel nuovo repo come riferimento di partenza.

## Scopo

Portare TrekTrak da PWA (Next.js + React) ad app **Android nativa** (Kotlin + Jetpack Compose), raggiungendo nella release pubblica **v1.0 la parità col core della PWA v0.10.10**.

Il porting è scomposto in **3 milestone**, ognuna con la propria spec→piano→implementazione:

| Milestone | Contenuto | Spec |
|-----------|-----------|------|
| **M1 — Core didattico** | Le 17 feature core + aggiunte didattiche/UX di v0.7.0 (profilo stimato-vs-reale, switch Learn/Track non distruttivo, Munter personale, quick-action marker, quiz clemente) + nuova **shell mobile bottom-nav** + **bussola reale nativa** (magnetometro + declinazione). App didattica completa, **on-device, senza account né cloud**. | **questo documento** |
| **M2 — Libreria percorsi locale** | v0.8.0: switch Editor↔Libreria, lista ordinabile, anteprima read-only su mappa, scheda metriche, note, **diario completamenti**. Ancora on-device. | da scrivere |
| **M3 — Libreria condivisa cloud** | v0.9.0: backend Supabase, auth magic-link a invito, membri/ruoli, RLS, sync. | da scrivere |
| **M4 — Strumenti da campo nativi** (post-v1.0) | Capacità hardware non possibili nel browser: **GPS live + registrazione traccia** (estende "stimato vs reale" al campo), **altimetro barometrico**, **mappe vettoriali offline** (mapsforge/MapLibre). Inquadrati come strumenti per *verificare il lavoro manuale contro la realtà*, non auto-compilazione. | da scrivere |

**Release pubblica v1.0 = fine M3** (parità piena con la PWA). L'app è funzionante e collaudabile già da fine M1. **M4 è post-v1.0**: sfrutta vantaggi nativi che la PWA non ha, non serve alla parità. La strategia di rilascio (beta dopo M1 vs unico lancio) è **rimandata**.

L'app resta didattica: apprendimento della cartografia manuale, l'utente inserisce i dati e l'app valida su richiesta. In M1 **nessun backend, nessun account**.

---

## Stack Tecnologico

| Componente | Tecnologia |
|------------|-----------|
| Linguaggio | Kotlin 2.0+ |
| UI Framework | Jetpack Compose + Material 3 |
| Mappa | osmdroid (tile raster, overlay custom, cache offline nativa) |
| Chart | Vico (Compose-native, AreaChart con serie multiple) |
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

Il ViewModel espone `StateFlow<UiState>` osservato dalla UI con `collectAsState()`. Le mutazioni passano dal Repository. **Predisposizione M3**: il Repository è già definito su interfaccia con `LocalDataSource` (Room); M3 aggiungerà un `RemoteDataSource` (Supabase) senza toccare ViewModel/UI.

**Navigazione**: Single-Activity con Compose Navigation. In M1 la "navigazione" mobile è guidata da una **bottom navigation** (vedi UI Layer), non da route multiple.

### Package Structure

```
it.trektrak/
├── data/
│   ├── local/
│   │   ├── AppDatabase.kt
│   │   ├── dao/{ItineraryDao, QuizDao, LearningDao}.kt
│   │   └── entity/{ItineraryEntity, WaypointEntity, LegEntity,
│   │                QuizSessionEntity, LearningSessionEntity, SettingsEntity}.kt
│   ├── remote/{ElevationService, GeocodingService, RoutingService, OverpassService}.kt
│   └── repository/{ItineraryRepository(+Impl), QuizRepository, LearningRepository, SettingsRepository}.kt
│
├── domain/
│   ├── model/{Waypoint, Leg, Itinerary, ValidationResult, QuizSession, LearningHistory, AppSettings}.kt
│   ├── calculation/{GeoCalculations, ValidationLogic, DifficultyRating,
│   │                ProfileSampling, AutoFillPipeline, MunterTime, ModeSnapshot}.kt
│   └── export/{GpxExporter, PdfSummaryExporter, PdfRoadbookExporter, UrlShareCodec}.kt
│
├── ui/
│   ├── shell/                      ← NUOVO: shell mobile
│   │   ├── MainScreen.kt           (orchestrazione: mappa + sheet + bottom nav)
│   │   ├── BottomNav.kt            (Mappa / Editor [+ Libreria in M2] / Altro)
│   │   ├── MoreMenu.kt             (Meteo / PDF sintetico / PDF roadbook / GPX)
│   │   └── ShellViewModel.kt       (mobileTab, moreMenuOpen, activeTool)
│   ├── map/
│   │   ├── TrekMapView.kt
│   │   ├── MapViewModel.kt
│   │   ├── MapToolsFab.kt          ← NUOVO: speed-dial bussola/righello/quiz
│   │   ├── WaypointPopup.kt        ← NUOVO: quick-action (rinomina/copia/elimina)
│   │   ├── CompassSensor.kt        ← NUOVO: SensorManager (rotation-vector) + declinazione
│   │   ├── overlay/{WaypointOverlay, LegPolylineOverlay, CompassOverlay,
│   │   │            RulerOverlay, CoordinateGridOverlay, QuizMarkerOverlay}.kt
│   │   └── TileProviders.kt
│   ├── panel/
│   │   ├── EditorPanel.kt          (header con ModeSwitch + ⚙; lista; tabella; azioni)
│   │   ├── PanelViewModel.kt
│   │   ├── WaypointList.kt / WaypointCard.kt / LegCard.kt
│   │   ├── SummaryBar.kt / ActionBar.kt / ItineraryHeader.kt
│   │   └── SavedItinerariesDialog.kt
│   ├── quiz/{QuizScreen, QuizViewModel, QuizQuestion, QuizSummary}.kt
│   ├── learn/{ProgressScreen, ProgressViewModel, ValidationBadge}.kt
│   ├── chart/{ElevationProfileChart, TrendChart}.kt
│   ├── settings/{MapSettingsSheet, ToleranceSettingsSheet, PaceSettingsRow, SettingsViewModel}.kt
│   ├── onboarding/{TutorialOverlay, WhatsNewDialog}.kt
│   ├── common/{NumberInputField, ModeSwitch, OfflineBanner, AppDialog, AppSnackbar}.kt
│   └── theme/{Theme, Color}.kt
│
├── di/{AppModule, ViewModelModule}.kt
└── TrekTrakApplication.kt
```

---

## Data Model (Room)

### Itinerario, waypoint, tratta

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
    entity = ItineraryEntity::class, parentColumns = ["id"],
    childColumns = ["itineraryId"], onDelete = ForeignKey.CASCADE)])
data class WaypointEntity(
    @PrimaryKey val id: String,
    val itineraryId: String,
    val name: String,
    val lat: Double?,
    val lon: Double?,
    val altitude: Double?,               // quota ATTIVA (dipende da appMode)
    val trackAltitude: Double?,          // ← NUOVO: snapshot modalità Track
    val learnAltitude: Double?,          // ← NUOVO: snapshot modalità Learn
    val order: Int,
    val validationJson: String?          // ValidationResult serializzato
)

@Entity(foreignKeys = [ForeignKey(
    entity = ItineraryEntity::class, parentColumns = ["id"],
    childColumns = ["itineraryId"], onDelete = ForeignKey.CASCADE)])
data class LegEntity(
    @PrimaryKey val id: String,
    val itineraryId: String,
    val fromWaypointId: String,
    val toWaypointId: String,
    val distance: Double?,               // km   — campo ATTIVO
    val elevationGain: Double?,          // m    — campo ATTIVO
    val elevationLoss: Double?,          // m    — campo ATTIVO
    val azimuth: Double?,                // gradi — campo ATTIVO
    val legOrder: Int,
    val elevationProfileJson: String?,   // Array<{distance, altitude}> — profilo ATTIVO
    val routeGeometryJson: String?,      // Array<LatLon> — geometria ATTIVA (solo Track)
    val learnValuesJson: String?,        // ← NUOVO: snapshot Learn (4 campi numerici)
    val trackValuesJson: String?,        // ← NUOVO: snapshot Track (4 campi + routeGeometry + elevationProfile REALE)
    val validationJson: String?          // Map<field, ValidationResult>
)
```

> Il **profilo stimato-vs-reale** (Feature 18) nasce da qui: in Learn, il profilo "reale" da disegnare dietro a quello dell'utente è quello in `trackValuesJson.elevationProfile`.

### Entità didattiche

```kotlin
@Entity
data class QuizSessionEntity(
    @PrimaryKey val id: String,
    val date: String,
    val totalScore: Int,                 // media 0–100
    val questionsJson: String            // Array<QuizAnswer> serializzato
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
    val toleranceDistance: Double,       // default 10 (%)
    val toleranceAzimuth: Double,        // default 5
    val toleranceElevation: Double,      // default 15 (%)
    val paceFactor: Double,              // ← NUOVO: fattore Munter personale, default 1.0 (range 0.7–1.5)
    val quizQuestionsPerSession: Int,    // default 5
    val baseMap: String,                 // "osm" | "opentopomap" | "cyclosm" | "thunderforest"
    val showHikingTrails: Boolean,
    val showCoordinateGrid: Boolean,
    val sampleInterval: Int,             // 20|50|100|200 metri
    val tutorialSeen: Boolean,
    val lastWhatsNewVersion: String
)
```

### Design decisions

- **Snapshot per-modalità su Entity**: `trackAltitude`/`learnAltitude` su Waypoint e `learnValuesJson`/`trackValuesJson` su Leg permettono lo switch Learn↔Track non distruttivo (Feature 19) senza perdita dati.
- **ValidationResult, QuizAnswer, snapshot, profili come JSON**: strutture annidate non queryate direttamente. TypeConverter con Kotlin Serialization.
- **ElevationProfile come JSON blob**: array potenzialmente grande; escluso dalle query lista, caricato on-demand.
- **Settings singleton row** (`id=1`), equivalente a `trektrak_settings` in localStorage della PWA.
- **Migration**: gestite da Room `Migration(n, n+1)`.
- **Domain model separato dalle Entity**: `domain/model/` contiene data class pure; il Repository mappa Entity ↔ Domain.

---

## Network Layer

Nessun proxy server-side (su Android nativo non c'è CORS): chiamate dirette alle API esterne. Retrofit + OkHttp condiviso. **Invariato rispetto alla spec originale.**

- **ElevationService**: `fetchElevation`, `fetchElevationProfile` (batch max 95 punti, `delay(1000)` tra batch, cache in-memory `ConcurrentHashMap`). Primary OpenTopoData (eudem25m), fallback Open-Elevation. Timeout 5s.
- **GeocodingService (Nominatim)**: `search`, `reverse`; User-Agent obbligatorio; debounce nel ViewModel.
- **RoutingService (OpenRouteService)**: `fetchRoute` profilo `foot-hiking`; API key in `BuildConfig`.
- **OverpassService**: `fetchPOIs(bounds)` (huts, peaks, springs); timeout 10s.
- **Pattern comuni**: nessun retry, fallback graceful a `null`, timeout per-service, OkHttp condiviso con cache disco 10 MB, degrado offline gestito dal ViewModel.

---

## UI Layer

### Shell mobile (riscritta — sostituisce drawer/bottom-sheet della spec originale)

Rilevamento dimensioni via **`WindowSizeClass`** Material 3.

**Compact (phone)** — nuova shell a **bottom navigation**:

```
MainScreen
├── TrekMapView (osmdroid, sempre presente sotto)
│   └── MapToolsFab (speed-dial in basso a sinistra: bussola / righello / quiz)
├── EditorPanel come SHEET a tutto schermo sopra la mappa (quando tab = Editor)
│   └── header: ModeSwitch (Learn/Track) + ⚙ (impostazioni)
├── ElevationProfileChart (striscia, sopra la bottom nav)
└── BottomNav (sempre visibile):  [🗺️ Mappa] [✏️ Editor] [⋯ Altro]
                                   (📚 Libreria si AGGIUNGE in M2)
```

- `ShellViewModel.mobileTab: StateFlow<MobileTab>` con valori `MAP | EDITOR` (M2 aggiunge `LIBRARY`).
- **Mappa**: tab base, mappa a tutto schermo; il tasto Indietro di Android (nativo, gestito da `BackHandler`) chiude prima eventuali overlay/tool, poi torna alla tab Mappa, infine esce (comportamento nativo — niente l'history-hack della PWA).
- **Editor**: sheet a tutto schermo sopra mappa+profilo, scrollabile come un'unica pagina.
- **Altro** (`MoreMenu`): Meteo / PDF sintetico / PDF roadbook / GPX, disabilitati se non applicabili (es. <2 waypoint).
- **MapToolsFab**: speed-dial con bussola/righello/quiz; **mutua esclusione** (`activeTool: ToolType?`); il tool attivo è evidenziato.

**Medium (phone landscape)**: mappa 60% + pannello 40%.

**Expanded (tablet)**: due colonne fisse — pannello 380dp a sinistra, mappa a destra (come desktop PWA). Niente bottom nav: ModeSwitch e tool nell'header del pannello.

### Dialog e notifiche

Il sistema **modal + toast in-app** della PWA (v0.7.0) su Android è nativo:
- Conferme/avvisi → `AppDialog` (Material 3 `AlertDialog`).
- Notifiche transitorie → `AppSnackbar` (`SnackbarHost`).
- Le quick-action del marker che chiedono conferma (elimina) usano `AppDialog`.

### Comunicazione tra componenti

- **Map ↔ Chart (hover/fly-to sync)** via `SharedMapState` in `MapViewModel` condiviso (`profileHoverDistance`, `profileFlyToIndex`, `selectedLegIndex`). Puro StateFlow, niente CustomEvent.
- **Quiz ↔ Mappa**: `QuizViewModel` emette i punti; `MapViewModel` li espone come `StateFlow<List<QuizPoint>>`; l'overlay li osserva (risolve l'hack CustomEvent-su-window della PWA).
- **Tool mutua esclusione**: `ActiveTool` nel `MapViewModel`/`ShellViewModel`.
- **Reorder waypoint**: `LazyColumn` con libreria `reorderable`; il reorder resetta e ricalcola le tratte.

---

## Feature Mapping (PWA → Android)

> Feature 1–17 invariate rispetto alla spec originale (riassunte); 18–22 sono le **aggiunte v0.7.0**.

1. **Gestione Waypoint** — `NumberInputField` custom, click/drag su mappa via osmdroid, reorder `LazyColumn`, limite 50.
2. **Gestione Tratte** — distanza/D+/D-/azimuth; derivati: tempo Munter, pendenza %.
3. **Mappa Interattiva** — osmdroid in `AndroidView`; 4 tile provider + overlay sentieri; `WaypointOverlay`, `LegPolylineOverlay`.
4. **Tabella Itinerario** — `LazyColumn` + `SummaryBar` sticky (totali).
5. **Profilo Altimetrico** — Vico `CartesianChart` area+gradient; sync hover/tap con la mappa; smoothing 5 punti [1,2,3,2,1].
6. **Export PDF** — `PdfDocument`/Canvas; sintetico (1 pag) + roadbook (multi-pag); SAF (`ACTION_CREATE_DOCUMENT`) + `ShareCompat`.
7. **Export GPX** — string builder GPX 1.1 (`<wpt>`, `<trk><trkseg>`, `<ele>`).
8. **Salvataggio Locale** — Room CRUD; `SavedItinerariesDialog`; niente limite 4 MB.
9. **Validazione con feedback visivo** — `ValidationBadge` (cerchio verde/giallo/rosso); stesse tolleranze (port `calculations.ts`); popover con delta + valore reale.
10. **Quiz Mode** — overlay full-screen; domande dal viewport; POI da Overpass; tipi coordinate/altitudine/distanza/azimuth.
11. **Suggerimenti Didattici** — port `didactic-tips.ts` → `DidacticTips.kt`; mostrati nel popover di validazione.
12. **Report Apprendimento** — `ProgressScreen` con summary cards + Vico `LineChart`; dati da `LearningRepository`.
13. **Tolleranze Configurabili** — `ToleranceSettingsSheet` (slider); persist in `SettingsEntity`.
14. **Overlay Griglia Coordinate** — `CoordinateGridOverlay` osmdroid (decimale); toggle da `MapSettingsSheet`.
15. **Stima Difficoltà** — scala SAC T1–T6 da pendenza massima; in `SummaryBar` e PDF.
16. **Link Meteo** — `Intent.ACTION_VIEW` URL Meteoblue; nel menu Altro.
17. **Condivisione URL** — `UrlShareCodec` (compatto + LZ-string); `ShareCompat`; ricezione via deep link `trektrak://itinerary/{hash}`.

### ← NUOVE (v0.7.0)

18. **Profilo stimato-vs-reale** (killer feature) — vedi sezione dedicata. Due serie Vico sovrapposte su asse X = distanza cumulata: **verde piena** = stima utente (quote waypoint, interpolazione lineare), **tratteggio ciano** = profilo reale DEM da `trackValues.elevationProfile`. Allineamento X con le distanze Track se presenti, altrimenti con quelle stimate. Visibile in Learn quando esiste uno snapshot Track.
19. **Switch Learn↔Track non distruttivo** — vedi sezione dedicata. `setAppMode` fa snapshot dei campi attivi nello slot della modalità uscente e restore da quella entrante, su waypoint e tratte; ricalcola Munter/pendenza; azzera la validazione (mode-specifica). Nessun dialog, nessuna perdita dati.
20. **Munter personalizzato** — `estimatedTime = baseMunter * paceFactor` (factor da `SettingsEntity.paceFactor`, default 1.0). Editabile via slider in `PaceSettingsRow`; al cambio si ricalcolano tutte le stime.
21. **Quick-action marker** — `WaypointPopup` su tap marker: **rinomina** (TextField, save on blur, trim 100 char), **copia coordinate** (`lat.toFixed(6), lon.toFixed(6)` in clipboard + snackbar), **elimina** (AppDialog di conferma → `removeWaypoint` + snackbar).
22. **Quiz scoring clemente** — curva piecewise (vedi sotto), più indulgente del lineare.
23. **Bussola reale (nativa)** — vedi sezione dedicata. A differenza della PWA (dove il "tool bussola" è solo una rosa dei venti disegnata, perché il browser non ha accesso affidabile al magnetometro), su Android la bussola usa i **sensori reali** e mostra l'orientamento effettivo del dispositivo, con **correzione della declinazione magnetica** (nord magnetico → nord geografico). È un upgrade didattico del tool esistente, non una feature separata nella UI.

### Feature non portate (non applicabili)

- **PWA / Service Worker / UpdateBanner**: l'app è nativa, sempre installata; aggiornamenti via Play Store.
- **Tile caching via Serwist**: sostituito dalla cache tile nativa osmdroid.
- **Gestione tasto Indietro via History API** (v0.10.2/0.10.10): su Android è nativa (`BackHandler`), niente guardie in cronologia.

---

## Feature 18 in dettaglio — Profilo stimato-vs-reale

**Dati**: per ogni tratta, `elevationProfile` (attivo) e `trackValues.elevationProfile` (reale, popolato dall'auto-fill in Track). Le quote waypoint hanno `learnAltitude`/`trackAltitude`.

**Costruzione (port di `ElevationProfile.tsx`)**:
1. Itera le tratte; per ciascuna con profilo, emette i punti (fallback: quote waypoint se manca il profilo).
2. Se in Learn ed esiste `trackValues.elevationProfile`, costruisce la serie "reale" da disegnare dietro.
3. Allinea le due serie sull'asse X (distanza cumulata): usa le distanze Track per-tratta se disponibili, altrimenti quelle stimate.
4. Dataset unico con chiavi `altitude` (utente) e `realAltitude` (Track) per distanza, ordinato; due Area in Vico.

**Interazione**: tap sul chart → fly-to sulla mappa; hover → linea di riferimento verticale (port `ProfileHoverMarker`).

---

## Feature 19 in dettaglio — Switch Learn↔Track non distruttivo

`ModeSnapshot.kt` (port di `snapshotLegForMode`/`restoreLegForMode` + logica `setAppMode` di `itineraryStore.ts`):

```
setAppMode(newMode):
  for wp in waypoints:
     wp[oldMode+"Altitude"] = wp.altitude          // snapshot
     wp.altitude = wp[newMode+"Altitude"]          // restore (o null)
     wp.validation = null
  for leg in legs:
     snapshotLegForMode(leg, oldMode)              // salva 4 campi (+ geometry/profile se Track)
     restoreLegForMode(leg, newMode)               // ripristina dallo slot della nuova modalità
     recalculateLeg(leg, paceFactor)               // Munter + pendenza
     leg.validation = null
```

Nessuna conferma, nessuna perdita: i valori delle due modalità coesistono negli slot snapshot.

---

## Feature 23 in dettaglio — Bussola reale (nativa)

`CompassSensor.kt` — wrapper su `SensorManager`:
1. Ascolta `Sensor.TYPE_ROTATION_VECTOR` (sensor-fusion magnetometro+accelerometro+giroscopio: stabile, già filtrato).
2. `SensorManager.getRotationMatrixFromVector` → `getOrientation` → azimuth in radianti → gradi (0–360, nord magnetico).
3. **Declinazione**: `GeomagneticField(lat, lon, altitude, timeMillis).declination` → `headingTrue = headingMagnetic + declination`. Richiede una posizione (da `FusedLocationProvider`/last-known); senza posizione si mostra solo il nord magnetico con avviso.
4. Low-pass filter leggero + arrotondamento per evitare jitter; emette `StateFlow<CompassReading>` (`headingMagnetic`, `headingTrue`, `declination`, `accuracy`).

UI: la `CompassOverlay` ruota la rosa secondo `headingTrue` e mostra il valore numerico + la declinazione. Uso didattico: rilevare un **azimut reale** verso un punto e confrontarlo con quello calcolato dall'itinerario; capire la differenza **nord magnetico vs geografico**.

Permessi: `ACCESS_FINE_LOCATION` (per la declinazione). Fallback se il dispositivo non ha magnetometro: si ricade sulla rosa didattica disegnata (comportamento PWA) con messaggio.

---

## Auto-Fill Pipeline

Port di `auto-fill.ts` in `AutoFillPipeline.kt` (invariato rispetto alla spec originale):

```
Trigger (drag/add/reorder waypoint)
 → fetch elevation (cache) → fetch route geometry (Trail) / linea retta (Classic)
 → campiona profilo → smoothing 5 punti [1,2,3,2,1] → D+/D- cumulativo → aggiorna Leg
```

Concorrenza: `currentJob?.cancel()` + `ensureActive()` (sostituisce il generation counter PWA). Cache elevation `ConcurrentHashMap` per sessione. Batch `chunked(95)` con `delay(1000)` (rate limit OpenTopoData 1 req/s).

---

## Calcoli chiave (port da `lib/`)

**Munter con fattore personale** (`MunterTime.kt`):
```
tHoriz = (distanceKm / 4) * 60
tVert  = max((gainM / 400) * 60, (lossM / 800) * 60)
base   = max(tHoriz, tVert) + 0.5 * min(tHoriz, tVert)
estimatedTime = base * paceFactor          // paceFactor default 1.0
```

**Quiz scoring clemente** (`quiz.kt` → `QuizScoring.kt`), `ratio = delta / tolerance`:
```
ratio ≤ 1 → 100 − 50*ratio          (100→50)
ratio ≤ 2 → 50 − 40*(ratio−1)       (50→10)
ratio ≤ 4 → 10 − 5*(ratio−2)        (10→0)
ratio > 4 → 0
```
Tolleranze: quota ±100 m (fissa), distanza ±20% del reale, azimuth ±30° (delta angolare con wrap a 360°).

---

## Tile Caching e Offline

Cache tile nativa osmdroid (`SqlTileWriter`):
```kotlin
Configuration.getInstance().apply {
    osmdroidTileCache = File(context.cacheDir, "osmdroid")
    tileFileSystemCacheMaxBytes  = 100L * 1024 * 1024
    tileFileSystemCacheTrimBytes =  80L * 1024 * 1024
    expirationOverrideDuration   = 30L * 24 * 60 * 60 * 1000  // 30 giorni
}
```
Sostituisce Serwist e le cache Workbox della PWA.

**Comportamento offline** (invariato): mappa solo da cache, CRUD/export/save locali funzionano, elevation→null, geocoding disabilitato (+banner), routing→fallback Classic, quiz-altitudine skippata. `NetworkMonitor` (`ConnectivityManager`) → `StateFlow<Boolean>` osservato da `OfflineBanner` e ViewModel.

---

## Testing Strategy

**Unit JVM (~60%)** — tutto `domain/`:
```
calculation/: GeoCalculations, ValidationLogic, DifficultyRating, ProfileSampling,
              AutoFillPipeline (service mockati), MunterTime, ModeSnapshot, QuizScoring
export/:      GpxExporter, PdfExporter (mock Canvas), UrlShareCodec
```
Port dei test della PWA + nuovi test per: **ModeSnapshot** (switch non distruttivo), **MunterTime con paceFactor**, **QuizScoring** (curva clemente), costruzione profilo stimato-vs-reale.

**Integration (~25%)** — Room + Repository con `Room.inMemoryDatabaseBuilder`: Itinerary/Quiz/Learning/Settings, incluse le **migration** degli snapshot per-modalità.

**UI (~15%)** — Compose `createComposeRule()`: WaypointCard, LegCard, ActionBar, ValidationBadge, ModeSwitch, NumberInputField, QuizQuestion, **WaypointPopup**, **BottomNav**, **MapToolsFab**, **MoreMenu**.

La **matematica della bussola** (heading magnetico→geografico con declinazione, normalizzazione 0–360, low-pass) è estratta in funzioni pure → unit test JVM; la lettura dei sensori è test manuale.

**Non testato in v1**: osmdroid MapView, Vico chart, lettura sensori bussola (hardware), API reali (mockate), layout responsivo (manuale su emulatore phone+tablet).

**Tool**: JUnit 5 + MockK + Compose Testing.

---

## Build e Distribuzione

- **Gradle (Kotlin DSL)**: compileSdk 35, minSdk 26, targetSdk 35, Kotlin 2.0+, Compose BOM, variants debug/release (R8).
- **API key** in `local.properties` (gitignored) → `BuildConfig`: `ORS_API_KEY`, `THUNDERFOREST_API_KEY`.
- **Signing**: debug auto; release keystore fuori dal repo; Google Play App Signing.
- **APK stimato** ~8–12 MB post R8.
- **Versioning**: la release pubblica v1.0 è a fine M3; `versionCode` incrementale, `versionName` semver. (Eventuali build di M1/M2 sono interne/beta — strategia rimandata.)
- **Play Store listing**: "TrekTrak — Cartografia Manuale", categoria Education, IARC Everyone, asset (icona 512, feature graphic 1024x500, ≥2 screenshot), privacy policy URL, data safety.

---

## Buone pratiche Android (trasversali)

Aspetti non-funzionali che un'app Android di qualità (e pubblicabile su Play) deve curare, e che il porting deve prevedere fin dall'inizio. Indicato `[M1]` se rilevante già nel core, `[M4]` se principalmente per gli strumenti da campo.

### A. Permessi di sistema
- **Dichiarare il minimo indispensabile** nel manifest. M1: `INTERNET`, `ACCESS_NETWORK_STATE` (normali, no prompt), `ACCESS_FINE_LOCATION` (runtime, per: posizione iniziale mappa, declinazione bussola). M4 aggiungerà `ACCESS_BACKGROUND_LOCATION` (flusso separato + giustificazione Play), `POST_NOTIFICATIONS` (Android 13+, per il foreground service di registrazione traccia), `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` (Android 14+). **No** `WRITE_EXTERNAL_STORAGE`: export via SAF (`ACTION_CREATE_DOCUMENT`). `[M1]`
- **Permessi runtime fatti bene** (`ActivityResultContracts.RequestPermission`): mostrare una **rationale** prima della richiesta; **degradare con grazia** se negato (mappa su centro di default; bussola → solo nord magnetico o rosa disegnata; nessun crash); se "non chiedere più", deep-link alle Impostazioni di sistema. La posizione è **opzionale**, non bloccante. `[M1]`
- **Play Data Safety**: dichiarare l'uso della posizione (solo on-device, non condivisa); privacy policy URL. `[M1]`

### B. Batteria e risorse
- **Sensori on-demand**: registrare i listener (bussola) solo quando il tool è attivo **e** in `onResume`/`STARTED`; deregistrare in `onPause`/quando il tool si chiude. Usare `SENSOR_DELAY_UI`, mai `FASTEST`. `[M1]`
- **GPS proporzionato** (M4): `Priority.BALANCED_POWER_ACCURACY` di default, `HIGH_ACCURACY` solo in modalità navigazione attiva; fermare gli update quando non servono; registrazione traccia in **foreground service** con tipo `location` e notifica. `[M4]`
- **Rete parsimoniosa**: nessun polling; batch già previsto per l'elevation; cache HTTP OkHttp; rispetto di Doze/background limits (nessun lavoro in background non necessario). `[M1]`
- Niente **wakelock** manuali; eventuale "schermo sempre acceso" solo opzionale in navigazione (M4). Download tile osmdroid limitati dalla cache.

### C. Ciclo di vita, configurazione e process-death
- **MapView osmdroid** dentro `AndroidView`: agganciare `onResume`/`onPause`/`onDetach` via `DisposableEffect` per evitare **memory leak** e thread dei tile orfani. `[M1]`
- **Sopravvivere a rotazione e process-death**: ViewModel per i dati di sessione; **`SavedStateHandle`** per lo stato UI transitorio (id itinerario corrente, `mobileTab`, tool attivo) così l'app si ripristina se il sistema la uccide in background. La persistenza dei dati è comunque su Room. `[M1]`
- **Niente Context leakati**: nei singleton/Koin usare `applicationContext`. `[M1]`

### D. Edge-to-edge e insets (targetSdk 35)
- Con **targetSdk 35 (Android 15) l'edge-to-edge è forzato**: gestire i `WindowInsets` (status bar, nav bar, IME) con `Scaffold`/`safeDrawing` così bottom-nav, FAB e sheet non finiscono sotto le barre di sistema. Colorare status/nav bar coerentemente col tema scuro. `[M1]`

### E. Accessibilità
- `contentDescription` su tutte le icone/azioni (FAB, marker, badge); **touch target ≥48dp** (Material); supporto **TalkBack** (semantics su elementi interattivi e badge di validazione); **font scaling** (usare `sp`, layout che reggono testo grande); contrasto adeguato; **non affidarsi al solo colore** per la validazione (icona + colore, come già previsto). `[M1]`

### F. Localizzazione e temi
- **Stringhe in `res/values/strings.xml`** (mai hardcoded), italiano di default, struttura pronta per i18n; formattazione numeri/date via `Locale`. Supporto RTL "gratis" usando `start`/`end`. `[M1]`
- **Material 3 + tema scuro** curato; **dynamic color** (Material You) opzionale; edge-to-edge come sopra. `[M1]`

### G. Sicurezza e privacy
- **HTTPS-only**: `networkSecurityConfig` con cleartext disabilitato. `[M1]`
- **API key** in `local.properties`→`BuildConfig` (già previsto): consapevoli che sono estraibili dall'APK; per le free-tier (ORS/Thunderforest) il rischio è basso. Nessun segreto sensibile lato client. `[M1]`
- **Dati solo locali** (Room): nessun PII trasmesso in M1/M2. In M3 il token di sessione Supabase è gestito dall'SDK (storage cifrato/privato dell'app). `[M1]`

### H. Backup e integrità dati
- **Regole di backup** (`dataExtractionRules`/`fullBackupContent`, Android 12+): decidere esplicitamente se includere il DB Room nell'**auto-backup** di Google (comodo per ripristino su nuovo device) — per M1/M2 dati locali: includere; valutare l'esclusione in M3 (sessione auth). `[M1]`
- **Room**: esportare lo schema (`room.schemaLocation`) e **testare le migration** con i file di schema; nessuna `fallbackToDestructiveMigration` in release. `[M1]`

### I. Build, R8 e rilascio
- **App Bundle (AAB)**, non APK, per il Play Store. `[M1]`
- **R8/ProGuard**: aggiungere le **keep rules** necessarie per **Kotlin Serialization** (`@Serializable`), **Retrofit/OkHttp**, **Room** ed eventuale reflection — altrimenti la release minificata rompe (de)serializzazione e DAO. `[M1]`
- **Baseline Profile** per migliorare il tempo di avvio (opzionale ma consigliato). `[M1]`
- Allineamento **16 KB page size** (dispositivi Android 15+): verificare le librerie native (osmdroid e co.). `[M1]`

### J. Qualità, threading e diagnostica
- **Static analysis** in CI: `ktlint`/`detekt` + Android Lint + Compose lint. **CI GitHub Actions**: build + unit test + lint ad ogni push. `[M1]`
- **StrictMode** in debug per scovare I/O o lavoro sul main thread. **Strutturare le coroutine**: `viewModelScope`, `Dispatchers.IO` per rete/DB, cancellazione (già nell'auto-fill); mai bloccare il main thread. `[M1]`
- **Compose performance**: chiavi stabili nelle `LazyColumn`, `remember` per calcoli costosi, parametri stabili per limitare le ricomposizioni; calcoli pesanti (profilo, 50 waypoint) fuori dal main thread. `[M1]`
- **Logging** via Timber, **rimosso in release**; **crash reporting** opzionale e rispettoso della privacy (es. Crashlytics opt-in) — valutare, non obbligatorio data l'assenza di backend in M1. `[M1]`
- **UiState** come sealed/`data class` (Loading/Success/Error/Empty) per una gestione errori uniforme. `[M1]`

---

## Costi

| Voce | Costo |
|------|-------|
| Android Studio / SDK | Gratuito |
| Account Google Play | $25 una tantum |
| OpenTopoData / Nominatim / Overpass | Gratuito |
| OpenRouteService | Gratuito (free tier) |
| Backend | $0 in M1/M2; M3 usa il progetto Supabase **esistente** (stesso della PWA) |

---

## Roadmap M2 / M3 (anticipazione dei modelli dati)

### M2 — Libreria percorsi locale (spec separata)

Estensioni al dominio `Itinerary` (da v0.8.0):

```kotlin
data class Itinerary(
    // ...campi base...
    val notes: String? = null,
    val completions: List<RouteCompletion> = emptyList(),
    val metrics: RouteMetrics? = null,
    val sortIndex: Int? = null,
    val createdByUsername: String? = null   // valorizzato in M3
)

data class RouteCompletion(
    val id: String,
    val personName: String,
    val date: String,                 // "YYYY-MM-DD"
    val durationMinutes: Int? = null,
    val difficulty: Int? = null,      // 1..5
    val weather: String? = null,
    val notes: String = "",
    val createdBy: String? = null     // member id (M3)
)

data class RouteMetrics(
    val distanceKm: Double, val elevationGain: Double, val elevationLoss: Double,
    val minAltitude: Double?, val maxAltitude: Double?,
    val avgSlope: Double, val maxSlope: Double, val estimatedTimeMin: Double
)
```

UI M2: tab **Libreria** nella bottom nav, lista ordinabile (`sortMode`: manual/name/distance/gain/updated/completions), vista **lista↔dettaglio** su mobile, anteprima read-only su mappa (overlay percorso selezionato), scheda metriche, note, diario completamenti con form. Room: tabelle `completions` (FK route) + colonne `notes/metrics/sortIndex` su itinerario.

### M3 — Libreria condivisa cloud (spec separata)

Aggiunge un `RemoteDataSource` Supabase dietro il Repository (predisposto in M1):
- Auth **magic-link a invito** (passwordless), sessione per-dispositivo persistita.
- Tabelle `members`, `invites`, `routes` (JSONB `data` + `sort_index`), `completions`; **RLS** + `is_member()`.
- Sync `fetchRoutes`/`saveRouteToCloud`/CRUD completions; risoluzione `createdByUsername` dai membri.
- **Stesso progetto Supabase della PWA** (locale+prod condivisi).

### M4 — Strumenti da campo nativi (post-v1.0, spec separata)

Sfrutta hardware non accessibile/affidabile nel browser. Filosofia: **verificare il lavoro manuale contro la realtà**, mai auto-compilare.

- **GPS live + registrazione traccia**: `FusedLocationProviderClient`, marker "tu sei qui", modalità *follow*, registrazione della traccia camminata (foreground service) → confronto **percorso reale vs pianificato** (estensione sul campo della killer feature stimato-vs-reale).
- **Altimetro barometrico**: `Sensor.TYPE_PRESSURE` → quota misurata, con calibrazione; confronto con quota mappa/DEM (lezione sull'errore barometrico).
- **Mappe vettoriali offline**: mapsforge o MapLibre GL Native — nitide a ogni zoom, peso minimo, 100% offline per uso reale in montagna (oltre alla cache raster osmdroid di M1).

(La **bussola reale** non è qui: è già in M1, Feature 23.)

---

## Predisposizione per il futuro (oltre M3)

Il Repository pattern permette di innestare ulteriori data source senza toccare ViewModel/UI. Il costo architetturale (~10h di interfacce pulite) è già messo in conto in M1.
