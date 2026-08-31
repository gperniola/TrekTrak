# Profilo d'uso — separare "imparo" da "vado in montagna"

Stato: progetto approvato il 2026-08-31. Misure raccolte nel browser sulla v0.14.2.
Origine: richiesta dell'utente di staccare la parte didattica dell'app perché
«sta diventando troppo confusionario per l'utente». La proposta iniziale era un
**sottodominio**; l'analisi l'ha scartata (vedi *Perché non un sottodominio*) e ha
portato a un profilo d'uso dentro la stessa app.

## Il problema, misurato

| | |
|---|---|
| Comandi visibili nella vista Mappa | **21** |
| Comandi visibili nell'Editor, con 4 waypoint | **112** (scalano coi waypoint: ~200 con 8) |
| Aree funzionali distinte | **~15** |

Le quindici aree: mappa e waypoint, Learn/Track, editor delle tratte, validazione,
quiz, progresso, bussola, righello, profilo altimetrico, libreria condivisa, sette
layer di emergenza, meteo del percorso, cinque formati di export, impostazioni e
tolleranze, avvisi (allerta DPC alla posizione, aggiornamento, offline).

Conseguenza concreta: **chi apre l'app per imparare a leggere una carta incontra
l'instabilità satellitare di Meteosat e il radar della pioggia prima di aver capito
cos'è un azimut**; e chi la apre per andare in montagna si porta dietro quiz, badge di
validazione e report di apprendimento che non gli servono.

## Perché non un sottodominio

La richiesta iniziale era spostare la parte didattica su un sottodominio. Scartata, con
misure:

- **Learn non è una sezione, è una modalità dello stesso editor su mappa.** Solo-learn
  sono **1.314 righe su 17.014** (~8%); `appMode` si dirama in **17 file**, fra cui
  `page.tsx`, `InteractiveMap`, `MapEvents`, `ElevationProfile`, `WaypointCard`,
  `ActionBar`. Leaflet e react-leaflet sono usati in **23 e 21 file**: servono a
  entrambe le metà. Un'app "solo learn" avrebbe comunque mappa, waypoint, editor,
  profilo altimetrico, storage, export.
- **Il risparmio di peso è già stato fatto in altro modo**: layer di emergenza, pannello
  meteo, Progresso, export PDF e `calculations` sono già caricati su richiesta
  (`dynamic()` / `await import()`), quindi non pesano sul primo caricamento (324 kB).
- **Un sottodominio è un'origine diversa**, e questo costa:
  - il `localStorage` non si condivide: nove chiavi, fra cui
    `trektrak_current_itinerary`, `trektrak_settings`, `trektrak_learning_history`,
    `trektrak_quiz_history`, `trektrak_user_level`. L'itinerario in lavorazione non
    seguirebbe l'utente fra le due metà — contro la garanzia della v0.11.8;
  - service worker e cache sono per origine: due PWA installabili e **le mattonelle
    della mappa scaricate due volte**, mentre dopo la v0.13.5 quella cache *è* la mappa
    offline;
  - la sessione Supabase è per origine: login alla libreria due volte, due URL di
    callback;
  - due build, due deploy, due indicatori di versione, due UpdateBanner.

**La confusione non nasce dal deploy unico**: nasce dal fatto che le quindici aree sono
tutte visibili contemporaneamente. Si risolve a origine singola, senza perdere dati.

## Il concetto: `profilo`

Un `profilo: 'imparo' | 'montagna'` che decide **quali aree esistono**, non solo come si
compilano i valori.

Lo imposta la domanda che **l'onboarding già fa** — *"Sto imparando" / "Sono esperto"* —
che oggi scrive `trektrak_user_level` e decide soltanto `appMode`. Quel collegamento
mancante è il punto di partenza del lavoro: la risposta esiste già e viene quasi
sprecata.

### `profilo` e `appMode` sono due cose diverse

È la distinzione dove è facile sbagliare:

| | `appMode` | `profilo` |
|---|---|---|
| Di chi è | dell'**itinerario** | dell'**utente** |
| Cosa decide | come si compilano i valori (a mano o calcolati) | quali aree si vedono |
| Dove è persistito | con l'itinerario (`trektrak_current_itinerary`) | chiave propria (`trektrak_profilo`) |

In profilo `imparo` l'interruttore Learn/Track **resta visibile**: il confronto
"stimato vs reale" è la funzione migliore dell'app e vive proprio in quel passaggio. In
profilo `montagna` l'interruttore non si mostra e `appMode` è sempre `track`.

Caso da non lasciare ambiguo: **un itinerario costruito in Learn, quando si passa al
profilo Montagna, si mostra in Track**. I valori inseriti a mano non si perdono — è la
garanzia non distruttiva della v0.7.0, che tiene `learnValues` e `trackValues` in
parallelo — e tornando in Imparo si rivedono. Il profilo cambia la vista, non i dati.

## L'assegnazione delle aree

Decisa con l'utente il 2026-08-31.

| Area | Imparo | Montagna |
|---|---|---|
| Mappa, waypoint, editor delle tratte | ● | ● |
| Profilo altimetrico | ● | ● |
| Bussola, righello | ● | ● |
| Export PDF (sintetico e roadbook) | ● | ● |
| Impostazioni mappa e tolleranze | ● | ● |
| Validazione (Verifica + badge + suggerimenti) | ● | |
| Quiz | ● | |
| Progresso (report apprendimento) | ● | |
| Interruttore Learn/Track | ● | |
| Layer di emergenza (tutti e sette) | | ● |
| Meteo del percorso | | ● |
| Avviso di allerta DPC alla posizione | | ● |
| Libreria condivisa | | ● |
| Export dati (GPX, JSON, copia link) | | ● |

Bussola e righello stanno in entrambi perché sono **strumenti didattici prima che da
campo**: misurare un azimut sulla mappa è un esercizio. Il PDF resta in Imparo perché
serve a portarsi l'esercizio su carta.

Una scelta da motivare, perché riguarda la sicurezza: **l'avviso di allerta DPC alla
posizione sta solo in Montagna**. È l'unica funzione dell'elenco che protegge una
persona, e nasconderla non è una decisione da prendere alla leggera. La ragione è che
in Imparo si sta a casa a esercitarsi su una carta, e un banner di allerta idrogeologica
lì è rumore che insegna a ignorare gli avvisi. Chi esce va in Montagna, e
l'interruttore è visibile e nominato proprio perché quel passaggio sia ovvio. Se
all'uso risultasse un errore, la correzione è una riga nella tabella: spostare
`allertaPosizione` fra le aree comuni.

## Come si realizza

### Una tabella dichiarativa, non `if` sparsi

In `src/lib/profilo.ts`:

```ts
export type Profilo = 'imparo' | 'montagna';

export const AREE = {
  validazione:      ['imparo'],
  quiz:             ['imparo'],
  progresso:        ['imparo'],
  switchLearnTrack: ['imparo'],
  layerEmergenza:   ['montagna'],
  meteo:            ['montagna'],
  allertaPosizione: ['montagna'],
  libreria:         ['montagna'],
  exportDati:       ['montagna'],
  bussola:          ['imparo', 'montagna'],
  righello:         ['imparo', 'montagna'],
  pdf:              ['imparo', 'montagna'],
} as const satisfies Record<string, readonly Profilo[]>;

export type Area = keyof typeof AREE;
export function mostra(area: Area, profilo: Profilo): boolean;
```

Motivo della tabella: con quindici aree sparse in una dozzina di componenti, la
domanda «questo pulsante in quale profilo si vede?» deve avere **una sola risposta in
un solo posto**. Altrimenti il difetto tipico è nascondere un ingresso e lasciarne un
altro allo stesso posto.

### Una guardia contro l'area dichiarata e mai applicata

Un test scandisce i sorgenti e pretende che **ogni chiave di `AREE` compaia in almeno
un componente**. È la difesa contro il difetto che in questo progetto è già passato due
volte — il campo scritto e mai riletto (`trektrak_user_level` nella v0.11.8, `slim`
nella v0.13.1) — che qui si manifesterebbe come un pulsante che credo di aver nascosto
e invece è ancora a schermo.

### Stato e persistenza

- `profilo` in `uiStore`, con `setProfilo`.
- Persistito in `localStorage` sotto una chiave nuova in `KEYS` (`profilo`).
- Letto all'avvio come fa `startup-itinerary.ts` per `appMode`: funzione pura che
  decide il profilo iniziale da (chiave `profilo`, chiave `user_level`, assenza di
  entrambe), così la decisione è testabile senza DOM.
- Migrazione: chi ha già `trektrak_user_level` = `beginner` parte in `imparo`,
  `expert` parte in `montagna`. Chi non ha nulla vede l'onboarding, che glielo chiede.

### Dove si cambia

Una voce **visibile e nominata**, non sepolta nelle impostazioni: nel menu *Altro* su
mobile e nell'intestazione su desktop, con l'etichetta del profilo corrente
(*"Modalità: Imparo"*). Al primo cambio, un avviso dice cosa è comparso e cosa è
sparito.

### I dati non si toccano

Cambiare profilo **non cancella niente**: i layer attivi restano nelle impostazioni,
l'itinerario in lavorazione resta, lo storico di verifiche e quiz resta. Tornando al
profilo precedente si ritrova tutto come era. È la garanzia della v0.11.8, e qui vale
doppio perché il cambio di profilo è un gesto che si farà per curiosità.

## Il rischio, e come si gestisce

**Funzioni nascoste sono funzioni non scoperte.** Tre mitigazioni, tutte necessarie:

1. l'interruttore è visibile e nominato, così il modo si vede *e* si sa che esiste un
   altro modo;
2. al primo cambio un avviso elenca cosa è cambiato;
3. il popup delle novità lo spiega alla prima apertura dopo l'aggiornamento.

## Come si verifica

- **La tabella**: per ogni area, in quale profilo compare. Test puro.
- **La guardia**: ogni area dichiarata è applicata da almeno un componente.
- **L'avvio**: la funzione pura che sceglie il profilo iniziale, nei quattro casi
  (profilo salvato, solo `user_level`, nessuno dei due, valore illeggibile).
- **I componenti**: in `imparo` il pulsante dei layer di emergenza non è nel DOM, il
  Meteo non è nel menu Altro, la Libreria non è fra le destinazioni; in `montagna`
  Verifica, i badge, il Progresso e il quiz non ci sono e `appMode` è `track`.
- **A schermo**, con lo stesso metodo usato per il pannello layer: contare i comandi
  visibili nei due profili e confrontarli con i 21 / 112 di partenza.

## Fuori da questo lavoro

- **Non** si spostano file in una cartella `features/`: quella è la leggibilità per chi
  sviluppa, un problema diverso, e mescolarla renderebbe il diff illeggibile.
- **Non** si tocca il deploy né si aggiungono origini.
- **Non** si rimuove nessuna funzione: tutte restano, dietro il profilo.

## Cosa ha trovato la guardia, appena scritta

Due cose, entrambe in attuazione (Task 12):

1. **`tipsDidattici` non era un'area a sé.** I suggerimenti didattici vivono *dentro* il
   popover del badge di validazione, quindi sparire con lui è automatico: dichiararli
   avrebbe promesso un interruttore che non esiste. Riga rimossa dalla tabella.
2. **Le aree presenti in tutti i profili non hanno nulla da applicare.** Bussola,
   righello e PDF non hanno un `mostra()` da nessuna parte perché non c'è niente da
   nascondere. La guardia ora pretende l'applicazione solo dalle aree **limitate** a un
   sottoinsieme di profili, e verifica le altre in modo diverso.

E un difetto vero, nel Task 9: il quiz ha **due** ingressi — il FAB su telefono e la
toolbar su schermo grande — e ne era stato guardato uno solo. È esattamente il difetto
per cui la tabella esiste.
