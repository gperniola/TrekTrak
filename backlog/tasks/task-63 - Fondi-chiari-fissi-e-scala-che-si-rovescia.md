---
id: TASK-63
title: I popup hanno il fondo bianco fisso, ma la scala grigia si rovescia col tema
status: Done
assignee: []
created_date: '2026-09-02 11:00'
labels:
  - a11y
  - tema
  - bug
dependencies: []
priority: medium
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trovato durante il TASK-62, ed è più grave di quello.

Il tema chiaro (v0.17.0) funziona **rovesciando la scala grigia**: `grigio-600` è scuro nel
tema scuro e chiaro nel tema chiaro. Il meccanismo regge perché anche i fondi si rovesciano
— tranne dove il fondo **non è nostro**.

I popup di Leaflet hanno il fondo bianco per la loro CSS, e l'app non lo ridefinisce
(`grep leaflet-popup src/app/*.css` → nulla). Misurato sul DOM di una build di produzione:

| | fondo | tema scuro | tema chiaro |
|---|---|---|---|
| `text-gray-600` in un popup | bianco fisso `rgb(255,255,255)` | 7,56 : 1 ✓ | **1,54 : 1** ✗ |

Nel tema chiaro il testo secondario dei popup è **praticamente invisibile**.

### Perché non si risolve cambiando classe

Il fondo è fisso e la scala si rovescia, quindi ogni classe grigia va bene in un tema e
male nell'altro:

- `text-gray-600`: 7,56 nello scuro, 1,54 nel chiaro
- `text-gray-800`: ~12,6 nello scuro, ~1,06 nel chiaro
- `text-gray-400`: ~2,7 nello scuro (già insufficiente), ~7 nel chiaro

Serve un **token che non si rovesci**, esattamente come `--su-colore` — che esiste già per
il testo sopra i colori pieni, e per la stessa ragione: «un pulsante si dipinge il fondo e
non segue la pagina».

## Dove sta il problema

- `src/components/map/emergency/EmergencyShelterLayer.tsx:130` — `text-gray-600` nel popup
- Ogni altro contenuto dentro un `<Popup>` di react-leaflet: il colore del testo normale lo
  decide Leaflet, e va verificato anch'esso nei due temi
- `src/components/map/InteractiveMap.tsx:88` — un campo con `bg-gray-100`: stesso schema,
  fondo chiaro fisso e testo dalla scala che si rovescia

## Task

- [x] **Scelta (a)**: i popup prendono il fondo dell'app (`grigio-800`). La (b) lascerebbe
      in piedi una trappola — una superficie bianca per sempre, dentro un'app a tema, su cui
      ogni modifica futura deve ricordarsi di non usare i grigi normali. Così invece un
      popup è un pannello come gli altri
- [x] Applicarla a tutto il contenuto dei popup, non solo alla riga misurata
- [x] Verificare **nei due temi** con l'audit sul DOM (vedi il metodo nel TASK-62): aprire
      un popup di un riparo e uno di un focolaio, e contare i guasti
- [x] Rimossa l'esclusione `DENTRO_UN_POPUP` da `tema.test.ts`: i popup ora rientrano nel
      controllo come tutti. Lo scarto `bg-gray-100` **resta**, ed è giusto: lì fondo e testo
      sono entrambi token della scala, quindi si rovesciano insieme (12,04:1 nello scuro,
      9,85:1 nel chiaro) — la coppia è semplicemente rovesciata rispetto alle altre

## Riferimenti

- `src/app/tema.css` (`--su-colore` e il commento che spiega perché non si rovescia)
- `src/__tests__/tema.test.ts`, blocco «i grigi usati come testo di pagina» (le esclusioni)
<!-- SECTION:DESCRIPTION:END -->

## Com'è andata

**Due correzioni sbagliate prima di quella giusta**, e le ha trovate entrambe lo scenario
nuovo, non il ragionamento:

1. La prima stesura scriveva la regola e **non aveva effetto**: la CSS di Leaflet arriva dal
   componente della mappa e finisce nel pacchetto dopo `globals.css`, quindi a pari
   specificità vinceva lei. La regola c'era, scritta bene, e il popup restava bianco — il
   difetto della v0.17.2 in un'altra veste. Rimedio: prefisso `.leaflet-container`.

2. Spostare l'import di Leaflet in `globals.css` sembrava più pulito e **ha rotto altro**:
   riordina la cascata per tutto, e le attribuzioni della mappa sono scese a 3,24:1.
   Misurato mettendo la modifica da parte e rimisurando. Un rimedio locale è meglio di un
   riordino globale che cambia cose che nessuno stava guardando.

## Il difetto era una classe, non un caso

Cercandone la radice è venuto fuori che «colore che si rovescia sopra un fondo che non si
rovescia» era presente in **cinque** punti, non uno:

| dove | misura nel tema chiaro |
|---|---|
| popup di Leaflet | 1,54 : 1 |
| toast di avviso | **1,13 : 1** |
| errore della bussola | 1,05 : 1 |
| errore della posizione | 1,05 : 1 |
| errore del meteo | 2,23 : 1 |

Il toast di avviso era rotto e i suoi fratelli identici stavano bene per un caso:
`amber-100` è fra i token, `green-100` e `red-100` no. Non si indovina — si legge nella
configurazione.

Da qui il controllo nuovo in `tema.test.ts`, che ricava dalla configurazione **quali
tonalità cambiano fra i due temi** e segnala chi le mescola con un fondo fisso. Restretto ai
casi in cui l'appaiamento è certo (una classe di testo e un fondo per riga): sui ternari e
sulle mappe di stile darebbe falsi allarmi, e un controllo che grida al lupo viene
disattivato dal primo che ci sbatte contro.

**Una cosa che il controllo NON prova**: segnala un rischio. Un fondo grezzo con opacità si
compone col fondo di pagina, che invece si rovescia, e può cadere a metà strada e funzionare.
`QuizQuestion` è così — 12,41:1 e 6,30:1 — ed è nell'elenco delle verificate a mano, con i
numeri. Calcolata come se il fondo fosse opaco dava 1,35:1 e sembrava un guasto grave.
