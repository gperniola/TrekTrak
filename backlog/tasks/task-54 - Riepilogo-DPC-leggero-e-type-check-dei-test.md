---
id: TASK-54
title: Riepilogo DPC leggero (400 KB → ~2,4 KB) e type-check dei file di test
status: Done
assignee: []
created_date: '2026-08-27 12:00'
labels:
  - emergency-layers
  - perf
  - tooling
dependencies: []
priority: medium
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Due punti rimandati dalla code review dell'avviso di posizione in zona di allerta DPC
(v0.11.5). Nessuno dei due è un difetto della feature: sono migliorie che richiedono
interventi più larghi di una rifinitura.

### 1. Riepilogo DPC leggero al posto dei 397 KB per sessione

**Oggi**: il controllo all'avvio scarica il topojson del giorno, **397.575 byte
compressi** (misurati), da `raw.githubusercontent.com`, escluso dalla cache del
service worker per scelta — quindi ogni sessione lo riscarica. Lo paga anche chi non
ha mai attivato il layer, e su rete mobile in montagna è tanto.

**L'osservazione che apre la strada**: le **geometrie** delle zone di allerta sono
amministrative e stabili nel tempo; cambiano solo i **livelli**, ogni giorno. Il
bollettino invece li spedisce insieme a ogni emissione.

**Direzione**: separare le due cose — geometrie scaricate una volta e messe in cache a
lungo (sono l'unica parte pesante), livelli giornalieri presi da un payload piccolo
(~2,4 KB nell'ordine di grandezza). Da verificare quale sorgente il DPC pubblichi per
i soli livelli, e come legarla alle geometrie (join per `Nome zona` o per codice).

**Attenzione**: le geometrie in cache diventano un dato che può invecchiare in modo
silenzioso, cioè esattamente la classe di difetto su cui è ruotata l'intera campagna
di review della v0.11.0. Serve una versione/validità esplicita, non una cache muta.

Nota: le regole `NetworkOnly` del service worker vanno riviste di conseguenza — sono
scritte per impedire che dati di *allerta* vengano serviti stantii, e delle geometrie
stabili è corretto fare cache.

### 2. I file di test non vengono type-checkati

`tsconfig.json` ha `"exclude": ["node_modules", "src/__tests__"]`, quindi né
`tsc --noEmit` né `next build` guardano i test: i cast `as never` nei fixture non sono
verificati da nulla fuori da ts-jest.

Provato durante la review: togliere l'esclusione produce **1001 errori**, tutti
`Cannot find name 'describe' / 'test' / 'expect'` e `Namespace 'jest' has no exported
member 'Mock'` — manca `@types/jest`, che non è fra le dipendenze (c'è
`@jest/globals`, ma i test usano i globali nudi).

**Direzione**: un `tsconfig.test.json` che estende quello principale, include
`src/__tests__` e aggiunge i tipi di jest, più uno script dedicato. Tenere i tipi di
test fuori dal `tsconfig` dell'app, che serve al build di Next.

### 3. (già noto) Nessuna configurazione ESLint

`npm run lint` apre il prompt interattivo di setup di `next lint`: non esiste alcun
file di configurazione ESLint in nessun branch del repository. Oggi il gate reale è
`tsc --noEmit`. Da decidere se adottare `eslint-config-next` (già fra le dipendenze)
o rinunciare esplicitamente, aggiornando lo script perché non finga di funzionare.

## Esito (2026-08-27)

**La sorgente leggera era diversa da come l'avevo immaginata, e migliore.** Non esiste
un file coi soli livelli per zona; esiste `files/<bulletinId>.json`, **2.439 byte**, che
è un manifest col **riepilogo nazionale della giornata**. Misurato su due giorni reali:

    con allerte:  "ORDINARIA CRITICITA' PER RISCHIO TEMPORALI / ALLERTA GIALLA:
                   Emilia Romagna : Montagna piacentino-parmense, ..."
    tranquillo:   "ASSENZA DI FENOMENI SIGNIFICATIVI PREVEDIBILI / NESSUNA ALLERTA"

Se in tutta Italia non ci sono allerte, nessuna posizione può cadere in una zona in
allerta: il controllo si conclude con **2,4 KB invece di 397**, e nei giorni tranquilli
— la maggioranza — le geometrie non vengono scaricate affatto.

Non è servita nessuna cache di geometrie, quindi il rischio che qui avevo annotato
(dati in cache che invecchiano in silenzio) **non si presenta**. Il manifest è solo
un'ottimizzazione e fallisce nel verso giusto: se non è raggiungibile, o se il testo
non è riconosciuto, si scaricano le geometrie come prima. Il riconoscimento ha polarità
deliberata — si salta il download **solo** su corrispondenza positiva di "nessuna
allerta" — perché la logica opposta trasformerebbe un cambio di frase in un falso
"nessuna allerta".

- [x] Il controllo di posizione all'avvio non scarica più centinaia di KB per sessione
- [x] Nessun dato può invecchiare in silenzio → non serve più alcuna cache di geometrie
- [x] `npm run typecheck:tests` controlla i tipi dei test **e passa**: 143 → 0
- [x] `npm run lint` fa qualcosa di utile: ESLint configurato, 0 warning
- [x] Nessuna regressione: 807 test verdi

## I 143 errori, spiegati

Non erano 143 problemi. **90 erano un buco della mia configurazione**, non debito dei
test: 53 file importano `expect` da `@jest/globals`, e `@testing-library/jest-dom`
augmenta il namespace globale `jest` — un'interfaccia diversa da quella che quei file
usano. Risultato: `toBeInTheDocument` e `toBeDisabled` risultavano inesistenti. Un
`import type {} from '@testing-library/jest-dom/jest-globals'` nel setup li ha azzerati
tutti in un colpo. Averlo scritto come "143 errori preesistenti" era una lettura
sbagliata dei numeri.

I 53 rimasti erano reali, e in due gruppi:

**Tipizzazione dei mock (38).** `jest.fn()` senza generici è `(...args: unknown[]) =>
unknown`: `mockResolvedValue` collassa a `never`. Aggiunto `asyncMock()` in
`src/__tests__/support/jest-mocks.ts`. Dove il test asserisce gli argomenti
(`toHaveBeenCalledWith`) la firma è dichiarata per esteso — un mock a zero parametri
rendeva quell'asserzione vacua.

**Deriva vera delle fixture (15), il motivo per cui il gate serviva:**
- `mapDisplay` senza `emergencyLayers` in `storage` e `map-features`: campo aggiunto
  nella v0.11.0, fixture mai aggiornate
- `notes` sui `Waypoint` di `InteractiveMap` e `QuizOverlay`: campo che **non esiste**
  nel tipo, rimasto da una versione precedente
- `ValidationResult` senza `userValue`, che è obbligatorio: il badge riceveva fixture
  che nella app non possono esistere
- le fixture di stato non erano annotate, quindi `sampleInterval: 50` si allargava a
  `number` e l'intero oggetto non veniva mai confrontato con lo stato reale: ora sono
  `Partial<ItineraryState>` e la deriva emerge alla definizione

Entrambi i gate sono verificati per mutazione: rimosso `emergencyLayers` da una fixture
→ `typecheck:tests` fallisce; togliendo una dipendenza da un `useEffect` → `lint`
segnala. Ripristinati, tornano puliti.

## ESLint

`npm run lint` era **peggio che inutile**: senza configurazione, `next lint` apriva un
prompt interattivo, cioè in CI si sarebbe piantato. Aggiunto `.eslintrc.json` con
`next/core-web-vitals`. Trovava 3 warning e 2 errori, tutti legittimi:
- 3 volte lo stesso pattern voluto (contatore di generazione incrementato nel cleanup
  sul riferimento **vivo**): il consiglio della regola invertirebbe la semantica, quindi
  sono `eslint-disable-next-line` con la ragione scritta accanto
- 2 direttive `@typescript-eslint/no-var-requires` stantie, che citavano una regola non
  definita da questa configurazione: rimosse

Aggiunto `npm run check` = typecheck + typecheck:tests + lint + test.

## Rimane aperto

- [ ] Valutare lo stesso risparmio per il **layer** DPC, che scarica due giorni di
      geometrie (~800 KB) anche quando il manifest dice che non c'è nulla da disegnare

## Riferimenti

- Review dell'avviso di posizione, 2026-08-27 (rilievo 12 e note finali)
- Misure: `397.575` byte compressi per topojson, nome di zona più lungo 146 caratteri
<!-- SECTION:DESCRIPTION:END -->
