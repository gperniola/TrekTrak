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

## Come si rifà la misura

```
python3 neve-satellite.py misura --sensori terra,aqua 2026-10-13 2026-10-15
python3 neve-satellite.py composito --sensori terra,aqua,noaa20,noaa21 2026-10-16 3
python3 neve-satellite.py vuote "<url di una mattonella di un giorno non pubblicato>" 8
```

Sentinel-2:
`https://earth-search.aws.element84.com/v1/search?collections=sentinel-2-l2a&bbox=13.5,42.0,14.15,42.5&datetime=...`;
la classe neve è nel file `SCL.tif` di ogni scena.
