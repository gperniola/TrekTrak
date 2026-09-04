# Analisi del codice per la pulizia — misure del 2026-09-04

Base di partenza per [[task-64]]. Tutti i numeri qui sono **misurati** su `src/`, `e2e/` e
`e2e-offline/` alla revisione `b597ee3` (v0.22.1), con gli script di misura in
`backlog/docs/strumenti-analisi.md`.

Il punto di questo documento è che un lavoro di pulizia deciso a occhio tocca quello che
salta all'occhio, non quello che pesa. Tre delle cose che credevo di trovare non c'erano, e
due che non cercavo sono difetti veri.

## Inventario

| | file | righe di codice |
|---|---|---|
| Prodotto | 188 | 17.310 |
| Prove | 166 | 16.488 |
| | | rapporto **0,95** |

## Quello che NON c'è (e che un piano generico avrebbe promesso di sistemare)

- **Codice morto: una riga.** `LivelloSac` in `lib/glossario.ts`, un tipo dichiarato e
  usato da nessuno, nemmeno nel suo file. È tutto.
- **Nessun `TODO`, `FIXME`, `XXX`, `HACK`** in tutto il repository.
- **Nessun `any`**, nessun `@ts-ignore`, nessun `@ts-expect-error`.
- **Nessuna funzione duplicata**: la ricerca di blocchi identici fra file diversi non ha
  trovato due implementazioni della stessa cosa. I 30 blocchi ripetuti sono impalcature di
  test e un unico schema di prodotto (sotto).
- Il pattern «chiudi al clic fuori», ripetuto in cinque componenti, **ascolta i tre eventi
  giusti in tutti e cinque** (`mousedown`, `touchstart`, `keydown`): sospettavo che qualcuno
  si fosse dimenticato il tocco, e non è così.

## Quello che c'è, in ordine di quanto conta

### 1. Due date senza fuso — le uniche conseguenze visibili all'utente

`toLocaleDateString('it-IT')` **senza `timeZone`** in due punti:

- `components/panel/CompletionList.tsx:15` — la data di un completamento nel diario
- `components/quiz/QuizSummary.tsx:86` — la data di una sessione di quiz

Su un dispositivo con fuso diverso, una registrazione fatta a mezzanotte e mezza italiana
si legge **il giorno prima**. È la famiglia di difetti più ripetuta di questo progetto (le
v0.13.2, v0.13.4 e v0.11.6 sono in buona parte questo), e gli altri cinque punti che
formattano orari dichiarano tutti `Europe/Rome` — quindi qui non manca una regola, mancano
due chiamate.

### 2. Cinque componenti grossi, dove non si tiene tutto in testa

Funzioni oltre 60 righe di codice: **52**. Ma la coda lunga sono componenti da 60-90 righe,
che vanno bene. Quelli che contano sono cinque:

| righe | cosa |
|---|---|
| 518 | `ActionBar` (`components/panel/ActionBar.tsx`, 550 righe di file) |
| 336 | `RouteWeatherPanel` (413) |
| 304 | `Home` (`app/page.tsx`, 341) |
| 281 | `ElevationProfile` |
| 273 | `EmergencyLayerRow` (316) |

Annidamento di graffe oltre 8: `ProgressOverlay` (11) ed `emergencyStore` (9).

`ActionBar` è il caso peggiore e anche il più chiaro: contiene export PDF/GPX/KML/JSON, il
pulsante «Quando partire», la mappa offline, il salvataggio, i motivi dei pulsanti
disabilitati e i suggerimenti. Sono cinque responsabilità in un file.

### 3. Settantasei esportazioni che nessuno importa

Non è codice morto: sono **tipi e funzioni interne marcate `export`** senza un consumatore.
Verificato su tre campioni: `generateRoadbookPDF` e `geometryContainsPoint` sono chiamate
dentro il proprio file (vive, `export` di troppo), `LivelloSac` no (morta).

Valore della pulizia: bassa ma reale — un `export` senza consumatori è superficie che
sembra API e non lo è, e allarga quello che si deve leggere per capire un modulo.

### 4. Impalcature di test copiate

Lo stesso itinerario di prova e le stesse `jest.mock` in 3-4 file
(`ActionBar.test`, `InteractiveMap.test`, `LeftPanel.test`, `OfflineNellEditor.test`), e due
copie del finto `localStorage` (`map-features.test`, `storage.test`).

### 5. Un unico schema di prodotto ripetuto cinque volte

«Chiudi al clic fuori, al tocco fuori, o con Esc»: `UserHeader`, `ElevationProfile`,
`SummaryBar`, `ActionBar`, `IncollaCoordinate`. Dodici righe a testa, corrette in tutti
e cinque. Un hook risparmia sessanta righe e rende impossibile scordarsi un evento la
sesta volta.

### 6. Vocabolario misto

Dodici file hanno più del 25% di identificatori nella lingua di minoranza. I peggiori:
`emergencyStore` (118 inglesi / 60 italiani), `CompassTool` (118/53), `emergency-layers`
(73/33), `route-weather` (85/163), `overpass` (37/39).

Il progetto sta migrando all'italiano da mesi, un file per volta. **Non è un lavoro da
fare in blocco**: gli identificatori scritti nei dati salvati (`appMode`, `learnValues`,
`trackValues`, le chiavi di `localStorage`) non si toccano senza una migrazione, e una
rinomina di massa produrrebbe un diff illeggibile su cui nessuna review può dire niente.
Vale come **regola**: quando si tocca un modulo per altro, si allinea il suo vocabolario.

### 7. Ventisei file di prodotto che nessun test nomina

La maggioranza sono presentazionali (`BrandMark`, `SheetHandle`, `Toast`, `OfflineBanner`):
li copre l'occhio, non un test. Quelli con logica dentro e senza rete di protezione sono
`ElevationProfile` (281 righe), `MappaOffline`, `IncollaCoordinate`, `LegCard`,
`WaypointCard`, `SaveRouteModal`, `QuizSummary`.

## Cosa NON entra nel lavoro, e perché

- **Rinomina di massa dell'inglese**: vedi sopra. Regola, non task.
- **`as unknown as` (65) e `!` non-null (45)**: quasi tutti in test, dove servono a
  costruire finti parziali. Toglierli significherebbe scrivere finti completi di API del
  browser: più codice, non meno.
- **`console.warn` in produzione (5)**: sono diagnostiche del ripiego di routing, con
  prefisso `[TrekTrak]`/`[ORS]`. Utili quando qualcuno segnala «la distanza è sbagliata».
  Si lasciano.
- **Aggiungere strumenti** (`knip`, `ts-prune`, `jscpd`): le misure qui sono state fatte con
  tre script di venti righe. Una dipendenza in più va giustificata dal fatto che serva ogni
  giorno, e questa analisi serve una volta l'anno.
