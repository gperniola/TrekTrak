---
id: TASK-63
title: I popup hanno il fondo bianco fisso, ma la scala grigia si rovescia col tema
status: To Do
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

- [ ] Decidere fra le due strade, e dirlo nel commento:
      **(a)** dare ai popup il fondo dell'app (`grigio-800`) così entrano nel sistema delle
      superfici e la scala funziona; cambia l'aspetto — i popup bianchi su mappa scura
      stonano già oggi;
      **(b)** aggiungere un token fisso tipo `--su-bianco` per il testo sopra i fondi
      chiari che non seguono il tema, sulla falsariga di `--su-colore`
- [ ] Applicarla a tutto il contenuto dei popup, non solo alla riga misurata
- [ ] Verificare **nei due temi** con l'audit sul DOM (vedi il metodo nel TASK-62): aprire
      un popup di un riparo e uno di un focolaio, e contare i guasti
- [ ] Togliere `EmergencyShelterLayer.tsx` da `DENTRO_UN_POPUP` in `tema.test.ts`, e togliere
      lo scarto `bg-gray-100` — quelle due esclusioni esistono solo per questo difetto

## Riferimenti

- `src/app/tema.css` (`--su-colore` e il commento che spiega perché non si rovescia)
- `src/__tests__/tema.test.ts`, blocco «i grigi usati come testo di pagina» (le esclusioni)
<!-- SECTION:DESCRIPTION:END -->
