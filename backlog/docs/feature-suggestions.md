# TrekTrak — Feature Suggestions & Value-Adds

Proposte di nuove funzionalità o miglioramenti di valore emerse durante l'analisi della v0.6.0/v0.6.1. Per discussione e prioritizzazione.

Costo stimato: **S** (1–3 giorni), **M** (1 settimana), **L** (2+ settimane).

---

## A. Didattica / Apprendimento (core)

### A1. Sovrapporre profilo "stimato vs reale" dopo Verifica — S
Quando l'utente in Learn inserisce D+/D-, alla verifica mostrare il profilo reale (campionato) sovrapposto al profilo "piatto" basato sulle quote endpoint. Forte feedback didattico: l'utente *vede* dove ha sottostimato.
**Valore.** Trasforma la Verifica da "X errori, ~ vicini, ✓" a un'esperienza visiva. Allinea Verifica e Profilo Altimetrico (oggi disgiunti).

### A2. "Modalità sfida cieca": maschera tile finché non risolvi — M
Una modalità in cui la mappa è "censurata" sopra le tappe (es. tile sfocate lungo il path) finché l'utente non ha inserito le stime. Forza il ragionamento topografico (curve di livello, simboli) invece di "guardare e indovinare".
**Valore.** Cartografia manuale = leggere segni, non confrontare immagini.

### A3. Categorie waypoint con bonus didattico — S/M
Marca waypoint come "rifugio", "passo", "cima", "guado" via un campo `category`. Bonus: punteggio extra nel quiz se identifichi correttamente la categoria da Overpass.
**Valore.** Vocabolario cartografico, non solo numeri.

### A4. "Profilo storico" — andamento personale visuale — S
Già esiste `ProgressOverlay` con stats numeriche. Aggiungere un grafico "miglioramento nel tempo" per categoria (azimuth, altitudine, distanza) con linea di trend.
**Valore.** Motivazione visibile, gamification minimale.

---

## B. Mappa e workflow

### B1. Quick-action popup su tap marker — S
Tap su un waypoint marker → popup con azioni: Rinomina | Elimina | Vai a (zoom) | Copia coordinate. Su mobile l'unica via oggi è il drawer.
**Valore.** Riduce il "context switch" mappa ↔ panel del 50%.

### B2. Annulla/Ripeti (undo/redo) — M
Stack di azioni per: add/remove/move waypoint, change name, reorder.
**Valore.** Confidence: ho cancellato un waypoint per sbaglio → cmd+Z.

### B3. Tracking GPS dal vivo durante l'escursione — L
Modalità "On the trail": registra il path GPS reale e confrontalo col tuo itinerario pianificato. Mostra deviazioni in tempo reale.
**Valore.** Chiude il ciclo "pianifica a casa → cammina → impara". Trasforma TrekTrak da pianificatore a strumento full-stack.

### B4. Import GPX da Komoot/Wikiloc/Strava — M
GPX in input → carica come itinerario base, poi l'utente lo "lavora" (inserisce stime, verifica, impara).
**Valore.** Onboarding più rapido: nessuno parte da zero, parte da un itinerario reale che vuole studiare.

### B5. Modalità "Stampa cartacea" per il roadbook — S
Il PDF Roadbook già esiste. Aggiungere uno stile "minimo plastica resistente": font grande, niente colori (per stampe B/N escursionistiche), checkbox accanto a ogni waypoint per spuntare durante il cammino.
**Valore.** Use case reale: portare il foglio in zaino.

---

## C. Quiz & Learning evolved

### C1. Modalità "Solo bussola/righello senza GPS" — M
Disabilita la geolocalizzazione, l'utente deve identificare la propria posizione SOLO da osservazioni cartografiche (azimuth a due punti noti, distanze stimate). Calcolo della triangolazione.
**Valore.** Skill cartografico raro, didatticamente potente.

### C2. Quiz "live POI from radius" — S
Mentre cammini (o pianifichi), genera quiz su POI entro N km dalla tua posizione corrente, non da bounds della mappa. Più rilevante per l'escursione corrente.

### C3. Quiz adattivo — punta sulle debolezze — M
Se `categoryStats` mostrano 30% di errori sull'azimuth, il quiz successivo pesca più azimuth e meno altitudine. Algoritmo: ponderazione inversa al `validPercent`.
**Valore.** Apprendimento personalizzato senza intervento utente.

---

## D. Polish utility

### D1. Modal in-app per `alert()` / `confirm()` — S
Sostituire le chiamate native con un componente `Modal` riusabile. Stile coerente con l'app.

### D2. Toast notifications — S
Stop a `alert()` per feedback non-bloccante ("Itinerario salvato", "Link copiato"). Già usi `VerifyBanner`: estendere a `Toast` riusabile.

### D3. Multilingua i18n — L
L'app oggi è hardcoded in italiano. Estraendo le stringhe in `messages/it.json` con `next-intl` o simile si apre EN, ES, DE per la community.
**Valore.** Audience 10×. Costo: setup + traduzioni iniziali. Aspetta se l'utente ha confermato uso personale.

### D4. Dark/Light mode toggle — S
Oggi è solo dark. Un light mode (sfondo bianco, accent verde scuro) potrebbe servire per stampe e per uso esterno con luce diretta.

---

## E. Tecniche / DX

### E1. Migrazione storage versioning — S
`SCHEMA_VERSION` esiste ma non c'è migration logic. Aggiungere una funzione `migrate(from, to)` chiamata in `loadItineraries` e `loadSettings`. Diventerà necessaria se i tipi cambiano.

### E2. Service Worker — pre-cache delle tile dell'ultima area visitata — M
Già esiste runtime cache per tile (`sw.ts`). Aggiungere proattivamente: quando l'utente salva un itinerario, pre-cachare le tile dei bounds nei livelli zoom 13-17 per offline use.
**Valore.** Trekking in zone senza segnale.

### E3. Test E2E con Playwright — M
Oggi 437 unit/component test. Aggiungere 5-10 scenari end-to-end (crea itinerario, verifica, salva, ricarica, export). Riduce regression risk durante refactor.
