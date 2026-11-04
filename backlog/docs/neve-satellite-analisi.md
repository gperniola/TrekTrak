# Layer neve: «non funziona o non c'è niente?» — misure del 2026-10-16

Nasce da una segnalazione dell'utente:

> «è finalmente arrivata la prima neve sulla maiella e sul gransasso, ho quindi provato a
> visualizzare la mappa di copertura nevosa ma non riesco a capire se il layer sulla mappa
> ha qualche problema di visibilità o se non sta effettivamente funzionando. conta che di
> neve ne è caduta solo a quote elevate e abbastanza poco»

I numeri qui sono **misurati** contro i servizi veri il 2026-10-16. Lo script che rifà le
misure è `neve-satellite.py`, nella stessa cartella. Dove un fatto è solo **letto** (in una
documentazione o in un avviso) è scritto.

In breve: **il layer non è rotto, ma non sa rispondere alla domanda dell'utente**. Quel
giorno una mappa vuota era quasi vera: la neve del 13 ottobre il 15 era sparita. Però l'app
non poteva dirlo, perché nube e «niente neve» sono identiche a schermo. In più la misura ha
trovato **quattro difetti veri** che col caso dell'utente non c'entrano. Uno di questi
disegna rumore sulla mappa.

---

## Cosa è successo alla neve

Finestra di 9×9 pixel (~4×4 km) attorno alla cima, mattonelle GIBS di livello 8 (~454 m
per pixel a 42°N). I numeri sono «pixel di neve / di nube / senza neve» su 81.

| | 13/10 | 14/10 | 15/10 | 16/10 |
|---|---|---|---|---|
| **Maiella**, MODIS Terra | **60** / 18 / 3 | 10 / 64 / 7 | 6 / 6 / **68** | 0 / **66** / 15 |
| **Maiella**, MODIS Aqua | **62** / 2 / 17 | 12 / 35 / 34 | 0 / 81 / 0 | non ancora pubblicato |
| **Gran Sasso**, MODIS Terra | 5 / 0 / 57 | 3 / 33 / 37 | 0 / 0 / **81** | 1 / **73** / 7 |
| **Gran Sasso**, MODIS Aqua | 2 / 28 / 35 | **34** / 35 / 12 | 0 / 81 / 0 | non ancora pubblicato |

E con Sentinel-2 (20 m, classe SCL 11 = neve), il 13/10 alle 10 UTC a cielo quasi sereno:
**Maiella 67% di neve**, **Gran Sasso 0,1%**. Dal 14 al 16 Sentinel-2 non è passato.

La lettura:

- Sulla **Maiella** la neve c'era, e la vedono due sensori indipendenti alla stessa ora
  (Terra e Aqua) più Sentinel-2. Il **15/10**, con cielo libero, Terra la dà quasi
  sparita. Quel giorno i modelli portano lo zero termico a circa 4000 m, con massime di
  +8/+10 °C in vetta.
- Sul **Gran Sasso** le prove sono deboli e in contrasto. Il solo segnale forte è Aqua del
  14/10 (34 su 81). Sentinel-2 il giorno prima, a cielo sereno, non vede quasi niente.
- Il **16/10** le cime sono sotto le nubi. Il layer mostrava solo quel giorno, quindi la
  mappa era vuota.

### Prova di controllo: il calcare non inganna

Maiella e Gran Sasso sono calcare chiaro sopra il bosco. Andava escluso che MODIS lo
scambiasse per neve. Nei giorni sereni d'estate (5/8, 15/8, 5/9) tutte e quattro le cime
danno **81 su 81 senza neve**. Il segnale del 13/10 è vero.

### I modelli non la vedono

Open-Meteo, coi modelli ECMWF IFS, ICON e **ICON-2I** (quello italiano a 2,2 km), dà
**zero neve caduta e zero neve al suolo** su tutte le cime dal 9 al 16 ottobre. Eppure dà
10-20 mm di precipitazione e minime di -5 °C in vetta. La fase (pioggia o neve) si decide
alla quota della griglia del modello, che sui massicci stretti è molto più bassa della
cima. Per «c'è neve in quota?» **i modelli non sono una fonte**.

---

## I difetti del layer

### 1. «Nessun dato» arriva come un 200 — e a volte è rumore

Per un giorno dentro il periodo dichiarato ma non ancora pubblicato, GIBS **non risponde
con un errore**: risponde 200, con `etag: 1000000000000` e senza l'header
`layer-identifier-actual`. Il corpo **cambia a ogni richiesta**. Otto richieste identiche
alla mattonella Aqua del 16/10 hanno dato:

- 4 volte un PNG da 136-166 KB con **circa il 70% dei pixel visibili**: rumore colorato a
  strisce, che Leaflet disegna;
- 3 volte un PNG vuoto da 935 B;
- 1 volta un PNG in scala di grigi.

In altre prove sono arrivati anche degli HTTP 500.

Conseguenze in `EmergencyXyzLayer`:

- il ripiego sul giorno prima scatta su `tileerror`, che con un 200 **non arriva**;
- l'app resta sul giorno senza dati, può disegnare rumore, e il pannello scrive «Immagine
  del <oggi>».

Per Terra la finestra in cui succede è la mattina, prima che il passaggio sia pubblicato
(passa fra le 07:25 e le 09:05 UTC, e serve circa un'ora di lavorazione). È proprio quando
si guarda prima di partire. Su Aqua e VIIRS il 16/10 l'ho visto. La mattina di Terra non
l'ho potuta osservare: Terra quel giorno era già pubblicato.

**Da un `<img>` gli header non si leggono**: per riconoscere «nessun dato» serve `fetch`.

### 2. Una mattonella in errore fa scendere di un giorno tutto il layer

`inErrore` cambia il giorno dell'intero layer al primo `tileerror`. La pubblicazione però
arriva **a pezzi**: il 14/10 la mattonella del Gran Sasso rispondeva 404 mentre quella
della Maiella, con la neve, c'era. E dei 404 visti alle 15 erano diventati 200 qualche ora
dopo.

### 3. Nube e «niente neve» sono identiche a schermo

Nella tavolozza del PNG tutte le classi speciali (nube, niente neve, acqua, notte...) sono
`alpha = 0`. La differenza fra «ho visto: niente neve» e «non ho visto: c'era una nube» è
**la domanda dell'utente**, e oggi l'app non può darla.

L'informazione però c'è, perché ogni classe trasparente ha un RGB suo nella tavolozza
(nube `0,191,255`, niente neve `0,255,0`). **Un canvas del browser la perde**. Provato in
Chromium e in WebKit, con `createImageBitmap(..., { premultiplyAlpha: 'none' })`: 65.438
pixel trasparenti su 65.438 escono senza colore. La decodifica a mano del PNG, con
`DecompressionStream('deflate')`, invece li distingue: 1.599 nube, 61.177 niente neve, 98
neve, in 3-4 ms per mattonella.

Le mattonelle valide sono sempre 256×256, a tavolozza da 8 bit, non interlacciate, con 1-2
IDAT. Pesano 1,6-6,2 KB a livello 8. CORS: `Access-Control-Allow-Origin: *`.

### 4. La fonte sta per spegnersi

Il layer usa **solo MODIS Terra**.

- **Letto** (avviso Earthdata del 2025): Terra e Aqua si spengono fra fine 2026 e inizio
  2027.
- **Letto** (avviso Earthdata aggiornato il 14/10/2026): **Suomi NPP smette di consegnare
  dati il 2/11/2026**.
- Restano **VIIRS NOAA-20 e NOAA-21**. Hanno la stessa color map, lo stesso schema di URL e
  lo stesso livello 8, quindi i 375 m nativi in GIBS diventano ~454 m.

Attenzione: il 13/10 i tre VIIRS hanno classificato come **nube** 56-66 dei pixel della
Maiella che MODIS dava come neve. Che sia la maschera nubi di VIIRS a scambiare la neve
fresca per nube non è verificato.

---

## Le fonti valutate

| Fonte | Risoluzione | Nubi | Accesso | Esito sul caso |
|---|---|---|---|---|
| GIBS MODIS Terra/Aqua | ~454 m, 1 passaggio al giorno ciascuno | trasparenti, distinguibili solo decodificando | aperto, CORS `*` | vede la neve il 13-14 e la sua scomparsa il 15 |
| GIBS VIIRS NOAA-20/21 (e SNPP fino al 2/11) | ~454 m in GIBS | idem | aperto, stessa forma | erede obbligato; il 13/10 ha visto nube dove MODIS vedeva neve |
| GIBS composti (8 giorni, mensili, «Cloud-Gap-Filled») | — | — | — | 8 giorni fermo al 30/9, mensile al 1/9; i CGF non sono in GIBS (solo HDF su NSIDC, con login) |
| Copernicus HR-S&I **GFSC** 60 m, senza nubi | 60 m, giornaliero | riempite con osservazioni fino a 7 giorni prima | i vecchi WMS `cryo.land.copernicus.eu/wms/*` sono **morti** (403); i dati richiedono un account CDSE | **scartato**: il 15/10 dava ancora la Maiella al 60% (teneva ferma la vista del 13), sul Gran Sasso non ha riempito le nubi, l'età del dato non è esposta |
| Copernicus SCE Europa 500 m | 500 m, giornaliero | no | account CDSE | coerente con MODIS (Maiella 61% → 2% fra il 13 e il 15) |
| **Sentinel-2 L2A** via Earth Search | **20 m**, ogni 2-3 giorni | no | **aperto, nessuna chiave, CORS `*`, letture parziali (206)** — verificato | l'unica fonte che vede bene la neve sottile (67% Maiella il 13/10); dal 14 al 16 nessuna scena |
| NOAA IMS 1 km (analisi senza nubi) | 1 km | analisi umana | aperto, ma file polare da 600 MB | **scartato**: non ha mai visto questa neve |
| EUMETSAT MTG «Snow RGB» | ~1 km, ogni 10 min | composito da interpretare | aperto, stesso server del layer instabilità | vede la macchia sulla Maiella il 13 e la sua assenza il 15-16 |
| Modelli Open-Meteo | — | — | già in uso | **scartato**: zero neve sulle cime |
| Meteomont | stazioni | — | API senza CORS | ultimi rilievi d'Abruzzo a maggio: fuori stagione |

Copernicus, IMS, MTG e Meteomont li ha provati la ricerca della sessione. Gli script
sono rimasti fuori dal repository. Sentinel-2 (ricerca, CORS, scena del 13/10) l'ho
riverificato io.

---

## Il composito «ultima vista libera»: utile, ma non qui

La prima proposta era comporre, pixel per pixel, l'ultima osservazione senza nube degli
ultimi giorni. Alla prima misura sembrava risolvere tutto: oggi sulla Maiella 28 pixel di
neve, sul Gran Sasso 38. **Era sbagliato**. Le mattonelle Terra del 15/10 alle 15
rispondevano 404, e il composito saltava proprio il giorno che diceva «sciolta». Ore dopo
sono arrivate. Con i dati completi lo stesso composito dà:

| Cima | Terra + Aqua (5 giorni) | Tutti e 5 i sensori |
|---|---|---|
| Maiella | 4 neve / 77 senza | 0 / 81 |
| Gran Sasso | 1 / 80 | 3 / 78 |
| Velino | 0 / 81 | 0 / 81 |
| Vettore | 0 / 81 | 0 / 81 |

Il composito serve **quando le nubi durano giorni sopra una neve che resta**, cioè in
inverno. Non avrebbe mostrato la neve del 13 il 16, e non doveva: la neve non c'era più.
Due lezioni:

- **I dati satellitari arrivano a pezzi e in ritardo.** Un buco nel composito va
  dichiarato, mai trattato come «senza neve». Lo script ora elenca i passaggi assenti.
- **Un pixel visto tre giorni fa può essere già sciolto**: fra il 13 e il 15 la Maiella è
  passata da 60 pixel a 6. L'età della vista va mostrata.

---

## Cosa si propone

**Passo 1 — un layer che dice il vero** (serve comunque, per i difetti 1-4):

- mattonelle via `fetch`, con il riconoscimento della risposta «nessun dato» (header);
- decodifica della tavolozza e **tre stati a schermo**: neve, niente neve, non visto
  (nube);
- più sensori: Terra e Aqua finché vivono, più NOAA-20 e NOAA-21;
- ripiego **per mattonella**, non per layer;
- composito corto (~3 giorni) con l'età dichiarata.

Correggere il difetto 1 richiede già `fetch`: a quel punto la decodifica costa poco in più.

**Passo 2 — solo se serve:** il dettaglio di Sentinel-2 sull'area del percorso («ultima
scena serena: 13/10, neve sopra i 2400 m»). Richiede un lettore di COG oppure una route
server, ed è un progetto a parte.

Scartati: GFSC, modelli, IMS. Il ritocco di opacità diventa inutile, perché con la
decodifica i colori li sceglie l'app.

---

## Neve falsa: misure del 3-4 novembre 2026

Il 3/11 il layer (composito a 5 sensori, v0.33.0) mostrava neve sopra **Chieti** (330 m).
Non c'era. Lo script di questa misura è `neve-falsi.py`, nella stessa cartella: tutti i
numeri qui sotto vengono da lui.

### Il caso: una nube presa per neve, tenuta tre giorni

- La lettura dell'app è giusta. Il mare della mattonella coincide con quello delle quote
  Terrarium; nella tavolozza l'indice *i* è l'NDSI *i* (1 = `240,240,128`, 100 =
  `255,0,0`, 0 = verde «senza neve»).
- Dei 75 pixel di neve entro ~7 km da Chieti, **44 vengono da Aqua del 2/11** (indice
  55-60). In quel passaggio Aqua vede nube su tutta la terraferma della mattonella, tranne
  363 pixel di «neve», tutti sotto i 600 m, e **zero** «senza neve». L'immagine a colori
  veri dello stesso passaggio (`MODIS_Aqua_CorrectedReflectance_TrueColor`) è tutta
  coperta; in 7-2-1 la nube è azzurra, cioè di ghiaccio.
- Il composito lo amplifica in due modi. Dentro il giorno vinceva **Aqua**, il primo
  dell'ordine «dal passaggio più tardo». E una vista sbagliata resta a schermo per tutta la
  finestra di tre giorni.

### Le regole che **non** funzionano (misurate prima della verità di terreno)

Senza un riferimento, sul solo criterio «sotto i 600 m in autunno è falsa»:

- **Soglia sull'indice.** La spec del layer l'aveva già scartata: la neve fresca e sottile
  ha indice basso. Con la verità di terreno: soglia 40 = −76% di falsi ma neve vera
  mostrata dall'87,8% al 73,3%.
- **Quota relativa** (neve implausibile se il terreno più alto nei dintorni è visto senza
  neve): −6% di falsi. Le nubi prese per neve stanno a tutte le quote, quindi sporcano
  anche il terreno di confronto.
- **Niente neve fra le nubi** (una neve circondata da nube nello stesso passaggio vale come
  nube): −3% di falsi. Dopo una nevicata le cime restano fra le nubi, e la neve vera si vede
  negli stessi squarci di quella falsa.

I modelli meteo non bastano come riferimento: sotto i 1000 m sono affidabili (Chieti,
L'Aquila, Venezia: zero neve, minime +4/+11 °C), ma in quota non vedono la neve (vedi
sopra).

### La verità di terreno: Sentinel-2

Per ogni pixel GIBS, la classe SCL di Sentinel-2 L2A dello **stesso giorno** (36 campioni
a 80 m dalla panoramica a 40 m del COG). Il pixel è «neve» se almeno metà dei campioni
chiari è neve, «senza» se al massimo uno lo è; non si giudica con meno dell'80% di
campioni chiari. **13 giornate** quasi serene, 2 mosaici 2×2 di mattonelle z8 (Appennino
centrale; Dolomiti-Veneto-Friuli), tutte le stagioni: neve sottile d'autunno (13/10, 26/10,
31/10), dopo la fusione (16/10), inverno (10/12, 27/12, 1/1, 25/2, 7/3), primavera (4/4,
25/4), estate come controllo (5/7, 14/8). In totale 74.130 pixel di neve vera e 1.236.859
senza neve. Registrazione delle due griglie: l'F1 della neve è massimo a spostamento zero
o col composito spostato di un pixel verso sud (differenze di 0,01-0,02): allineate entro
un pixel.

**Per sensore** (solo il passaggio del giorno della scena):

| Sensore | Neve vera vista come neve / nube / senza | Senza neve detta neve |
|---|---|---|
| MODIS Aqua | 61% / 29% / 10% | **4,6%** |
| MODIS Terra | 68% / 28% / 4% | **3,5%** |
| VIIRS NOAA-20 | 48% / 45% / 8% | 0,33% |
| VIIRS S-NPP | 44% / 49% / 8% | 0,15% |
| VIIRS NOAA-21 (in GIBS solo da ottobre 2026: 4 date) | 23% / 75% / 2% | 0,32% |

Le due facce del problema. **I MODIS fanno 10-30 volte i falsi dei VIIRS**: in alcune
giornate (Dolomiti 26/10, 31/10, 27/12; Appennino 1/1) Aqua e Terra dicono neve sull'11-20%
dei pixel senza neve, e il 14/8 Aqua da solo dipinge 2.841 pixel di neve sulle Dolomiti.
**I VIIRS chiamano «nube» quasi metà della neve vera**, soprattutto quella sottile (il
13/10, 119 pixel quasi tutti sulla Maiella: S-NPP 96%, NOAA-21 86%). La vecchia
osservazione del 13/10 è quindi confermata: è la maschera nubi di VIIRS.

**Per regola** (composito del giorno della scena, contro Sentinel-2):

| Regola | Neve vera mostrata | Neve vera detta «senza» | Falsi |
|---|---|---|---|
| attuale (Aqua, NOAA-20, S-NPP, NOAA-21, Terra) | 87,8% | 11,4% | 48.419 |
| soglia indice 20 | 84,9% | 14,2% | −38% |
| soglia indice 40 | 73,3% | 25,9% | −76% |
| conferma da 2 passaggi | 78,8% | 12,3% | −49% |
| conferma solo per i MODIS | 79,4% | 12,2% | −48% |
| VIIRS prima di MODIS (Aqua, poi Terra) | 88,1% | 11,1% | −77% |
| **VIIRS, poi Terra, poi Aqua** | **89,6%** | **9,6%** | **−77%** |
| VIIRS prima + conferma per i MODIS | 80,3% | 11,3% | −86% |
| VIIRS, Terra, Aqua + conferma per Aqua | 87,4% | 9,7% | −78% |
| solo VIIRS (dopo lo spegnimento dei MODIS) | 66,5% | 8,5% | −89% |
| niente neve fra le nubi | 87,4% | 11,4% | −3% |
| quota relativa | 87,8% | 11,4% | −6% |

**«VIIRS, poi Terra, poi Aqua»** dentro lo stesso giorno (l'ordine fra i giorni resta: oggi
prima di ieri) funziona perché sfrutta i due difetti a incastro. Dove un VIIRS vede il
suolo senza neve, la sua vista vince sul falso dei MODIS; dove un VIIRS chiama nube la neve
sottile, il pixel ricade sui MODIS, che la vedono. Terra prima di Aqua perché sbaglia meno
in entrambi i sensi. Per data, la neve vera mostrata cambia fra −6 punti (Dolomiti 31/10) e
+9 (Appennino 4/4, dove oggi Aqua dice «senza» sul 21% della neve vera e vince per primo);
il 14/8 sale di 14, ma su 14 pixel. I falsi calano in tutte le 13 date tranne il controllo
del 5/7 (13 pixel, Aqua senza dati).

### Cosa resta fuori dalla misura

- **Il caso di Chieti.** Sentinel-2 serve cielo sereno, e i falsi peggiori nascono sotto
  coperture di giorni, dove nessun sensore vede il suolo. Il 3/11, attorno a Chieti, la
  regola vincente porta i pixel di neve da 75 a 60; la variante con la conferma per Aqua a
  28, ma costa 2,2 punti di neve vera nel complesso (Dolomiti 27/12: dal 93,3% all'87,8%).
- **Lo spegnimento dei MODIS** (fine 2026 - inizio 2027): con i soli VIIRS i falsi calano
  dell'89%, ma la neve vera mostrata scende al 66,5%, e la neve sottile al 27% (13/10) e al
  36% (4/4). Il layer vedrà meno neve fresca, e lo dovrà dire.
- La classe neve di Sentinel-2 ha i suoi errori; i pixel «misti» (fra 1 campione e metà) e
  quelli in ombra (classe 2) non si giudicano.

---

## Come si rifà la misura

```
python3 neve-satellite.py misura --sensori terra,aqua 2026-10-13 2026-10-15
python3 neve-satellite.py composito --sensori terra,aqua,noaa20,noaa21 2026-10-16 3
python3 neve-satellite.py vuote "<url di una mattonella di un giorno non pubblicato>" 8
```

Neve falsa (gira con la sola libreria standard; la prima volta scarica circa 400 MB, quasi
tutti nei 201 file SCL di Sentinel-2, poi lavora dalla cache):

```
python3 -I neve-falsi.py regole  apennini 2026-11-03
python3 -I neve-falsi.py sensori apennini 2026-11-03 2026-11-02 2026-11-01 2026-10-31
python3 -I neve-falsi.py verita  apennini 2026-10-13 2026-10-16 2025-12-10 2026-01-01 2026-02-25 2026-04-04 2026-07-05
python3 -I neve-falsi.py verita  dolomiti 2026-10-26 2026-10-31 2025-12-27 2026-03-07 2026-04-25 2026-08-14
```

Sentinel-2:
`https://earth-search.aws.element84.com/v1/search?collections=sentinel-2-l2a&bbox=13.5,42.0,14.15,42.5&datetime=...`;
la classe neve è nel file `SCL.tif` di ogni scena.
