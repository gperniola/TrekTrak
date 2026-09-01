# i18n: misurato, e non adesso

**Data:** 2026-09-01 · **Riguarda:** [[task-36-i18n-setup]] · **Esito:** rimandato, con la
misura che lo motiva

## Cosa chiedeva il task

Estrarre tutte le stringhe italiane in file JSON (`messages/it.json`, `messages/en.json`),
sostituire ogni testo nei componenti con `t('namespace.chiave')`, aggiungere un selettore
di lingua, e passare a `Intl.NumberFormat`/`Intl.DateTimeFormat` reattivi al locale —
comprese le **distanze in miglia e piedi** per `en-US`.

## La misura

Contato sul codice di oggi, non a occhio:

| | |
|---|---|
| Stringhe brevi di interfaccia (testo visibile) | **132** |
| `aria-label`, `title`, `placeholder` | **92** |
| Messaggi di toast e conferme | **28** |
| **Stringhe lunghe (≥ 25 caratteri): la prosa** | **2.756** |
| File che contengono testo italiano | **100** |

La prosa non è distribuita: sta in sei moduli, ed è **il prodotto**, non l'etichetta di un
pulsante.

| Modulo | Parole |
|---|---|
| `LearnTutorial.tsx` (la guida) | 2.346 |
| `WhatsNew.tsx` (le novità) | 1.502 |
| `emergency-layers.ts` (descrizioni, legende, avvertenze) | 1.039 |
| `glossario.ts` (13 definizioni) | 876 |
| `quiz.ts` | 595 |
| `didactic-tips.ts` | 387 |

## Perché non adesso

**1. Il testo di quest'app è la funzione, non la decorazione.** Quasi tutto il lavoro
degli ultimi rilasci è consistito nello scrivere frasi che dicono la cosa vera: «i
focolai di due giorni fa presentati come ultime 24 ore», «per il GPX servono coordinate»
mostrato dove il GPX non esiste, «Modalità: Imparo» che sembrava un'informazione invece
di un comando. Trasformare `«Su questo tipo di errore stai migliorando.»` in
`t('badge.trend.positivo')` sposta duemila frasi in un file che nessuno rilegge mentre
lavora sul componente — e la lezione ricorrente di questo progetto è che **le frasi
sbagliano proprio quando nessuno le guarda accanto al codice che le mostra**.

**2. Contraddice `lib/formato.ts`, e per una ragione scritta.** Quel modulo formatta i
numeri all'italiana **a mano**, deliberatamente, per non dipendere dai dati di lingua del
runtime; il test che lo protegge verifica che *quello che l'app scrive, riletto dai suoi
stessi campi, valga lo stesso numero*. `Intl.NumberFormat` reattivo al locale rompe quel
patto: con `en-US` l'app scriverebbe `1,500` dove i suoi campi leggono `1.500` come
millecinquecento.

**3. Il punto sulle unità imperiali colpisce il cuore didattico.** Questa app insegna la
cartografia su carte italiane, con equidistanze in metri, scala 1:25.000, dislivelli in
metri e la scala SAC. «Miglia e piedi» non è una traduzione: è un'altra app.

**4. Nessuno lo chiede.** L'app è a uso personale e a invito. Non c'è un utente non
italofono, e non c'è un canale da cui potrebbe arrivare.

**5. Costo e rischio sono concreti.** Toccare 100 file per una funzione senza domanda
significa, in questo progetto, introdurre difetti: le tre correzioni «troppo zelanti» di
fine agosto sono nate tutte da modifiche estese fatte guardando il codice invece del
risultato.

## Cosa si farebbe, se un giorno servisse

Non serve rifare l'analisi da capo:

1. `next-intl` (App Router), `messages/it.json` come lingua sorgente.
2. **Prima le 252 stringhe brevi**, che sono etichette: quelle sì che diventano chiavi
   senza perdere niente.
3. **La prosa resta accanto al codice** finché non esiste una seconda lingua vera:
   glossario, guida, novità e legende hanno il testo come contenuto, non come etichetta.
4. Le unità restano metriche, sempre. Se mai servisse l'imperiale, è un altro task e va
   discusso a parte: cambia cosa l'app insegna.

## Se la decisione fosse diversa

Il lavoro è stimabile: due giorni per le stringhe brevi con i test che le seguono, più il
tempo di rileggere duemila frasi in un contesto dove non si vede più dove finiscono. Basta
dirlo e si fa — questa pagina serve perché la scelta sia consapevole, non per chiuderla.
