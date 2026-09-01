---
id: TASK-62
title: text-gray-500 è sotto il contrasto minimo, e sta in 34 file
status: To Do
assignee: []
created_date: '2026-09-01 19:30'
labels:
  - a11y
  - debito
dependencies: []
priority: medium
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trovato durante la review della v0.18.0, mentre correggevo **la mia** occorrenza.

`--grigio-500` nel tema scuro vale `107 114 128` (#6b7280), cioè il valore di Tailwind.
Misurato con la formula WCAG:

| testo | fondo | rapporto | serve |
|---|---|---|---|
| `text-gray-500` | `bg-gray-900` (#111827) | **3,67 : 1** | 4,5 : 1 (testo normale) |
| `text-gray-500` | `bg-gray-800` (#1f2937) | **3,20 : 1** | 4,5 : 1 |
| `text-gray-400` | `bg-gray-900` | 6,99 : 1 | ✓ |

`text-gray-500` compare **96 volte in 34 file**. Non tutte sono difetti: sopra i 24 px
(o 18,66 px in grassetto) la soglia scende a 3:1 e il 3,67 basta. Ma sotto quella taglia
no, ed è la taglia della maggior parte di quegli usi.

### Perché non se n'è accorto nessuno

- **Lighthouse dà 100** perché guarda solo ciò che è a schermo durante l'esame: quasi tutti
  quei 96 usi stanno in pannelli chiusi, schede non aperte, stati non raggiunti.
- **`tema.test.ts` non lo copre**: verifica i token del tema fra loro e il testo sopra i
  colori pieni, non le coppie «classe grigia Tailwind su fondo del contenitore». Il file
  contiene perfino un commento che avverte che «un `text-gray-500` a 3,67:1 è passato due
  volte» — e adesso è la terza.

## Task

- [ ] Passare in rassegna i 96 usi e separarli: testo grande (va bene) / testo piccolo
      (da portare a `gray-400`) / decorazione non informativa (da valutare)
- [ ] Verificare anche il **tema chiaro**: lì `--grigio-500` vale `90 99 114` su fondi
      chiari, e il rapporto è un altro — va misurato, non dedotto
- [ ] Estendere `tema.test.ts` con un controllo che ricavi le coppie **classe testo /
      classe fondo** dai componenti, invece di elencarle a mano: un elenco scritto a mano
      invecchia (è già successo nella v0.17.x)
- [ ] Se il controllo automatico è troppo fragile, in alternativa: ridefinire
      `--grigio-500` a un valore che superi il 4,5:1 su `grigio-900` e `grigio-800`,
      accettando che la scala si comprima

## Riferimenti

- `src/app/tema.css:17-22` (tema scuro) e `:62-67` (tema chiaro)
- `src/__tests__/tema.test.ts:16` (il commento che avverte del problema)
- `src/components/settings/MappaOffline.tsx` (l'unica occorrenza già corretta)
<!-- SECTION:DESCRIPTION:END -->
