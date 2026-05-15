# TrekTrak — Persona-Based Usability Tests

Sessione di valutazione condotta su `develop @ v0.6.2` da 4 personalità diverse, ognuna con i propri criteri di giudizio. Obiettivo: scovare problemi e proporre miglioramenti che emergono solo quando si guarda l'app con occhi diversi.

Metodo: per ogni persona, lista di task realistici → tentativo di esecuzione → friction trovati → proposte di miglioramento. Severity 🔴/🟡/🟢 come bug log.

---

## A. La Programmatrice Senior — *"Sara, full-stack 10y, mi interessa il codice"*

**Profilo.** Studia il repo per capirne la qualità prima di valutarne l'adozione/contributo. Apre DevTools, legge tipi, controlla le decisioni architetturali.

### Task & osservazioni

#### A.1 Leggere README + CHANGELOG per capire cosa fa l'app
- 🟡 **Manca un README significativo**. Il repo ha CHANGELOG.md ma il README.md non esiste o è minimo (`Grep` di `README` solo nel piano docs). Per chi atterra dal link GitHub, niente intro/install/run.
  - **Proposta:** README con badge stato, screenshot, quick start (`npm i && npm run dev`), `.env.example` esplicato, link a CHANGELOG.

#### A.2 Esplorare la struttura del progetto
- 🟢 **Struttura chiara**: `src/lib/` (logica), `src/stores/` (Zustand), `src/components/{map,panel,quiz,...}/`. Buona separazione.
- 🟡 **`docs/superpowers/` mescolato a `backlog/`** (post-polish). Storico in superpowers, ongoing in backlog. Non ovvio dall'esterno.
  - **Proposta:** README in `docs/` che spiega la distinzione + un `backlog/README.md` con stato del progetto.

#### A.3 Controllare types e state management
- 🟢 `src/lib/types.ts` ben strutturato, post-R1-03 niente duplicazione.
- 🟢 Zustand store ben isolato in `src/stores/`. `itineraryStore` e `uiStore` separation chiara.
- 🟡 **`itineraryStore` ha 290 LOC** con molte action. Border-line "fat store". Potrebbe essere splittato in slice (waypoints, legs, settings, profileHover).
  - **Proposta:** considerare la pattern slice di Zustand quando si superano le 300 LOC.

#### A.4 Cercare error handling / robustezza
- 🟢 Dopo polish v0.6.2: validation profonda in `loadItineraries`/`loadQuizHistory`, range check lat/lon in `decodeItinerary`, generation refs per race condition.
- 🟡 **Errori di rete a livello UI quasi sempre silent**: ORS fallback non notificato (TASK-6), Nominatim error → `null` ritorna senza UX cue.
  - **Proposta:** Toast component (già TASK-5) per tutti gli errori non-bloccanti.

#### A.5 Tentare un'estensione: aggiungere export KML
- 🟢 `lib/export-gpx.ts` e `lib/export-json.ts` sono pattern facili da seguire. Aggiungere `export-kml.ts` sarebbe ~1-2 ore con i tipi esistenti.
- 🟢 Action bar accetta nuovi bottoni senza refactoring.
- 🟡 Manca un design pattern formale per "exportFormat: registry". Ogni export è hand-written.
  - **Proposta:** se gli export crescono, introdurre `interface Exporter { name: string; ext: string; mime: string; serialize(itinerary): Blob }`.

#### A.6 Build & test
- 🟢 `npm test` passa 437/437 in ~15s. Buona copertura unit.
- 🟡 **Niente E2E**. Test di integrazione fra Leaflet, store e auto-fill mancano. Refactor pesanti sono rischiosi.
  - **Proposta:** suite Playwright minimale (proposta E3) — 5 scenari coprono 80% del valore.
- 🟡 **`ts-jest` deprecation warning** nei test (`Define ts-jest config under globals is deprecated`). Cleanup di config.
  - **Proposta:** S — aggiornare `jest.config.js` al pattern moderno.

### Verdetto persona A
**6/10.** Codice solido, types puliti, ma DX fragile per chi entra da fuori: README mancante, niente E2E, log di errori solo console. Investimento di 2-3 giorni risolverebbe l'80% dei punti.

---

## B. Lo UX Expert — *"Marco, design lead 12y, mi interessa il flow"*

**Profilo.** Apre l'app con mente neutra, prova a "fare cose" senza leggere documentazione. Misura: scoperta, errori, friction, gratificazione.

### Task & osservazioni

#### B.1 First visit — tutorial
- 🟡 **Tutorial obbligatorio bloccante.** All'apertura il modal copre la mappa subito. 8 step + bottone "Salta".
  - **Proposta:** mostrare la mappa SOTTO il tutorial (il tutorial in panel laterale, non modal). L'utente vede di cosa parla mentre legge.
- 🟢 Skip prominente, gradino di accesso basso.
- 🟢 Il tutorial spiega Learn vs Track, è la differenza critica.

#### B.2 Provare ad aggiungere waypoint (mobile)
- 🟡 **Mobile: per cliccare la mappa devo prima chiudere il drawer.** Se il drawer è aperto, copre tutto. Se è chiuso, vedo la mappa ma non gli output dell'azione.
  - **Proposta:** modalità "split-screen" su mobile (mappa sopra, drawer mini in basso a 30% altezza, swipe per espandere).
- 🟢 Touch target hamburger ☰ è 44×44 ✓.
- 🟡 **Tap su marker non offre azioni rapide**: solo drag. Per rinominare/eliminare devo aprire il drawer.
  - **Proposta:** popup Leaflet su tap del marker con 3 azioni rapide (rinomina inline, elimina, copia coord). Già in feature B1.

#### B.3 Switch Learn ↔ Track
- 🔴 **Switch a Learn è distruttivo.** "Passare a Learn cancellerà tutti i dati calcolati..." → un escursionista che voleva *vedere* i dati Track e *provare* a stimarli sopra perde tutto.
  - **Proposta:** mantenere `trackValues` e `learnValues` separati nello store. Switch = cambia view, non cancella.
- 🟡 **Verbo confusing**: "Learn" e "Track" sono in inglese mentre l'app è in italiano.
  - **Proposta:** "Esercizio" e "Calcolo" o "Studio" e "Pianifica". O lasciare in inglese ma con sottotitolo italiano nel tutorial.

#### B.4 Inserire valori e verificare
- 🟢 Badge colorati ✓/~/✗ con suggerimenti didattici al click — pattern eccellente.
- 🟡 **Niente undo dopo la verifica.** Se hai cliccato Verifica per sbaglio prima di finire, devi ricominciare.
  - **Proposta:** banner "Verifica in corso... [Annulla]" durante la fase di chiamata.

#### B.5 Esportare PDF
- 🟢 PDF Sintetico + PDF Roadbook = naming chiaro.
- 🟡 **`alert()` se < 2 waypoint.** Brutale.
  - **Proposta:** bottone disabled con tooltip "Servono almeno 2 waypoint" (TASK-7).

#### B.6 Microcopy
- 🟢 Italiano corretto e didattico (post-R5-02). Tono coerente.
- 🟡 **Mix di terminologia**: "Waypoint" (eng), "Tappa" (forse in altre stringhe?), "Punto" — chiarire un vocabolario unico.
- 🟡 **"Difficoltà: T1"** — la scala SAC è nota agli esperti ma non al neofita.
  - **Proposta:** tooltip o piccolo "?" che apre la legenda SAC (T1 = facile camminata; T6 = alpinismo).

#### B.7 Disponibilità dei dati
- 🟡 **"📊 Progresso"** — il pulsante c'è sempre, anche quando non hai dati. Aprirlo a freddo è un empty state.
  - **Proposta:** disabilitato (con tooltip) finché non ci sono almeno 1 verifica o 1 quiz salvati.

#### B.8 Onboarding ricorrente
- 🟡 **Tutorial scompare dopo la prima volta**, nessun modo di rivederlo.
  - **Proposta:** in Impostazioni (o footer del drawer) un link "Rivedi tutorial" che resetta il flag. Già in feature suggestion 7.

### Verdetto persona B
**7/10.** UI funzionale, tono coerente, buone scelte di base (touch target, focus trap, badge cliccabili). Ma l'asse "Learn ↔ Track distruttivo" è un grosso ostacolo all'apprendimento iterativo. Anche il drawer modale mobile rompe il flow "vedo mappa → agisco → vedo risultato". Risolvendo questi due, schizza a 9/10.

---

## C. L'Escursionista Esperta — *"Anna, alpinista CAI, GR20 e Sentiero Italia"*

**Profilo.** Pianifica un'escursione sul Gran Sasso. Vuole rapidità, accuratezza dei dati, esportazione GPX per il suo GPS Garmin.

### Task & osservazioni

#### C.1 Trovare la zona
- 🟢 Search box top-right (Nominatim) funziona, debounce 400ms ragionevole.
- 🟡 **Search molto basic**: digitando "Corno Grande" trova il rifugio o la cima? Senza preview, devo cliccare per scoprire.
  - **Proposta:** mostrare `category` da Nominatim accanto al nome (cima/rifugio/sentiero).

#### C.2 Selezionare la mappa
- 🟢 4 mappe disponibili (Thunderforest, OpenTopoMap, CyclOSM, OSM) + overlay sentieri Waymarked. Coverage italiana eccellente.
- 🟡 **OpenTopoMap maxNativeZoom 17, gli altri 19-22.** Zoomando oltre, il browser scala l'immagine (sgranata). Non c'è UI cue del massimo zoom per mappa.
  - **Proposta:** quando zoom > maxNativeZoom mostrare un piccolo banner "Zoom oltre il dettaglio nativo".

#### C.3 Tracciare l'itinerario (5 waypoint)
- 🟢 Click per aggiungere. Trail routing ON di default (post-R1, R5-07).
- 🟡 **Validazione coordinata "manuale" è chiave per l'esperto**: io so che il rifugio è a 42.4768N, 13.5602E. Voglio incollare le coordinate. Oggi devo cliccare la mappa.
  - **Proposta:** in modalità Learn (o sempre), il `WaypointCard` editabile per lat/lon. Già fattibile probabilmente, ma non discoverable.
- 🟡 **Reverse-geocoding rallenta** rispetto al click. 1.1s per chiamata + serializzazione = se aggiungo 5 waypoint in 5 secondi, gli ultimi tardano.
  - **Proposta:** rate limit è corretto, ma mostrare "..." sul nome del waypoint mentre carica.

#### C.4 Verificare accuratezza distanze e D+
- 🟢 Trail routing via ORS — buono per sentieri Komoot-mappati.
- 🔴 **Se ORS non trova il sentiero, fallback silenzioso a linea d'aria.** Per Anna è critico: una "tappa di 4 km" potrebbe essere 6 km su sentiero reale. Non vede l'avviso.
  - **Proposta:** TASK-6 già aperto. Priorità alta per Anna.
- 🟢 D+/D- cumulativo (post-polish, già implementato in auto-fill).
- 🟡 **Niente confronto con quote ufficiali IGM** o database CAI. Non è realistic ma è quello che un esperto cerca.
  - **Proposta:** layer opzionale "punti quota Open Data" se disponibile per la zona.

#### C.5 Stimare il tempo Munter
- 🟢 Calcolo Munter implementato (`calculateMunterTime`).
- 🟡 **Niente fattore correzione personale** (peso zaino, condizione fisica, esperienza).
  - **Proposta:** in Impostazioni un "passo personale" che moltiplica il Munter (1.0 standard, 1.2 con zaino, 0.85 corridore).

#### C.6 Salvare + Esportare GPX
- 🟢 Save su localStorage + load — pattern semplice e funziona.
- 🟢 Export GPX 1.1 con track e waypoint.
- 🔴 **`SavedItinerariesModal` non sincronizza fra dispositivi**. Salvo su PC, non vedo su tablet.
  - **Proposta (medio termine):** cloud sync opzionale (Firebase / Supabase). Per ora documentare il limite.

#### C.7 Stampa PDF roadbook
- 🟢 PDF Roadbook esistente.
- 🟡 **Non testato dal punto di vista cartaceo "in zaino"**: font, formato A5 ripiegabile, plastica.
  - **Proposta:** feature B5 (stile stampa cartacea minima B/N) confermata utile.

### Verdetto persona C
**6/10.** L'app fa il 70% di quello che serve a un esperto, MA i punti rotti (silent ORS fallback, niente sync cloud, niente Munter personale, niente input coordinate diretto) sono proprio quelli che separano "giocattolo didattico" da "strumento da escursione". Investimento: 1-2 settimane per portare a 9/10 per l'esperto.

---

## D. L'Escursionista Principiante — *"Luca, prima escursione fra 3 settimane"*

**Profilo.** Ha sentito di TrekTrak da un amico. Non sa cosa siano azimuth, dislivello positivo/negativo, scale SAC. Vuole "imparare a leggere una cartina" prima dell'escursione di fine mese.

### Task & osservazioni

#### D.1 Prima apertura
- 🟢 Tutorial 8-step gli racconta tutto: waypoint, Learn vs Track, verifica, badge, quiz, salvataggio.
- 🟡 **L'inquadramento iniziale della mappa è "Chieti, Italy"** (hard-coded `DEFAULT_CENTER` in `GeolocateOnMount.tsx:7`). Se Luca ha bloccato il GPS, vede un posto random.
  - **Proposta:** mostrare un mini-prompt "Permetti la geolocalizzazione per centrare la mappa sulla tua zona".
- 🟡 **Il tutorial parla di concetti (azimuth, D+/D-, SAC T1) senza definirli.**
  - **Proposta:** glossario interno accessibile dal "?" del menu. O dare definizione breve nel tutorial: "Azimuth = direzione in gradi (Nord=0°, Est=90°)".

#### D.2 Aggiungere il primo waypoint
- 🟢 "Clicca sulla mappa per aggiungere waypoint" — chiarissimo.
- 🟡 **Default è modalità Track** = auto-pilot. Per Luca, che vuole *imparare*, è il contrario di quello che gli serve.
  - **Proposta:** all'onboarding chiedere "Vuoi imparare a calcolare manualmente o vuoi che facciamo noi?" → setta default appropriato. Vedi anche feature suggestion in ui-critical-analysis sez. 7.

#### D.3 Tenta di "studiare" il percorso
- 🔴 **Luca non capisce la differenza Learn vs Track.** Tutorial step 3 lo dice, ma quando è nel flow, vede "Learn / Track" senza ricontestualizzazione.
  - **Proposta:** invece di tab nudi, due card con icona + 1-frase descrizione: "📚 Esercizio — inserisci tu i valori e verifica" / "🤖 Calcolo — calcoliamo noi tutto".

#### D.4 Quiz cartografico
- 🟢 Quiz è IL feature per Luca. Genera 5 domande sulla zona della mappa.
- 🟢 Punteggio 0-100 con tolleranze sensate.
- 🟡 **Domanda azimuth chiede "stima l'azimuth tra punto viola e punto arancione"** senza spiegare come si fa.
  - **Proposta:** primo quiz mostra una mini-guida "Per stimare l'azimuth: orienta la mappa al Nord, conta i gradi dal Nord in senso orario...". Linkare alla [bussola] tool nell'app stessa.

#### D.5 Verifica e badge
- 🟢 Suggerimenti didattici (v0.4.0) sui badge — eccellente per Luca.
- 🟡 **Errori grandi non sono incoraggianti**: ✗ rosso senza positive reinforcement.
  - **Proposta:** se hai migliorato rispetto alla sessione precedente (anche se ancora errato), aggiungi badge "+5 vs ieri 📈". Engagement.

#### D.6 Salvare e tornare dopo qualche giorno
- 🟢 Save funziona, dopo R1-02 niente "Invalid Date".
- 🔴 **Niente cloud — se cambio device perdo i progressi.** Per Luca che usa PC a casa e telefono in escursione, è frustrante.
  - **Proposta:** export/import JSON è la via attuale, ma serve documentazione + UI dedicata "Sincronizza" che fa export+condivisione email/cloud.

#### D.7 Sbaglia e si arrabbia
- 🟡 **Se Luca cancella per sbaglio un waypoint, niente undo.**
  - **Proposta:** feature B2 (undo/redo) — alta priorità per principianti.
- 🟡 **`confirm("Eliminare questo itinerario?")` è freddo.**
  - **Proposta:** modal in-app con preview ("Stai per eliminare 'Gita al Gran Sasso' con 8 waypoint. Confermi?") + bottone Annulla.

### Verdetto persona D
**6.5/10.** Il valore didattico è alto (badge + suggerimenti + quiz) ma l'onboarding è troppo astratto e il default Track tradisce la mission. Cambiando il default a Learn (o chiedendo all'apertura) e aggiungendo glossario + positive reinforcement, l'app diventa quello che il suo nome promette: **TrekTrak**, traccia + apprendimento.

---

## Sintesi cross-persona

### Pattern di problemi ricorrenti

| Problema | Personas impattate | Severity media | Task collegata |
|---|---|---|---|
| Switch Learn ↔ Track distruttivo | B, D | 🔴 | nuova (TASK-8?) |
| Fallback ORS silenzioso | A, C | 🔴 | TASK-6 |
| Niente undo/redo | B, D | 🟡 | feature B2 |
| Tap marker senza azioni rapide | B, C | 🟡 | feature B1 |
| `confirm()`/`alert()` nativi | B, D | 🟡 | TASK-5 |
| Niente cloud sync | C, D | 🟡 | (nuova) |
| Manca glossario/contesto SAC/azimuth | D | 🟡 | (nuova) |
| Default Track contro mission | D | 🟡 | nuova (UI-01) |
| Niente README | A | 🟡 | (nuova) |

### Top 5 azioni di valore (ordinate per impatto cross-persona)

1. **Risolvere lo switch Learn ↔ Track non-distruttivo** (A, B, D × 🔴) — store con `learnValues` + `trackValues` paralleli, switch = cambia view.
2. **UI feedback su fallback ORS** (A, C × 🔴) — già TASK-6.
3. **In-app modal + toast** (B, D × 🟡) — già TASK-5; sblocca anche miglioramenti di confirm/alert ovunque.
4. **Tutorial e onboarding: glossario + scelta del profilo** (D × 🟡) — nuovo lavoro.
5. **Quick-action marker popup** (B, C × 🟡) — feature B1.

Queste 5 azioni coprono i problemi 🔴 e i 🟡 di tutte le personas. Bundle ideale per **v0.7.0 "Didattica visiva + UX rifondata"**.

---

## Appendice: Round 2 — Test live (2026-05-15 dopo session-restart)

Esecuzione effettiva via Chrome DevTools MCP sul dev server, dopo `localStorage.clear()` per simulare first-visit.

### Scenari coperti

| Persona | Scenario eseguito |
|---|---|
| **D** | Tutorial → click mappa → 2 waypoint con reverse-geocode auto → quiz distanza (errato 42% → 0/100) → switch Learn → input manuale → Verifica → badge ✓/⚠️ con tip didattico |
| **C** | Search "Corno Grande" (1 risultato Bolzano, NOT Abruzzo) → 4 waypoint sulla mappa Alpi → GPX export → Copia link |
| **B** | Resize mobile 390×844 → ispezione drawer / top bar / popup leaflet |
| **A** | Inspect a11y tree, console warnings, snapshot DOM |

### Nuovi findings emersi dal test live

| ID | Severity | Trovato da | Descrizione |
|---|---|---|---|
| **R8-01** | 🔴 HIGH | C | 3 waypoint vicini hanno **tutti lo stesso nome auto-generato** ("Monteplair"). Reverse-geocode trova lo stesso POI per coordinate vicine. Utente non può distinguere i WP nel pannello |
| **R8-02** | 🟡 MEDIUM | C | Y-axis del profilo altimetrico per range piccoli (es. 2531-2558m, Δ=27m) mostra padding eccessivo (2520-2600m). Chart "schiacciato", difficile leggere variazioni |
| **R8-03** | 🟡 MEDIUM | C | Search "Corno Grande" ha restituito 1 solo risultato (Bolzano), mancando il famoso del Gran Sasso d'Abruzzo. Nominatim limit=5 ma query troppo ambigua. Manca biasing per area visibile della mappa |
| **R8-04** | 🔴 HIGH a11y | A | TUTTI gli spinbutton (Lat, Lon, Alt, Dist, Azim, D+, D-) hanno `aria-valuemin="0" aria-valuemax="0"` errati. In Learn mode Lat/Lon sono anche `aria-invalid="true"` su valori validi. Screen reader leggono info sbagliate |
| **R8-05** | 🟡 MEDIUM | B | Quando compass/ruler/quiz è attivo, ENTRAMBI i tab Learn/Track risultano `aria-selected=false` e visivamente non selezionati. Crea ambiguità: "in che modalità sono?". Soluzione: mantenere il tab attivo evidenziato anche con tool ON |
| **R8-06** | 🟡 MEDIUM | A | Console warning Recharts `width(-1) height(-1)` al primo render. Container senza dimensioni iniziali → flash/flicker del chart |
| **R8-07** | 🟢 LOW | D | "Copia link" cliccato: nessun feedback visibile (testato in automation, clipboard API può essere bloccata). Verificare che lo stato `setLinkCopied(true)` sia chiaramente visibile (cambio testo bottone, colore, banner) |
| **R8-08** | 🟡 MEDIUM | C | Reverse-geocode firing su drag: 5 trascinamenti rapidi del marker → 5 chiamate serializzate (corretto post-R3-01 fix). Ma l'UX feel laggy: il nome del waypoint cambia con delay |
| **R8-09** | 🟡 MEDIUM | D | Quiz scoring molto severo: distanza reale 1.41 km, risposta 2.00 km → errore 42% → punteggio **0/100**. Tolerance distance = 20%, ma con scoring lineare anche piccoli sforamenti vanno a 0. Per Persona D è frustrante: scoraggia continuare |
| **R8-10** | 🟢 LOW | A | Dialog modale tutorial ha `aria-label="Tutorial modalità Learn"` ma il tutorial copre Learn E Track. Etichetta fuorviante |

### Highlight positivi (cose che funzionano bene)

- ✅ Click → waypoint → reverse-geocode → trail routing → elevation profile: tutto in ~3s, niente errori
- ✅ Badge didattici cliccabili con tip personalizzato per tipo di errore (es. "Verifica la declinazione magnetica..." per azimuth warning). Pattern eccellente.
- ✅ Calcolo D+/D- cumulativo coerente (4 leg: 23+33+29+0=85; 1+29+32+0=62)
- ✅ Mappa Thunderforest Outdoors molto leggibile a livelli di zoom alti
- ✅ Profilo altimetrico in Learn mode ha background ambra ("stimato") che chiaramente lo distingue da Track
- ✅ Mobile layout (390×844) lavora bene con touch target 44px su elementi principali

### Aggiornamento "Top 5 azioni" (post-test live)

Le top 5 invariate (Learn↔Track non-distruttivo, UI ORS fallback, modal/toast, glossario+profilo, marker popup). **Aggiungo**:

6. **R8-04** — Fix `aria-valuemin/max` e `aria-invalid` in NumberInput (HIGH a11y, low effort)
7. **R8-01** — Suffix progressivo su auto-name duplicati (MEDIUM impact, low effort)
8. **R8-09** — Rivedere la curva di scoring del quiz: invece di scoring lineare → curva più clemente (es. `1 - (delta/tolerance)^0.5` invece di `1 - delta/tolerance`)
9. **R8-02** — Y-axis padding intelligente: per range < 50m usare padding fisso 5m, per range > 200m usare 5%; in mezzo interpolare

