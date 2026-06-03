# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il progetto adotta [Semantic Versioning](https://semver.org/lang/it/).

## [0.8.0] — 2026-06-03 — "Libreria percorsi"

Nuova area dedicata ai percorsi salvati con diario delle uscite. Estende il modello `Itinerary` e sostituisce la vecchia modale salva/carica. Sviluppata in 12 task TDD subagent-driven con review spec + qualità per ciascuno. 473 test, First Load 253 kB. Spec e piano in `backlog/docs/route-library-{design,plan}.md`.

### Added
- **Switch top-level Editor ↔ Libreria** nel pannello sinistro (`uiStore.mainView`, `MainViewSwitch`).
- **Lista percorsi numerata e ordinabile**: riordino manuale drag-and-drop (@dnd-kit) + sort-by (posizione/nome/distanza/dislivello/aggiornamento/completamenti).
- **Anteprima read-only** del percorso selezionato sulla mappa grande (`PreviewRouteLayer`, polilinea + marker numerati + fitBounds), con placeholder nel profilo altimetrico.
- **Scheda metriche** congelate al salvataggio (`computeRouteMetrics`): distanza, D+/D-, altitudine min/max, pendenza media (pesata sulla distanza) e max, stima Munter.
- **Note del percorso** editabili (salvataggio on-blur).
- **Diario completamenti**: per ogni percorso N entry { chi, data, tempo impiegato, note }, con autocomplete dei nomi già usati e confronto **tempo reale vs stima Munter**.
- **Banner anteprima** su mobile quando si sfoglia la libreria.

### Changed
- **Salvataggio arricchito**: al primo salvataggio `SaveRouteModal` (titolo + note); il re-salvataggio aggiorna lo snapshot metriche preservando note, completamenti e ordine.
- Il pulsante "Carica" apre ora la tab Libreria invece della modale.
- `Itinerary` esteso con campi opzionali `notes`, `completions`, `metrics`, `sortIndex`; migration localStorage **v2 → v3** (idempotente, retrocompatibile).

### Removed
- `SavedItinerariesModal` (sostituita dalla tab Libreria).

## [0.7.1] — 2026-05-15 — Hotfix

### Fixed
- **CRITICAL**: crash al secondo waypoint causato da Rules of Hooks violation in `ElevationProfile`. Il `useMemo` di `mergedData` (TASK-29) era dopo l'early-return placeholder "<2 waypoint": al passaggio da 1 a 2 waypoint l'ordine degli hooks cambiava (38→39) e React buttava giù il componente con `NotFoundErrorBoundary`. Hooks ora tutti prima dei return condizionali, come da Rules of Hooks.

## [0.7.0] — 2026-05-15 — "Didattica visiva + UX rifondata"

Bundle di 20+ task completati, basati sul backlog generato dalla campagna polish v0.6.2 e dai persona usability test.

### Killer feature
- **TASK-29 ⭐** Profilo altimetrico "stimato vs reale" sovrapposto in Learn quando esistono dati Track. Trasforma la verifica da numeri a confronto visivo.

### Architettura
- **TASK-15** Switch Learn↔Track **non-distruttivo**: valori per modalità in slot paralleli (`trackValues`/`learnValues`, `trackAltitude`/`learnAltitude`), ripristinati al cambio. Niente più "cancellerà i dati".
- **TASK-3** Migration scaffold `SCHEMA_VERSION` (v1→v2) con snapshot legacy data in `trackValues`.

### UX
- **TASK-5** Modal + Toast in-app: 12 `alert()` e 3 `confirm()` migrati a UI coerente.
- **TASK-13** Curva scoring quiz più clemente (piecewise lineare, credito anche a stime fuori tolerance).
- **TASK-16** Profile choice all'onboarding + tutorial reapribile da Impostazioni.
- **TASK-17** Popup quick-action sui marker: rinomina, elimina, copia coordinate.
- **TASK-20** UI cues: Progresso disabled senza dati; tooltip scala SAC T1-T6; positive reinforcement.
- **TASK-21** Fattore Munter personalizzato (slider 0.7-1.5x).
- **TASK-25** Mini-guida al primo quiz di ogni tipo.
- **TASK-6** Toast su fallback ORS.
- **TASK-7** Tooltip su Copia link disabilitato.

### Performance e qualità
- **TASK-4** ProgressOverlay lazy-loaded via `next/dynamic`.
- **TASK-12** Debounce per-marker (500ms) sull'autoFill al drag.
- **TASK-11** Risolto warning Recharts `width(-1)`.
- **TASK-8** Y-axis padding adattivo nel profilo altimetrico.

### Accessibility
- **TASK-10** Tab Learn/Track aria-selected anche con tool attivi.
- **TASK-14** Tutorial aria-label corretto.

### Networking
- **TASK-9** Ricerca località con map-bias (viewbox).

### DX
- **TASK-18** README aggiornato, `.env.example` documentato, `jest.config.js` modernizzato.

### Skipped/Deferred
- TASK-2 (assets), TASK-19 (undo), TASK-22 (cloud), TASK-23 (E2E), TASK-24 (PDF print), TASK-26 (coord paste), TASK-27 (slice refactor), TASK-28 (exporter), TASK-30 (sfida cieca), TASK-31 (categorie), TASK-32 (trend già presente), TASK-33 (import GPX), TASK-34 (triangulation), TASK-35 (light mode), TASK-36 (i18n), TASK-37 (pre-cache), TASK-38 (side panel).

## [0.6.2] — 2026-05-15 — "Polish"

Campagna di code review approfondita: 32 fix in 7 round su type safety, React patterns, networking, storage, accessibility, performance, usability.

### Fixed
- **Caricamento itinerario**: `routeGeometry` ed `elevationProfile` ora si rigenerano automaticamente quando un itinerario viene caricato (da storage o share URL). Prima la mappa mostrava linee rette e il grafico era vuoto fino al primo edit.
- **RulerTool**: race condition risolta — click rapidi prima che `fetchElevation` risponda non sovrascrivono più punti con altitudini stale (generation refs per slot).
- **QuizOverlay**: session generation guard scarta i risultati di sessioni precedenti se chiudi/riapri durante il caricamento.
- **MyLocationButton / CompassTool**: timeout di errore tracciati e puliti su unmount.
- **Validazione storage**: `loadItineraries` e `loadQuizHistory` validano profondamente le voci, scartando dati corrotti senza crashare l'UI.
- **`SavedItinerariesModal`**: itinerari senza `updatedAt` non mostrano più "Invalid Date".
- **Share URL**: validazione lat/lon nei range geografici (`[-90,90]` / `[-180,180]`) e coerenza `legs == waypoints-1` per scartare URL malformati.
- **MapDisplay settings**: fallback automatico se la mappa base salvata non è più disponibile (es. API key Thunderforest rimossa).
- **Nominatim**: chiamate reverse geocoding serializzate per rispettare il rate limit di 1 req/s.
- **Cache elevation**: chiave normalizzata a 6 decimali per evitare miss da precisione float.
- **Overpass cache**: LRU eviction (cap 20 entry).
- **AbortSignal.any**: polyfill-free fallback per Safari < 17 / Chrome < 116.

### Accessibility
- Wrapper `<main>` landmark per la navigazione screen reader.
- Contrasti testo migliorati a WCAG AA (`gray-500` → `gray-400` su sfondi scuri; `gray-400` → `gray-300` su grigi medi).
- `role="tablist"` non contiene più bottoni non-tab (tool e tabs separati).
- Form input con attributo `name` e `autoComplete`.
- `aria-live="polite"` per notifiche transienti (era `assertive`).
- Lighthouse a11y: 87 → 97.

### Performance
- `jspdf` (~100kB) caricato dinamicamente solo al primo click export — First Load JS ridotto da 381 kB a 252 kB (−130 kB).
- `ElevationProfile`: memoization di `profileData` e `waypointDots` con `useMemo`.
- `InteractiveMap`: memoization di `validWaypoints`.
- `LegPolylineHoverEvents`: callback stabilizzato per evitare rebind di eventHandlers su ogni Polyline.

### Changed
- PWA manifest arricchito (`display_override`, `lang`, `dir`, `categories`).
- Standard `<meta name="mobile-web-app-capable">` aggiunto al fianco di quello Apple.
- Tipografia tutorial: corretti accenti italiani (`modalità`, `funzionalità`).

## [0.6.1] — 2026-05-01

### Fixed
- Default app: parte in modalità "track" con calcolo automatico del sentiero (trail routing) e linea colorata per pendenza già attivi. L'overlay sentieri rimane attivo come prima.
- Quiz: nuova action `deactivateQuiz` e uso di `deactivate*` al posto di `toggle*` per una chiusura sicura senza riattivazioni accidentali.
- `InteractiveMap`: rimossa subscription a `quizActive` non più utilizzata.

## [0.6.0] — 2026-04-12 — "Qualità e Refactoring"

### Changed
- Migrazione PWA da `next-pwa` a `@serwist/next`.
- `InteractiveMap` suddiviso in sotto-componenti separati per ridurre la complessità.
- Stato dei tool migrato da prop drilling a uno store Zustand dedicato (`uiStore`).
- Estrazione di `lib/auto-fill.ts` e `lib/map-icons.ts` come moduli indipendenti.

### Added
- Smoke test su componenti React (mock setup + suite di test).

## [0.4.0] — 2026-04-11 — "Didattica Evoluta"

### Added
- **Suggerimenti didattici**: i badge di verifica colorati (✓ ~ ✗) sono ora cliccabili e mostrano consigli personalizzati proporzionati all'entità dell'errore.
- **Report Progresso**: nuovo pannello (📊) con grafici di andamento, statistiche per categoria e confronto fra verifiche e quiz.
- **Feedback Verifica**: riepilogo immediato dopo ogni verifica (campi corretti, approssimati, errati) con animazione del badge.
- Persistenza storico sessioni di validazione su `localStorage`.

## [0.3.0] — 2026-03-26

### Added
- **4 mappe + sentieri**: Thunderforest Outdoors, OpenTopoMap, CyclOSM e OpenStreetMap; overlay Waymarked Trails per sentieri CAI/GR.
- **Quiz cartografico**: 5 domande su altitudine, distanza e azimuth con punteggio 0–100 e storico sessioni; quiz su POI reali via Overpass.
- **Righello e griglia coordinate**: misurazione fra due punti (distanza, azimuth, dislivello) e overlay griglia.
- **Profilo altimetrico interattivo**: hover bidirezionale grafico ↔ mappa, click per centrare la mappa.
- **Condividi e meteo**: copia link con itinerario compresso (lz-string), apertura previsioni Meteoblue, posizione GPS sulla mappa.
- **Offline / PWA**: app installabile con caching automatico dei tile delle zone visitate.
- Auto-naming waypoint via Nominatim.

## [0.2.0] — 2026-03-20

### Added
- **Percorso su sentiero** (trail routing): calcolo distanza e dislivelli lungo i sentieri reali via OpenRouteService al posto della linea d'aria.
- **Percorso colorato**: polyline sulla mappa con gradiente colore per pendenza (verde / giallo / arancione / rosso).
- **What's New**: popup di walkthrough visivo per ogni nuova release.

## [0.1.0] — 2026-03-20

### Added
- Prima release MVP: creazione itinerari con waypoint e tratte, validazione manuale di altitudine / distanza / azimuth / dislivelli, profilo altimetrico colorato, layout mobile con drawer a tutto schermo, tutorial interattivo, validazione cumulativa, import/export JSON, export GPX 1.1, export PDF (sintetico + roadbook).

[0.7.1]: https://github.com/gperniola/TrekTrak/releases/tag/v0.7.1
[0.7.0]: https://github.com/gperniola/TrekTrak/releases/tag/v0.7.0
[0.6.2]: https://github.com/gperniola/TrekTrak/releases/tag/v0.6.2
[0.6.1]: https://github.com/gperniola/TrekTrak/releases/tag/v0.6.1
[0.6.0]: https://github.com/gperniola/TrekTrak/compare/49fe267...8796c62
[0.4.0]: https://github.com/gperniola/TrekTrak/compare/166329c...49fe267
[0.3.0]: https://github.com/gperniola/TrekTrak/compare/855dea1...166329c
[0.2.0]: https://github.com/gperniola/TrekTrak/compare/v0.1.0...855dea1
[0.1.0]: https://github.com/gperniola/TrekTrak/commits/develop
