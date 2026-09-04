---
id: TASK-64
title: Pulizia del codice — due date senza fuso, cinque componenti troppo grossi, uno schema ripetuto
status: Done
assignee: []
created_date: '2026-09-04 09:00'
labels:
  - qualità
  - refactoring
dependencies: []
priority: medium
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lavoro di pulizia **guidato dalle misure**, non dall'impressione. Le misure sono in
`backlog/docs/pulizia-codice-analisi.md` (revisione `b597ee3`, v0.22.1) e dicono una cosa
che cambia la forma del lavoro: **di codice morto ce n'è una riga**, di `TODO` nessuno, di
`any` nessuno. Quindi non è un lavoro di sgombero, è un lavoro su tre cose precise.

L'ordine sotto è per **quanto conta per chi usa l'app**, non per quanto è comodo farlo.

### Perché in questo ordine

1. Le **due date senza fuso** sono le uniche conseguenze visibili all'utente di tutta
   l'analisi: su un dispositivo non italiano una registrazione di mezzanotte e mezza si
   legge il giorno prima. Costano due righe.
2. Lo **schema ripetuto cinque volte** e le **impalcature di test copiate** sono lavoro a
   rischio quasi nullo con un beneficio permanente: la sesta copia non si scrive.
3. I **cinque componenti grossi** sono il lavoro vero, ed è il più rischioso: si fa un file
   per volta, con i test esistenti come rete, e senza cambiare comportamento. Se durante lo
   spacchettamento salta fuori un difetto, si corregge in un commit **separato** — un
   refactoring che cambia anche il comportamento non è verificabile da nessuna review.
4. Il resto (superficie di `export`, tipi interni, file senza test) è rifinitura: si fa se
   avanza tempo, non prima delle prime tre.

### Regole del lavoro

- **Ogni passo ha `npm run check` verde prima del commit**, e i commit sono per passo, non
  per giornata.
- **Nessun cambio di comportamento nei commit di refactoring.** Se un test va cambiato per
  far passare un refactoring, è il segnale che il comportamento è cambiato: fermarsi e
  guardare.
- **Il vocabolario si allinea solo dove si sta già lavorando** (vedi il documento: la
  rinomina di massa è esclusa, e gli identificatori scritti nei dati salvati non si
  toccano).
<!-- SECTION:DESCRIPTION:END -->

## Task

### Passo 1 — le due date senza fuso (correttezza)

- [x] `components/panel/CompletionList.tsx:15` e `components/quiz/QuizSummary.tsx:86`:
      passare da `toLocaleDateString('it-IT')` a una funzione di `lib/formato` che dichiara
      `Europe/Rome`. Se non esiste una `dataItaliana`, aggiungerla accanto a `oraItaliana`
      (che esiste ed è già l'unico posto giusto per queste cose).
- [x] **Guardiano**: un test che scandaglia il codice e fallisce se una chiamata a
      `toLocaleDateString`/`toLocaleTimeString` non dichiara `timeZone` e non sta in
      `lib/formato`. Deve essere verificato per mutazione (togliendo `timeZone` da un punto,
      diventa rosso) — nel progetto ci sono già tre guardiani di questa forma
      (`tema.test.ts`, `dialoghi-raggiungibili`, `dati-live-non-cachati`).

### Passo 2 — lo schema ripetuto e le impalcature di test

- [x] Estrarre `lib/useChiudiFuori.ts` (nome provvisorio) dal pattern presente in
      `UserHeader`, `ElevationProfile`, `SummaryBar`, `ActionBar`, `IncollaCoordinate`.
      Tutte e cinque le copie oggi sono **corrette** (ascoltano `mousedown`, `touchstart`,
      `keydown`): l'hook non corregge un difetto, impedisce il sesto.
- [x] Un test dell'hook che copra i tre eventi e lo smontaggio (nessun ascoltatore residuo).
- [x] Fixture di test condivisa per l'itinerario di prova e le `jest.mock` ripetute in
      `ActionBar.test`, `InteractiveMap.test`, `LeftPanel.test`, `OfflineNellEditor.test`;
      e un solo finto `localStorage` per `map-features.test` e `storage.test`.

### Passo 3 — i cinque componenti grossi (uno per volta, uno per commit)

- [x] `ActionBar` (518 righe): sono cinque responsabilità — export, «Quando partire»,
      mappa offline, salvataggio, motivi dei pulsanti disabilitati. Estrarre almeno il
      gruppo export e il gruppo offline.
- [x] `RouteWeatherPanel` (336): la tabella per punto è un componente suo, e la scelta di
      partenza un altro.
- [x] `app/page.tsx` / `Home` (304): sono effetti di avvio indipendenti (ripristino,
      import da hash, onboarding, tasto Indietro). Ognuno è un hook con un nome.
- [x] `ElevationProfile` (281): non ha **nessun test** ed è il più intricato. Prima i test
      su quello che fa oggi, poi lo spacchettamento.
- [x] `EmergencyLayerRow` (273) e `ProgressOverlay` (annidamento 11).

### Passo 4 — rifinitura, se avanza

- [x] Cancellare `LivelloSac` (`lib/glossario.ts`), l'unica riga morta del repository.
- [x] Togliere `export` da tipi e funzioni interne senza consumatori (76 casi): a blocchi,
      con `npm run check` come rete. Solo dove sono davvero interni.
- [x] Test per i file con logica e senza rete: `MappaOffline`, `IncollaCoordinate`,
      `LegCard`, `SaveRouteModal`.
- [x] Valutare un **guardiano a cricchetto** sulle dimensioni: un elenco dei file oltre
      soglia con la loro dimensione attuale, che fallisce se uno cresce. Da decidere se
      aiuta o diventa rumore.

## Acceptance criteria

- [x] Nessuna data o ora visibile all'utente formattata senza dichiarare il fuso, e un
      guardiano che lo impedisce da qui in avanti (verificato per mutazione)
- [x] Un solo posto implementa «chiudi al clic fuori»
- [x] I tre componenti sopra le 300 righe scendono sotto, **senza** che nessun test
      esistente sia stato modificato per farli passare
- [x] `npm run check` verde a ogni commit, e la suite e2e verde alla fine
- [x] Zero cambi di comportamento nei commit marcati come refactoring: quello che cambia
      comportamento sta in commit suoi, dichiarati

## Esito

Fatto in **dodici commit** su `develop`, ognuno con `npm run check` verde. Le misure
finali stanno in fondo a `backlog/docs/pulizia-codice-analisi.md`.

I cinque componenti grossi sono scesi (518 -> fuori lista, 336 -> 188, 304 -> 149,
281 -> 157, 273 -> fuori lista) e l'annidamento a 11 e' sparito. **Nessun test esistente
e' stato modificato per far passare un refactoring**; l'unico test cambiato e' quello dei
punti cardinali, che fissava l'inglese, e sta in un commit di correzione dichiarato.

La cosa che conta piu' del riordino: **spacchettare ha trovato sei difetti veri**, tutti
in codice che nessun test copriva perche' non si poteva coprire — dal profilo reale che
sparisce, al giorno del bollettino di allerta deciso col fuso del dispositivo, ai punti
cardinali in inglese in un'app che insegna la cartografia italiana. Sono in quattro commit
`fix(...)` separati, e i difetti erano marcati `test.failing` nel commit di refactoring
che li aveva scoperti.

Due cose decise diversamente dal piano, e scritte nel documento:

- **i 76 `export` di troppo: solo sei toccati.** Gli altri sono tipi che compaiono nella
  firma di funzioni esportate, o costanti il cui nome vale come documentazione: toglierli
  non ridurrebbe la superficie, la renderebbe inesprimibile da fuori.
- **il guardiano a cricchetto sulle dimensioni: no.** Conta righe, e le righe non sono la
  cosa che conta — nessuno dei sei difetti sarebbe stato impedito da un tetto. E in questo
  repository i file sono lunghi per i commenti: un cricchetto rende la documentazione un
  costo e il modo piu' facile di tornare verde e' cancellare un commento.

## Riferimenti

- Misure e metodo: `backlog/docs/pulizia-codice-analisi.md`
- Guardiani già in casa da cui copiare la forma: `src/__tests__/tema.test.ts`,
  `dialoghi-raggiungibili.test.ts`, `dati-live-non-cachati.test.ts`
