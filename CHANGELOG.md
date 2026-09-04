# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il progetto adotta [Semantic Versioning](https://semver.org/lang/it/).

## [0.22.1] — 2026-09-04 — L'anello della bussola è un compasso

### Changed
- **Un anello solo, di raggio pari alla distanza del punto mirato.** La v0.22.0 ne
  disegnava tre, fissi, a distanze tonde (500 m, 1 km, 1,5 km): non era la cosa chiesta e
  nemmeno la più utile. Ora il raggio **è** la distanza misurata, quindi spostando la mappa
  l'anello si apre e si chiude insieme al mirino — come un compasso che si allarga fino al
  bersaglio. Il cerchio passa esattamente per il mirino, e dice quello che nessun numero
  dice da solo: *tutto ciò che sta su questo cerchio è lontano quanto ciò che stai
  puntando*. Quella cima è dentro o fuori? Si guarda, non si calcola.
- **Nessuna etichetta sull'anello**: la distanza sta già nel pannello in basso, sempre a
  schermo. Due copie dello stesso numero sono due occasioni di scriverlo in modi diversi —
  ed è successo, in questo progetto, cinquantacinque volte.
- A distanza nulla l'anello non si disegna: all'accensione bersaglio e posizione
  coincidono, e un cerchio di raggio zero sarebbe un punto sporco sotto il mirino. Nasce
  chiuso e si apre spostando la mappa.

### Removed
- `lib/anelli-distanza.ts` (la scala 1-2-5), `AnelliDistanza` e i loro test: con un anello
  che segue il bersaglio non serve scegliere raggi tondi. Codice morto con i suoi test è
  peggio che non averlo scritto.

### Test
- 1834 unità, 32 end-to-end, 4 offline. Il test dell'anello verifica **l'accoppiamento**
  (il raggio disegnato è la distanza misurata), non la presenza di un cerchio: verificato
  per mutazione — con un raggio fisso al posto della distanza, diventa rosso.
- Misurato a schermo su build di produzione: 262 m dopo uno spostamento, 587 m dopo tre,
  con l'anello che passa per il mirino.

## [0.22.0] — 2026-09-03 — Il punto «dove sono», gli anelli di distanza, e i simboli che si vedono

### Added
- **Il punto della propria posizione sulla mappa.** Mancava: lo store della posizione
  esisteva dalla v0.11.5 e lo alimentavano già l'avvio e il tasto «La mia posizione», ma
  nessuno lo **disegnava** — si concedeva il permesso, la mappa volava lì, e sul posto non
  c'era niente. Ora c'è il punto (anello bianco, cuore blu) e il cerchio dell'incertezza,
  che si tace quando l'incertezza supera i 2 km: un cerchio da chilometri copre mezza
  mappa e non dice niente, mentre il punto continua a dire «più o meno qui».
  **Non chiede mai la posizione**: legge dallo store, che è la stessa garanzia strutturale
  dell'avviso allerte.
- **Gli anelli di distanza** attorno a dove sei, con la bussola accesa: tre cerchi
  concentrici con la loro etichetta. La bussola dà **una** distanza, quella del bersaglio;
  gli anelli la danno per tutto quello che si vede — «quella cima è appena oltre il
  secondo anello» diventa un numero senza misurare niente, ed è il mestiere che questa app
  insegna. I raggi vengono da una scala **1-2-5** (100, 200, 500 m, 1, 2, 5 km…) scelta in
  modo che tre anelli stiano nella vista: un anello a 337 m non si ricorda, e uno fuori
  schermo non si vede.

### Fixed
- **I punti della bussola restavano sulla mappa dopo averla spenta.** Segnalato, e vero:
  i due marker erano creati *imperativamente* (`L.marker(...).addTo(map)`) dentro un hook
  che gira a ogni render — anche a strumento spento, perché gli hook stanno **prima**
  dell'uscita anticipata. Misurato nel browser: le due croci erano attaccate alla mappa
  **già prima** di accendere la bussola, e spegnendola non venivano rimosse ma spostate a
  (0,0). Ora si dichiarano nel render, come fa il righello: escono di scena col
  componente, senza che nessuno debba ricordarsene.
- **I simboli si vedevano poco.** Segnalato. La croce di prima era due linee da 2 px sopra
  una mappa escursionistica piena di sentieri arancioni e rossi. Ora ogni simbolo ha il
  **contorno bianco** e l'ombra — il modo in cui i simboli delle carte restano leggibili su
  qualunque fondo, non un vezzo: mirino della bussola 28 px (da 20), capi del righello
  18 px (da 14) con la lettera che ora si legge, e le due linee tracciate due volte,
  bianca sotto e colorata sopra.
- **«Dove sono» era disegnato in due modi diversi.** La bussola aveva un suo marker verde,
  e passando da uno strumento all'altro lo stesso posto cambiava simbolo. Ora la bussola
  **pubblica** ogni fix nello store e il punto lo disegna un solo componente: un posto, un
  simbolo — e la posizione resta anche dopo aver spento lo strumento, perché è la tua, non
  un dettaglio della bussola.
- Il mirino sta **sopra** il punto della posizione: all'accensione il bersaglio è il centro
  della mappa, che dopo il volo coincide con dove sei, e con il mirino sotto sembrava che
  accendere la bussola non avesse fatto niente.

### Fixed — dalla review prima del rilascio

Metodo di questo giro: **la vita della cosa nel tempo e in combinazione**, che è l'angolo
che i giri precedenti non coprivano.

- **Un punto vecchio diceva «sei qui».** Difetto mio, introdotto lo stesso giorno: il
  campo `at` dello store esisteva dalla v0.11.5 ed era **scritto e letto da nessuno** — la
  famiglia di `slim` e del livello utente — quindi il punto restava alle coordinate
  dell'ultimo rilevamento per sempre. Chi concede la posizione all'imbocco del sentiero
  alle 9 e cammina due ore si ritrovava disegnato al parcheggio, e un punto su una mappa
  si legge «sei qui, **adesso**». Ora: pieno finché è attuale (sotto i 5 minuti, che a
  passo d'uomo sono già 400-500 m), **vuoto** quando è vecchio, il nome accessibile dice
  sempre da quanto, e il cerchio dell'incertezza sparisce — dichiarare una precisione su
  un punto dove non sei più sono due affermazioni sbagliate invece di una. Non si
  cancella: «eri lì» è un'informazione vera.
- L'età si rivaluta da sola ogni minuto: senza un orologio, un punto rilevato adesso
  sarebbe rimasto «attuale» per tutta la sessione, cioè il difetto sarebbe tornato per la
  porta di servizio.

Misurato in questo giro: trascinando la mappa con bussola e anelli accesi, su **1819
fotogrammi** la mediana è **16,7 ms** (60 fps) e solo 2 fotogrammi passano i 33 ms — i nove
tracciati in più non costano niente. E i tre strumenti restano mutuamente esclusivi,
quindi i loro riquadri non si sovrappongono mai.

### Test
- 1843 unità (+32), 32 end-to-end, 4 offline. Nuovi: `anelli-distanza` (la scala 1-2-5 e
  le etichette all'italiana), `eta-posizione` (la soglia, il futuro che non diventa età
  negativa) e `StrumentiMappa` (bussola spenta che non disegna, punto della posizione che
  invecchia da solo, anelli).
- **Il finto Leaflet ora modella tre cose che prima ignorava**: `Circle` (raggio in metri,
  non in pixel), `map.distance` calcolata per davvero — un valore finto avrebbe reso verdi
  i test sugli anelli qualunque cosa facesse il codice — e il **contenuto delle icone**
  `DivIcon`. Quest'ultima è venuta da un controllo per mutazione: togliendo il mirino della
  bussola i test restavano verdi, perché contavano «almeno un marker» e i marker c'erano
  comunque — erano le etichette degli anelli. Ora ogni simbolo si riconosce dal suo nome
  accessibile.

## [0.21.1] — 2026-09-03 — I due modi si chiamano «Impara» e «Pianificazione»

### Changed
- **I due modi dell'itinerario si chiamano «Impara» e «Pianificazione»**, non più «Learn»
  e «Track». Cambiato in tutti gli otto punti dove arrivano all'utente: l'interruttore
  nell'Editor, l'illustrazione e il testo della guida, il riscontro dopo la scelta del
  livello, le impostazioni mappa e il pannello meteo.
- **Gli identificatori interni restano `learn` e `track`.** Sono scritti dentro ogni
  itinerario salvato (`appMode`) e nei campi paralleli `learnValues`/`trackValues`:
  cambiarli vorrebbe dire una migrazione dei dati per un'etichetta. Quello che l'utente
  legge e il nome che il dato porta con sé sono due cose separate, di proposito.
- **Il gruppo dell'interruttore ha un nome accessibile nuovo**: «Come si compilano i valori
  dell'itinerario» al posto di «Modalità app». L'utente vede due controlli che si chiamano
  entrambi *modalità* — il profilo («Modalità: Imparo») e questo — e a voce erano
  indistinguibili.

### Test
- 1811 unità (+5), 32 end-to-end, 4 offline. Nuovo `NomiDeiModi`: il rischio di una
  rinomina non è sbagliare i nomi, è **dimenticarne un pezzo**. Due testi su otto mi erano
  sfuggiti al primo giro e li hanno trovati per caso i test di altri componenti; ora il
  controllo è esplicito e scorre tutti i passi della guida.
- La prima versione di quel guardiano **non funzionava**: cercava `Track` col confine di
  parola, ma `textContent` incolla i testi adiacenti (`ImparaTrack`), quindi il confine fra
  `a` e `T` non esiste e la parola vecchia non veniva trovata — un test che certificava
  esattamente il difetto che esiste per impedire. Trovato rimettendo il nome vecchio su un
  bottone: passava. Ora la ricerca è senza confini, e con la stessa prova falliscono due
  test su cinque.

## [0.21.0] — 2026-09-03 — Neve, valanghe e terremoti (layer di emergenza, fase 2)

I tre layer stagionali che mancavano, più la decisione di non fare il quarto. Le fonti
erano già validate nell'appendice del progetto, ma **otto verifiche su otto hanno cambiato
l'implementazione**: il dettaglio in `backlog/tasks/task-51`.

### Added
- **Pericolo valanghe**, scala europea 1-5 per micro-regione, da EAWS (Alpi per regione più
  Meteomont per gli Appennini). I colori sono **letti dal CSS dell'app che pubblica i
  bollettini**, non ricordati; il popup dice il nome italiano della zona, il pericolo, la
  differenza fra alta e bassa quota, il giorno del bollettino e che **vale per la zona, non
  per il singolo pendio**. Si interroga sull'area inquadrata, come i ripari.
- **Copertura nevosa** da NASA GIBS (indice MODIS NDSI), un passaggio al giorno. Il
  pannello dichiara **di che giorno** è l'immagine, e la descrizione dice la cosa
  controintuitiva: dove non c'è colore può esserci una nuvola, perché il satellite non vede
  sotto le nubi.
- **Terremoti delle ultime 48 ore** dall'INGV, da magnitudo 2. Colore per magnitudo, popup
  con profondità e orario in ora italiana. Una zona che si muove è una zona dove i sentieri
  possono essere interrotti.
- Due categorie nuove nel pannello (**Neve e valanghe**, **Terremoti**), che il registro
  della fase 1 ha assorbito senza modifiche strutturali.

### Fixed
- **`/api/avalanche`, e il motivo per cui esiste.** Le geometrie delle micro-regioni
  italiane pesano **4,85 MB** e il server che le pubblica non comprime (verificato
  chiedendo con `--compressed`): dal telefono non si scaricano. Non basta nemmeno prendere
  "solo la regione che serve", perché il rettangolo di `IT-MeteoMont` copre l'Italia
  intera, isole comprese. La route le tiene in memoria, **ritaglia sulla vista** e
  semplifica in base allo zoom: al client arrivano **31-106 KB** invece di 4,85 MB,
  misurati contro il servizio vero con una data in stagione.
- **Fuori stagione l'app diceva che c'era un bollettino.** Misurato il 03/09: le otto
  regioni alpine rispondono 404, ma Meteomont pubblica ogni giorno le sue 39 zone **tutte a
  `0`** — che nell'aggregato EAWS vuol dire *nessuna valutazione*, non *nessun pericolo*.
  La prima versione dipingeva 39 poligoni grigi sull'Appennino annunciando «Bollettino del
  03/09/2026». Ora le zone a zero non si disegnano e un bollettino di soli zeri non è un
  bollettino.
- **Un guasto non è "fuori stagione".** Il primo `catch` trattava allo stesso modo un 404 e
  una rete interrotta, quindi senza connessione il pannello avrebbe dichiarato «nessun
  bollettino: fuori stagione» **a gennaio** — un guasto travestito da buona notizia, e chi
  legge "fuori stagione" non riprova. Ora: 404 = assenza, tutto il resto = errore; e se una
  regione su nove cade, il resto si mostra **dichiarando** che è incompleto.
- **Gli orari INGV non hanno il fuso** (`"2026-09-02T23:46:59.485000"`): sono UTC per
  standard, ma letti come ora locale sarebbero due ore di errore in estate, sempre nella
  direzione di far sembrare la scossa più recente. E il servizio è **mondiale**: la prima
  risposta conteneva un evento nelle Isole Sandwich Australi, quindi si chiede l'Italia.
- **GIBS vuole `{y}` prima di `{x}`**: con l'ordine scambiato le mattonelle arrivano tutte,
  200 e PNG validi, ma di un altro posto. Il tile di oggi risponde **404** finché il
  satellite non passa: il ripiego al giorno prima è servito il primo giorno, e il pannello
  dice quale giorno sta mostrando.
- Il tocco su un terremoto **non crea un waypoint**: `bubblingMouseEvents: false` dall'inizio,
  verificato sulla mappa vera (marker prima 4, dopo 4). È il difetto della v0.11.1, che
  allora finì in produzione.

### Changed
- **GDACS scartato, con misura**: 12 eventi in tutto il mondo in 30 giorni, **zero in
  Italia**. La soglia è globale, e per l'Italia FIRMS, DPC e INGV sono più sensibili di tre
  ordini di grandezza. Un layer che non mostra mai nulla insegna solo a diffidere del
  pannello.
- Le nuove voci del registro portano `kind` propri (`avalanche`, `xyz`, `quakes`): il
  `kind` dice **quale renderer** montare, e infilare i terremoti sotto `points` avrebbe
  richiesto un secondo criterio dentro il dispatch.
- Il guardiano della Data Cache copre anche il proxy valanghe, e il marcatore
  `cache-immutabile-ok:` distingue i confini amministrativi (statici) dal bollettino
  (vivo).

### Fixed — dai tre giri di review prima del rilascio

Quattro giri con quattro metodi diversi (il codice contro il catalogo dei difetti già
ripetuti; lo schermo; gli invarianti con ingressi ostili; il diff riletto da estraneo, col
costo misurato e le giunzioni provate), perché più giri con lo stesso metodo guardano più
volte la stessa cosa. **Dodici difetti**, tutti miei, tutti in codice non ancora
rilasciato.

- **Le zone valanghe restavano quelle di prima, ricolorate coi pericoli nuove.** Il più
  grave. `react-leaflet` passa `data` a Leaflet **solo quando crea** il layer (la sua
  funzione di aggiornamento tocca soltanto `style`), quindi tutto dipende dalla `key` — e
  la mia era `data-numeroZone-primoId`, che fra due viste diverse con lo stesso numero di
  zone e lo stesso primo id **coincide**: cosa normale pannando dentro la stessa regione.
  Risultato: poligoni vecchi con lo stile nuovo, cioè un livello di pericolo sbagliato su
  un'area sbagliata. Ora la chiave è un'**impronta del contenuto** (`improntaZone`), e il
  finto `GeoJSON` dei test congela `data` alla creazione **come fa Leaflet**, così questa
  classe di difetti non è più perdonata dai test.
- **«Riprova» sulla copertura nevosa restava in «Caricamento…» per sempre**: il componente
  non si rimontava, nessun effetto ripartiva, lo stato non tornava mai da `loading`. È
  identico al difetto dei layer WMS, corretto allora con `retryTick`, che non avevo
  previsto per il kind nuovo.
- **Il flag `ultimoTentativo` era scritto e riletto da nessuno** — la classe di `slim` e
  del livello utente. La conseguenza vera: esaurito l'elenco dei giorni, il layer restava
  `ready` con la mappa vuota, cioè assenza di dati indistinguibile da «niente neve». Ora
  dichiara «Nessuna immagine disponibile negli ultimi giorni».
- **Il messaggio «dati parziali» diceva il falso** su due layer: per i terremoti significa
  elenco tagliato al tetto di 300, per le valanghe una regione su nove che non ha
  risposto. Tre cause, tre frasi.
- **`maxDangerRatings` come array produceva zone finte**: `typeof [] === 'object'`, quindi
  un formato cambiato diventava tre zone con id "0", "1", "2" e il pannello dichiarava
  tre zone valutate. Ora è un errore.
- **Chiavi vuote diventavano zone** senza id, non disegnabili né spiegabili.
- **Un vertice `Infinity` rendeva infinito il rettangolo** di una zona, e un rettangolo
  infinito si sovrappone a tutto: una geometria rotta avrebbe fatto disegnare la sua zona
  su qualunque vista. Ora si accettano solo coordinate finite e dentro il mondo.
- **Epicentri fuori dal mondo** (lat 200, lon 400) venivano disegnati da qualche parte:
  un epicentro inventato è peggio di un epicentro mancante.
- **Due eventi con lo stesso `eventId`** producevano due chiavi React identiche — il
  difetto che i focolai hanno già pagato con `pointKey`. Ora l'id resta quello dell'INGV
  (non lo falsifichiamo) e la chiave per disegnare la costruisce chi disegna.
- **Due richieste contemporanee scaricavano due volte i confini** (2,5 MB a testa per
  l'Appennino, da un servizio gratuito): il client fa da tampone, ma due schede aperte lo
  scavalcano. Ora le richieste in volo si condividono.
- Più due irrigidimenti: un **tetto sull'area** che la route accetta di servire (5 gradi
  di lato; il client non chiede mai tanto, quindi una richiesta più grande è un errore
  nostro da far vedere) e l'**etichetta del giorno buttata col layer**, come gli altri
  payload.

#### Quarto giro: il diff letto da estraneo, il costo misurato, le giunzioni provate

- **«Butta l'etichetta di questo layer» buttava quella di tutti.** `xyzGiorno: {}` azzerava
  la mappa intera invece della sola chiave, e la condizione era agganciata a un id scritto
  a mano invece che al kind: oggi non si vedeva (di layer a mattonelle con data ce n'è uno)
  ma il campo è indicizzato per layer proprio perché ce ne saranno altri, e il secondo si
  sarebbe spento insieme al primo. Il commento diceva una cosa, il codice un'altra.
- **«Il bollettino c'è ma non riusciamo a disegnarlo» era indistinguibile da «qui non ci
  sono aree valanghive».** Sono la stessa immagine — una mappa senza colori — e
  significano l'opposto. I servizi valanghe ridisegnano le micro-regioni fra una stagione
  e l'altra: se gli id smettono di combaciare, un inverno intero di bollettini resta
  invisibile mentre il pannello dice che non c'è niente da vedere. Ora il caso si
  riconosce (`joinBroken`) e si dichiara come errore, col «Riprova» accanto — e tre test
  coprono i casi legittimi che **non** devono suonare l'allarme.
- **Il costo in memoria era dichiarato «accettabile» senza un numero.** Misurato:
  **+12,5 MB** di heap per una vista dolomitica (che carica anche l'Appennino, il file
  grosso), **+13,7 MB** con tutte e nove le regioni in cache. Ora il commento dice il
  numero.
- Ripulita una doppia chiamata a `regioniPerBbox` per la stessa vista.

Misurato sulla mappa vera in questo giro: **cinque spostamenti consecutivi, due
richieste** — la guardia dell'area già coperta funziona come progettata, e non era mai
stata osservata.

Verificato a schermo nel terzo giro: la soglia di zoom che parla («avvicinati per vedere
le zone valanghe»), i dieci layer accesi insieme senza errori in console, la neve a zoom
13 che chiede mattonelle z8 e le stira (8192 px da 256 nativi), le attribuzioni che vanno
e vengono coi layer, l'aspetto **in stagione** con i colori 1/3/5 e il bordo nero del
livello 5, il popup completo, e il contrasto delle righe nuove: 9,85:1 nel tema chiaro,
12,04:1 nello scuro.

### Test
- 1806 unità (+130), 32 end-to-end, 4 offline. Nuovi: `valanghe`, `valanghe-proxy`,
  `terremoti`, `neve`, `fase2-invarianti`, `LayerFase2`. I due finti di Leaflet ora
  modellano quello che Leaflet fa davvero: il `TileLayer` espone i gestori degli eventi
  (così il ripiego al giorno prima è verificabile facendo scattare `tileerror`) e il
  `GeoJSON` congela `data` alla creazione.

## [0.20.0] — 2026-09-02 — Radar che non lampeggia, cielo per ogni waypoint

Tre segnalazioni, e due difetti trovati per strada mentre le verificavo — uno dei quali
faceva perdere il lavoro salvato.

### Added
- **I comandi del radar sono sulla mappa**, in basso, quando il layer è accesso: play,
  cursore dei fotogrammi, orario, e la riga che dice che è **pioggia già caduta**. Prima
  stavano solo nel pannello dei layer: si accendeva il radar, si chiudeva il pannello per
  guardare la mappa, e da quel momento la pioggia si muoveva senza che niente dicesse che
  era un'animazione, di che ora, né come fermarla. Restano anche nel pannello, dove si
  sceglie cosa vedere.
- **L'iconcina del cielo per ogni waypoint**, con la parola e la temperatura di quell'ora,
  in «Quando partire». Il codice meteo c'era già — serviva a riconoscere i temporali — e non
  arrivava mai a schermo: si vedevano tre colonne di numeri e il cielo bisognava
  immaginarselo. Sotto la tabella, una legenda con **le sole icone presenti** (al tocco non
  esiste nessun `title` da leggere). Un codice che non si conosce si scrive `n/d`, non lo si
  disegna sereno.

### Fixed
- **La pioggia non lampeggia più fra un fotogramma e l'altro.** Il layer veniva
  *rimontato* a ogni fotogramma — altrimenti Leaflet riusava i tile in cache e l'animazione
  restava ferma — ma rimontare toglie lo strato vecchio *prima* che il nuovo abbia
  scaricato, e fra i due a schermo non c'era niente. Ora sono **due strati**: uno si vede,
  sull'altro si carica il successivo, e si scambiano quando è pronto. Le regole stanno in
  `lib/radar-anim.ts`, senza Leaflet. MISURATO su pioggia vera (96 tile, 7 secondi di
  animazione, build di produzione): **zero istanti su 70 senza pioggia a schermo**, fra
  52.000 e 73.000 pixel di pioggia sempre presenti.
- **Il layer dell'instabilità non spariva più cambiando zoom.** Da zoom 11 in su il
  servizio EUMETSAT restituisce un PNG valido e **completamente trasparente** (misurato sui
  pixel: 100% opaco a z6-z8, 86% a z9, 14% a z10, 0% da z11). Ora `maxNativeZoom: 8`: si
  chiedono le immagini che esistono e si ingrandiscono, sfocate ma vere.
- **La previsione si chiede alla quota dei punti.** MISURATO su Cima delle Murelle
  (2596 m): la maglia del modello sta a **1257 m**, e senza dichiarare la quota Open-Meteo
  risponde 26,1 gradi contro 19,5, con raffiche a 47,5 km/h invece di 40,3 — il meteo del
  fondovalle presentato come quello di vetta, per tutti e tre i dati che il pannello mostra.
  Ora l'app manda le quote che l'utente ha scritto. Quando non le ha tutte non si possono
  mandare (il servizio pretende una lista completa) e allora **lo dichiara**, con lo scarto
  in metri, invece di far finta.
- **Il lavoro salvato non si cancella più da solo.** Salvare uno stato **vuoto** cancellava
  l'itinerario in lavorazione, e l'autosalvataggio salva anche quando la pagina viene
  nascosta: bastava aprire l'app in una seconda scheda — che parte sempre vuota, perché il
  ripristino avviene dopo — e cambiare scheda, per far sparire il lavoro salvato dalla
  prima. Al riavvio non tornava niente, che è esattamente il difetto per cui la v0.11.8
  esiste. Ora cancellare è un **gesto** (Nuovo, il cestino), non uno stato: `saveCurrent`
  non cancella più, e chi vuole cancellare chiama `clearCurrent`.
- **La barra dei comandi del radar copriva altri comandi.** Alla prima stesura il bordo
  sinistro finiva sopra il pulsante tondo degli strumenti e la didascalia tagliava la riga
  delle attribuzioni. Visto guardando lo schermo; da qui in avanti lo vede
  `e2e/radar-comandi.spec.ts`.
- **La legenda del cielo ha un nome accessibile.** Le icone sono `aria-hidden`, quindi per
  chi non vede era una filza di parole senza appiglio.

### Changed
- **Gli scenari end-to-end non registrano più il service worker.** Le risposte finte
  valgono solo per le richieste che passano dalla pagina: quelle che passano dal service
  worker non le vede `page.route`. In sviluppo il service worker non c'è e non si notava,
  ma con un server di produzione in ascolto sulla stessa porta gli stub smettevano di
  valere **in silenzio** e i test interrogavano i servizi veri. Il comportamento offline si
  prova con `playwright.offline.config.ts`, che il service worker lo pretende.
- Il finto `TileLayer` dei test ora modella le due cose che l'animazione usa davvero —
  l'opacità cambiata a mano sull'oggetto Leaflet e l'evento `load`. Un layer che non dice
  mai di aver caricato metteva il codice davanti a uno scenario impossibile e nascondeva
  l'unico comportamento che conta: che a schermo ci sia sempre pioggia.

### Test
- 1676 unità (+52), 32 end-to-end (+10), 4 offline. Nuovi: `radar-anim`, `cielo`,
  `e2e/radar-comandi`, `e2e/meteo-percorso`, più i casi sull'autosalvataggio e sulla quota.

## [0.19.2] — 2026-09-02 — Consolidamento: tre round di review

Tre giri sul lavoro delle 0.19.x, ognuno con un metodo diverso — il codice, lo schermo, gli
invarianti — perché tre giri con lo stesso metodo guardano tre volte la stessa cosa.

### Fixed
- **Due pannelli, due scaricamenti.** `useTessereOffline` condivideva il *calcolo* ma non lo
  *stato*: un `useState` per componente. Con l'editor e le impostazioni mappa montati
  insieme (aprire il dialogo non smonta l'editor) il pannello mostrava «Scarica per l'uso
  senza rete» mentre l'editor stava scaricando, e premendolo partiva un **secondo**
  scaricamento in parallelo — il doppio del traffico su servizi gratuiti, che è la cosa che
  quel codice dichiara di volere evitare. E «libera» restava attivo, quindi si poteva
  svuotare la cache a metà. È la stessa lezione di prima applicata allo stato: due copie
  della stessa verità divergono.
- **«Spazio non interrogabile su questo browser» per un secondo intero, a ogni apertura.**
  `null` voleva dire due cose — «non lo so ancora» e «non si può sapere» — e il pannello
  mostrava il messaggio definitivo anche per lo stato transitorio. Ora sono tre stati.
- **Leggere il peso di 168 mattonelle costava 1.197 ms**, misurati; col tetto pieno sarebbero
  stati sette secondi. Ora si leggono al massimo cento intestazioni, distribuite fra le
  cache in proporzione, e si scala: nel caso comune il campione **è** tutto e il numero è
  esatto, oltre è dichiarato approssimato.
- **«Ripari non disponibili» diceva la cosa sbagliata** quando le istanze rispondono ma
  nessuna ha un database: mandava a controllare la connessione, l'unica cosa che in quel
  caso sicuramente funziona. Tre motivi, tre messaggi, e nessuno dei tre dice «non ci sono
  ripari» — che è la cosa che non sappiamo.
- **L'avviso sopra i 400 km² non era più vero.** Diceva che l'area sarebbe stata coperta
  «solo alle scale più larghe», che valeva col rettangolo e non col corridoio. Rimosso
  insieme alla sua costante, invece di lasciarlo a mentire. E il messaggio del tetto ora
  parla del **percorso troppo lungo**, non dell'area troppo grande.

### Changed
- `quanteTessere` è stata rimossa: col corridoio non la chiamava più nessuno e sopravviveva
  solo nei propri test. `tessereNelRettangolo` resta come **termine di paragone**, ed è
  detto: il test che pretende che il corridoio chieda molte meno mattonelle è ciò che
  dimostra perché il corridoio esiste.
- Le due scansioni del codice in `tema.test.ts` ora **contano i file visitati**: un
  `toEqual([])` su un elenco che nessuno ha popolato passa felice, e sarebbe una guardia
  verde e cieca proprio per la classe di difetto che esiste per fermare. Verificato per
  mutazione: rompendo la ricerca, cadono.
- Via un ramo di testo irraggiungibile nella tendina degli export (il pulsante che la apre è
  spento alla stessa condizione), e detto nel test che il filtro sullo zoom dei sentieri oggi
  **non scatta** — serve al giorno in cui `ZOOM_MASSIMO` verrà alzato.

### Verificato, non dedotto
- **Il corridoio non ha buchi**: 2.515 punti campionati lungo il percorso caricato, ai
  cinque zoom, tutti coperti. Un buco sarebbe un pezzo di sentiero senza mappa.
- L'ordine delle coordinate della geometria dei sentieri (`[lat, lon]`, non `[lon, lat]`) è
  protetto da un test — verificato per mutazione, perché scambiarlo scaricherebbe in
  silenzio le mattonelle di un altro emisfero.
- La tendina degli export sta dentro lo schermo anche a 1280 px, con tutte e quattro le voci
  leggibili.

## [0.19.1] — 2026-09-02 — Megabyte, non gigabyte

Segnalato: «mi sembra che stia salvando troppi dati, sia il numero di tile sembra eccessivo
ma anche lo spazio occupato parla di giga scaricati in pochi secondi; non capisco se è
sbagliata la stima o se sta scaricando tantissimo». Entrambe le cose, e per due ragioni
diverse.

### Fixed
- **Il browser addebitava 7,3 MB di quota per ogni mattonella da 20 kB.** Le mattonelle si
  chiedevano `no-cors`, come fa Leaflet coi suoi `<img>`, e la risposta che ne torna è
  **opaca**: il browser la conta in quota con un riempimento enorme, apposta, perché il peso
  di un'immagine di un altro sito non trapeli. Misurato su Chrome, venti mattonelle per
  volta: **7.688.466 byte addebitati** per una risposta opaca contro **1.907** per la stessa
  chiesta in CORS — un fattore quattromila, per gli stessi byte sulla rete.

  Quindi: **non stava scaricando giga** (168 mattonelle sono 2,7 MB veri), ma il browser
  gliene *tratteneva* 1,2 GB. Ora le richieste sono in CORS — tutti e cinque i servizi che
  l'app usa rispondono `access-control-allow-origin: *`, verificato — e il service worker
  riscrive in CORS anche le richieste dei tag `<img>`, così valgono le mattonelle
  pre-caricate **e** quelle prese navigando. Misurato sulla build di produzione: la quota
  addebitata per lo stesso scaricamento è passata da ~1,2 GB a **2,89 MB**, cioè al peso
  vero.
- **Le mattonelle erano davvero troppe: si copriva il rettangolo, non il percorso.** Un
  itinerario in diagonale sta in un rettangolo che è per metà terreno che non si
  attraversa. Ora si scarica un **corridoio** lungo il tracciato, con un anello di margine
  (≈450 m allo zoom più fine), seguendo la geometria vera dei sentieri quando c'è. Misurato
  sugli zoom 12-16: una diagonale di 8 km da 611 mattonelle a 219, un percorso a L da 843 a
  240, una **traversata di 25 km da 5.372 a 558**. Su quest'ultima non era solo spreco: col
  rettangolo il tetto di cinquecento si esauriva allo zoom 13 e si tornava con una mappa
  sfocata; col corridoio ci sta tutto il percorso alla scala che serve per camminare.
- **Una mattonella che il server non ha, ora si vede.** Con le risposte opache lo stato non
  era leggibile e un 404 risultava «scaricata»: in quota si trovava un buco grigio senza
  preavviso.

### Changed
- Il pannello **legge** il peso invece di stimarlo: `Content-Length` è fra le intestazioni
  accessibili di una risposta CORS e coincide al byte col contenuto. Le due stime precedenti
  erano entrambe sbagliate — «circa 15 kB» dette a naso, e poi il conteggio della quota che
  riportava il riempimento delle risposte opache.
- La stima *preventiva* usa 25 kB per mattonella, misurato su due scaricamenti veri (16,9 e
  23,2 kB di media). Con i 60 kB dei campioni singoli il pannello annunciava «circa 9,8 MB»
  per uno scaricamento da 2,7: un numero che non somiglia alla realtà, cioè il difetto da
  cui questa faccenda è partita.

### Added
- Uno scenario che pretende **zero risposte opache** nelle cache delle mattonelle e un peso
  medio nell'ordine delle decine di kilobyte. È l'invariante che costa gigabyte quando si
  rompe, ed è invisibile: una risposta opaca funziona — la mappa si vede, offline compresa —
  e intanto la quota si riempie. Verificato per mutazione: tornando a `no-cors`, cade.

## [0.19.0] — 2026-09-02 — Il percorso finisce con «quando partire»

### Fixed
- **I rifugi e i bivacchi non comparivano.** Segnalato: il Bivacco Carlo Fusco, sotto Cima
  delle Murelle sulla Maiella, non c'era. Verificato che query e parser erano giusti — il
  bivacco è in OpenStreetMap come *way* con `amenity=shelter`, e l'app lo prende. Il guasto
  era a monte: l'app **ricorda sul dispositivo la porta Overpass che ha funzionato**, e il
  mirror imparato il 31 agosto nel frattempo si è svuotato — risponde `HTTP 200` con
  `elements: []` per qualunque parte del mondo. Un successo vuoto è indistinguibile da «qui
  non ci sono ripari», quindi il layer dichiarava con sicurezza che non c'era nulla. Ora una
  risposta il cui database non dichiara una data plausibile non si accetta e la sua porta non
  si ricorda: verificato sulla rete vera, partendo dallo stato guasto, e i ripari sono
  quattro dove prima erano zero.
- **Un bivacco non è un ricovero.** `shelter_type=basic_hut` in OpenStreetMap indica un
  locale in cui si dorme; l'app lo ignorava e mostrava «Ricovero», che nella legenda è una
  tettoia. In quota la differenza fra «qui mi riparo dalla pioggia» e «qui ci passo la
  notte» è la decisione.

### Changed
- **Il pulsante «Meteo» è diventato «Quando partire»**, in evidenza e staccato dagli export.
  Non era un widget meteo: il pannello incrocia i waypoint con gli orari di Munter e dice a
  che ora sei in ogni punto e che tempo trovi lì a quell'ora. Chiamarlo «Meteo» lo faceva
  passare per una pastiglia fra cinque uguali, e la funzione che decide *se e quando andare*
  non è una pastiglia.
- **Un solo «Esporta».** I due PDF erano pulsanti a tutta larghezza accanto a una tendina che
  già esisteva per gli altri formati: tre controlli per la stessa idea, e i due più grossi
  per i formati che si usano meno. Ora PDF, GPX e KML stanno in un posto, ognuno con scritto
  sotto a cosa serve. Da cinque pastiglie a tre.

### Added
- **«📥 Mappa offline» nell'editor**: scarica le mattonelle del percorso appena disegnato,
  senza passare dalle impostazioni. Il gesto appartiene al percorso, non alle impostazioni —
  chi finisce di disegnarlo è lì. Sotto, un promemoria che dice **quante** sono: «scarica le
  mappe» senza un numero non aiuta a decidere se sia il momento, e in quota si arriva senza
  aver deciso.
- Le mattonelle **non si scaricano mai da sé**: nessun effetto, nessun timer, nessuna soglia.
  Arrivano da servizi che ce le regalano, e un'app che le prende di sua iniziativa spende la
  banda di qualcun altro senza che nessuno l'abbia chiesto. C'è un test che monta l'editor con
  un percorso pronto e pretende zero richieste.
- **Abbandonando il percorso si liberano anche le sue mattonelle** — «Nuovo» e «cancella
  tutti i waypoint» — e la conferma lo dice prima. Cancellare solo l'ultimo waypoint non le
  tocca: il percorso c'è ancora.

## [0.18.3] — 2026-09-02 — Cinque punti illeggibili nel tema chiaro

### Fixed
- **I popup della mappa erano illeggibili nel tema chiaro** (TASK-63). Leaflet dà loro un
  fondo bianco per la sua CSS, ma il tema chiaro funziona **rovesciando la scala grigia**:
  un fondo che non si rovescia sotto colori che si rovesciano regge in un tema e crolla
  nell'altro. Misurato: il testo secondario dei popup faceva 7,56:1 nel tema scuro e
  **1,54:1** nel chiaro. Ora i popup hanno il fondo dell'app e sono pannelli come gli altri.
- Cercando la radice è emerso che lo stesso difetto era in **cinque punti**, non uno. Nel
  tema chiaro erano invisibili: il **toast di avviso** (1,13:1), l'errore della **bussola**
  e quello della **posizione** (1,05:1), l'avviso del **meteo** (2,23:1). Il toast di avviso
  era rotto e i suoi fratelli identici stavano bene per un caso — `amber-100` è fra i colori
  che seguono il tema, `green-100` e `red-100` no.

### Added
- **Il contrasto si misura sul DOM vero, nei due temi** (`e2e/contrasto.spec.ts`). Cinque
  scenari attraversano le viste e **aprono i popup**, chiedendo a ogni elemento con testo il
  colore calcolato e il fondo composto — componendo l'opacità, perché `bg-black/20` sopra il
  verde non è nero. È l'audit che il 2026-09-02 ha trovato in dieci minuti quattro difetti
  invisibili a 1.500 test unitari e a Lighthouse 100, scritto una volta e poi tenuto.
- Un controllo che ricava dalla configurazione di Tailwind **quali tonalità cambiano fra i
  due temi**, e segnala chi le mescola con un fondo fisso: è la classe di difetto sopra, e
  finora si trovava un pezzo alla volta.

## [0.18.2] — 2026-09-02 — Testo che si legge, in tutti e due i temi

### Fixed
- **Contrasto sotto il minimo in tutto il tema scuro** (TASK-62). `text-gray-500` su
  `bg-gray-900` fa **3,67:1** dove ne servono 4,5, e stava in **96 punti su 33 file** —
  nessuno dei quali abbastanza grande da poter usare la soglia più bassa. Lighthouse dava
  100 perché guarda solo ciò che è a schermo durante l'esame, e quasi tutti quegli usi
  stanno in pannelli chiusi. Il tema chiaro non era interessato.
- Cercandoli sono venuti fuori difetti peggiori: **«Tendenza da 10 sessioni» e i segni di
  «nessun dato» a 1,94:1** nel pannello Progresso, il **segnaposto del campo email a
  2,35:1** (illeggibile in entrambi i temi), **tre maniglie di trascinamento a 2,35:1** —
  che sono componenti d'interfaccia e non superavano nemmeno il 3:1 — e il pulsante
  **«Ricarica» dell'avviso di aggiornamento a 4,28:1**, cioè la parte meno leggibile di un
  avviso che esiste per farsi leggere.

### Changed
- `tema.test.ts` non si fida più di un elenco scritto a mano: le classi di testo si
  **contano nel codice** e vengono misurate sui tre fondi su cui l'app scrive davvero
  (rilevati sul DOM: 44 elementi su `grigio-900`, 4 su `grigio-800`, 1 su `grigio-950`,
  **nessuno** su `grigio-700`). Un commento che avvertiva del problema c'era già, e non ha
  impedito la terza ricaduta: un commento non è un controllo.

## [0.18.1] — 2026-09-01 — Aprire l'app e vedere il proprio percorso

### Fixed
- **Al ripristino, la mappa non guardava l'itinerario** (TASK-61). Si scaricavano le
  mattonelle del proprio percorso e poi, riaprendo l'app, ci si trovava sul centro
  predefinito — Chieti — con il Gran Sasso cinquanta chilometri più in là. Con il GPS
  acceso non si notava; senza segnale e senza posizione, che è **la situazione per cui
  esiste il pre-caricamento**, bisognava trascinare la mappa a mano fino a incontrare il
  proprio percorso, attraversando aree mai scaricate. Ora un itinerario ripreso
  dall'autosalvataggio viene inquadrato all'apertura.
- La posizione sposta la mappa **solo se cade entro cinque chilometri dal percorso**. Chi
  prepara la gita da casa non viene più sbalzato via da un fix GPS che dice «Roma»; chi è
  al parcheggio dell'attacco continua a essere seguito come prima.

## [0.18.0] — 2026-09-01 — La mappa che resta quando il segnale se ne va

### Added
- **Pre-caricamento delle mattonelle per l'uso senza rete** (TASK-37). In Impostazioni
  mappa una nuova sezione calcola l'area dell'itinerario più un margine del 20%, dice
  quante mattonelle sono e fino a che zoom si arriva, e le scarica con una barra di
  avanzamento interrompibile. Zoom 12-16, tetto di 500 mattonelle per servizio — che non è
  una difesa dal nostro codice ma un patto con chi ci regala le mappe. Il numero dichiarato
  comprende i sentieri quando sono accesi, perché è quello che si scarica davvero. Con un
  waypoint solo si prende comunque un chilometro attorno, invece di una colonna larga
  quanto un punto. Lo spazio occupato si vede e si libera.
- **`npm run test:e2e:offline`**: uno scenario che costruisce per la produzione, scarica
  davvero le mattonelle e **spegne la rete**. Non usa l'emulazione «offline» del DevTools,
  che non raggiunge il service worker e regala un falso verde: ogni scenario comincia
  verificando che una URL mai vista fallisca sul serio, altrimenti si ferma.

### Fixed
- **La cache delle mattonelle non aveva mai funzionato.** Workbox rifiuta le risposte
  *opache* — quelle che tornano dalle immagini di altri siti, prive di stato leggibile —
  se non gli si dice esplicitamente di accettarle. Misurato su una build di produzione:
  ventiquattro mattonelle a schermo e nessuna cache `tiles-*` esistente. Da mesi la mappa
  non veniva conservata da nessuna parte, e non c'era test che potesse accorgersene perché
  il codice era scritto correttamente: era il browser a non fare ciò che sembrava
  chiedergli.
- **Un dialogo centrato più alto della finestra è in parte irraggiungibile.** Cresciute con
  la nuova sezione, le Impostazioni mappa sbordavano dallo schermo: un elemento centrato
  con flex che supera l'altezza della finestra esce **anche dal bordo superiore**, e da lì
  nessuno scorrimento lo riporta indietro. L'ultima riga risultava «visibile e stabile» e
  insieme «fuori dalla finestra». Sistemati tutti e tre i dialoghi che non avevano un tetto
  d'altezza (Impostazioni mappa, invito, salvataggio in libreria).

### Changed
- Le cache delle mattonelle sono ora **le prime a essere sacrificate** quando lo spazio del
  browser finisce (`purgeOnQuotaError`). Sono le uniche che si riottengono da sole: il
  guscio dell'app e i dati salvati no, e sono anche quelle che riempiono lo spazio.
- Il peso delle mappe conservate non si stima più: lo dichiara il browser. Le risposte
  opache vengono conteggiate con un forte arrotondamento in eccesso — **4,5 MB a
  mattonella misurati, contro i ~15 kB reali su disco** — quindi il pannello lo scrive
  esplicitamente e avvisa **prima** di scaricare se lo spazio concesso non basta, invece
  di lasciar fallire una scrittura a metà.

## [0.17.2] — 2026-09-01 — La classe che non esisteva

### Fixed
- **Il testo sopra i pulsanti colorati non aveva colore.** La correzione della v0.17.1
  introduceva una classe nuova, usata in venticinque punti, la cui definizione è però
  rimasta fuori dal pacchetto: la classe non generava nessuna regola, e quegli elementi
  ereditavano il colore di ciò che li conteneva — nel tema chiaro, testo scuro sopra un
  pulsante viola, che è esattamente il difetto che quella versione doveva risolvere.

  La variabile c'era, il test del contrasto era verde e il pacchetto si costruiva senza
  lamentarsi: mancava solo il ponte fra la classe che i componenti scrivono e il colore che
  il generatore di stili conosce. Ora un controllo verifica quel ponte, e ferma qualunque
  colore inventato che non sia dichiarato.

## [0.17.1] — 2026-09-01 — Tre correzioni dal consolidamento

Review del lavoro delle due versioni precedenti, cercando per prime le classi di difetto
che questo progetto ripete.

### Fixed
- **La guida non si poteva mandare via col dito, e non prendeva il fuoco.** Dichiarava il
  gesto di trascinamento ma non era collegata al proprio riquadro, quindi il gesto non
  aveva niente su cui lavorare — e chi usa la tastiera non arrivava al pannello appena
  aperto.

- **L'app lampeggiava a ogni avvio.** Il tema veniva applicato solo dopo il primo disegno:
  chi aveva scelto il chiaro vedeva un lampo scuro, chi ha il sistema scuro un lampo
  bianco. Il primo fotogramma non si corregge dopo, quindi adesso il tema si decide prima
  che la pagina venga dipinta.

- **Il testo bianco sopra i pulsanti colorati.** Nel tema chiaro il bianco si rovescia in
  quasi nero: giusto per il testo sulla pagina, sbagliato per la scritta di un pulsante
  viola o rosso, che il fondo se lo dipinge da sé. Corretto in venticinque punti.

  Aggiungendo la misura di questa famiglia di accoppiate sono venuti fuori difetti **più
  vecchi del tema**: la scritta bianca sul pulsante degli strumenti con la bussola attiva
  stava a 2,15:1 — praticamente illeggibile — e lo era anche nel tema scuro, da sempre.
  Con lei, altre quattro tinte sotto la soglia, e tre pulsanti che **peggioravano al
  passaggio del mouse**, schiarendo lo sfondo e tenendo la scritta bianca.

## [0.17.0] — 2026-09-01 — Un tema chiaro, una guida che non copre la mappa

### Added
- **Tema chiaro.** Chiaro, scuro, o «come il sistema» — che è il valore di partenza e non
  è un terzo aspetto: è una delega, e l'app segue la preferenza del telefono **mentre
  cambia**, senza bisogno di riaprirla. Si sceglie dalle impostazioni, si applica al tocco.

  Che sia leggibile non è affidato all'occhio: venti accoppiate di colori vengono misurate
  con la formula del contrasto WCAG in entrambi i temi, a ogni giro di test. Il colore è
  l'unica parte dell'interfaccia che nessun test guarda mai, ed è per questo che in questa
  app un grigio troppo tenue è passato due volte.

- **La guida non copre più la mappa.** Era una finestra al centro dello schermo, con un
  velo scuro sopra tutto: al secondo passo diceva «tocca la mappa per posizionare i
  waypoint» **impedendo di toccarla**. Adesso è un pannello — a destra su schermo grande,
  un foglio in basso su telefono, che si manda via col dito — e la mappa dietro resta
  visibile e utilizzabile.

  In più, i passi **indicano** l'elemento di cui parlano, con un contorno verde: la mappa
  quando spiega i waypoint, l'interruttore Learn/Track quando spiega le modalità, il
  grafico quando spiega il profilo.

### Fixed
- **Il passo personale non si perdeva più a ogni riavvio.** Chi si era tarato l'andatura
  per le stime di tempo la ritrovava a 1,0 al lancio successivo, e da lì in poi tutti i
  tempi erano calcolati su un'andatura che non era la sua. Succedeva da sempre.

### Changed
- Test end-to-end in un browser vero (dieci scenari, un minuto e mezzo): il primo avvio, i
  waypoint dal tocco, la tratta calcolata, la verifica in Learn, la ricarica che non perde
  il lavoro, il link condiviso, e i pannelli che non devono creare punti sotto di sé.
  Servono per una ragione precisa: i difetti che contano stanno nel divario fra «i test
  passano» e «cosa si vede a schermo».

## [0.16.0] — 2026-09-01 — Si torna indietro, e si incollano le coordinate

Cinque voci di arretrato chiuse in un colpo: due si vedono, tre stanno sotto e servono a
quello che verrà dopo.

### Added
- **Annulla e rifai.** Fino a cinquanta passi indietro, con Ctrl/Cmd+Z e Ctrl/Cmd+Maiusc+Z,
  e **i pulsanti dicono cosa annullano**: «Annulla: rimozione del waypoint», non «Annulla».
  Chi preme quel tasto di solito lo fa proprio perché non è più sicuro di cosa ha appena
  combinato.

  Nella storia entrano solo i gesti veri: aggiungere, togliere, spostare, rinominare,
  riordinare, scrivere un valore a mano. Restano fuori i valori che calcola l'app in
  modalità Track, i giudizi della verifica e il nome che trova la geocodifica — non sono
  cose che qualcuno ha *fatto*, e annullarle non risponderebbe a nessuna domanda. Le
  scorciatoie non scattano mentre si scrive in un campo: lì Ctrl+Z deve annullare le
  lettere, come fa il browser.

- **Si possono incollare le coordinate.** Prima l'unico modo di mettere un punto con
  precisione era toccare la mappa col dito: chi arrivava con una coordinata già in mano —
  da una relazione, da una guida, dal messaggio di un compagno — doveva cercare il posto a
  occhio.

  Ora si incolla, in una qualunque delle forme in cui una coordinata si trova scritta:
  `42.4419, 13.5595`, `42,4419 13,5595` all'italiana, `42° 26' 30" N, 13° 33' 34" E`,
  `N 42 26.514, E 13 33.570`, con le lettere in italiano o in inglese e anche in ordine
  invertito. **Si vede dove finirà il punto mentre si scrive**, e un testo che non è una
  coordinata lo dichiara invece di lasciar premere un pulsante che non farebbe niente.

- **Un avviso quando si ingrandisce oltre il dettaglio della mappa.** Su una carta si è
  abituati al contrario — più ci si avvicina, più si vede — ma oltre un certo punto il
  server non ha altre mattonelle e quelle che ci sono vengono stirate: l'immagine diventa
  più grande, non più precisa. Le quattro mappe si fermano a punti diversi (22, 20, 19,
  17), e l'avviso dice quale e dove.

- **Un formato in più per esportare: KML**, per vedere il percorso drappeggiato sul
  rilievo in Google Earth. I formati stanno ora dietro una voce «Esporta», e ognuno dice a
  cosa serve e — se è spento — perché.

- **«Su questo tipo di errore stai migliorando»** compare nel dettaglio di una verifica
  sbagliata, quando lo storico lo dice davvero: servono almeno sei sessioni su quel campo
  e un calo di almeno un quinto. Un incoraggiamento dato sul rumore sarebbe una frase
  falsa.

### Fixed
- L'istogramma delle ultime sessioni nel Progresso, per la categoria «distanza», era una
  fila di barre tutte uguali qualunque fosse il miglioramento: le medie venivano
  arrotondate al chilometro, quindi ogni errore sotto i 500 metri valeva zero.

### Changed
- Lo store dell'itinerario è diviso in parti (nessun cambiamento visibile: 1335 test
  passati invariati), e la ricostruzione della catena delle tratte — che era scritta tre
  volte quasi identica — ora è una funzione sola.

## [0.15.3] — 2026-09-01 — Le parole si possono chiedere

### Added
- **Un glossario che si apre dove serve.** I pulsanti ⓘ accanto ai campi mostravano frasi
  che *usavano* le parole da spiegare — «Dislivello positivo cumulativo (metri di
  salita)», «Latitudine WGS84 in gradi decimali» — cioè aiutavano chi già sapeva. Per
  un'app che esiste per insegnare la cartografia era il posto peggiore dove dare per
  scontato.

  Adesso quel ⓘ apre una vera definizione, presa da un catalogo di **13 termini**: azimut,
  declinazione magnetica, D+ e D−, distanza in linea d'aria, percorso su sentiero, quota,
  curve di livello, pendenza, WGS84, gradi decimali, scala SAC da T1 a T6, metodo Munter.
  Ogni voce dice che cos'è e poi la parte pratica: come si misura e dove ci si sbaglia.

- **Dopo una verifica sbagliata, il giro si chiude.** Il suggerimento che compare parla
  per esempio di «equidistanza fra le curve»; sotto, adesso, c'è scritto *Che cos'è: Curve
  di livello · Quota*, e toccando il termine la definizione prende il posto del
  suggerimento nello stesso riquadro. Chi ha appena sbagliato un valore è esattamente la
  persona che potrebbe non sapere cosa siano quelle parole.

  Le definizioni descrivono **quello che l'app fa davvero**: la voce sul metodo Munter
  dichiara le velocità che l'app usa per stimare i tempi, e un test le riprova sul calcolo
  vero — se un giorno cambiassero, il glossario mentirebbe proprio a chi lo sta usando per
  imparare.

### Fixed
- **I dislivelli si scrivono in un modo solo.** La barra di riepilogo mostrava `+1205 m`
  senza il punto delle migliaia, con un trattino al posto del segno meno, e `-0 m` su ogni
  percorso senza discesa — che si legge «meno zero».

## [0.15.2] — 2026-08-31 — Ripari che rispondono, editor che si legge

### Fixed
- **Il layer dei rifugi non va più in errore, e la causa non era nel codice.** La query
  e il parser erano giusti: sbagliata era la *porta*. Su una normale rete domestica
  italiana il router distribuisce il dominio di ricerca `homenet.telecomitalia.it`, e
  `overpass-api.de` — che ha **un solo punto** — viene provato prima col suffisso:
  `overpass-api.de.homenet.telecomitalia.it`, che il DNS dell'operatore risolve con un
  jolly a **127.0.0.1**. La richiesta finiva su sé stessa e restava appesa.

  Era l'unico indirizzo dell'app con un punto solo — tutti gli altri ne hanno almeno due
  e vengono risolti per quello che sono. Per questo cadeva soltanto questo layer, e per
  questo la correzione dell'ordine delle regole del service worker (v0.13.5) non poteva
  bastare: riguardava la cache, non il nome.

  Ora l'app non ha un indirizzo ma **un elenco di porte provate in ordine**, e ricorda
  sul dispositivo quella che ha funzionato: l'attesa si paga una volta, non a ogni
  avvio. Misurato sulla rete vera: primo avvio 8 secondi, poi risposta in 465 ms con 39
  rifugi; al secondo avvio la richiesta parte diretta sulla porta buona.

- **Il quiz è tornato ad avere vette e rifugi veri.** Usa la stessa fonte, e con l'unico
  indirizzo di prima non riceveva nulla: ripiegava **in silenzio** su punti casuali, e
  la cosa non si vedeva perché il quiz partiva lo stesso.

### Changed
- **In modalità Track l'editor mostra valori, non caselle.** Erano **25 caselle a
  schermo, 24 delle quali non scrivibili**, ciascuna col suo bordo e il suo pulsante ⓘ —
  24 pulsanti ⓘ in tutto — e due schermate di scorrimento per vedere quattro waypoint.
  Il difetto in una riga: *una casella in cui non si può scrivere non è una casella*.

  Adesso ogni waypoint è una riga — numero, nome, quota — con sotto i quattro numeri
  della tratta scritti per esteso (`1,42 km · 34° NE · +205 m · 0 m`). Coordinate,
  pendenza, tempo stimato e la rinomina si aprono toccando la riga, una per volta, com'è
  già il pannello dei layer. Risultato: **una casella sola** (il nome dell'itinerario) e
  l'itinerario intero in una schermata, con riepilogo ed export ancora visibili.

  Vale per la modalità, non per il profilo: migliora anche chi sta in «Imparo» e passa a
  Track per confrontare i propri valori con quelli reali. In Learn le schede coi campi
  restano esattamente com'erano.

- **I numeri dell'editor sono scritti all'italiana** anche qui (`1,42 km`, `2.130 m`):
  dentro le caselle di sola lettura era rimasta la scrittura inglese. E «non lo so» e
  «zero» ora si scrivono diversi: `n/d` contro `0 m` — una tratta in piano dichiarava
  `−0 m`, che si legge «meno zero».

## [0.15.1] — 2026-08-31 — Undici correzioni dalla modalità

Tre giri di review approfondita sulla modalità d'uso appena rilasciata. I primi due
cercavano **aree chiuse in un ingresso e aperte in un altro**; il terzo la classe
opposta: **cosa resta a schermo quando un'area sparisce**.

### Fixed
- **La guida di primo avvio raccontava funzioni che la modalità appena scelta aveva
  nascosto**, ed era il posto peggiore possibile: la scelta *«Sto imparando» / «Sono
  esperto»* sta al primo schermo della guida stessa. Chi rispondeva «sono esperto» si
  vedeva spiegare, nei due schermi immediatamente dopo, l'interruttore Learn/Track e il
  pulsante «Verifica» — le due cose che l'app gli aveva appena tolto — e più avanti il
  Quiz. A chi imparava, la guida prometteva «Copia link», che in «Imparo» non c'è.

  Ora ogni passo sa a quale modalità appartiene. Il primo contatto è di 4 schermi in
  «Imparo» e 3 in «Vado in montagna», dove al posto di Learn/Track e Verifica c'è
  «Pronto per la gita», che indica il meteo del percorso e il pulsante dei layer sulla
  mappa. Il Quiz ha un passo suo, «Condividi» si è staccato da «Usa l'app offline»
  perché il link è un export, e il disegnino della barra strumenti non disegna più il
  quiz e l'interruttore quando non ci sono.

- **La scheda «Libreria» su schermo grande si accendeva senza fare niente.** Guardava
  solo l'accesso e non la modalità, mentre il pannello ha una guardia che in «Imparo»
  mostra l'editor: la scheda si sottolineava di verde e a schermo non cambiava nulla. Un
  comando che dichiara di aver funzionato senza aver funzionato è peggio sia di averlo
  che di non averlo.

- **Un link di invito alla libreria condivisa ora impone «Vado in montagna».** La
  libreria è un'area di quella modalità, quindi chi apriva un invito trovandosi in
  «Imparo» vedeva l'app nascondergli proprio la cosa per cui era stato invitato.

- **Si può importare un itinerario da file anche in «Imparo».** L'importazione non è un
  export — è il modo in cui il lavoro *entra* — ed era stata portata via insieme agli
  export per vicinanza: senza libreria condivisa, GPX né link, non restava alcun modo di
  aprire un itinerario ricevuto come file.

- **I layer di emergenza non restavano più accesi sulla mappa in «Imparo».** Il pulsante
  e il pannello erano nascosti, ma i layer veri si montavano comunque: il radar della
  pioggia continuava a disegnarsi e a scaricare, l'attribuzione citava RainViewer, e il
  comando per spegnerlo non c'era. Nella stessa famiglia: l'avviso di allerta alla
  posizione non scarica più il bollettino in «Imparo».

- **Le note che spiegano i pulsanti spenti parlavano di pulsanti inesistenti.** Con due
  waypoint senza coordinate, in «Imparo» la nota diceva «per il GPX servono waypoint con
  coordinate» mentre le uniche voci a schermo — i due PDF — funzionavano benissimo.

- **Cambiando modalità si chiudono i pannelli che l'altra non prevede.** Restavano
  aperti e invisibili, e il tasto Indietro contava un passo che non c'era.

- **Via due contenitori vuoti**: in «Vado in montagna» su telefono la barra dei modi era
  un rettangolo vuoto con una riga di separazione in mezzo al nulla, e il gruppo
  «Attività» era sempre vuoto perché Verifica e Progresso sono entrambe di «Imparo».

### Changed
- Il nome accessibile dell'interruttore di modalità dice l'azione e poi lo stato
  («Cambia modalità d'uso, adesso: Imparo»): letto ad alta voce, «Modalità: Imparo»
  sembrava un'informazione e non un comando.
- Il benvenuto della guida nomina entrambi gli usi dell'app, perché la scelta sta subito
  sotto: dire solo «impara la cartografia manuale» era la prima frase letta anche da chi
  stava per rispondere «sono esperto».

## [0.15.0] — 2026-08-31 — Due modi di usare l'app

### Added
- **L'app ora ha una modalità, e mostra soltanto quello che serve a quella.** «Imparo» dà verifica, quiz, progressi e l'interruttore Learn/Track. «Vado in montagna» dà layer di emergenza, meteo, radar, rifugi, libreria condivisa ed export. Mappa, waypoint, editor, profilo altimetrico, bussola, righello e PDF stanno in entrambe.

  Il motivo è che quindici aree funzionali tutte visibili insieme sono troppe: chi apriva l'app per imparare a leggere una carta incontrava l'instabilità satellitare di Meteosat prima di aver capito cos'è un azimut, e chi la apriva per andare in montagna si portava dietro quiz e badge di validazione.

  La modalità la sceglie la domanda che il tutorial **già faceva** al primo avvio — *«Sto imparando» / «Sono esperto»* — che finora decideva soltanto se le tratte si compilano a mano o da sole.

- **Si cambia quando si vuole**, dalla prima voce del menu «Altro» su telefono o dall'alto del pannello su schermo grande. La voce dice sempre in quale modalità sei, e al cambio spiega cosa è comparso, cosa è sparito e come tornare indietro.

- **Niente è stato rimosso: tutto cambia solo di posto.** I percorsi salvati, l'itinerario in lavorazione, i layer accesi, le impostazioni e lo storico di verifiche e quiz restano dove sono, e tornando alla modalità di prima si ritrova tutto. Verificato a mano: acceso il radar in «Vado in montagna», passato a «Imparo» (il pulsante spariva, il layer restava salvato), tornato indietro e il radar era ancora acceso.

### Changed
- Passando a «Imparo» l'itinerario torna in Learn, se era in Track: chi sceglie di imparare vuole l'esercizio, non la lettura dei valori calcolati. Ma resta libero di passare a Track quando vuole confrontare la sua stima con la realtà — l'interruttore in «Imparo» c'è proprio per quello.

## [0.14.2] — 2026-08-31 — Quando ha guardato il satellite

### Added
- **I focolai dicono l'ora in cui il satellite è passato**, non solo quella in cui l'app ha scaricato i dati. Erano due cose diverse presentate come una: il satellite passa **due volte al giorno**, quindi fra il suo ultimo sguardo su una valle e il nostro download possono passare ore, e prima si leggeva solo "Aggiornato alle", che sembrava riferirsi al primo.

  Adesso, aprendo la riga: *Passaggi satellite 01:39 – 14:46 · il più recente 2 h fa*, e sotto *Scaricato alle 16:19*. La finestra spiega anche perché sulla mappa alcuni focolai sono rossi e altri arancioni.

  Se il passaggio più recente ha **più di sei ore** — la stessa soglia con cui la legenda distingue i colori — l'avviso compare anche a riga chiusa: a quel punto non è un dettaglio da consultare ma una cosa da sapere prima di fidarsi di quello che si vede.

### Fixed
- **Un orario dell'app era scritto nel fuso del telefono invece che in quello italiano**: la riga di aggiornamento dei layer di emergenza era l'unica dei quattro punti che scrivono orari a non dichiararlo. Su un dispositivo impostato su un altro fuso mostrava un'ora, mentre tutto il resto dell'app ne mostrava un'altra.

## [0.14.1] — 2026-08-31 — I fogli si mandano via col dito

### Added
- **I pannelli che salgono dal basso si chiudono trascinandoli in giù**, oltre che con la ✕: il pannello dei layer, il menu *Altro* e il meteo del percorso. In cima a ognuno c'è ora una **barretta da afferrare** — perché un gesto che non si vede non esiste, e senza quella l'avrei aggiunto per chi legge il codice invece che per chi usa l'app.

  Dal corpo del foglio il trascinamento parte solo se il contenuto è **già in cima**: è la regola dei fogli di sistema, e serve a non rubare lo scorrimento a chi stava leggendo. Dalla barretta parte sempre. Il foglio si chiude se lo trascini oltre un terzo della sua altezza, oppure se lo lasci andare con un colpo secco.

  La ✕ resta al suo posto su tutti e tre, come il tocco fuori dal foglio e il tasto Indietro: un trascinamento non si può fare con la tastiera né con un lettore di schermo, quindi non può essere la sola via d'uscita.

- Il gesto **non** è stato messo su Editor e Libreria. Su telefono quelli non sono fogli sovrapposti alla mappa ma le due destinazioni della barra in basso: riempiono lo schermo, "chiuderli" vuol dire tornare alla Mappa — cosa che fanno già il pulsante Mappa e il tasto Indietro — e si scorrono dall'inizio alla fine, quindi il trascinamento verso il basso avrebbe litigato col gesto che ci si usa tutto il tempo.

## [0.14.0] — 2026-08-31 — Il menu dei layer torna un quadro di comando

### Changed
- **Il pannello dei layer di emergenza era diventato illeggibile man mano che lo si usava.** Ogni layer acceso si portava dietro per sempre la propria documentazione — descrizione, fino a sei voci di legenda, riga di stato, comandi specifici — quindi più layer accendevi, più diventava faticoso raggiungere gli interruttori: il pannello puniva chi lo usava. Con cinque layer accesi, su un telefono, bisognava scorrere **due schermate** per arrivare all'ultimo interruttore, e nella prima se ne vedevano quattro su sette.

  Ora ogni layer è **una riga sola**: icona della categoria, nome, pallino di stato, interruttore. Tutti e sette stanno in una schermata, senza scorrere. Il resto — legenda, descrizione, orario di aggiornamento, comandi del radar, scelta del giorno per le allerte — si apre toccando il nome, una riga per volta. **Nessuna funzione è stata rimossa: sono cambiate di posto.**

  Quello che riguarda l'**attendibilità** del dato resta invece sempre in vista, anche a riga chiusa: un errore col suo pulsante "Riprova", l'assenza di rete, i dati parziali, i dati non aggiornati e la riga "nessuna zona in allerta per questo giorno". Il pannello si comprime quando tutto va bene, non quando c'è qualcosa da sapere.

- Le quattro intestazioni di categoria (*Incendi*, *Alluvioni e frane*…) non occupano più una riga ciascuna: sono diventate l'icona sulla riga del layer, e i layer affini restano vicini come prima.

### Accessibility
- **Il pallino di stato non è più solo un colore**: la riga si annuncia come *"Dove ripararsi: Rifugi e ricoveri, nessun dato"*. Chi usa un lettore di schermo prima non sapeva nulla dello stato dei layer.
- Nome e interruttore sono due comandi distinti e non annidati: toccare il nome apre il dettaglio, toccare l'interruttore accende il layer, e nessuno dei due fa il lavoro dell'altro.

### Fixed
- Su schermo grande cinque etichette su sette andavano a capo: il pannello passa da 288 a 320 px di larghezza.

## [0.13.5] — 2026-08-28 — Focolai della notte, ripari che rispondono, mappa offline che c'e'

Tre cose segnalate usando l'app, e una scoperta strada facendo che nessuno aveva
segnalato perche' non si vede: la mappa offline non veniva salvata.

### Fixed
- **I focolai visti dal satellite durante la notte non comparivano**, e il pannello dichiarava comunque "Focolai attivi (24 h)". Il parametro che si passava a NASA FIRMS non chiede "le ultime 24 ore" ma "da mezzanotte UTC di oggi", e il passaggio notturno del satellite sull'Italia sta **a cavallo di quella mezzanotte**: le rilevazioni dell'una-due di notte risultano del giorno prima e venivano scartate. Un incendio acceso la sera prima era invisibile fino al pomeriggio successivo. Ora la finestra e' davvero di 24 ore, e sono state ritrovate le rilevazioni delle 01:52-01:54 della notte appena passata.

  Resta un limite che nessun software puo' togliere: il satellite passa **due volte al giorno**, quindi un fuoco acceso dopo l'ultimo passaggio utile non puo' comparire prima del successivo.
- **L'elenco dei rifugi e bivacchi dava errore** dicendo che il servizio era occupato, mentre il servizio rispondeva regolarmente. Era l'app a interrompere la richiesta troppo presto: il servizio pubblico mette in coda le domande e la nostra ne aspetta venti secondi, ma il meccanismo di cache dell'app la troncava a dieci e restituiva un errore inventato.
- **La mappa non veniva piu' salvata per l'uso senza campo.** Le regole di conservazione delle mattonelle erano scritte dopo una regola generale che le intercettava tutte, quindi non venivano mai applicate: la mappa finiva in un magazzino da 32 mattonelle valide un'ora, invece che 1000 valide un mese. In montagna, senza segnale, voleva dire nessuna mappa. Nessuno l'aveva segnalato perche' non c'e' niente da vedere: funziona finche' hai campo.

### Added
- **Nel meteo del percorso, sotto ogni punto problematico c'e' scritto perche'**: *raffiche 49 km/h*, *CAPE 2600 J/kg: instabilita' molto alta*, *temporale*. Prima c'era solo un pallino colorato, e per capirne il motivo bisognava incrociare tre colonne di numeri e sapere quali soglie contano. Il colore del testo segue la gravita', e la stessa informazione ora e' leggibile da un lettore di schermo, che del pallino non sapeva nulla.

### DX
- Un controllo automatico sull'ordine delle regole di conservazione: qualunque regola scritta dopo quella generale verrebbe ignorata, e questo difetto non si vede leggendo il file.

## [0.13.4] — 2026-08-28 — L'ora di partenza e' l'ora italiana

### Fixed
- **Nel pannello meteo si sceglieva un orario e ne compariva un altro**, su qualunque dispositivo non impostato sull'ora italiana. Il pannello scrive tutto in ora italiana — arrivi, fasce critiche, alba e tramonto — ma costruiva la partenza con il fuso del dispositivo: si sceglieva "le 5" e la tabella partiva dalle 07:00. In Italia, con il telefono sull'ora italiana, non si vedeva; si vede a chi viaggia, a chi pianifica una gita italiana da fuori, e su un dispositivo rimasto su UTC. Adesso giorno e ora si scelgono in ora italiana, cambio dell'ora legale compreso.

  Chiude l'unico rilievo lasciato aperto dalla 0.13.3.

### DX
- La suite passa identica sotto qualunque fuso del sistema (provata su UTC, Sydney e Roma). Prima, con `TZ=UTC`, il test che sceglie le 5 e si aspetta le 05:00 in tabella ne trovava 07:00: il difetto e' stato riprodotto prima di essere corretto.

## [0.13.3] — 2026-08-28 — Numeri all'italiana, e frasi che non promettono piu' del vero

Versione nata da una **prova a mano dell'app dall'inizio alla fine**: creare un
itinerario vero, verificarlo, fare il quiz, guardare il meteo, accendere i layer,
esportare, ricaricare. Quasi tutto quello che c'e' qui dentro l'ha trovato lo schermo,
non la lettura del codice — e nemmeno 1.000 test.

### Fixed
- **I focolai di due giorni prima erano presentati come "ultime 24 ore".** Il proxy dei dati di emergenza serviva risposte vecchie prese da una cache su disco: il pannello scriveva "Aggiornato alle 09:29" sopra rilevazioni del 26 agosto, e il layer delle allerte diceva "Nessun bollettino per oggi" mentre il bollettino valido era pubblicato. Su un layer di sicurezza il dato vecchio spacciato per fresco e' il modo peggiore di sbagliare: e' quello che si guarda prima di partire.
- **I numeri erano scritti all'inglese in tutta l'app.** Il caso peggiore stava nel cuore della modalita' Learn: il valore calcolato con cui confronti la tua stima compariva come `Calcolato: 3.161 km`, che in italiano si legge **3161 km**. La stessa scrittura, battuta in un campo in metri, l'app la interpretava proprio come 3161: due meta' della stessa applicazione davano due significati opposti allo stesso testo. Ora ovunque — riepilogo, tratte, tabella, profilo, quiz, tolleranze, PDF — la virgola separa i decimali e il punto le migliaia: `3,161 km`, `1.920 m`, `11,1%`.
- **Un punteggio del 6% era dipinto di verde con la spunta.** Nel riquadro dei progressi l'esito dell'ultima verifica era sempre verde, qualunque fosse: in un'app che insegna, dire "bravo" a chi ha sbagliato il 94% dei valori e' il contrario del suo mestiere. Adesso il colore segue il risultato, e la spunta non c'e' piu'.
- **Gli scarti medi per categoria non dicevano l'unita', e per la distanza erano inutili.** Comparivano come `Δ 1417` senza specificare se metri, gradi o chilometri; e siccome la distanza veniva arrotondata al chilometro, **ogni errore sotto i 500 metri si leggeva `Δ 0`**, cioe' "perfetto". Un errore reale di 761 metri diceva `Δ 1`. Ora si legge `Δ 761 m`.
- **Una fascia critica che arrivava a fine giornata era scritta "15:00-00:00"**, che sembra un intervallo al contrario. Ora finisce alle `24:00`, come gli orari di chiusura. La stessa riga la stampava anche il pannello con un suo formattatore: adesso ce n'e' uno solo.
- **Il riscontro di validazione si annunciava in inglese.** Chi usa un lettore di schermo sentiva "Dettaglio validazione: error" sui riquadri che sono il cuore didattico dell'app. Ora dice "valore sbagliato, apri il dettaglio".
- **Le due soglie del grafico dei progressi si contraddicevano a vista**: "Min. 10 sessioni" e "Completa almeno 3 sessioni" una sotto l'altra, senza dire cosa sbloccasse cosa. Sono due cose diverse e adesso lo dicono.
- **Il pulsante che spiega il profilo stimato era alto 20 pixel**: ora si prende un bersaglio da 44 senza occupare piu' spazio, perche' su telefono la striscia del profilo e' alta poco piu' di quello.

### DX
- **La suite era rossa ogni mattina prima delle 10.** I test del pannello meteo preparavano la previsione finta per il solo giorno dopo, ma la partenza predefinita e' *oggi* prima delle 10 e *domani* dalle 10 in poi: passavano il pomeriggio e fallivano la mattina. Nessuno se n'era accorto perche' `npm run check` era sempre stato lanciato dopo pranzo.
- Due controlli automatici nuovi: uno impedisce che i dati di emergenza tornino a passare dalla cache, l'altro verifica che quello che l'app **scrive** sia ribattibile nei suoi stessi campi e valga lo stesso numero.

### Noto, non ancora corretto
- L'ora di partenza del pannello meteo viene costruita con l'ora **locale del dispositivo**, mentre tutti gli orari sono stampati in ora italiana: su una macchina impostata su un altro fuso si sceglie le 5 e la tabella scrive le 07:00. In Italia, su un telefono con l'ora italiana, non si vede.

## [0.13.2] — 2026-08-27 — Orari che non si sanno, numeri scritti all'italiana

Due giri di review sul lavoro delle versioni precedenti. Il filo comune: l'app
presentava come certo qualcosa che non sapeva, e leggeva i numeri in un modo che
in Italia nessuno usa.

### Fixed
- **In modalità Learn il meteo del percorso mostrava tutti i punti all'ora di partenza.** Le tratte appena create non hanno ancora distanza e dislivelli, quindi non hanno un tempo di percorrenza: quel vuoto veniva trattato come zero minuti, e il pannello dichiarava di arrivare in vetta all'ora in cui parti. Chi usa la modalità Learn è esattamente chi non può accorgersene. Ora le ore che non si conoscono si leggono `n/d`, un avviso dice che mancano distanza e dislivelli, e il verdetto nomina comunque le ore instabili della giornata invece di tacere.
- **Il dato meteo di un punto poteva essere mostrato sotto un altro.** Quando il servizio risponde con meno serie dei punti richiesti, l'app ripiegava in silenzio sulla prima: tutte le righe mostravano lo stesso CAPE come se fosse stato calcolato per ognuna. Ora i punti senza previsione propria lo dichiarano.
- **Nel quiz, rispondere "1.500" a una domanda in metri valeva un metro e mezzo, e il punteggio era zero su una risposta giusta.** In italiano il punto separa le migliaia. La correzione della versione precedente copriva i campi dell'itinerario; il quiz ha un campo suo. Essere bocciati da un separatore, in un'app che serve a imparare, è il peggio che possa capitare.
- **La tolleranza delle coordinate non era impostabile.** Vale 0,001 gradi, e il campo rifiutava la virgola: all'italiana quel numero non si poteva scrivere. Ora tutti i campi delle tolleranze accettano la virgola e chiedono la tastiera decimale.

### Added
- **Un pulsante "Riprova" sui layer che non hanno risposto.** I servizi pubblici di emergenza restituiscono un errore temporaneo di tanto in tanto; prima l'unico rimedio era spegnere e riaccendere l'interruttore del layer — per i ripari, muovere la mappa — cioè un trucco che bisognava indovinare.

### DX
- **Un controllo automatico sui campi numerici.** Lo stesso difetto del separatore decimale è ricomparso tre volte in due giorni, ogni volta in un punto nuovo dell'app. Ora un test rifiuta i campi numerici del browser dove serve leggere numeri italiani, e chi ha una ragione per usarli la scrive accanto.

## [0.13.1] — 2026-08-27 — Otto correzioni dalla review

Review del lavoro della giornata, cercando per prime le classi di difetto che in questo progetto si sono già ripetute. I primi quattro difetti sono stati riprodotti prima di essere corretti.

### Fixed
- **Chi parte di notte vedeva gli orari del sole del giorno prima.** Con partenza all'una del mattino l'app calcolava alba e tramonto del giorno precedente, e quindi anche l'avviso "arrivi dopo il tramonto" era sbagliato. La partenza notturna non è un caso di scuola: è quella classica per una vetta.
- **Un temporale dopo la mezzanotte veniva dichiarato inesistente.** Le ore critiche venivano cercate solo nel giorno civile della partenza, quindi una salita notturna con instabilità alle 3 riceveva un tranquillo "Nessuna criticità prevista". Ora si guarda tutto l'arco del cammino, e resta la frase utile quando invece la finestra cade dopo il rientro.
- **Nei campi in metri, "1.500" valeva un metro e mezzo.** In italiano il punto separa le migliaia, e chi scriveva 1.500 m di quota otteneva 1,5 senza accorgersene: tre ordini di grandezza su un dato che serve a leggere una carta. Ora nei campi in metri il separatore è quello delle migliaia, mentre nei chilometri e nei gradi il punto resta decimale.
- **Un itinerario ripristinato senza il tracciato sui sentieri non lo diceva.** Quando lo spazio sul dispositivo si esaurisce, il salvataggio conserva i valori e lascia andare il tracciato dettagliato: al riavvio comparivano linee rette senza spiegazione, e sembrava che i dati si fossero corrotti. Adesso l'app avvisa che il tracciato non era stato salvato e che i valori invece ci sono tutti.
- **Il layer dell'instabilità satellitare non si aggiornava mai.** È un prodotto che esce ogni quarto d'ora, ma restava a schermo quello caricato all'accensione — per ore, sotto l'etichetta "osservata adesso". Ora si rinfresca da sé, e se smette di aggiornarsi lo dichiara come fanno gli altri layer.
- **I ripari erano tagliati a 200 senza dirlo.** In una zona densa si vedeva una parte credendo fosse tutto, e l'avviso riusato diceva una cosa falsa ("alcune fonti non hanno risposto"). Ora dice quello che succede: ne vedi una parte, avvicinati per l'elenco completo.
- **La mappa interrogava il servizio dei ripari a ogni spostamento**, anche quando la nuova vista era già dentro quella scaricata: su un servizio pubblico che spesso è occupato significava più errori mostrati per gli stessi ripari. Ora l'area scaricata è più larga della vista e viene riusata.
- **Nel pannello meteo il tasto Tab usciva dal pannello**, portando il fuoco sui comandi dietro, che sono coperti e inutilizzabili. Ora il fuoco resta dentro, come negli altri riquadri dell'app.

## [0.13.0] — 2026-08-27 — Instabilità osservata, non prevista

### Added
- **Nuovo layer: instabilità osservata da satellite.** È il Lifted Index di Meteosat, aggiornato ogni quarto d'ora: dice quanto l'atmosfera è instabile **adesso**, misurata dal satellite, mentre il CAPE del pannello meteo è una previsione di modello. Serve la mattina della partenza, per confermare o smentire quello che il meteo diceva la sera prima.

  La legenda dice le classi a parole e con i valori — *molto instabile fino a -8 K*, *instabile*, *poco instabile*, *stabile oltre 0 K* — perché la scala di questo prodotto è a **polarità inversa** rispetto al CAPE (più negativo, più instabile) e i suoi colori non si indovinano: nella barra ufficiale il viola sta fra il giallo e il marrone. Il layer non si può interrogare tenendo premuto, e l'app non lo propone: il servizio, a chi chiede il valore sotto il dito, risponderebbe con i colori del pixel invece del numero.

### DX
- **Un controllo automatico per gli accenti italiani.** Nei giorni scorsi ho scritto quattro volte un apostrofo dove serviva un accento — "instabilita’" invece di "instabilità" — e ogni volta l'ho scoperto guardando lo schermo. Ora un test scandisce i sorgenti e li trova prima: appena scritto ne ha trovati quattro, uno dei quali nel popup delle novità.

## [0.12.0] — 2026-08-27 — Temporali: cosa incontri, e a che ora

Le app meteo dicono che tempo farà in un posto. Nessuna sa a che ora tu ci arriverai. TrekTrak sì, perché conosce i tuoi waypoint, le loro quote e la tua andatura: da qui nasce questa versione.

### Added
- **Meteo del percorso.** Il pulsante "Meteo" ora apre un pannello che incrocia la previsione con gli orari stimati dalla formula di Munter: per ogni punto, l'ora in cui ci arrivi, l'energia disponibile ai temporali (CAPE), le raffiche e la probabilità di pioggia. In cima, la frase che serve prima di partire: *"dalle 12:00 alle 13:00 la previsione diventa critica, e a quell'ora hai passato «Passo Sella», mentre sei ancora in cammino"*. Si scelgono giorno e ora di partenza, e il verdetto cambia con loro — perché la decisione vera è **partire prima**, non guardare un'icona di nuvola.

  Il collegamento a Meteoblue resta, dentro il pannello, come "previsione completa".
- **Raffiche di vento** insieme al resto: sopra 50 km/h su terreno esposto si cammina male, sopra 70 non si cammina, e in cresta contano quanto la pioggia.
- **Alba, tramonto e crepuscolo**, calcolati sul dispositivo senza rete, con un avviso quando l'orario di arrivo stimato cade **dopo il tramonto**. Essere colti dal buio è uno dei modi più comuni in cui una gita facile diventa un problema.
- **Come si legge**, richiudibile: cos'è il CAPE e perché dice quanta benzina c'è e non che il temporale ci sarà; il ciclo diurno della convezione, che è la ragione della regola più vecchia dell'alpinismo (in vetta presto, giù prima delle 14); e la regola 30/30 per quando il temporale è già lì.
- **Radar della pioggia** fra i layer di emergenza, con l'animazione delle ultime due ore, lo scorrimento a mano e l'orario del fotogramma sempre visibile. La legenda dice a chiare lettere che è **pioggia già caduta, non una previsione**: serve a vedere da dove arriva la cella e dove sta andando.
- **Rifugi, bivacchi e ricoveri** sulla mappa, dall'area che stai guardando. È il layer che rende utile un avviso di temporale: non "sta arrivando", ma *dove mi metto*. Il popup dice il tipo, i posti letto e il telefono quando ci sono — e avverte che apertura e stato non sono verificati, perché un ricovero mappato può essere chiuso o diroccato.

### Changed
- Il pulsante **Meteo** non apre più Meteoblue in una scheda esterna: apre il pannello del percorso, dove il collegamento a Meteoblue è una riga in fondo.
- Il tasto Indietro (mobile) chiude anche il pannello meteo, come fa con gli altri.

### Nota sull'onestà dei dati
Ogni numero di questa versione arriva da una previsione o da una mappa collaborativa, non da una misura sul posto. Il pannello lo dice: la previsione può sbagliare, il campionamento su un massimo di 12 punti del percorso è dichiarato (i modelli meteo hanno maglie di chilometri), gli orari vengono dalla formula di Munter e **non contano le pause**, il radar mostra il passato, i ripari vengono da OpenStreetMap. Nessuno di questi dati sostituisce i canali ufficiali di allerta.

## [0.11.8] — 2026-08-27 — Il lavoro non si perde più

Rilascio nato da una review dedicata all'usabilità: percorrere l'app come la percorre chi la usa, a dito su un telefono e col mouse su un desktop, cercando gli attriti invece dei difetti di codice. Sono emersi dodici punti, due dei quali gravi.

### Fixed
- **L'itinerario su cui stai lavorando non si perde più.** Prima viveva solo nella memoria dell'app: bastava ricaricare la pagina e sparivano tutti i waypoint — e l'avviso di aggiornamento della PWA invita proprio a ricaricare. Chi non ha accesso alla libreria condivisa non aveva **nessun** modo di conservare un itinerario, perché "Salva" è riservato ai membri. Ora l'itinerario viene tenuto su questo dispositivo mentre lo costruisci, e lo ritrovi riaprendo l'app: waypoint, valori scritti a mano, nome e modalità. Il salvataggio avviene poco dopo ogni modifica e subito quando l'app va in secondo piano, perché al telefono capita di chiudere tutto senza preavviso. Se lo spazio finisce, vengono conservati i valori che hai scritto tu, che sono gli unici irrecuperabili.

  Conseguenza: aprire un **link condiviso** ora chiede conferma, perché sostituirebbe un itinerario che prima non esisteva più comunque.
- **La scelta "Sto imparando" viene rispettata.** Veniva registrata e mai riletta: alla riapertura l'app tornava in modalità Track, quella in cui calcola tutto da sé — l'opposto di quanto chiesto da chi ha detto di voler imparare. Adesso all'avvio vale la modalità dell'itinerario che stai riprendendo e, se non ce n'è uno, il livello che hai dichiarato.
- **La virgola decimale funziona.** Scrivendo `1,5` — come si scrive in italiano — il campo si svuotava, e succedeva sull'attività principale dell'app: inserire distanze, quote e azimut. Ora si accettano virgola e punto, e la tastiera del telefono mostra il separatore. Valeva anche per le risposte del quiz.
- **Quando un pulsante è grigio, l'app dice perché.** Il motivo era in un tooltip, che su un telefono non esiste: si vedevano quattro pulsanti spenti e nessuna spiegazione. Ora è scritto accanto ai pulsanti — export, Copia link, Progresso, Salva, e le voci del menu "Altro".
- **Il messaggio del profilo altimetrico dice cosa manca davvero.** Con tre waypoint già sulla mappa continuava a chiedere di "aggiungere almeno 2 waypoint": mancavano le **quote**, e ora lo dice, indicando dove inserirle.
- **La scelta iniziale del livello dà un riscontro.** Le due carte sparivano senza confermare nulla: non si sapeva cosa fosse stato scelto né come cambiarlo. Restano visibili, con quella scelta marcata, e si può cambiare idea.
- **Il popup "Novità" non compare più a chi apre l'app per la prima volta.** Arrivava al secondo avvio, subito dopo il tutorial, a raccontare come "novità" funzioni che quella persona non ha mai conosciuto diversamente.
- **Il menu "Altro" e gli strumenti della mappa non si sovrappongono più.** Si aprivano insieme e la voce "Quiz" finiva sotto il menu, quindi intoccabile. Il tasto Indietro ora chiude anche gli strumenti, come fa con gli altri pannelli.
- **La Libreria dice come funziona.** Chiedeva un'email a chiunque promettendo un link d'accesso, e solo dopo l'invio rispondeva "Invito non valido" — incomprensibile per chi non ha mai avuto un invito. Ora spiega che è un'area ad accesso su invito e, soprattutto, che senza invito l'app funziona per intero: l'itinerario resta sul dispositivo e si porta altrove con JSON, GPX o "Copia link".
- **Il quiz non si chiude più in silenzio** quando non c'è un'area di mappa su cui costruire le domande.

### Accessibility
- **Tocchi più facili sotto i 44px che l'app si è data**: campi numerici da 34px, e i tre pulsanti tondi sulla mappa da 40px. Su desktop restano come erano.

## [0.11.7] — 2026-08-27 — Popup Novità più corto

### Changed
- **Il popup "Novità" alla prima apertura è passato da cinque passi a quattro**, con i testi accorciati. Il passo che spariva è quello sull'avviso di allerta alla tua posizione: è un banner che compare da sé nelle giornate in cui serve e non ha bisogno di essere annunciato in anticipo. Restano i layer di emergenza — cosa sono, le allerte della Protezione Civile, cosa si tocca per avere i dettagli, e il limite di questi dati.

## [0.11.6] — 2026-08-27 — Legende vere, marker che non intralciano, controllo allerte leggero

### Fixed
- **Le legende dei layer Copernicus dicevano cose che sulla mappa non si vedevano.** Le aree bruciate dichiaravano una voce sola — un rosso che non corrisponde a nessuna classe — mentre il servizio le disegna in **quattro colori per recenza**: ultimo giorno, ultimi 7, ultimi 30, resto della stagione. Chi guardava una macchia azzurra o verde non aveva modo di sapere che stava leggendo *quando* è bruciata, che è l'informazione più utile del layer. Il pericolo incendio (FWI) ne dichiarava cinque su sei, con colori inventati: mancava proprio la classe più grave. Ora colori, nomi e soglie sono campionati e riletti dalla legenda che il servizio pubblica, decimali compresi — arrotondare `< 11,2` a `< 11` sposta il confine fra due classi rispetto al colore disegnato davvero.

### Accessibility
- **I marker decorativi non intralciano più la navigazione da tastiera.** I capi del righello, i punti del quiz, le etichette della griglia e i numeri dell'anteprima di percorso finivano nell'ordine di tabulazione come pulsanti senza nome: Leaflet mette `role="button"` e `tabIndex=0` su ogni marker per default, e `interactive={false}` blocca il mouse, non la tastiera — è la ragione per cui il difetto sembrava già gestito.
- **I marker dei waypoint hanno un nome che si capisce**: "Waypoint 3" invece del solo "3", con il testo di supporto visibile ai soli screen reader.
- **Le etichette non attive della barra di navigazione hanno contrasto sufficiente**: erano a 3,67 su un minimo di 4,5, a 11px.

### Performance
- **Il controllo "sono in una zona in allerta?" all'avvio scarica 2,4 KB invece di 400.** Il bollettino DPC pubblica un manifest giornaliero col riepilogo nazionale: se dice che in tutta Italia non ci sono allerte, nessuna posizione può cadere in una zona in allerta e le geometrie non servono. Misurato in produzione: 2.921 byte totali, zero richieste di geometrie. Nei giorni tranquilli — la maggioranza — il risparmio è pieno. Il manifest è solo un'ottimizzazione e fallisce nel verso giusto: se non è raggiungibile, o se il testo è formulato in un modo non riconosciuto, si scaricano le geometrie come prima. Non può produrre un falso "nessuna allerta".

### DX
- **I file di test sono type-checkati** (`npm run typecheck:tests`) e **ESLint fa qualcosa di utile** (`npm run lint`, prima apriva un prompt interattivo: in CI si sarebbe piantato). Il nuovo controllo ha trovato subito quattro derive vere nelle fixture: campi aggiunti al tipo e mai aggiunti alle fixture, un campo `notes` sui waypoint che nel tipo non esiste più, un campo obbligatorio assente, e fixture di stato non annotate che quindi non venivano mai confrontate con lo stato reale. Aggiunto `npm run check` che esegue tutti i gate. 808 test.

## [0.11.5] — 2026-08-27 — Allerta DPC dove ti trovi

### Added
- **All'avvio, se ti trovi in una zona con un'allerta della Protezione Civile in corso, un banner te lo dice** — con il livello, la zona e **ogni rischio col proprio livello** (per esempio "idraulico gialla, idrogeologico arancione", non un unico livello attribuito a tutti). Se non ci sono allerte, o la tua posizione non è disponibile, non compare nulla.

  **La posizione non viene chiesta**: viene letta da chi la ha già ottenuta — la geolocalizzazione all'apertura della mappa o il pulsante "la mia posizione". È una garanzia strutturale, non un controllo che si può sbagliare: questa funzione non ha accesso alla geolocalizzazione, quindi non può far comparire alcun permesso da chiedere. Se nessuno ha ottenuto una posizione, tace. **Le coordinate non lasciano il dispositivo**: si scaricano le geometrie delle zone e il confronto avviene sul telefono.

  È un banner in flusso come quello di "modalità offline", quindi non copre la navigazione. Il messaggio ricorda che è un bollettino per l'intera zona e non una misura sul posto, non sostituisce i canali ufficiali, e cita la fonte.

### Fixed
- **Le notifiche permanenti erano irraggiungibili**: il tipo dichiarava `duration: null` come "resta finché non la chiudi", ma il codice lo collassava a 3 secondi. Il componente che le disegna le gestiva già correttamente.

## [0.11.4] — 2026-08-27 — Il bollettino DPC torna raggiungibile

### Fixed
- **Le allerte della Protezione Civile risultavano sempre "non raggiungibili".** Regressione della campagna di review: avevo fatto escludere i path `files/preview/` per non costruire il layer su un bollettino i cui topojson non esistono ancora, e ho corretto troppo. Il repo DPC committa spesso i soli preview — il 26/08 l'ultimo commit su master toccava unicamente `files/preview/20260826_1422_{oggi,domani}.png`, con le geometrie dello stesso bollettino già pubblicate — quindi la discovery non trovava più nessun id. Ora gli id dei preview tornano candidati validi e il rischio si gestisce **verificando che le geometrie esistano** (una richiesta `HEAD`, che non pesa sul rate limit di GitHub) invece di ignorare la cartella: funzionano sia il preview con geometrie pronte, sia quello della prossima emissione che non le ha ancora.
- **Il popup "Novità" tornava a parlare dei dettagli invece della cosa importante.** Mostra solo la voce più recente, e le voci erano diventate tre (cestino waypoint, pressione lunga sulle aree bruciate, layer di emergenza): chi apriva l'app si sentiva raccontare il cestino. Ora è una voce sola in quattro passi sui **layer di emergenza** — le tre fonti, le allerte DPC, cosa è tappabile, e il fatto che questi dati non sostituiscono i canali ufficiali di allerta.

## [0.11.3] — 2026-08-26 — Cancellare i waypoint dalla mappa

### Added
- **Cestino sulla mappa per cancellare i waypoint**, col numero di waypoint nel badge. Compare solo se ce n'è almeno uno. Alla pressione chiede cosa fare: **cancellarli tutti**, **solo l'ultimo aggiunto**, o annullare — perché le due azioni sono diverse e nessuna è il contrario naturale dell'altra. "Solo l'ultimo" copre il caso frequente del tocco sbagliato. Il fuoco della tastiera parte da Annulla, così un Invio distratto non cancella l'itinerario, e su mobile i tre pulsanti vanno in colonna con altezza minima da pollice. Il nome dell'itinerario sopravvive alla cancellazione: non è un "nuovo itinerario".

## [0.11.2] — 2026-08-26 — Hotfix: i focolai tornano visibili

### Fixed
- **I focolai della zona che stai guardando non sparivano più dietro al tetto di performance.** Il limite di 400 marker introdotto nella v0.11.0 ordinava per potenza su **tutta l'Italia**: misurato sui dati reali, 2298 focolai in Italia e 289 nella vista, di cui ne passavano **3** — perché per entrare nei primi 400 servivano 53,8 MW mentre in quell'area la media era 6,4. Il criterio era sbagliato: che un incendio a 600 km sia più potente non ha nessuna rilevanza per ciò che va disegnato qui. Ora si scarta quello che è **fuori schermo** (con un margine, così un pan breve non scopre aree vuote), e il tetto resta solo come rete di sicurezza per la mappa zoomata su mezza Europa, dove i punti sono sub-pixel comunque.

## [0.11.1] — 2026-08-26 — Tap sui focolai + aree bruciate interrogabili

### Fixed
- **Toccare un focolaio non aggiunge più un waypoint all'itinerario.** Regressione della v0.11.0, introdotta dal passaggio dei focolai al renderer canvas: un tap apriva il popup *e* creava un waypoint, con tanto di chiamata di reverse-geocoding. Con il renderer SVG il bersaglio del click è il `<path>` e Leaflet risolve il layer; col canvas il bersaglio è la tela, quindi `_findEventTargets` non riconosce il layer e aggiunge la **mappa** come bersaglio di fallback, facendo scattare entrambi. Risolto con `bubblingMouseEvents: false` — il flag che il ciclo di Leaflet già controlla per fermarsi al layer. Toccando la mappa vuota il waypoint si aggiunge come sempre: resta possibile pianificare un percorso con i layer di emergenza accesi.

### Added
- **Aree bruciate interrogabili**: una **pressione lunga** sull'area (click destro su desktop) chiede a Copernicus EFFIS cosa c'è sotto quel punto e mostra la **data dell'incendio**. Il gesto non è il tap normale di proposito — sulla mappa il tap significa già "aggiungi waypoint" — ed è annunciato nella riga del layer, perché una pressione lunga non si scopre da sola. Il pericolo incendio (FWI) resta non interrogabile: EFFIS lo dichiara `queryable="0"` nelle proprie capabilities e il layer gemello `mf010.query` risponde senza attributi.

## [0.11.0] — 2026-08-26 — "Layer di emergenza (fase 1)"

Prima fase dei layer di emergenza sulla mappa (TASK-52): 4 layer opzionali con dati satellitari e bollettini ufficiali, pensati per la sicurezza sul campo. Spec in `backlog/docs/emergency-layers-design.md`. 708 test.

Il rilascio è passato per una **campagna di code review in tre round** (2026-08-26), da cui sono usciti 29 problemi distinti, chiusi in quattro ondate. Il filo conduttore dei più gravi era sempre lo stesso: un layer rotto o con dati vecchi che si presentava come funzionante e aggiornato. Su una feature che si consulta per decidere se salire su un sentiero, è peggio del layer assente.

### Added
- **Pulsante ⚠️ sulla mappa** che apre il pannello "Layer di emergenza" (caricato con dynamic import, impatto marginale sul First Load JS): attiva/disattiva i 4 layer, con legenda, orario di aggiornamento e fonti sempre visibili.
- **Focolai attivi (NASA FIRMS)**: hotspot rilevati da satellite nelle ultime 24 ore, tramite proxy server `/api/fires` (`FIRMS_MAP_KEY` mai esposta al client); refresh automatico ogni 15 minuti.
- **Aree bruciate e pericolo incendio (Copernicus EFFIS)**: area percorsa dal fuoco nell'anno corrente e indice di pericolo incendio previsto (FWI) del giorno, come layer WMS semi-trasparenti sotto il tracciato.
- **Allerte meteo-idro e frane (Dipartimento Protezione Civile)**: zone di allerta (gialla/arancione/rossa) per rischio idraulico, temporali e idrogeologico, dal bollettino ufficiale (`/api/dpc-alerts` + GitHub raw), con selettore giorno (oggi/domani) e popup con i 3 rischi.
- **Disclaimer** alla prima attivazione di un layer di emergenza: i dati possono essere incompleti o in ritardo e non sostituiscono i canali ufficiali di allerta (112 in caso di emergenza).

### Changed
- **Service worker**: le richieste dei dati di emergenza (`/api/fires`, `/api/dpc-alerts`, tile WMS EFFIS, bollettini DPC da GitHub raw) sono escluse dal caching offline (`NetworkOnly`) — dati stantii in questo ambito sono un rischio, non una feature.

### Fixed
- **La mappa non crasha più riaprendo l'app con un layer di emergenza attivo**: il pane `emergency` veniva creato in un `useEffect` del contenitore, ma React esegue gli effetti dei **figli prima di quelli del padre** — i layer WMS si agganciavano quando il pane non esisteva ancora e Leaflet moriva su `getPane('emergency').appendChild` di `undefined`, distruggendo il sottoalbero della mappa. Si vedeva solo sul percorso di riattivazione persistita, cioè quello reale: accendi un layer, chiudi l'app, riapri. Ora i layer figli si montano **solo a pane pronto**. Il mock di react-leaflet nei test non modellava il registro dei pane e nascondeva il difetto: ora `createPane`/`getPane` hanno stato e un test di regressione verifica che il pane esista nell'istante in cui il layer si aggancia.
- **Fonti senza doppioni nel pannello**: con aree bruciate e pericolo FWI accesi insieme il footer elencava `Copernicus EFFIS · Copernicus EFFIS` — le due attribution sono identiche e venivano concatenate senza deduplica.
- **Conteggio dei layer attivi annunciato agli screen reader**: il badge sul pulsante ⚠️ era solo visivo; ora il nome accessibile è "Layer di emergenza, N attivi".

#### Dalla campagna di review — bloccanti

- **Ogni tocco sul pannello dei layer non sporca più l'itinerario**: pulsante e pannello sono figli DOM di `MapContainer` e non fermavano la propagazione, così il click risaliva a `.leaflet-container`, Leaflet sparava l'evento `click` della mappa e `MapEvents` lo interpretava come "aggiungi waypoint" — un waypoint spurio, più una chiamata di reverse-geocoding, a ogni tap. Wheel e drag sul pannello, allo stesso modo, zoomavano e pannavano invece di scrollare. La guardia è ora in un hook condiviso (`useMapOverlayGuard`) e usa il flag `_leaflet_disable_click`, non `stopPropagation`: fermare la propagazione del click avrebbe soddisfatto Leaflet ma tagliato fuori la delega eventi di React, rendendo gli switch inerti. I test verificano entrambe le direzioni.
- **Su mobile lo sheet non copre più la bottom navigation**: era ancorato a `bottom-0` sopra una `nav` senza z-index, quindi le quattro destinazioni erano irraggiungibili e, senza backdrop, il pannello non si chiudeva nemmeno toccando fuori. Ora si fermano a `bottom-14`, con backdrop, e pannello e menu "Altro" sono mutuamente esclusivi (due sheet sovrapposti rendevano ambigua anche la priorità del tasto Indietro).

#### Dalla campagna di review — dati sbagliati mostrati come buoni

- **Una risposta FIRMS non-CSV non viene più letta come "zero incendi"**: con MAP_KEY invalida o quota esaurita FIRMS risponde `200` con testo semplice; il parser tornava `[]` e il proxy metteva in cache 15 minuti un payload vuoto **come successo**, con il pannello che scriveva "Aggiornato alle HH:MM". Ora `parseFirmsCsv` distingue "corpo non riconosciuto" (`null` → 502) da "header valido, nessuna riga" (`[]`), e i risultati **parziali** sono marcati come tali e messi in cache per 2 minuti invece di 15.
- **Un bollettino DPC troppo vecchio non viene più servito come buono**: il fallback su cache stantia non aveva tetto d'età, e con due date entrambe passate `defaultDpcDate` tornava `null`, quindi nessuna zona veniva disegnata mentre il layer restava "ready" con orario fresco. Ora la cache scade a 6 ore e il caso ha uno stato esplicito **"nessun dato disponibile"**.
- **I layer WMS possono finalmente segnalare un guasto**: partivano `ready` a scatola chiusa e `refreshLayer` non li trattava affatto, quindi un'interruzione EFFIS dava tile bianchi con il pannello che dichiarava il layer funzionante. Ora lo stato lo decidono i tile (`tileload`/`tileerror`, con soglia perché un tile fuori copertura non è un guasto), e l'orario di aggiornamento si mostra anche per loro.
- **Spegnere un layer ne butta i dati**: `stopLayer` azzerava solo lo stato, così riaccendendolo si ridisegnavano subito i dati di ore prima — e con `lastFetch` a `null` il pannello nascondeva sia l'orario sia l'avviso di staleness, cioè dati vecchi senza alcun riferimento temporale.
- **"Pericolo incendio oggi" non mostra più la previsione di ieri**: il `TIME` dei WMS non veniva mai ricalcolato (nessun timer, `refreshMinutes: null`), quindi una sessione aperta oltre la mezzanotte continuava a chiedere il giorno prima. Un tick condiviso da 5 minuti rivaluta giorno corrente e staleness — che prima non compariva mai, perché `isStale` leggeva `Date.now()` in fase di render e nulla provocava un nuovo render proprio quando i refresh si fermavano.
- **Il giorno DPC selezionato prima di mezzanotte non resta selezionato dopo**: la mappa continuava a disegnare le zone di ieri come selezione corrente. E con un bollettino di due giorni non compaiono più due pulsanti entrambi etichettati "Ieri".
- **Niente più focolai fantasma a (0,0)**: `Number('')` vale `0` e supera `Number.isFinite`, quindi una riga con lat/lon vuote — risposta troncata o colonne sfasate — diventava un focolaio nel Golfo di Guinea. Aggiunta anche la validazione dei range.

#### Dalla campagna di review — robustezza

- **`/api/fires` non può più restare appesa**: `clearTimeout` scattava all'arrivo degli header, disarmando l'AbortController prima di `res.text()`; un body che si blocca a metà teneva la funzione occupata fino a quando la piattaforma la uccideva.
- **Timeout e guardia anti-accumulo lato client**: le fetch del browser non avevano alcun timeout (layer bloccato su "Caricamento" per sempre) e `refreshLayer` non controllava se una richiesta era già in volo, quindi l'intervallo le impilava e una risposta tardiva poteva sovrascrivere dati più nuovi.
- **Discovery DPC: da 6 chiamate a GitHub a 1**, come prescrive la spec (`/commits/master` porta già l'elenco dei file), con deadline complessiva e **cache negativa** — prima ogni richiesta ritentava, su una GET pubblica, bruciando il rate limit di 60/ora per IP in modo auto-amplificante.
- **La regex del bollettino ora matcha i file che il modulo stesso costruisce**: pretendeva l'id subito dopo `files/`, quindi **non** riconosceva la forma canonica `files/topojson/<id>_today.json`; funzionava solo perché i commit toccano anche altri path. E ignora gli id di `preview/`, che esistono prima dei topojson pubblicati e danno 404 su entrambi i giorni.
- **Payload validati e messaggi sempre in italiano**: `res.json()` stava fuori dalla protezione di `safeFetch` e nessuno controllava la forma della risposta, così un corpo malformato (captive portal, risposta troncata) arrivava al render come `points={undefined}` e faceva crashare l'albero React — nel progetto non esiste alcun ErrorBoundary che limiti il danno al singolo layer. `/api/dpc-alerts` inoltre propagava il testo grezzo di upstream (`GitHub API: HTTP 403`, messaggi di abort e DNS in inglese) fino al toast.

#### Dalla campagna di review — perf, spec e accessibilità

- **Focolai su renderer canvas** (spec §4.5), con popup costruito al click invece di uno per punto e un tetto di 400 marker (i più potenti): in stagione la bbox italiana su tre sensori dà migliaia di righe, e montarle tutte insieme bloccava la mappa per secondi sul telefono, che è il dispositivo per cui la feature esiste.
- **I tile EFFIS non vengono più riscaricati a ogni re-render**: `params` era un oggetto letterale ricostruito ogni volta e react-leaflet lo confronta per riferimento, quindi chiamava `setParams` → `redraw()`.
- **Zone DPC in una sola FeatureCollection**: prima un `<GeoJSON>` per zona, cioè decine di layer Leaflet distrutti e ricreati a ogni refresh e a ogni tap sul selettore giorni.
- **Righe "non disponibile offline"** (spec §6): da offline i layer mostravano un errore di rete e i WMS tile bianchi senza spiegazione, mentre i dati di emergenza sono esclusi dalla cache di proposito.
- **404 dalle fonti = "nessun dato disponibile", non errore** (spec §6): il pattern serviva già ora, ed è quello su cui la fase 2 si appoggerà per la stagionalità delle valanghe.
- **Chiave FIRMS assente**: il pannello mostrava all'utente il nome della variabile d'ambiente del server; ora la riga dice che il layer non è disponibile su questa installazione (spec §4.3).
- **Focus da tastiera visibile sugli switch**: erano una copia di `ToggleSwitch` che aveva perso il ring, quindi tabulando fra i quattro toggle non si vedeva dove fosse il fuoco.
- **Un solo escaping condiviso** (`escapeMarkup`) al posto di tre copie divergenti, e un solo `toYmd`.
- **Le giornate senza allerte lo dicono**: quando il bollettino è valido ma nessuna zona supera il livello 0 — il caso più frequente: il 26/08 erano 0 zone su 187 — il layer acceso restava su una mappa vuota, indistinguibile da un layer rotto. Ora il pannello scrive "Nessuna zona in allerta per questo giorno". Emerso verificando col bollettino reale, non dai test.

## [0.10.10] — 2026-06-09 — Tasto Indietro: uscita affidabile + mappa che non salta

### Fixed
- **"Esci" ora esce davvero** (tornando alla pagina precedente): la guardia in cronologia per la conferma d'uscita poteva **accumularsi** (React StrictMode in dev, o un remount), così un solo `history.back()` non bastava a superarle tutte e l'app restava sulla stessa pagina. Ora `pushGuard` è **idempotente**: mai due guardie in cima → l'uscita supera la guardia e lascia l'app. Verificato in emulazione mobile (la pagina naviga via).
- **La mappa non "salta" più sulla posizione GPS**: `GeolocateOnMount` vola sul GPS **solo alla prima apertura della sessione**; ad ogni mount successivo **ripristina l'ultima vista** (centro+zoom, salvata in `sessionStorage`). Così, anche se ci fosse un remount o un reload, la mappa resta dov'era invece di ri-centrarsi bruscamente sulla posizione attuale.

## [0.10.9] — 2026-06-09 — Tasto Indietro: stop al reload + pulizia diagnostica

### Fixed
- **Niente più "refresh" di mappa e posizione premendo Indietro o uscendo**: le nostre `history.pushState`/`replaceState` sovrascrivevano lo **stato interno del router di Next.js** (App Router lo conserva in `history.state`: `__NA`, `__PRIVATE_NEXTJS_INTERNALS_TREE`). Al `popstate` il router non riusciva a riconciliare la rotta e forzava un **hard reload** della pagina (la mappa si rimontava e `GeolocateOnMount` ri-centrava sul GPS). Ora preserviamo lo stato di Next in ogni manipolazione della cronologia (spread di `history.state`), così il tasto Indietro chiude i livelli e mostra la conferma d'uscita **senza ricaricare**. Verificato in emulazione mobile.

### Removed
- Rimossa tutta la diagnostica temporanea del tasto Indietro: overlay `?debug=back`, `lib/back-debug.ts`, `components/shared/BackDebug.tsx` e relativi log.

## [0.10.8] — 2026-06-09 — Tasto Indietro: history per livello di navigazione

### Fixed
- **Tasto Indietro mobile finalmente affidabile** — riprogettato il meccanismo. Il problema di fondo: tenevamo **una sola entry "guardia"** e provavamo a ricrearla *dentro* l'handler `popstate`, ma sul mobile `pushState` chiamato dentro `popstate` è **inaffidabile** (sia sincrono che deferito), quindi la guardia si esauriva e l'app usciva "a tratti", senza mostrare il popup. Ora la cronologia rispecchia la **profondità di navigazione**: ogni livello aperto (scheda diversa dalla Mappa, overlay, menu) spinge una entry **al momento della navigazione** (dove `pushState` è affidabile), e `popstate` si limita a **chiudere un livello** leggendo lo stato — non ri-pusha mai durante il pop. Le chiusure programmatiche (tap su ✕) riallineano la cronologia con `history.go`. La guardia base resta solo per la conferma d'uscita dalla Mappa.

### Changed (diagnostica temporanea)
- Log `?debug=back` aggiornato al nuovo modello: `sync push/pop`, `pop close`, `pop base → confirm`, `pop skip(self)`.

## [0.10.7] — 2026-06-09 — Tasto Indietro: re-arm sincrono della guardia

### Fixed
- **Tasto Indietro mobile esce dall'app dopo poche pressioni**: la diagnostica `?debug=back` (v0.10.6) ha mostrato che dopo `editor→mappa`/`libreria→mappa` la guardia in cronologia non veniva ricreata in tempo (era ri-armata con `setTimeout(0)`, deferito), quindi la pressione successiva non faceva nemmeno scattare `popstate` e il browser usciva di colpo (popup mai mostrato). Ora la guardia è **ri-armata in modo sincrono** come prima istruzione dell'handler `popstate`: ogni pressione del tasto Indietro trova sempre un'entry da consumare e l'handler viene sempre invocato.

### Changed (diagnostica temporanea)
- Log `?debug=back` arricchito con `persisted` su `pagehide`/`pageshow` per distinguere la sospensione BFCache (non un'uscita) da un'uscita reale.

## [0.10.6] — 2026-06-09 — Tasto Indietro: diagnostica persistente

### Changed (diagnostica temporanea)
- Il log dell'overlay `?debug=back` ora è **persistito in localStorage**: sopravvive all'uscita/ricarica dell'app, così l'evento d'uscita (proprio quello che ci interessa) non va più perso. `?debug=clear` svuota il log.
- Tracciate informazioni aggiuntive: presenza della guardia in cronologia (`event.state.ttBack`), `referrer` e lunghezza cronologia al mount, ed evento `pagehide` nell'istante in cui l'app esce — per distinguere "popstate non ha fermato la navigazione" da "guardia esaurita".

## [0.10.5] — 2026-06-09 — Tasto Indietro: tentativo fix + diagnostica

### Fixed (tentativo)
- **Tasto Indietro mobile**: la ri-armatura della guardia in cronologia ora è **deferita** (`setTimeout(0)`) invece che sincrona dentro `popstate` — alcuni browser mobili ignorano `pushState` chiamato dentro l'handler `popstate`, causando lo svuotamento della guardia e l'uscita dopo qualche pressione.

### Added (diagnostica temporanea)
- Overlay di debug del tasto Indietro attivabile con `?debug=back` (disattiva con `?debug=off`): mostra gli eventi del gestore per diagnosticare il comportamento sul dispositivo reale.

## [0.10.4] — 2026-06-09 — "Aggiornamenti PWA visibili"

### Added
- **Avviso di nuova versione**: quando il service worker rileva un aggiornamento, compare un banner "È disponibile una nuova versione" con pulsante **Ricarica** (`UpdateBanner`). Risolve il caso in cui la PWA continuava a mostrare la versione in cache finché non si chiudeva/riapriva del tutto.
- **Indicatore di versione** ("TrekTrak v…") in fondo a Impostazioni mappa (⚙️), per verificare a colpo d'occhio quale build si sta usando. Versione esposta da `package.json` via `NEXT_PUBLIC_APP_VERSION`.

## [0.10.3] — 2026-06-09 — Hotfix

### Fixed
- **Tasto Indietro mobile inaffidabile** (regressione v0.10.2): nel ramo "uscita" la guardia in cronologia non veniva ricreata prima del popup di conferma (async), così durante il gesto reale l'app poteva uscire direttamente (popup mai mostrato; a volte uscita anche da una scheda diversa dalla Mappa). Ora ogni `popstate` **ri-arma subito la guardia** in modo sincrono e incondizionato: l'app non "cade fuori" mai, il popup di conferma compare in modo affidabile sulla Mappa, dalle altre schede Indietro torna alla Mappa e gli overlay si chiudono per primi. L'uscita confermata è best-effort (`history.go(-2)`).

## [0.10.2] — 2026-06-08 — "Mobile: menu Altro + tasto Indietro"

Rifiniture della navigazione mobile (solo `<lg`, desktop invariato). TASK-50.

### Added
- **Menu "Altro"** come quarta voce della bottom nav: apre una tendina con **Meteo**, **PDF sintetico**, **PDF roadbook**, **GPX** sull'itinerario corrente (disabilitati quando non applicabili). Si chiude dopo l'azione o toccando fuori.
- **Gestione del tasto Indietro** del telefono (History API): chiude prima eventuali overlay/menu aperti, poi torna alla **Mappa** da un'altra scheda, infine (sulla Mappa, nulla aperto) chiede conferma con un popup in-app "Uscire da TrekTrak?". Logica di priorità in `lib/back-nav.ts` (pura, unit-tested).

### Changed
- Bottom nav: i 3 pulsanti di navigazione passano da `role=tab` a pulsanti con `aria-current` per ospitare in modo accessibile il pulsante "Altro".

## [0.10.1] — 2026-06-08 — Hotfix

### Fixed
- **Pannello mobile completamente scrollabile**: lo sheet Editor/Libreria copriva solo l'area mappa con un singolo blocco interno scrollabile, lasciando su schermi piccoli una finestrella minuscola e le azioni in fondo tagliate. Ora lo sheet copre mappa + profilo (tutta l'area sopra la bottom nav) e scorre come un'unica pagina; lo scroll interno dei componenti resta solo su desktop (`lg:`), che è invariato.

## [0.10.0] — 2026-06-05 — "Navigazione mobile rifondata"

Fase B del ridisegno usabilità mobile (TASK-39): nuova shell mobile a **bottom navigation**, solo sotto il breakpoint `lg` — il desktop conserva la sidebar fissa, invariato. Sviluppata e revisionata in 6 task (TASK-44 → 49) con esecuzione subagent-driven (TDD) e code-review finale. Spec/piani in `backlog/docs/mobile-shell-B-*`. 553 test.

### Added
- **Bottom navigation** (Mappa · Editor · Libreria) al posto di hamburger + top-bar densa + drawer a tutto schermo; la mappa resta sempre visibile, Editor/Libreria salgono come sheet (`BottomNav`, `uiStore.mobileTab`).
- **FAB speed-dial** sulla mappa per i tool (bussola/righello/quiz), con icona + etichetta e tool attivo evidenziato (`MapToolsFab`).
- **Libreria mobile lista ↔ dettaglio** come viste separate, con "← Tutti i percorsi" e "Sulla mappa".

### Changed
- **Learn/Track** nell'header dell'Editor; **⚙️** unico per le impostazioni; rimosse le duplicazioni della shell mobile.
- **Diario completamenti tap-friendly**: azioni ✎/✕ ≥44px con **conferma sull'eliminazione**, scarponi difficoltà e form più comodi.
- **Touch target ≥44px** sui controlli in-pannello, applicati solo su mobile (`max-lg:`) per non alterare il desktop.

### Removed
- Hamburger, drawer a tutto schermo e seconda riga della top-bar mobile; stato `drawerOpen` ormai inutilizzato.

## [0.9.2] — 2026-06-05 — "Pulizia UI (fase A)"

Primo passo del riordino usabilità (fase A di TASK-39, `backlog/docs/mobile-usability-analysis.md`): riduzione del rumore su **componenti condivisi**, quindi migliora sia mobile sia desktop.

### Changed
- **Tool della mappa etichettati** (Bussola / Righello / Quiz): icona + testo, basta il glifo "?" ambiguo. (TASK-40)
- **ActionBar riordinata**: export (PDF / GPX / Copia link) disabilitati con tooltip quando l'itinerario non è esportabile; "Verifica" e "Progresso" separati dagli export in un gruppo "Attività". (TASK-41/42)
- **Onboarding più snello**: tutorial iniziale da 8 a 4 passi essenziali, con continuazione opzionale "Altre funzionalità" (i contenuti avanzati restano accessibili anche alla riapertura). (TASK-43)

## [0.9.1] — 2026-06-05 — Hotfix

### Fixed
- **Onboarding mobile**: al primo accesso da mobile un utente autenticato ma senza username veniva lasciato sulla mappa col menu chiuso, nascondendo lo step di scelta username. Ora il drawer si apre automaticamente sulla **Libreria** (one-shot, solo sotto il breakpoint `lg`) così la scelta username è la prima cosa visibile.

### Chore
- `token-hash` (nota con il token d'invito in chiaro) aggiunto a `.gitignore`.

## [0.9.0] — 2026-06-05 — "Libreria condivisa cloud"

La libreria percorsi diventa **condivisa e sincronizzata sul cloud** (Supabase), ad accesso **a invito** e **senza password**. I membri di un gruppo raccolgono insieme i percorsi e ne tengono un diario comune delle uscite. Sviluppata in 6 fasi (backend/RLS → sync → auth → UI → geometria tracciato → branding email). Spec e piani in `backlog/docs/shared-library-*`.

### Added
- **Libreria condivisa cloud (Supabase)**: percorsi e diario completamenti sincronizzati e condivisi tra i membri invitati (tabelle `members`, `invites`, `routes`, `completions`; layer `lib/sync.ts`; store `authStore` + `routeLibraryStore`).
- **Accesso a invito + magic-link**: niente password. Invito via token nel link (`#invite=`), gate lato server (`/api/shared/request-access`); ai membri già registrati viene **inviato** un magic-link di login (`signInWithOtp`), alle email nuove un invito che crea l'utente. Scelta dello **username** al primo accesso (`/api/shared/claim-username`).
- **Membri e ruoli** (`member`/`admin`) con **Row-Level Security** su tutte le tabelle.
- **Email brandizzate in italiano** (invite / magic-link / confirm) con tema "cresta di vette" email-safe, via **SMTP custom** (Gmail). Template versionati in `supabase/templates/`.
- **Vista di default = Libreria** per gli utenti autenticati (atterraggio diretto dopo il login).

### Security
- `public.is_member()` spostata nello schema **`private`** (non più esposta come endpoint RPC) per chiudere gli advisor di sicurezza Supabase 0028/0029, mantenendo la RLS funzionante.

### Changed
- L'`Itinerary` salvato in cloud preserva geometria reale del tracciato e profilo altimetrico per tratta.

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

[0.10.5]: https://github.com/gperniola/TrekTrak/releases/tag/v0.10.5
[0.10.4]: https://github.com/gperniola/TrekTrak/releases/tag/v0.10.4
[0.10.3]: https://github.com/gperniola/TrekTrak/releases/tag/v0.10.3
[0.10.2]: https://github.com/gperniola/TrekTrak/releases/tag/v0.10.2
[0.10.1]: https://github.com/gperniola/TrekTrak/releases/tag/v0.10.1
[0.10.0]: https://github.com/gperniola/TrekTrak/releases/tag/v0.10.0
[0.9.2]: https://github.com/gperniola/TrekTrak/releases/tag/v0.9.2
[0.9.1]: https://github.com/gperniola/TrekTrak/releases/tag/v0.9.1
[0.9.0]: https://github.com/gperniola/TrekTrak/releases/tag/v0.9.0
[0.8.0]: https://github.com/gperniola/TrekTrak/releases/tag/v0.8.0
[0.7.1]: https://github.com/gperniola/TrekTrak/releases/tag/v0.7.1
[0.7.0]: https://github.com/gperniola/TrekTrak/releases/tag/v0.7.0
[0.6.2]: https://github.com/gperniola/TrekTrak/releases/tag/v0.6.2
[0.6.1]: https://github.com/gperniola/TrekTrak/releases/tag/v0.6.1
[0.6.0]: https://github.com/gperniola/TrekTrak/compare/49fe267...8796c62
[0.4.0]: https://github.com/gperniola/TrekTrak/compare/166329c...49fe267
[0.3.0]: https://github.com/gperniola/TrekTrak/compare/855dea1...166329c
[0.2.0]: https://github.com/gperniola/TrekTrak/compare/v0.1.0...855dea1
[0.1.0]: https://github.com/gperniola/TrekTrak/commits/develop
