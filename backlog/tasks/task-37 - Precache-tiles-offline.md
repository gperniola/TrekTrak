---
id: TASK-37
title: Pre-cache tile della mappa per uso offline (escursioni senza segnale)
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - pwa
  - offline
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Feature** (suggestion **E2**) — il service worker (`app/sw.ts`) già fa caching runtime delle tile (CacheFirst). Funziona quando l'utente le ha visualizzate almeno una volta. Per uso "offline pianificato" (escursione senza segnale) serve un pre-caching esplicito.

## Task

### Trigger
- [x] Bottone "Scarica per l'uso senza rete" — messo in **Impostazioni mappa**, non nell'ActionBar: la `SavedItinerariesModal` non esiste più dalla v0.9.0, e l'ActionBar è già la barra più affollata dell'app
- [x] Calcolare i bounds dell'itinerario + un buffer del 20%

### Pre-fetch
- [x] URL delle tile per i livelli **12-16** (non 13-17) dentro i bounds, **solo la mappa corrente** più i sentieri se accesi. Lo zoom 12 serve a orientarsi, il 17 costa il quadruplo del 16 per un dettaglio che a piedi non si usa; scaricare tutte le mappe base moltiplicherebbe per cinque una scaricata che è già un favore chiesto a chi ce le regala
- [x] `fetch(url)` per ognuna → il service worker le mette in cache automaticamente
- [x] Progress bar nel modale: "Scaricamento tile 124/600..."

### Storage management
- [x] Mostrare lo spazio usato per offline (StorageManager API)
- [x] Bottone "Pulisci cache offline" per liberare

### Limiti
- [x] Cap a ~500 tile per evitare abuso dei provider (rispettoso di tile usage policy)
- [x] Avviso oltre i **400 km²** (non 100: un giro di cresta di 15 km ne fa già più di cento, e un avviso che scatta sempre non è un avviso)

## Acceptance criteria

- [x] Scarico le tile → **rete spenta** → la mappa funziona ancora. Verificato in `e2e-offline/precaricamento.spec.ts`, non col DevTools: **l'emulazione "offline" del DevTools non raggiunge il service worker** e dà un falso verde (misurato: a rete "spenta" una URL mai vista rispondeva lo stesso). Si usa `context.setOffline` di Playwright, e ogni scenario comincia verificando che una URL mai vista fallisca davvero
- [x] Progress feedback durante download
- [x] Cache size accessibile e cancellabile

## Riferimenti

- `src/app/sw.ts` (cache strategy esistente)
- `backlog/docs/feature-suggestions.md` E2
<!-- SECTION:DESCRIPTION:END -->

## Cosa è saltato fuori facendolo

1. **La cache delle tile non aveva mai funzionato.** Workbox rifiuta le risposte *opache*
   — quelle che tornano dalle immagini di altri siti, senza stato leggibile — se non gli
   si dice esplicitamente di accettarle. Misurato: ventiquattro mattonelle a schermo,
   nessuna cache `tiles-*` esistente. Rimedio: `CacheableResponsePlugin({ statuses: [0, 200] })`
   sul gestore delle mattonelle in `sw.ts`. Da mesi la mappa non era conservata da nessuna
   parte, e nessun test poteva accorgersene perché il codice era scritto bene.

2. **Il peso in quota non è il peso su disco.** Il pannello dichiarava «circa 1,0 MB» dove
   il browser ne contava 518. Le risposte opache vengono conteggiate con un forte
   arrotondamento in eccesso, apposta: misurate **4,5 MB a mattonella** contro i ~15 kB
   reali. Ora il peso non si stima — lo si chiede a `navigator.storage.estimate()` — e
   prima di scaricare si avvisa se non ci sta.

3. **`{s}` non è libero.** Leaflet sceglie il sottodominio in modo deterministico e la
   chiave di cache è l'URL intero: scaricare da `a.tile…` ciò che verrà chiesto a
   `b.tile…` riempirebbe il disco senza che nessuno peschi da lì.

4. **Un dialogo centrato più alto della finestra è in parte irraggiungibile** — questa
   sezione ha fatto crescere le Impostazioni mappa oltre lo schermo, e l'ultima riga
   risultava «visibile e stabile» e insieme «fuori dalla finestra». Rimediato su tutti e
   tre i dialoghi che ne erano privi, con `dialoghi-raggiungibili.test.ts` a pretenderlo
   da tutti.

## Fuori portata, ma trovato qui

Al ripristino dell'itinerario in lavorazione **la mappa non ci si sposta**: resta sul
centro predefinito. Con il GPS acceso non si nota (si è lì), ma chi apre l'app senza
segnale e senza posizione vede la vista di partenza e deve trovare il proprio percorso a
mano — proprio dopo averne scaricato le mattonelle. Non è un difetto introdotto qui e non
riguarda il pre-caricamento: vale un task a parte.
