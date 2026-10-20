# Layer neve: un layer che dice il vero — Design

Data: 2026-10-16 · Analisi di riferimento: `backlog/docs/neve-satellite-analisi.md` (i
numeri citati qui vengono da lì, e si rifanno con `backlog/docs/neve-satellite.py`).

## Scopo

L'utente ha acceso il layer «Copertura nevosa» dopo la prima neve su Maiella e Gran Sasso
e non ha potuto capire **se il layer fosse rotto o se la neve non ci fosse**. La misura ha
dato ragione a tutte e due le letture: la neve del 13/10 il 15/10 era quasi sparita, ma
l'app non poteva dirlo, e il layer ha quattro difetti veri.

1. **«Nessun dato» arriva come un 200.** GIBS risponde 200 senza l'header
   `layer-identifier-actual`, con un corpo che cambia a ogni richiesta: vuoto, oppure
   ~150 KB di rumore visibile. `tileerror` non scatta, il ripiego sul giorno prima non
   parte, Leaflet può disegnare il rumore, e il pannello dichiara la data di oggi.
2. **Una mattonella in errore fa scendere di un giorno tutto il layer**, mentre la
   pubblicazione di GIBS arriva a pezzi: 404 che diventano 200 qualche ora dopo.
3. **Nube e «niente neve» sono identiche a schermo**: entrambe trasparenti.
4. **La fonte sta per spegnersi**: il layer usa solo MODIS Terra, che si spegne fra fine
   2026 e inizio 2027; Suomi NPP chiude il 2/11/2026.

In più: **GIBS non è escluso dalla cache del service worker** (`src/app/sw.ts`). Le sue
richieste cadono nell'acchiappatutto `NetworkFirst` di Serwist (un'ora, taglio a 10 s),
contro la regola del progetto «i dati di emergenza non si servono mai da cache».

## Decisioni

**Dell'utente:**

- **Prima il layer, poi l'avviso sul percorso.** Questo design è solo il layer. L'avviso
  «possibile neve sul percorso» è un lavoro successivo (vedi Fuori perimetro).
- **Nubi: velo grigio.** Dove nessun passaggio ha visto il suolo, la mappa si scurisce.
  Scelto fra tre bozze sui dati veri (velo, tratteggio, niente sulla mappa).
- **Neve: la scala ufficiale NASA (giallo → rosso), ma nitida e coprente.** Scelta fra
  quattro tavolozze sui dati veri. Il «problema di visibilità» notato dall'utente non era
  il colore: era la resa sfocata (livello 8 stirato con interpolazione) al 60% di opacità.
- **Nessun pixel di neve nascosto.** In pianura e sui versanti ripidi compaiono pixel
  spuri (misurato: a gruppi, quasi tutti di indice 1-20). Nessun filtro li separa bene
  dalla neve vera: togliere i pixel isolati non funziona perché sono a gruppi; filtrare
  per quota cancella la neve vera sui versanti nord ripidi; togliere l'indice 1-20
  cancella 98 dei 219 pixel di neve vera sopra i 2000 m del 12-14/10. Quindi: tutti
  disegnati con la stessa forza; la legenda dice «~1-20: poca neve o incerta»; la
  descrizione del layer avverte dei pixel spuri.
- **Pressione lunga su un pixel → popup con stato ed età della vista** (proposta mia,
  confermata dall'utente). È l'unico posto dove l'età **per pixel** diventa leggibile.
  La funzione che c'è sotto, «cosa dice il composito in questo punto», va scritta in modo
  da poterla riusare: l'avviso sul percorso la chiederà per ogni punto del tracciato.

**Mie, da verificare in lettura** (l'utente non le ha discusse):

- **Composito «ultima vista libera» sugli ultimi 3 giorni con dati.** I giorni sono UTC,
  come li indicizza GIBS. Se per una mattonella **nessun sensore ha ancora pubblicato
  oggi**, la finestra è ieri e i due giorni prima. Senza questa regola, al mattino
  italiano, prima che Terra sia pubblicato (passaggio ~07:25-09:05 UTC più ~1 h), i 3
  giorni diventerebbero di fatto 2: proprio quando si guarda prima di partire. Più giorni
  coprono meglio le nubi ma mostrano neve forse già sciolta (fra il 13 e il 15 la Maiella
  è passata da 60 pixel di neve a 6). Con 3 giorni e 5 sensori, il 14/10 e il 16/10 la
  zona «non vista» era lo 0%; nei tre giorni di pioggia 8-10/10, il 94%.
- **Cinque sensori**: MODIS Terra e Aqua, VIIRS NOAA-20, NOAA-21, S-NPP. Stessa color map,
  stesso schema di URL, stesso livello 8. Quando uno si spegne, le sue risposte diventano
  «nessun dato» o 404 e il composito va avanti con gli altri, **senza date di spegnimento
  scritte nel codice**.
- **Opacità della neve ~92%**, colori **presi dalla tavolozza della mattonella stessa**
  (sono i colori ufficiali): la legenda attuale `LEGENDA_NEVE` resta vera.
- **Pixel nitidi** a ogni zoom: oltre il livello 8 si ingrandisce senza interpolazione.
- **Aggiornamento ogni 60 minuti** dei passaggi mancanti: durante il giorno GIBS pubblica
  i passaggi uno alla volta (Terra ~1 h dopo il passaggio, VIIRS 2-8 h).

## Architettura

### Rete — `fetch`, non `<img>`

Da un `<img>` gli header non si leggono, e il difetto 1 si riconosce **solo** da un
header. Tutte le mattonelle passano da `fetch`.

- **URL**: lo schema attuale (`templateNeve`) con il nome del layer per sensore:
  `MODIS_Terra_NDSI_Snow_Cover`, `MODIS_Aqua_NDSI_Snow_Cover`,
  `VIIRS_NOAA20_NDSI_Snow_Cover`, `VIIRS_NOAA21_NDSI_Snow_Cover`,
  `VIIRS_SNPP_NDSI_Snow_Cover`. Livelli 0-8 (`GoogleMapsCompatible_Level8`).
- **Regola «nessun dato»: manca `layer-identifier-actual` → nessun dato.** Il corpo non
  si legge (si annulla con `AbortController`: può pesare 170 KB di rumore). **Attenzione:
  `etag: 1000000000000` è il segno più evidente, ma dal browser l'`etag` non è leggibile**
  (non è fra gli header esposti da GIBS: `access-control-expose-headers` elenca solo
  `layer-identifier-request/actual` e `layer-time-request/actual`). La regola deve
  quindi stare tutta sull'header esposto. Verificato in Chromium e WebKit che
  `layer-identifier-actual` si legge.
- **Tre esiti per un passaggio che non c'è**, tutti **assenti** (mai «senza neve»), e
  tutti da richiedere al prossimo aggiornamento:
  - **non pubblicato**: 200 senza header, oppure **404**. Il 404 è la risposta
    **normale** di GIBS fuori dal periodo dichiarato di un layer: un giorno futuro, un
    sensore non ancora lanciato o spento (S-NPP dal 2/11/2026), una pubblicazione non
    ancora arrivata (404 che diventano 200 ore dopo). Non è un'anomalia e non si
    segnala: altrimenti, dopo il 2/11, l'avviso resterebbe acceso per sempre.
  - **errore**: 5xx, errore di rete, timeout. È un'anomalia (vedi pannello).
  - **corpo non valido**: vedi la riga successiva; vale come «non pubblicato».
- **Corpo non a tavolozza** (tipo colore ≠ 3) → trattato come «nessun dato». Le risposte
  di rumore sono RGBA o scala di grigi; le mattonelle valide sono sempre a tavolozza da 8
  bit (verificato su 18 mattonelle, livelli 2-8). Non basta da solo: la risposta vuota
  da ~935 B è **anch'essa a tavolozza**, e la riconosce solo la regola dell'header.
- **Cache in memoria** delle mattonelle valide decodificate (per sessione, limitata).
  Nessuna cache persistente: sono dati di emergenza.
- **Ordine dei passaggi**: dal giorno più recente; dentro un giorno, dal passaggio più
  tardo (Aqua ~13-15 UTC, VIIRS ~10-13 UTC, Terra ~07-09 UTC). Si scaricano **solo
  finché servono**: appena ogni pixel della mattonella ha una vista, ci si ferma.

### Decodifica — PNG a mano, non canvas

Un canvas **perde la classe dei pixel trasparenti**: provato in Chromium e WebKit, anche
con `createImageBitmap(…, { premultiplyAlpha: 'none' })`, 65.438 pixel su 65.438 escono
senza colore. Nube e niente-neve hanno `alpha = 0` ma RGB diversi nella tavolozza, ed è
l'RGB che li distingue.

Un modulo puro decodifica il PNG: blocchi, IDAT concatenati (possono essere più d'uno),
`inflate`, i cinque filtri di riga, tavolozza + `tRNS`. L'`inflate` è **iniettato**: nel
browser `DecompressionStream('deflate')` (Safari ≥ 16.4), nei test `zlib` di Node. Costo
misurato: 3-4 ms per mattonella. Pesi: 1,6-6,2 KB per mattonella valida a livello 8.

**Classi** (RGB della tavolozza, da `colormaps/v1.3/MODIS_NDSI_Snow_Cover.xml`):

| RGB | Classe | Nel composito |
|---|---|---|
| `0,255,0` | senza neve | vista |
| `0,0,255` / `35,35,117` | acqua / mare | vista (trasparente) |
| `0,191,255` | nube | si passa oltre |
| `189,0,189` / `255,200,255` / `200,200,200` / `170,0,0` / `255,255,255` | notte / mancante / indeciso / saturo / fill | si passa oltre |
| indici 1-100, `alpha > 0` | neve, indice NDSI = indice di tavolozza | vista |
| qualunque altro RGB con `alpha = 0` | sconosciuta | si passa oltre (mai «senza neve») |

Che l'indice di tavolozza coincida col valore NDSI va **verificato su una fixture**
(misurato finora: indici 10-72 sulle cime, colori coerenti con la color map), non dato per
scontato.

### Composito — modulo puro

Ingresso: i passaggi di una mattonella in ordine (decodificati, oppure assenti con il
motivo). Uscita, per ogni pixel: stato (`neve` con indice | `senza` | `acqua` |
`nonVisto`) e da quale passaggio viene. Più un riassunto: giorni e sensori usati,
passaggi assenti.

Regola: vince **il primo passaggio, dal più recente, che ha visto il suolo**. Nube, notte,
mancante, indeciso, saturo e fill non sono una vista. Un pixel che nessun passaggio
disponibile ha visto è `nonVisto`. Se nel frattempo dei passaggi erano **assenti**, il
pixel resta `nonVisto` sulla mappa, ma il riassunto lo dice (vedi pannello).

### Disegno — un `GridLayer` su canvas

Sostituisce `EmergencyXyzLayer` (che resta solo se servisse ad altri layer: oggi
`kind: 'xyz'` è usato **solo** dalla neve). Pane `EMERGENCY_PANE`, come gli altri.

- Zoom ≤ 8: composito della mattonella `(z, x, y)` stessa.
- Zoom > 8: composito della mattonella genitrice al livello 8, di cui si disegna il
  quadrante, ingrandito **senza interpolazione** (`imageSmoothingEnabled = false`).
- Colori: neve → RGB della tavolozza, opacità ~92%; senza neve e acqua → trasparente;
  non visto → velo `rgba(71,85,105,0.45)` (quello della bozza approvata).
- Legenda: `LEGENDA_NEVE` (prima voce: «~1-20: poca neve o incerta») + «non visto
  (nubi)» col colore del velo. Colori della legenda e del disegno da **una sola
  costante**, come per il meteo: non possono divergere.

### Stato e pannello

`xyzGiorno` (un giorno solo) non basta più: diventa un riassunto delle mattonelle **a
schermo**: primo e ultimo giorno usati, sensori usati, e se qualche passaggio era assente.

- Riga del pannello, al posto di «Immagine del …»: **«Viste dal 14 al 16 ottobre ·
  MODIS Terra, Aqua · VIIRS NOAA-20»**. Solo i sensori che hanno davvero contribuito.
  Date in italiano via `formato.ts`. I giorni sono UTC (così li indicizza GIBS).
- **`partial: true`** («alcune immagini non sono arrivate») se almeno un passaggio
  **tentato** è finito in **errore** (5xx/rete). Non serve altra condizione: i passaggi si
  scaricano dal più recente e solo finché restano pixel senza vista, quindi ogni
  passaggio tentato poteva cambiare almeno un pixel. «Non pubblicato» (404 compreso) non
  accende mai l'avviso.
- `status`:
  - `loading` finché la prima mattonella non è composta;
  - `ready` appena una mattonella ha almeno un passaggio disponibile;
  - `nodata` («Nessuna immagine negli ultimi 3 giorni») se in nessuna mattonella c'è
    un passaggio disponibile, e almeno una risposta era un «nessun dato» (200 senza
    header): GIBS ha risposto, e non ha pubblicato niente;
  - `error` (con «Riprova») se non c'è nessun passaggio disponibile e **ogni** risposta è
    stata un 404 o un errore. Almeno uno dei cinque sensori ha sempre pubblicato ieri:
    404 ovunque vuol dire che GIBS non riconosce più i layer (nomi cambiati) o non
    risponde. È la classe «layer rotto presentato come dati assenti», e va detta come
    guasto.
- «Riprova» ricomincia da capo (stessa garanzia di oggi via `retryTick`: rimonta il
  layer, svuota il riassunto).
- `refreshMinutes` resta per `isStale`; l'aggiornamento orario ridisegna le mattonelle
  con passaggi mancanti o il cui giorno più recente non è oggi.

### Pressione lunga

`contextmenu` (lo stesso gesto di `EmergencyFeatureInfo`, che oggi interroga solo i WMS)
→ popup, ad esempio:

- «Neve (indice 45) · vista il 15 ottobre da MODIS Terra»
- «Senza neve · vista il 16 ottobre da VIIRS NOAA-20»
- «Non visto: nubi in tutti i passaggi dal 14 al 16 ottobre»

Un solo popup anche con un WMS interrogabile acceso insieme: i risultati si combinano,
non si aprono due popup. Testo da `escapeMarkup` (popup Leaflet in HTML).

### Registro e testi

- `id: 'snow-cover'` **invariato**: è salvato nelle impostazioni
  (`mapDisplay.emergencyLayers`).
- Descrizione: dice composito di 3 giorni, ~450 m, «grigio = non visto per le nubi», e
  «in pianura e sui versanti ripidi possono comparire pixel spuri». Il test
  `fase2-invarianti` (la descrizione nomina le nubi) resta valido.
- Attribuzione: «Neve: NASA GIBS / MODIS, VIIRS».

### Service worker

Regola `NetworkOnly` per `^https://gibs\.earthdata\.nasa\.gov/`, **prima** di
`...defaultCache` (vedi il commento sull'ordine in `sw.ts`), con il suo caso in
`service-worker-ordine.test.ts`.

## Verifica

- **Fixture vere**, piccole (1,6-6 KB): mattonelle GIBS reali, per esempio Terra 13/10
  `8/94/138` (neve sulla Maiella), Terra 16/10 `8/94/138` (nubi), Aqua 14/10 `8/94/137`.
  I conteggi attesi per classe vengono dallo script Python di riferimento
  (`neve-satellite.py`), non dall'implementazione che si sta provando.
- **Decodifica**: le fixture vere coprono solo il filtro 0. I filtri 1-4 e gli IDAT
  multipli si provano con PNG sintetici generati nel test.
- **Unità**: regola «nessun dato» (header assente; corpo non a tavolozza), composito
  (nube scavalcata, assente ≠ senza neve, ordine dei passaggi), riassunto per il
  pannello (un 404 non accende `partial`; 404 ovunque → `error`, non `nodata`), finestra
  «3 giorni con dati» (al mattino, senza passaggi di oggi, si parte da ieri), popup.
- **Per mutazione** (rompere di proposito e vedere un test rosso): la regola
  dell'header, il «passa oltre la nube», e il fatto che un passaggio assente non diventi
  «senza neve».
- **Playwright**: GIBS finto con le fixture. Si controllano i pixel del canvas (neve
  colorata, velo sulle nubi) e il testo del pannello; una risposta «nessun dato» con
  corpo di rumore **non** deve lasciare segni sulla mappa. Poi `npm run test:e2e:webkit`
  (`DecompressionStream`).
- **Sui dati veri**: app aperta sull'Abruzzo con GIBS vero; i conteggi sulle quattro cime
  (pressione lunga, o una sonda) devono tornare con `neve-satellite.py composito` dello
  stesso giorno.
- `npm run check` verde.

## Fuori perimetro

- **Avviso «possibile neve sul percorso»**: il lavoro successivo, già chiesto
  dall'utente. Nota per allora: le mattonelle di quota Terrarium
  (`s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`) sono aperte, con
  CORS `*`, **sulla stessa griglia**. A 450 m una frase «neve da X m in su» va detta con
  prudenza: il 12-14/10 la neve copriva il 19% dei pixel sopra i 2000 m.
- **Sentinel-2 a 20 m** (Earth Search, aperto): è l'unica fonte che vede bene la neve
  sottile, ma passa ogni 2-3 giorni. Progetto a parte, se servirà.
- **Valanghe e terremoti in cache**: anche `/api/avalanche` (cache `apis` di Serwist,
  24 h) e `webservices.ingv.it` (acchiappatutto, 1 h) mancano dalle regole
  `NetworkOnly`. Correzione piccola, separata da questa.
- **Filtri anti-pixel spuri**: decisi «nessuno» (vedi Decisioni).

## Lasciato al costruttore

L'integrazione del `GridLayer` con react-leaflet, la risoluzione del canvas sugli schermi
ad alta densità, la dimensione della cache in memoria, il meccanismo del timer orario,
come estendere `EmergencyFeatureInfo` ai layer non WMS, i nomi dei file. Rilascio come
**v0.33.0** (funzione nuova), con `CHANGELOG.md`, la riga del layer neve nel
`CLAUDE.md` e la KB aggiornati.
