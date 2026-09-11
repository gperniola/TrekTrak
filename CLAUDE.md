# TrekTrak — istruzioni di progetto

PWA didattica per la **cartografia manuale** applicata al trekking: l'utente inserisce a
mano coordinate, quota, distanza e azimut, e l'app li **verifica** contro i dati reali.
Cresciuta in un secondo perimetro — «compagno di gita» — con meteo del percorso e layer di
emergenza. Uso personale, italiano, mobile-first.

Versione corrente: vedi `package.json` (`version`) e la voce in cima al `CHANGELOG.md`.
La documentazione di dettaglio, quando serve, sta nella KB Obsidian
`02 - Projects/TrekTrak/` del vault; spec e piani in `docs/superpowers/`; task e analisi in
`backlog/`.

## Comandi

- `npm run check` — **il cancello**: typecheck (prodotto, test, e2e) + lint + jest. Verde
  prima di ogni commit.
- `npm test` / `npm run test:watch` — unit (Jest + Testing Library).
- `npm run test:e2e` — Playwright (Chromium, contro `next dev` sulla 3210).
- `npm run test:e2e:offline` — comportamento offline (col service worker vero).
- `npm run test:e2e:webkit` — l'intera suite sul motore di Safari; **controllo da
  pre-rilascio** (copre la classe di difetti WebKit già pagata, non ciò che è solo di iOS).
- `npm run dev` — porta 3000. `npm run build` — build di produzione.

## Stack

Next.js **14.2** (App Router, non 15) · TypeScript · React-Leaflet + OpenStreetMap ·
**Zustand a più store** · Recharts · Tailwind (token CSS, tema chiaro/scuro) ·
`@serwist/next` (PWA, migrato da next-pwa nella v0.6.0) · jsPDF + html2canvas · @dnd-kit ·
lz-string · Jest + Playwright.

## Due assi da non confondere

- **`appMode`** (`'learn'` | `'track'`) è dell'**itinerario**: decide come si compilano i
  valori. A schermo si chiama **«Impara»** / **«Pianificazione»** (id interni invariati:
  stanno nei dati salvati).
- **`profilo`** (`'imparo'` | `'montagna'`) è dell'**utente**: decide **quali aree
  esistono**. La risposta è in **un solo posto**, `mostra(area, profilo)` in
  `lib/profilo.ts` (`AREE`). Ogni ingresso di un'area passa da lì.

## Store (`src/stores/`)

`itineraryStore` (l'itinerario, montato a **slice** in `stores/itinerary/`: waypoint,
tratte, documento, modo, profilo-storia, undo/redo) · `uiStore` (viste, tab mobile,
overlay aperti, profilo, `guidaAperta`, `settingsOpen`) · `emergencyStore` (i layer) ·
`positionStore` (posizione GPS, alimentato da avvio e tasto) · `notificationStore`
(`confirm`/`choose`/`toast`) · `authStore` + `routeLibraryStore` (libreria — vedi sotto).

## Le aree principali

- **Editor + verifica**: `verifica-itinerario.ts` (puro) confronta i valori dell'utente
  col terreno (quote DEM, distanze/dislivelli via ORS o linea d'aria). Cuore di «Impara».
- **Meteo del percorso** («Quando partire»): incrocia i waypoint con gli orari di Munter e
  la previsione Open-Meteo (`route-weather.ts`). **L'avviso segue la previsione vera**
  (codice meteo + probabilità di pioggia); il **CAPE è contesto/aggravante, non un
  trigger** (v0.26.1), e la sua soglia d'innesco **è quella dell'arancione del modello**,
  non un numero fisso — fissa era irraggiungibile per ICON. Fuori dalla tabella (al suo
  posto i millimetri, **con l'unità in cella**, colorati per gravità), ma visibile nel
  **dettaglio della riga** insieme alla quota a cui ha risposto il modello. Colonne:
  `Punto · Arrivo · Cielo · Piogg. · mm · Raffiche · ⋮`. Il tetto dei punti
  (`MAX_PUNTI`) conta i **luoghi, non i waypoint**: col ritorno per la stessa strada i
  waypoint raddoppiano ma i posti no, la rete chiede ogni luogo una volta sola
  (`chiaveLuogo`) e riespande la risposta sui passaggi — contare i waypoint saltava la
  meta (v0.31.5). **Due modelli** (`ecmwf_ifs` +
  `icon_seamless`) in **una sola richiesta**; l'utente sceglie il suo dalla tendina
  (`AppSettings.modelloMeteo`, predefinito ECMWF — e `loadSettings` deve **rileggerlo**:
  alla v0.31.0 lo scriveva e lo buttava via) e **quel modello possiede tutto** — righe,
  motivi, verdetto, fasce: i valori non si mescolano mai fra fonti. Un modello che non
  risponde resta vuoto senza spegnere il pannello. Le **soglie di pioggia sono per modello**
  e **misurate**, non a occhio (`SOGLIE_MODELLO`: ECMWF 15/32, ICON 5/10 — da 171 temporali
  osservati al METAR, vedi `backlog/docs/meteo-verifica-modelli-analisi.md` e lo script
  accanto per rifare la misura); le stesse costanti le legge «Come si legge», che non può
  quindi divergere. I **nomi dei codici WMO** hanno una sola casa, `cielo.ts`: il giudizio
  ne prende il testo e ci attacca la probabilità in **un motivo solo** («neve 70%», non
  «neve · pioggia 70%»). **L'iconcina non è sempre quella del codice**: `cieloDellOra`
  mostra «possibile pioggia» quando la probabilità raggiunge l'arancione del modello e il
  codice non dichiara precipitazione — il codice è di **una** corsa, la probabilità di un
  **insieme** (la nebbia è esclusa: è un pericolo suo). La legenda elenca i cieli
  **mostrati**, non quelli dei codici. Sole/crepuscolo in `sun.ts` (NOAA, nessuna rete), cielo in
  `cielo.ts`. Il **passo** si cambia anche dal pannello (`applicaPasso`, stesso globale
  delle Impostazioni); la **rete è separata dalla ricostruzione** — il report è un
  `useMemo`, cambiare passo/soste/**modello** non riscarica. Le **soste ai waypoint** (`pausaMin` su
  `Waypoint`, tastino ⏸️ sulla mappa e controllo nella lista) spostano gli arrivi (`arrivalTimes`),
  e una sosta ≥60 min (`SOGLIA_PAUSA_METEO`) sdoppia il punto in `arrivo`/`ripartenza`
  (campo `fase`); il **ritorno automatico non copia le soste**. In cima al pannello,
  l'**allerta DPC del percorso** (`AllertaDpcPercorso` + `checkRoute`) se un tratto è in
  una zona in allerta nel giorno di partenza (v0.27.0).
- **Layer di emergenza** (⚠️): 10 layer opzionali (focolai FIRMS, aree bruciate + FWI
  EFFIS, allerta DPC, valanghe EAWS, neve GIBS, terremoti INGV, rifugi Overpass, radar
  RainViewer, instabilità Meteosat). Definiti in `emergency-layers.ts` (registry
  `kind → renderer`). Il layer DPC legge la **criticità idrogeologica** (allerta
  ufficiale), **non** la vigilanza meteo. Dati **esclusi dalla cache** del service worker.
- **Libreria condivisa** (Supabase, invito/magic-link, RLS): **SPENTA** dietro
  `LIBRERIA_DISPONIBILE = false` in `lib/funzioni-spente.ts` — il flusso di accesso non
  funziona. Il codice resta; per riaccenderla si rimette `true`. Ingressi gated da
  `mostra('libreria', …)`.
- **Shell mobile**: bottom nav (Mappa/Editor/Libreria/Altro), sheet, FAB strumenti, e il
  **tasto Indietro** via History API (`back-nav.ts` puro + `useTastoIndietro.ts`).
- **Export**: registry in `lib/exporters/` (PDF sintetico/roadbook, GPX, KML, JSON); ogni
  formato dichiara `impedimento(): string | null`.

## Convenzioni che si pagano se ignorate

- **Tutto in ora e formato italiani.** Numeri/date/ore via `lib/formato.ts`; il fuso è
  sempre `Europe/Rome`. **Vietati** i getter locali di `Date` (`getHours`, `getDate`, …) e
  `toLocale*` senza `timeZone` — c'è un guardiano (`__tests__/fuso-orario.test.ts`) che
  fallisce se ne compaiono. La virgola decimale si accetta (`parseDecimale`).
- **Non dire il falso, e non far finta di sapere.** Un dato assente si dichiara («n/d»,
  «dati non disponibili»), non si disegna a zero o «sereno». Le funzioni di rischio/quota
  distinguono «non lo so» da «zero».
- **Popup Leaflet in HTML** (`bindPopup`) → sempre da `escapeMarkup`; in JSX l'escaping è
  di React.
- **La posizione non si chiede mai** d'iniziativa: garanzia strutturale (`positionStore`
  alimentato solo da avvio e dal tasto).
- **Renderer canvas di Leaflet**: un `Marker`/tap richiede `bubblingMouseEvents: false` o
  crea un waypoint fantasma; `interactive={false}` non blocca la tastiera (serve
  `keyboard={false}`).
- **Chiavi**: `FIRMS_MAP_KEY` e `SUPABASE_SERVICE_ROLE_KEY` sono **server-only** — mai il
  prefisso `NEXT_PUBLIC_`. Le altre (ORS, Thunderforest) sono nel bundle client di
  proposito. Le chiavi `localStorage` stanno in `KEYS` (`lib/storage.ts`).
- **Un campo nuovo in `AppSettings` va RILETTO in `loadSettings`**, che ricostruisce
  l'oggetto da un elenco fisso: chi non lo aggiunge lì lo scrive e lo butta via, in
  silenzio. È successo cinque volte (`pace`, `trektrak_user_level`, `slim`,
  `modelloMeteo`). Ora la fixture del test è `Required<AppSettings>`, quindi **la
  dimenticanza non compila**; e se il valore fa da chiave, si verifica contro il suo
  insieme prima di accettarlo (`MODELLI_METEO`, come `TEMI`).

## Come si lavora qui

- **Verificare sui dati veri, non solo sui test.** La lezione ricorrente del progetto: i
  difetti che contano stanno nel divario fra «i test passano» e «cosa si vede/succede».
  Per meteo, allerte e mappe si controlla la risposta reale del servizio; per l'interfaccia
  si guarda lo schermo (Playwright o browser). I test unità restano la rete, non la prova.
- **Guardare la mano, non solo il codice**: dopo un cambio di renderer o di layout, si
  riprova col dito/viewport reale.
- **`npm run check` verde a ogni commit.** Le correzioni si verificano **per mutazione**
  (rompere di proposito la riga corretta e vedere un test rosso). Nessun test si modifica
  per far passare un refactoring.
- **Chiedere sempre prima di committare** (regola dell'utente). Niente push su `master`
  senza richiesta esplicita; lavoro su `develop`. Push via SSH
  (`git@github.com-personal:gperniola/TrekTrak.git`). Rilascio = merge su master + tag
  annotato + push, solo su richiesta.
- **Commenti e testo in italiano.** I commenti spiegano il *perché* (spesso il difetto che
  la riga previene), non il *cosa*.

## Documentazione correlata

- `docs/ARCHITECTURE.md` — panoramica (rimanda qui per lo stato corrente).
- `docs/superpowers/specs/` e `plans/` — spec e piani per feature.
- `backlog/docs/` — analisi (es. `rilascio-pubblico-analisi.md`, `pulizia-codice-analisi.md`).
- KB Obsidian `02 - Projects/TrekTrak/` — sinossi cross-progetto e dettaglio per area.
