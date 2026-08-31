# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il progetto adotta [Semantic Versioning](https://semver.org/lang/it/).

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
