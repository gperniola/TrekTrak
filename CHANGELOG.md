# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il progetto adotta [Semantic Versioning](https://semver.org/lang/it/).

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

[0.6.1]: https://github.com/gperniola/TrekTrak/releases/tag/v0.6.1
[0.6.0]: https://github.com/gperniola/TrekTrak/compare/49fe267...8796c62
[0.4.0]: https://github.com/gperniola/TrekTrak/compare/166329c...49fe267
[0.3.0]: https://github.com/gperniola/TrekTrak/compare/855dea1...166329c
[0.2.0]: https://github.com/gperniola/TrekTrak/compare/v0.1.0...855dea1
[0.1.0]: https://github.com/gperniola/TrekTrak/commits/develop
