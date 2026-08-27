---
id: TASK-54
title: Riepilogo DPC leggero (400 KB → ~2,4 KB) e type-check dei file di test
status: To Do
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

## Acceptance criteria

- [ ] Il controllo di posizione all'avvio non scarica più centinaia di KB per sessione
- [ ] Le geometrie in cache hanno una validità esplicita: nessun dato può invecchiare
      in silenzio, e la distinzione fra "nessuna allerta" e "non lo so" resta intatta
- [ ] `npm run typecheck:tests` (o equivalente) controlla i tipi di `src/__tests__`
- [ ] `npm run lint` fa qualcosa di utile, oppure non esiste più
- [ ] Nessuna regressione sui 780 test

## Riferimenti

- Review dell'avviso di posizione, 2026-08-27 (rilievo 12 e note finali)
- Misure: `397.575` byte compressi per topojson, nome di zona più lungo 146 caratteri
<!-- SECTION:DESCRIPTION:END -->
