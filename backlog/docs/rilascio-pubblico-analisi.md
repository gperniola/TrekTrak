# Rilascio al pubblico (limitato) — campagna di review e analisi delle criticità

Data: 2026-09-05, dopo la v0.25.0. Cinque giri di review con metodi diversi — è la regola
del progetto: ogni metodo trova classi di difetti sue. Tutti i numeri sono **misurati**.

## La campagna, in sintesi

| giro | metodo | esito |
|---|---|---|
| R1 | diff `v0.23.0..HEAD`, a caccia delle classi già pagate | 3 rilievi (A, B, D sotto) |
| R2 | schermo, flussi da utente nuovo: telefono 412×823 e desktop, due temi | 1 rilievo grosso (C) + conferme |
| R3 | avversaria: ingressi non fidati, route API, `npm audit` | escaping a posto; 1 critico nei pacchetti, corretto |
| R4 | misure su build di produzione | First Load 343 kB; Lighthouse mobile: a11y **100**, SEO 100, best practices 96 |
| R5 | questa analisi | — |

### Corretto in questa campagna

- **(C) Su telefono non esisteva NESSUN accesso a tolleranze, tema e «rivedi tutorial»**:
  `ToleranceSettings` si apriva solo dal pulsante desktop sopra la mappa. Un utente
  pubblico è prima di tutto un utente da telefono: niente tema chiaro/scuro, e per chi
  usa Imparo niente tolleranze. Ora c'è **«⚙️ Impostazioni e tema» nel menu Altro**
  (`settingsOpen` è passato nello store apposta).
- **(B) Il tasto Indietro di Android con la guida-popup aperta proponeva «Uscire da
  TrekTrak?»** — sotto il popup ancora aperto. Al primo avvio in assoluto è la prima cosa
  che un utente nuovo preme. La guida ora sta nella macchina del back (`guidaAperta` in
  `nextBackAction`, priorità massima: un popup modale sta sopra a tutto).
- **(D) «Rivedi tutorial al prossimo avvio» apre la guida SUBITO**: il rinvio era la scusa
  di quando la guida era legata al montaggio della pagina; da popup autonomo non ha più
  ragione. Il flag `guidaAperta` è a due vie: il back la chiude, le impostazioni la aprono.
- **(A)** La carta «Attiva Impara» diceva «da Modalità in cima all'Editor»: su telefono
  sta nel menu Altro. Il testo ora dice entrambi i posti.
- **`npm audit fix`**: jsPDF aveva un avviso **critico** (PDF object injection) → 4.2.1;
  sistemati anche nanoid e brace-expansion. Restano 7 «high» legati a Next 14 (sotto).

### Verificato e risultato sano (quello che NON è un problema)

- **Ingressi non fidati**: il decode dei link condivisi (`#data=`) valida tipi,
  intervalli di coordinate, lunghezze (nome ≤200, waypoint ≤100 char) e coerenza
  punti/tratte; i popup Leaflet in HTML (`bindPopup`) passano tutti da `escapeMarkup`
  (focolai, valanghe, zone DPC), e quelli in JSX (ripari da Overpass, terremoti INGV)
  hanno l'escaping di React. Le route API validano i parametri (`/api/elevation` con
  regex + range) o non ne prendono affatto.
- **Chiavi server-only al loro posto**: `FIRMS_MAP_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
  non toccano il bundle client.
- **Privacy strutturale**: la posizione non viene mai chiesta dall'app di sua iniziativa
  (garanzia della v0.11.5); nessun tracker, nessuna analytics.
- **Onestà dei dati**: disclaimer su meteo e layer d'emergenza («chiama il 112»), ripari
  dichiarati non verificati, età dei dati satellitari a schermo, attribuzioni licenze.
- **Codice**: zero `TODO`/`any`, zero righe morte note, prove/prodotto 1,03, 2017 test
  unità + 39 e2e + 4 offline verdi, guardiani su fuso/tema/dialoghi/cache.
- **Lavoro dell'utente**: autosalvataggio locale (v0.11.8) — una ricarica non perde nulla;
  UpdateBanner per gli aggiornamenti PWA; mappe offline con tetto di cortesia.

---

## Criticità per il rilascio pubblico limitato, in ordine di rischio

### 1. Nessun error tracking: se si rompe sul telefono di qualcun altro, non lo sai — ALTO (di visibilità, non di danno)

Tutta la storia di questo progetto dice che i difetti veri emergono **sui dispositivi
degli altri** (il fuso, WebKit che risponde `prompt` a permesso concesso, la virgola
italiana). Oggi un errore da un utente arriva solo se te lo racconta a voce.

**Azione consigliata (prima del lancio):** un canale di segnalazione esplicito (anche solo
una voce «Segnala un problema» con mailto e versione app preimpostata costa un'ora) e,
se si vuole di più, Sentry free tier — ma è una dipendenza in più e raccoglie dati:
per «poca gente» il mailto può bastare.

### 2. Quote API condivise con chiave nel bundle — MEDIO

- **Thunderforest** (mappa base di default): chiave `NEXT_PUBLIC_`, è il funzionamento
  previsto dal servizio, ma il piano gratuito è **150.000 tile/mese per la chiave,
  condivisi fra tutti gli utenti**. Un utente che pianifica attivamente consuma 1–3 mila
  tile al giorno. Con ~10 persone si può sforare: Thunderforest avvisa e poi serve tile
  vuoti. *Mitigazioni già in casa:* altre 3 mappe base senza chiave (OpenTopoMap, CyclOSM,
  OSM), tetto di 500 tile per il precaricamento offline. *Azione:* tenere d'occhio la
  dashboard TF il primo mese; se serve, cambiare default a OpenTopoMap per gli ospiti.
- **OpenRouteService** (tracciato sui sentieri): chiave `NEXT_PUBLIC_`, quota free
  **2.000 richieste/giorno condivise**; ogni tratta in Pianificazione con routing acceso
  è una richiesta. A quota esaurita il fallback è silenzioso (linea d'aria + DEM): il
  percorso resta corretto ma meno preciso, **senza dirlo**. *Azione:* accettabile per il
  lancio; valutare in seguito un avviso «routing non disponibile, uso la linea d'aria».
- **Nominatim** (nomi dei waypoint): policy 1 req/s aggregata «absolute maximum» — con
  poca gente va bene, ma è il servizio più severo sul bulk. Nessuna azione per ora.
- Open-Meteo, RainViewer, INGV, DPC, EAWS, Overpass: per pochi utenti nessun rischio
  concreto (Open-Meteo conta per IP del client, quindi per utente).

#### Piani a pagamento e alternative, verificati il 2026-09-05

**Tile (oggi: Thunderforest, gratis 150k/mese).** Il primo piano Thunderforest è
**$125/mese** (1,5M tile): non è la strada per un hobby. Le alternative economiche:

| opzione | gratis | primo piano | note |
|---|---|---|---|
| Thunderforest (attuale) | 150k/mese | **$125/mese** (1,5M) | lo stile Outdoors resta il migliore per sentieri |
| **Stadia Maps** | 200k crediti/mese (solo non commerciale) | **$20/mese** (1M) | ha stili terrain/outdoors; TrekTrak è non commerciale → il free basta a lungo |
| MapTiler | 100k/mese | $30/mese (500k) | stile Outdoor, anche raster |
| OpenTopoMap (già in app) | fair-use, senza chiave | — | già il ripiego naturale: cambiare default a OpenTopoMap costa zero |

**Routing (oggi: openrouteservice, gratis ~2.000 directions/giorno).** HeiGIT **non vende
piani**: esiste il piano **Collaborative, gratuito**, con quote più alte, per progetti
umanitari/accademici/non-profit — si chiede via il loro form, e un'app didattica gratuita
è un buon candidato. Alternative a pagamento: GraphHopper (free 500 crediti/giorno non
commerciale; primo piano **€69/mese** — caro), Mapbox Directions (100k/mese gratis, poi a
consumo), oppure **self-host di ORS** col grafo Italia su una VPS da ~€5–10/mese (quota
infinita, ma manutenzione a tuo carico).

**In pratica, per «poca gente»**: i piani gratuiti attuali bastano (150k tile ≈ 5–15
utenti attivi; 2.000 routing/giorno ≈ decine di percorsi). La strategia a basso costo se
si sfora: default tile a OpenTopoMap (gratis, subito) o Stadia $20/mese; per il routing,
richiesta del Collaborative a HeiGIT (gratis) prima di pensare a una VPS.

### 3. `/api/*` senza rate limiting — MEDIO-BASSO

Le quattro route proxy (fires, avalanche, dpc-alerts, elevation) sono pubbliche e senza
limiti: chiunque trovi l'URL può martellarle, consumando la quota FIRMS (5.000
transazioni/10 min, in pratica difficile da esaurire) e le invocazioni Vercel. Per un
rilascio a poca gente il rischio reale è basso; se l'URL diventa pubblico su larga
scala, aggiungere un rate limit (Vercel firewall o middleware).

### 4. Libreria condivisa e `request-access` — SPENTA (2026-09-05)

Il flusso di accesso al momento **non funziona**, quindi ogni ingresso della libreria è
stato nascosto dietro `LIBRERIA_DISPONIBILE = false` (`lib/funzioni-spente.ts`): scheda
della bottom nav, switch Editor/Libreria, Salva/Carica con la loro nota, onboarding.
L'app per il pubblico è locale + export (JSON/GPX/link), che funziona per intero.

Quando si riaccenderà, restano da sistemare prima: il fatto che chi ha il link di invito
può far spedire email a indirizzi arbitrari senza rate limit (SMTP = il tuo Gmail,
~500 email/giorno), e `listUsers()` paginato a 50 che oltre i 50 utenti può far sbagliare
ramo al controllo «esiste già». I test dello stato acceso restano validi (alzano
l'interruttore con `jest.replaceProperty`); lo stato spento ha i suoi in
`libreria-spenta.test.tsx`.

### 5. Vulnerabilità residue nei pacchetti: Next 14 — BASSO (ma da pianificare)

Dopo `npm audit fix` restano 7 avvisi «high» tutti radicati in **Next 14.2** (DoS su
Server Components, cache immagini, postcss in bundle con Next): si chiudono solo con
Next 15/16, che è un major (React 19, cambio di comportamenti di caching). Su Vercel
l'esposizione pratica di questi DoS è ridotta dall'infrastruttura. *Azione:* task
dedicato «migrazione Next 15» dopo il lancio, non sotto pressione.

### 6. Il lavoro vive nel `localStorage` del dispositivo — BASSO (per design, ma da dire)

Per chi non ha l'invito alla libreria cloud, l'itinerario vive solo su quel
browser/dispositivo: pulizia dei dati del sito = lavoro perso, e nessuna sincronia fra
telefono e PC. L'app lo dichiara (scheda Libreria) e offre export JSON/GPX e link di
condivisione. Nessuna azione: è il design; il testo che lo spiega c'è già.

### 7. Cold start e cache per-istanza su Vercel — BASSO

`/api/avalanche` ha ~2,5 s di cold start e cache in memoria per istanza (promemoria di
novembre già in backlog): d'estate il layer valanghe è comunque «nessun dato». Nessuna
azione ora.

### Note minori

- Il badge del cestino e la colonna destra reggono fino a 4 controlli; un quinto
  richiederà un ripensamento (nessuna azione).
- Il First Load è salito a 343 kB (era 322 alla v0.12): fisiologico con le feature nuove,
  ancora sano per una PWA con mappa. Da tenere d'occhio, non da agire.
- Non esiste una privacy policy scritta: l'app non traccia e non chiede la posizione, ma
  il flusso di invito raccoglie email (in Supabase). Per un uso fra conoscenti va bene
  così; se il pubblico si allarga, servirà una riga di informativa.

## Checklist pre-lancio

- [x] Suite completa verde (2017 unit, 39 e2e, 4 offline) e Lighthouse a11y 100
- [x] `npm audit fix` applicato (jsPDF critico chiuso)
- [x] Impostazioni/tema raggiungibili da telefono; back button corretto sulla guida
- [ ] Controllare su Vercel: `SITE_URL` di produzione, tutte le env presenti
- [ ] Dashboard Thunderforest e ORS: sapere DOVE si guarda la quota, prima che serva
- [ ] Voce «Segnala un problema» (criticità 1) — consigliata prima di dare il link
- [ ] Provare il flusso completo su UN iPhone vero (la classe WebKit è già costata una
      versione; i test girano su Chromium)
