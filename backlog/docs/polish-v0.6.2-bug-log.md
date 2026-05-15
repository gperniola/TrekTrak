# Polish v0.6.2 — Bug Log

Tracking di tutti i bug trovati durante la campagna di polishing su `polish/v0.6.2`.

Status:
- 🔴 **HIGH** — bug funzionale che impatta UX o correttezza dei dati
- 🟡 **MEDIUM** — bug funzionale di minore impatto o robustezza
- 🟢 **LOW** — cleanup, drift risk, miglioramenti minori

| ID | Round | Severity | File | Description | Status |
|---|---|---|---|---|---|
| R1-01 | 1 | 🔴 HIGH | `TrackModeAutoFill.tsx`, `itineraryStore.ts` | Loading an itinerary (from URL hash or saved) doesn't regenerate `routeGeometry`/`elevationProfile` — map shows straight lines, elevation chart is empty until user edits a waypoint | fixed |
| R1-02 | 1 | 🔴 HIGH | `SavedItinerariesModal.tsx` | Saved itineraries without `updatedAt` (from older versions/imports) show "Invalid Date" | fixed |
| R1-03 | 1 | 🟡 MEDIUM | `lib/types.ts` | `ValidationSessionResult.field` duplicates `ValidationFieldType` — drift risk | fixed |
| R1-04 | 1 | 🟡 MEDIUM | `lib/storage.ts` | `loadItineraries` shallow validation: array-of-anything passes if shape vaguely matches. Corrupted waypoints/legs can crash UI | fixed |
| R1-05 | 1 | 🟡 MEDIUM | `stores/itineraryStore.ts` | `setProfileHover` accepts NaN/Infinity for `distance` without validation | fixed |
| R1-06 | 1 | 🟡 MEDIUM | `lib/storage.ts` | `loadSettings` accepts a saved `baseMap` that is no longer `available` (e.g., Thunderforest API key removed) — silent fallback to broken map | fixed |
| R1-07 | 1 | 🟡 MEDIUM | `lib/share-url.ts` | `decodeItinerary` doesn't validate lat ∈ [-90,90] / lon ∈ [-180,180] — geographically invalid coords pass | fixed |
| R2-01 | 2 | 🔴 HIGH | `ElevationProfile.tsx` | `profileData`/`waypointDots` recomputed on every render via expensive loops; no `useMemo` → unnecessary rerenders on any unrelated state change | fixed |
| R2-02 | 2 | 🟡 MEDIUM | `InteractiveMap.tsx` | `validWaypoints` filter on every render; combined with Marker map, triggers Leaflet rerender unnecessarily | fixed |
| R2-03 | 2 | 🟡 MEDIUM | `MyLocationButton.tsx` | `setTimeout` for clearing error message not stored/cleared — rapid clicks can stack pending timeouts that fire over later state | fixed |
| R2-04 | 2 | 🟡 MEDIUM | `LegPolylines.tsx` | `LegPolylineHoverEvents.handleMouseMove` depends on `[waypoints, legs]` — any store change re-creates callback and re-binds eventHandlers on every Polyline | fixed |
| R2-05 | 2 | 🔴 HIGH | `RulerTool.tsx` | Race condition: rapid clicks before previous `fetchElevation` resolves cause stale altitudes to overwrite new points | fixed |
| R2-06 | 2 | 🟡 MEDIUM | `CompassTool.tsx` | `setTimeout` for `deactivateRef.current()` on error not cleared on unmount | fixed |
| R2-07 | 2 | 🟢 LOW | `CompassTool.tsx` | Dead import: `useCallback` imported but unused | fixed |
| R2-08 | 2 | 🟡 MEDIUM | `QuizOverlay.tsx` | `fetchHikingPOIs` and per-question `buildQuestion` chain has no cancellation token — closing overlay during loading wastes network/time | fixed |
| R3-01 | 3 | 🔴 HIGH | `MapEvents.tsx`, `reverse-geocoding-api.ts` | Every map click triggers `reverseGeocode` to Nominatim; no rate limit queue. Rapid waypoint adding can hit Nominatim's 1 req/s policy and get the user banned | fixed |
| R3-02 | 3 | 🟡 MEDIUM | `lib/auto-fill.ts` | Elevation cache key `${lat},${lon}` uses raw JS number `toString` — repeat fetches for the same point can miss the cache due to float precision (e.g., 45.10000001) | fixed |
| R3-03 | 3 | 🟡 MEDIUM | `lib/geocoding-api.ts` | Uses `AbortSignal.any` which is unavailable on Safari < 17 / Chrome < 116 — feature crashes on older browsers | fixed |
| R3-04 | 3 | 🟡 MEDIUM | `lib/overpass-api.ts` | Cache prune only removes expired entries; if 21+ unique unexpired bounds are queried, cache grows unbounded | fixed |
| R3-05 | 3 | 🟢 LOW | `lib/routing-api.ts` | ORS API key exposed client-side via `NEXT_PUBLIC_*`. Standard ORS pattern but should be documented in README / `.env.example` | deferred |
| R4-01 | 4 | 🔴 HIGH | `lib/quiz.ts` | `loadQuizHistory` returns parsed array without validation — corrupted/older-format localStorage entries can crash UI consumers (asymmetry with `loadValidationHistory`) | fixed |
| R4-02 | 4 | 🟡 MEDIUM | `lib/share-url.ts` | Decoder doesn't enforce `legs.length === waypoints.length - 1` — stale/malformed URLs can load partial data silently | fixed |
| R4-03 | 4 | 🟡 MEDIUM | `public/manifest.json` | PWA icons only at 192/512px — missing 144/256/384 sizes affects splash screen quality on some devices | deferred (asset gen) |
| R4-04 | 4 | 🟢 LOW | `public/manifest.json` | Missing `display_override`, `lang`, `dir`, `categories` — minor PWA polish | fixed |
| R4-05 | 4 | 🟢 LOW | `lib/storage.ts` | `SCHEMA_VERSION` exists but no migration logic. Acceptable for personal-use app, document as future tech debt | deferred |
| R5-01 | 5 | 🟡 MEDIUM | `ItineraryHeader.tsx`, `LocationSearch.tsx` | Form inputs without `name` attribute — Chrome DevTools issue, affects autofill and form serialization. Has `aria-label` but no `name` | fixed |
| R5-02 | 5 | 🟢 LOW | `LearnTutorial.tsx` | Italian typos: `modalita'` / `funzionalita'` instead of `modalità` / `funzionalità` (apostrophe instead of grave accent) | fixed |
| R5-03 | 5 | 🟢 LOW | `MyLocationButton.tsx` | Transient error notification uses `aria-live="assertive"` — screen readers interrupt; `polite` is more appropriate | fixed |
| R5-04 | 5 | 🟢 LOW | `InteractiveMap.tsx` toolbar | Inconsistent button aria-label wording: "Attiva bussola"/"Attiva righello" vs "Avvia quiz". Unify on "Attiva X" | fixed |
| R5-05 | 5 | 🟡 MEDIUM | multiple | Color contrast fails WCAG AA: `text-gray-500` on `bg-gray-900` (3.66:1, needs 4.5:1) — affects WAYPOINT header, empty-state placeholder, "Difficoltà" label; `text-gray-400` on `bg-gray-700` (4.05:1) on inactive tab | fixed |
| R5-06 | 5 | 🟡 MEDIUM | `app/page.tsx` | Document has no `<main>` landmark — screen reader users can't jump to main content with landmark navigation | fixed |
| R5-07 | 5 | 🟡 MEDIUM | `panel/ModeSwitch.tsx` | The `role="tablist"` container holds non-tab buttons (compass/ruler/quiz) — violates ARIA pattern, axe rule `aria-required-children` | fixed |
| R5-08 | 5 | 🟢 LOW | leaflet markers | Marker icons exposed with `role="button"` but no aria-label by Leaflet. Hard to fix without library work — document only | deferred |
| R6-01 | 6 | 🟡 MEDIUM | `lib/export-pdf.ts`, `panel/ActionBar.tsx` | `jspdf` bundled with main entry (~100kB minified). PDF export is a rare action; should be dynamic-imported only when user clicks export | fixed (-130kB First Load) |
| R6-02 | 6 | 🟢 LOW | `components/panel/ProgressOverlay.tsx` | Statically imports Recharts even though overlay is gated by `progressOpen`. Could lazy-load via `dynamic` to shave first-paint cost | deferred |
| R7-01 | 7 | 🟢 LOW | `app/layout.tsx` | Missing standard `<meta name="mobile-web-app-capable">` companion to Apple-only equivalent — Chrome warns on console | fixed |
| R7-02 | 7 | 🟢 LOW | `map/MapWrapper.tsx` | "Caricamento mappa..." placeholder uses `text-gray-500` on `bg-gray-800` (~4.27:1, below WCAG AA); also missing `role="status"` for SR announcement | fixed |
| R7-03 | 7 | 🟡 MEDIUM | `panel/SavedItinerariesModal.tsx`, `panel/ActionBar.tsx`, `panel/WaypointList.tsx` | Use native `alert()` and `confirm()` — poor mobile UX, no localization control, blocks main thread. Should use styled in-app modal/banner | deferred (UX redesign) |
| R7-04 | 7 | 🟡 MEDIUM | `auto-fill.ts` (silent ORS fallback) | When trail routing fails for a leg, fallback is silent (only `console.warn`). User has no UI cue that the path is straight-line instead of real trail | deferred (UX improvement) |
| R7-05 | 7 | 🟢 LOW | `panel/ActionBar.tsx` "Copia link" | Button disabled state has no tooltip explaining *why* (e.g., "Servono almeno 2 waypoint con coordinate") | deferred (UX improvement) |
| R8-01 | 8 | 🔴 HIGH | reverse-geocoding consumers (MapEvents, drag handlers) | Multiple waypoints with same auto-name when reverse-geocode returns same POI for nearby coords (live test: 3× "Monteplair") | fixed |
| R8-02 | 8 | 🟡 MEDIUM | `ElevationProfile.tsx:127-131` Y-axis | For small altitude ranges (e.g., 27m delta) padding is excessive (~50%+), chart appears flat | open |
| R8-03 | 8 | 🟡 MEDIUM | `lib/geocoding-api.ts`, `LocationSearch.tsx` | Ambiguous queries return only 1 result without map-bias (e.g., "Corno Grande" → Bolzano, missing Abruzzo). Limit=5 but Nominatim doesn't auto-disambiguate | open |
| R8-04 | 8 | 🔴 HIGH a11y | `components/shared/NumberInput.tsx` | All spinbuttons report `aria-valuemin="0" aria-valuemax="0"` (wrong); Lat/Lon report `aria-invalid="true"` on valid coords. Screen readers receive wrong info | fixed (step="any" default) |
| R8-05 | 8 | 🟡 MEDIUM | `panel/ModeSwitch.tsx` | When compass/ruler/quiz active, BOTH Learn and Track tabs have `aria-selected=false` and visually unselected — ambiguous current mode | open |
| R8-06 | 8 | 🟡 MEDIUM | `ElevationProfile.tsx` | Recharts logs `width(-1) height(-1)` warning at first render before container layout settles | open |
| R8-07 | 8 | 🟢 LOW | `panel/ActionBar.tsx` "Copia link" feedback | Visible feedback after copy (label change "✓ Copiato") not prominent enough; consider toast | deferred (waits TASK-5) |
| R8-08 | 8 | 🟡 MEDIUM | drag handlers + reverse-geocoding | Each drag-end fires reverseGeocode (serialized). Names refresh with delay, feels laggy. Debounce drag-end | open |
| R8-09 | 8 | 🟡 MEDIUM | `lib/quiz.ts` `calculateQuizScore` | Linear scoring drops to 0 quickly: 42%-off answer gets 0/100, discouraging beginners. Use sub-linear curve (e.g., `1 - sqrt(delta/tolerance)`) | open |
| R8-10 | 8 | 🟢 LOW | `components/tutorial/LearnTutorial.tsx` | Dialog has `aria-label="Tutorial modalità Learn"` but covers Learn AND Track; misleading label | open |
