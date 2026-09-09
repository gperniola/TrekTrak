# Meteo del percorso: perché diceva «nuvoloso» sotto un temporale — misure del 2026-09-09

Nasce da tre segnalazioni dell'utente, nell'arco di una giornata:

> «sul percorso mi dice nuvoloso ma se apro meteoblue mi dice temporali e piogge»

> «anche con "piogge deboli" segna verde, nessuna criticità»

> «"pioggia 78%, possibili temporali forti" … però l'iconcina cielo mostra "sereno", perché?»

Tutti i numeri qui sono **misurati** contro i servizi veri il 2026-09-09, e la parte
centrale — la classifica fra i modelli — è verificata contro **osservazioni**, non contro
un altro modello. Lo script che rifà le misure è `meteo-verifica-modelli.py`, nella stessa
cartella: la prossima volta si rimisura invece di discutere.

Il punto del documento è che le tre segnalazioni sono **difetti diversi**, e che il più
grave non è quello che sembrava. Il terzo è arrivato **dopo** le correzioni dei primi due:
la stessa frattura fra corsa singola ed ensemble, sopravvissuta in un posto che non avevo
guardato.

---

## Difetto B — i codici di precipitazione non li legge nessuno

Il più semplice, e quello che ha prodotto la seconda segnalazione.

`classifyHour` (`src/lib/route-weather.ts:302`) guarda **solo** i codici 95/96/99:

```ts
const CODICI_TEMPORALE: Record<number, string> = { 95: …, 96: …, 99: … };
if (codiceNoto && CODICI_TEMPORALE[o.weatherCode]) { … alza(3); }
```

Tutti gli altri codici di precipitazione — **51-57 pioviggine, 61-67 pioggia, 71-77 neve,
80-86 rovesci** — non entrano nel giudizio. `cielo.ts` mappa tutte e ventotto le voci WMO
per **disegnare** l'iconcina, ma la funzione che **giudica** le ignora: l'unica cosa che
può far scattare un avviso di pioggia è la *probabilità* (≥40%).

Misurato su 4 punti italiani × 72 ore: **7 ore** in cui il modello dichiara pioggia o neve
e l'app resta a livello 0, senza scrivere alcun motivo. Cinque di quelle sette sono
`codice 80 = rovesci deboli`.

È la classe di difetto già pagata tre volte in questo progetto — un dato mostrato a
schermo e **mai riletto dalla logica** (`slim`, `trektrak_user_level`, `positionStore.at`).

---

## Difetto A — un solo modello, e la variabile meno sensibile che ha

L'app chiedeva a Open-Meteo il `best_match` (che in Italia risolve in ICON) e ne mostrava
due variabili come se fossero «la previsione»: `weather_code` per la colonna «Cielo» e
`precipitation_probability` come grilletto principale del giudizio.

Per il tempo **convettivo** — il temporale estivo, cioè il caso che conta in montagna —
`weather_code` è la variabile meno sensibile disponibile: descrive solo la pioggia che
cade *in quella cella* in *quella singola corsa*.

Misurato su 4 punti (Maiella 2100 m, Monte Bianco, Campo Imperatore, Appennino
tosco-emiliano), 288 ore:

| misura | risultato |
|---|---|
| ore col cielo «tranquillo» (codici 0-3) sopra un segnale di pioggia | **25 su 288 (9%)** |
| ore in cui l'app direbbe **verde** e ECMWF o GFS prevedono precipitazione | **62 su 288 (22%)** |
| caso peggiore | `prob = 98%` con l'iconcina **☁️ coperto** |

Il caso più netto, e quello che spiega la segnalazione parola per parola:

```
Maiella  2026-09-10 19:00 UTC
  app:   codice=3 (coperto), prob=0%, CAPE=900   ->  VERDE
  ECMWF: codice=95  =  TEMPORALE
```

---

## Difetto C — l'iconcina diceva «sereno» sotto un avviso di pioggia

Segnalato dall'utente il 2026-09-09, dopo le correzioni precedenti:

> «"pioggia 78%, possibili temporali forti, raffiche 31 km/h" per strada statale Appia 7
> alle 17 di oggi, però l'iconcina cielo mostra "sereno", perché? forse temporali con
> schiarite viene visto come sereno?»

**No: quel codice WMO non esiste.** È di nuovo la frattura del difetto A, sopravvissuta in
un posto che non avevo guardato — la colonna «Cielo». Le due variabili rispondono a due
domande diverse:

- **`weather_code`** è il cielo di **una** corsa del modello in quella cella a quell'ora;
- **`precipitation_probability`** viene da un **insieme di simulazioni**.

Quella corsa era capitata fra le asciutte. Dati veri di quel pomeriggio, ECMWF sulla SS7
(40,83 / 16,50):

| ora it. | codice | probabilità | CAPE |
|---|---|---|---|
| 17:00 | 51 pioviggine | 65% | 1350 |
| **18:00** | **0 sereno** | **54%** | 1850 |
| 19:00 | 0 sereno | 31% | 2340 |

**Quanto spesso**, sui due mesi e le 8 stazioni della verifica principale:

| | cielo senza pioggia + probabilità da «attenzione» in su | di cui con l'iconcina del sole |
|---|---|---|
| ECMWF | 760 ore su 11.904 = **6,4%** | 196 = 1,6% |
| ICON | 897 su 11.904 = **7,5%** | 85 = 0,7% |

Circa un'ora su quindici, e concentrata nei giorni convettivi — cioè quelli in cui la
tabella serve.

### La strada che sembrava migliore, e perché è stata scartata

Domanda dell'utente: *«l'ensemble che ti dà bagnato non ha nulla per mostrare l'iconcina
corretta? non ha variabile cielo come la run singola?»*

**Ce l'ha.** `ensemble-api.open-meteo.com` espone `weather_code` **per ogni membro** — 51
per `ecmwf_ifs025`, 40 per `icon_seamless` — accetta `elevation`, e una sola chiamata copre
entrambi i modelli. Quindi si poteva **contare** il cielo invece di dedurlo.

Misurato, non è la strada giusta, per tre ragioni indipendenti.

**1. Nel caso segnalato non avrebbe mostrato pioggia.** Alle 18:00, i 51 membri ECMWF:

```
19 poco nuvoloso   14 pioviggine   9 sereno   9 parz. nuvoloso
```

La maggioranza dà **poco nuvoloso**. I bagnati sono 14 su 51 (27%): una minoranza. Toglie
il «sereno», non mette la pioggia.

**2. I membri e la probabilità dichiarata sono due popolazioni diverse.** Alla stessa ora:

| ora it. | membri con codice di pioggia | membri con > 0,1 mm | probabilità dichiarata |
|---|---|---|---|
| 15:00 | 84% | 50% | **29%** |
| 18:00 | 27% | **5%** | **54%** |

Il 54% **non viene da quei 51 membri** (la documentazione parla di ~30 simulazioni).
Mettere nella stessa riga un'iconcina contata su una popolazione e una percentuale presa da
un'altra sarebbe **mescolare le fonti** — la regola che questa stessa versione ha appena
stabilito per i due modelli. Nota a margine: l'ensemble ECMWF è **a passo di tre ore**, quindi
tre ore consecutive riportano gli stessi conteggi.

**3. Costo e una trappola.** 12 punti × 3 giorni × due modelli = **299 KB** contro i 17 KB
della chiamata attuale (un percorso tipico da 5-6 punti su 2 giorni starebbe sui 100 KB). E
l'host è `ensemble-api.open-meteo.com`: la regola `NetworkOnly` del service worker copre
`api.open-meteo.com` e **non lo intercetterebbe**, quindi le previsioni finirebbero nella
cache generica da un'ora — il difetto della v0.13.5.

Più un costo di sostanza: l'ensemble ECMWF gira a ~25 km di maglia contro i 9 km della corsa
singola. Si guadagnerebbe il consenso e si perderebbe risoluzione, su un'app dove la cella di
valle e quella di cresta sono due mondi.

### Cosa si è fatto

L'iconcina **segue la probabilità**: sopra la soglia d'attenzione *di quel modello* e con un
codice che non dichiara precipitazione, mostra «possibile pioggia». Una variabile sola, la
stessa che decide il colore del pallino, alla risoluzione fine del modello, zero byte in più.
**La nebbia è esclusa**: in montagna è un pericolo suo, e coprirla toglierebbe informazione.

Il dettaglio della riga dice sempre cosa aveva detto la corsa, e «Come si legge» spiega la
differenza fra una corsa e un insieme — è il punto didattico dietro tutta questa storia.

---

## Come fanno i siti a prevedere temporali che «i modelli non dicono»

Domanda dell'utente, e la risposta è tutta nella variabile che si legge, non nel modello.

**La probabilità di pioggia di Open-Meteo è già ensemble.** Documentazione:
*«Probability is based on ensemble weather models with 0.25° (~27 km) resolution. 30
different simulations are computed»*. Quindi quando ECMWF dà 65% mentre la sua corsa
deterministica dà `codice 0, 0,0 mm`, non è una contraddizione: sono **due domande
diverse** alla stessa previsione.

I siti leggono la distribuzione; l'app leggeva una singola estrazione.

Poi c'è la scala. Confronto su **Maiella 2100 m, 10/09 ore 16:00 italiane**, stesso punto,
stessa ora:

| fonte | cosa dice |
|---|---|
| ICON deterministico 7-11 km *(quello che usava l'app)* | coperto, 0,3 mm, prob. 3% |
| ECMWF deterministico | coperto, 0,0 mm, prob. 40-43% |
| **ECMWF ensemble, 51 membri** | **19% dei membri** fa piovere, massimo 1,5 mm |
| ICON ensemble, 40 membri | 0-2%, massimo 0,3 mm |
| ICON-2I 2,2 km (ARPAE) | pioggia, **9,7 mm/h** |

Nessuna di queste è «la verità». Un modello a 2,2 km azzecca il *carattere* e la
*finestra* della convezione, ma la **posizione esatta della cella è quasi casuale** — e
l'ensemble, che misura proprio l'incertezza, gli dà contro. È il motivo per cui un sito
scrive «rovesci e temporali nel pomeriggio sulla dorsale» e non «alle 16:00 su quella
cresta»: la prima è verificabile, la seconda no.

---

## Quali modelli esistono davvero per l'Italia

Misurato interrogando l'API sui 4 punti (una richiesta con più punti fallisce **tutta** se
un solo punto è fuori dominio: le esclusioni sotto valgono per l'Appennino centrale).

| modello | copertura | maglia | orizzonte | probabilità |
|---|---|---|---|---|
| `ecmwf_ifs` | sì | 9 km (HRES) | 168 h | **sì** |
| `ecmwf_ifs025` | sì | 25 km | 168 h | sì |
| `icon_seamless` / `icon_eu` | sì | 11 / 7 km | 168 h | **sì** |
| `gfs_seamless` | sì | 13-25 km | 168 h | sì |
| `gem_seamless` | sì | ~15 km | 168 h | sì |
| `italia_meteo_arpae_icon_2i` | sì | **2,2 km** | **85 h** | **no (0 valori su 48)** |
| `meteofrance_arpege_europe` | sì | 11 km | 168 h | no |
| `knmi_/dmi_harmonie_arome` | sì | 5,5 km | — | no |
| `icon_d2` · `meteoswiss_icon_ch1` | **no** — «No data is available for this location» | 2 km | 48 h | — |
| `ukmo_uk_deterministic_2km` | **no** | 2 km | — | — |
| `ecmwf_aifs025` | sì ma **0 codici validi su 48** | 28 km | — | no |

Due trappole trovate strada facendo:

- **`ecmwf_ifs_hres` non esiste**: l'API risponde *«Cannot initialize MultiDomains from
  invalid String value»*. Gli identificativi validi sono `ecmwf_ifs` (distinto da
  `ecmwf_ifs025`: codici diversi, stessa probabilità) e `ecmwf_ifs04` (valido ma senza
  dati). Che `ecmwf_ifs` sia il 9 km è quanto dice la documentazione, **non verificato in
  modo diretto**.
- **ICON-2I non fornisce `precipitation_probability`**: con un impianto che giudica sulla
  probabilità, quel modello sarebbe muto per costruzione.

---

## La verifica che conta: 2 mesi, 8 stazioni, temporali **osservati**

Le due segnalazioni si spiegavano entrambe con «passa a ECMWF», ma erano **due casi**. Un
deterministico che azzecca un pomeriggio è esattamente ciò che ci si aspetta per caso.
Quindi: misura vera.

**Impianto.** Luglio-agosto 2026. Otto stazioni italiane con METAR
(Gioia del Colle, Perugia, Bolzano, Bergamo, Firenze, Villafranca, Genova, Ancona).
Verità = **temporale osservato** (`TS`/`TSRA`/`VCTS` nel METAR, archivio Iowa State).
Previsioni recuperate dall'**archivio delle previsioni** di Open-Meteo alle stesse
coordinate e alle stesse ore. Giudizio calcolato con `classifyHour` tradotta riga per riga.
Tolleranza temporale **±1 ora** (la convezione non si giudica al minuto).

**Campione: 11.904 ore-stazione, di cui 171 con temporale osservato.**

### Con le soglie attuali dell'app

| | temporali presi | falsi allarmi | ore in allarme |
|---|---|---|---|
| regola app + **ICON** *(com'era)* | 99 / 171 = **58%** | 310 | 4% |
| regola app + **ECMWF** | 123 / 171 = **72%** | **1045** | 11% |

ECMWF prende 24 temporali in più ma **triplica i falsi allarmi**. Con le soglie tarate a
occhio, «passare a ECMWF» non è un miglioramento netto: è uno scambio.

### Senza soglie — chi discrimina meglio

**AUC** (probabilità che un'ora con temporale abbia previsione più alta di una senza;
0,5 = a caso):

- ICON: **0,891**
- ECMWF: **0,927**

Probabilità media prevista:

| | ore **con** temporale | ore senza | separazione |
|---|---|---|---|
| ICON | **38,7%** | 2,9% | 13,2 × |
| ECMWF | **63,7%** | 9,3% | 6,8 × |

### A parità di temporali presi, quanto costa

| presi | ICON | ECMWF |
|---|---|---|
| 50% | soglia 33% → 350 falsi | soglia 71% → 418 falsi |
| 70% | soglia 15% → 724 falsi | soglia 45% → 903 falsi |
| 80% | soglia 8% → 1070 falsi | soglia 32% → 1266 falsi |
| **90%** | **irraggiungibile** (servirebbe soglia 0%) | soglia 19% → 1845 falsi |

**Conclusione.** ECMWF discrimina meglio ed è l'unico che arriva a coprire il 90% dei
temporali. ICON è competitivo — e un po' più economico — nella fascia media, ma satura:
non può avvisare oltre una certa soglia perché la sua probabilità, quando il temporale c'è,
vale in media 38,7%.

### Il difetto vero non è il modello, sono le soglie

L'app usa **40% → giallo** e **70% → arancione** per entrambi. Ma con ICON la media nelle
ore di temporale è **38,7%**: la soglia dell'arancione è **strutturalmente irraggiungibile**.
Ecco perché ad Altamura era verde.

Soglie ricavate dalla misura, per modello:

| modello | soglia | temporali presi | falsi allarmi | ore in allarme |
|---|---|---|---|---|
| ECMWF | 15% | 93% | 2.096 | 21% |
| **ECMWF** | **32%** | **81%** | **1.266** | **13%** |
| ECMWF | 45% | 70% | 903 | 10% |
| ICON | 5% | 83% | 1.293 | 13% |
| **ICON** | **10%** | **78%** | **937** | **10%** |
| ICON | 15% | 70% | 724 | 8% |

**ECMWF 32% e ICON 8-10% danno la stessa sensibilità.** È il punto di taratura scelto: così
cambiare modello dalla tendina non cambia di nascosto quanto l'app avvisa.

### Limiti, dichiarati

Le 8 stazioni stanno fra **3 e 350 m** — sono aeroporti di valle, non creste: la convezione
in quota può comportarsi diversamente. `VCTS` è «temporale nelle **vicinanze**», definizione
generosa. È **una sola estate**, 171 eventi, con ±1 ora di tolleranza. La classifica fra i
due modelli la considero solida; i **valori assoluti** delle soglie andranno riverificati se
un domani si trovano osservazioni in quota.

---

## Il caso reale del 2026-09-09: temporale sulla Murgia

Segnalato dall'utente mentre stava succedendo. Serve da caso di prova per i test.

**Osservazioni** — Gioia del Colle (LIBV), ~20 km da Altamura:

```
14:55 it.  FEW040TCU                 cumuli in sviluppo
16:55 it.  VCTS FEW040CB … RETS      temporale nelle vicinanze + temporale recente
17:55 it.  VCTS FEW040CB             ancora in zona, temperatura 30 → 27
```
E Grottaglie: `-TSRA`, poi `TS` — temporale con pioggia **sulla stazione**.

**Cosa avrebbe detto l'app, ad Altamura**, con le regole allora in vigore:

| ora | con ICON *(com'era)* | con ECMWF |
|---|---|---|
| 15:00 | **VERDE** — cod. 2, prob. 3% | GIALLO — cod. 51, prob. 29% |
| 16:00 | **VERDE** — cod. 2, prob. 18% | **ROSSO** — pioggia 53% · possibili temporali forti |
| 17:00 | GIALLO — *solo «raffiche 32»* | **ROSSO** — pioggia 65% · possibili temporali forti |
| 18:00 | GIALLO — cod. **0 «sereno»** | **ROSSO** — pioggia 54% · possibili temporali forti |

La riga delle 17:00 mostra i due difetti insieme: il modello aveva in mano `codice 80 =
rovesci deboli` e l'unico motivo scritto è il vento.

E ICON-2I, per lo stesso punto: **6,9 mm/h alle 17:00**, 4,4 alle 18:00.

---

## Meteoblue: perché no (per ora)

- **Non è fra i modelli di Open-Meteo.** Verificato sulla documentazione: ci sono ECMWF,
  ICON, ARPEGE/AROME, Met Office, HARMONIE, GFS, HRRR, JMA, GEM — non Meteoblue.
- **Scraping della pagina: non arrivano dati.** La richiesta al loro sito restituisce
  **5.522 byte** contenenti `window._cf_chl_opt`, cioè la **pagina di sfida di Cloudflare**:
  zero valori meteo. In più la risposta non ha `Access-Control-Allow-Origin`, quindi dal
  browser è illeggibile e servirebbe comunque un nostro server. Superare la sfida
  richiederebbe un browser headless per ogni richiesta: è **aggirare un controllo
  d'accesso**, non leggere una pagina pubblica.
  Onestà: il loro `robots.txt` è `Disallow:` **vuoto** — non vieta il crawling — e la pagina
  dei termini cercata dà 404, quindi **nessun divieto contrattuale verificato**. Il blocco
  trovato è tecnico.
- **La loro API gratuita esiste**: 10 milioni di crediti per un anno, chiave **su
  richiesta**, e la loro documentazione raccomanda di chiamarla da un backend (firma
  HMAC-SHA256 o allowlist di domini). Resta la strada legittima se un domani si vogliono i
  loro numeri: chiave server-only + route proxy, come `/api/fires`.
- **Il link alla loro pagina invece funziona** e non richiede niente:
  `https://www.meteoblue.com/it/tempo/settimana/{lat}N{lon}E` — verificato con un browser
  vero, titolo *«Meteo 42.2°N 14.28°E - meteoblue»*. È la voce del menu ⋮ di ogni riga.

---

## Cosa si è deciso

Progetto in `docs/superpowers/specs/2026-09-09-meteo-modelli-e-soglie-design.md`.

1. I codici di precipitazione entrano in `classifyHour` (difetto B).
2. Due modelli in **una** chiamata, ma **uno solo alla volta possiede la riga**: tendina di
   scelta nel pannello, niente dati mescolati fra fonti.
3. Soglie **per modello**, con i valori misurati qui: ECMWF 15/32, ICON 5/10.
4. Colonna CAPE via dalla tabella (resta nel giudizio, detto a parole), millimetri al suo
   posto, colorati per gravità.
5. Menu ⋮ per riga con «Apri su Meteoblue».
6. L'iconcina segue la probabilità quando il codice la contraddice (difetto C).

**Scartato con misura:** l'iconcina contata sui membri dell'ensemble (vedi difetto C).

**Rimandati:** ICON-2I come indicatore «localmente forti», Meteoblue via API.
