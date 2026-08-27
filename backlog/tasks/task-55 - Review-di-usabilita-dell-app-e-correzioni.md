---
id: TASK-55
title: Review di usabilita dell app e correzioni
status: Done
assignee: []
created_date: '2026-08-27 16:30'
labels:
  - usability
  - review
dependencies: []
priority: high
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review dell'app **incentrata sull'usabilita**, non sulla correttezza del codice: cercare
attriti e difetti che si vedono usandola, a dito su mobile e col mouse su desktop.

Metodo: percorrere i flussi reali sulla build di produzione (creare un itinerario,
Learn/Track, verifica, quiz, libreria, layer di emergenza, export, tasto Indietro,
offline) e annotare ogni punto in cui l'app fa perdere tempo, sorprende, o non spiega
cosa e' successo. Le due lezioni del progetto valgono qui piu' che mai: **verificare a
mano** (i difetti veri riguardano cosa si vede e si tocca) e **non fidarsi dei test**
come prova di usabilita'.

Esito: correzioni + un rilascio. Cio' che non si corregge va scritto qui con la ragione.

## Rilievi (review del 2026-08-27, mobile 412x823 e desktop 1440x900, build di produzione)

### 1. Il lavoro in corso non e' salvato da nessuna parte — GRAVE
Ricaricando la pagina l'itinerario spariva: **3 waypoint -> 0**, e in `localStorage`
restavano solo tre chiavi (`schema_version`, `user_level`, `tutorial_seen`).
`itineraryStore` non ha alcuna persistenza. Aggravanti:
- l'**UpdateBanner** della v0.10.4 invita esplicitamente a **ricaricare**: l'app propone
  il gesto che distrugge il lavoro;
- per chi non e' loggato **"Salva" e' disabilitato**, quindi non esiste alcun modo di
  conservare un itinerario;
- `saveItinerary` / `loadItineraries` in `storage.ts` esistono ancora ma **nessun
  componente di produzione le usa**: e' una regressione della migrazione cloud v0.9.0,
  che ha sostituito la libreria locale con quella condivisa senza lasciare un ripiego.

### 2. La scelta "Sto imparando" viene ignorata dopo la ricarica — GRAVE
`trektrak_user_level` e' scritto in **un solo punto** (`LearnTutorial`) e **letto in
nessuno**; il default dello store e' `appMode: 'track'`. Chi si dichiara principiante si
ritrova in modalita' esperto, con l'app che compila tutto: l'opposto dello scopo
didattico. Verificato su desktop dopo la ricarica: interruttore su **Track**, valori
auto-compilati.

### 3. La virgola decimale non e' accettata
Campi `type="number"` senza `inputmode`. Misurato: scrivendo `1,5` il valore del campo
diventa `""`; con `1.5` funziona. In un'app italiana in cui si scrivono distanze e
azimut con la virgola, e' un blocco all'attivita' principale.

### 4. Il popup "Novita'" appare a un utente nuovo
Aspetta `tutorialSeen`, quindi scatta al **secondo avvio**, subito dopo l'onboarding: a
chi ha appena conosciuto l'app si raccontano come "novita'" funzioni che non ha mai
conosciuto diversamente.

### 5. Pulsanti disabilitati che non spiegano il perche' (mobile)
Salva, PDF sintetico, PDF roadbook, GPX e le quattro voci del menu Altro: la ragione sta
solo nell'attributo `title`, **invisibile al tocco**. Su mobile l'utente vede grigio e
non ha modo di sapere cosa manca.

### 6. Il messaggio del profilo altimetrico non dice cosa manca
Con 3 waypoint gia' presenti continuava a dire "Aggiungi almeno 2 waypoint con quota":
il problema sono le **quote**, non i waypoint.

### 7. La scelta del livello non da' riscontro
Le due carte spariscono e il dialogo torna al testo di benvenuto: non si sa cosa e' stato
scelto ne' come cambiarlo.

### 8. Menu "Altro" e FAB strumenti si aprono insieme e si sovrappongono
La voce Quiz finisce sotto il pannello del menu Altro. Due overlay che si ignorano.

### 9. La Libreria promette a chiunque un accesso che non puo' funzionare
"Inserisci la tua email: riceverai un link per entrare" -> dopo l'invio, "Invito non
valido". Non dice che l'area e' **ad invito**, ne' che senza account non esiste alcuna
libreria.

### 10. Target di tocco sotto i 44px che il progetto si e' dato nella v0.10.0
Pulsanti sulla mappa **40x40**, campi numerici **34px** di altezza.

### 11. Quiz attivabile senza dati
Il pulsante passa ad "attivo" (`aria-label` diventa "Disattiva quiz") e non succede
nulla, senza spiegazione. Prova disturbata dal rilievo 8: **da riverificare**.

### 12. Doppia istanza dell'editor nel DOM
Sheet mobile + pannello desktop nascosto: 6 campi "Alt (m)" per 3 waypoint, 79 pulsanti
in pagina. Non e' un difetto visibile, ma raddoppia i nodi e puo' confondere lettori di
schermo e autofill.
<!-- SECTION:DESCRIPTION:END -->

## Esito delle correzioni (2026-08-27)

Tutti i rilievi sono stati affrontati. Ogni correzione ha un test che fallisce senza di
essa, e ognuna e' stata **verificata a mano** sulla build di produzione, a 390x844 e
1440x900.

| # | Esito |
|---|---|
| 1 | **Corretto.** Autosalvataggio locale dell'itinerario in lavorazione (`lib/current-itinerary.ts`, `lib/useItineraryAutosave.ts`, `hydrateCurrent` nello store). Verificato: 3 waypoint, ricarica, 3 waypoint. Il salvataggio scatta 400 ms dopo l'ultima modifica e **subito** quando la pagina viene nascosta, perche' su mobile la PWA puo' essere sospesa senza preavviso. Se lo spazio finisce si riscrive senza geometria e profilo, tenendo i valori dell'utente, che non si possono ricalcolare. Conseguenza affrontata: da adesso aprire un **link condiviso** puo' cancellare lavoro vero, quindi chiede conferma come già faceva l'import da JSON |
| 2 | **Corretto.** `startupAction()` (funzione pura, testata) decide all'avvio: c'e' lavoro salvato -> si ripristina con la sua modalita'; altrimenti si applica il livello dichiarato. La modalita' salvata **vince** sul livello, perche' l'utente puo' averla cambiata a mano dopo. Verificato: scelto "Sto imparando", ricaricato, l'app riparte in Learn |
| 3 | **Corretto.** `NumberInput` non e' piu' `type="number"`: e' testo con `inputMode="decimal"` e un parser che accetta virgola e punto. Il testo battuto vive nel componente, cosi' `1,` e `-` restano a schermo mentre si scrive. Verificato: `1,5` -> 1.5 salvato. **Lo stesso difetto c'era nel quiz**, che ha un input suo: trovato provando l'app, non leggendo il diff |
| 4 | **Corretto.** Finito il tutorial, la versione corrente viene marcata come vista: a chi ha appena conosciuto l'app non si raccontano "novita'". Chi aveva già il tutorial visto continua a vederle |
| 5 | **Corretto.** Il motivo del grigio e' **scritto**, non in un `title`: riquadro ambra sopra gli export, riga sotto Progresso, riga sopra Salva, riga in fondo al menu Altro. I pulsanti li puntano con `aria-describedby` |
| 6 | **Corretto.** Tre messaggi distinti: pochi waypoint / waypoint senza quota / caso residuo. Verificato a schermo: con 3 waypoint senza quota dice "Inserisci la quota di almeno 2 waypoint nell'Editor" |
| 7 | **Corretto.** Le carte restano visibili con quella scelta marcata (`aria-pressed`, cornice, ✓) e una riga che nomina la modalita' e ricorda come cambiarla. Si puo' cambiare idea senza ricominciare |
| 8 | **Corretto.** `toolsFabOpen` spostato nello store: i tre pannelli che vengono dal basso si escludono a vicenda. Lo speed-dial entra anche nel tasto Indietro (`closeToolsFab`) e nel conteggio della profondita' |
| 9 | **Corretto.** Senza link di invito non si chiede piu' l'email: si dice che l'area e' ad invito **e** che l'app funziona per intero comunque, con Esporta JSON / GPX / Copia link per portare via il lavoro. Con un invito scaduto il messaggio dice cosa fare ("chiedi un link nuovo") |
| 10 | **Corretto.** Pulsanti tondi sulla mappa 40 -> 44px sotto `lg`; campi numerici 34 -> 44px; carte del livello e campo del quiz idem. Su desktop resta 40, dove va benissimo |
| 11 | **Non era un difetto del quiz.** Riprovato a mano: il quiz parte e mostra "Domanda 1/5" dopo ~5 s (costruisce le domande sui POI dell'area). Il silenzio che avevo visto era il rilievo 8 — il menu Altro copriva l'overlay. Corretto comunque un percorso muto vero: se l'area inquadrata non e' disponibile, prima si chiudeva **in silenzio**, ora lo dice |
| 12 | **Verificato, non e' un difetto.** La copia in eccesso e' nascosta con `display: none` (classe `hidden lg:flex`): non e' nell'albero di accessibilita', non e' tabulabile, l'autofill la salta. Misurato: `larghezza 0`, `display: none`, `tabIndex` non raggiungibile. Renderla singola richiederebbe decidere il layout da JavaScript, con lampeggio al primo paint e rischio di disallineamento in idratazione: **un peggioramento per l'utente in cambio di nulla di visibile**. Resta la duplicazione dei nodi, che non si vede e non si sente |

## Cose trovate durante la verifica, non nella review

- **Il campo del quiz** rifiutava la virgola: la correzione dei campi dell'editor non lo
  copriva. Trovato guardando lo schermo (lo spinner numerico era ancora li'), non nel diff.
- **Due miei errori di lingua** introdotti dalle correzioni stesse: "comparira'" invece
  di "comparirà" e "e'" invece di "è", perche' avevo evitato le lettere accentate per
  non litigare con la shell. Dentro il testo JSX una sequenza `\uXXXX` non e' un escape:
  si legge a schermo cosi' com'e'. Corretti con le entita' HTML.
- **Un contrasto sotto soglia** in un testo nuovo: `text-gray-500` misura 3,67:1, cioe'
  esattamente il difetto corretto nella v0.11.6 sulla bottom nav. Portato a `gray-400`.
