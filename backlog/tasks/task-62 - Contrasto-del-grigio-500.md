---
id: TASK-62
title: text-gray-500 è sotto il contrasto minimo, e sta in 34 file
status: Done
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

- [x] Passare in rassegna i 96 usi e separarli: testo grande (va bene) / testo piccolo
      (da portare a `gray-400`) / decorazione non informativa (da valutare)
- [x] Verificare anche il **tema chiaro**: lì `--grigio-500` vale `90 99 114` su fondi
      chiari, e il rapporto è un altro — va misurato, non dedotto
- [x] Estendere `tema.test.ts` con un controllo che ricavi le coppie **classe testo /
      classe fondo** dai componenti, invece di elencarle a mano: un elenco scritto a mano
      invecchia (è già successo nella v0.17.x)
- [x] **Scartata** la strada di ridefinire `--grigio-500`: `bg-gray-500` fa il fondo di
      due pulsanti secondari, e il loro testo chiaro sta a 4,83:1. Portando il token al
      valore che serve al testo su `grigio-800` (circa 141 148 161) quei pulsanti
      scenderebbero a 3,05:1. Corrette le classi, 96 usi in 33 file

## Riferimenti

- `src/app/tema.css:17-22` (tema scuro) e `:62-67` (tema chiaro)
- `src/__tests__/tema.test.ts:16` (il commento che avverte del problema)
- `src/components/settings/MappaOffline.tsx` (l'unica occorrenza già corretta)
<!-- SECTION:DESCRIPTION:END -->

## Com'è andata

**Il tema chiaro non c'entrava**: `--grigio-500` là vale `90 99 114` e passa su tutti i
fondi (4,92 – 6,07). Il difetto era solo nel tema scuro.

**Zero dei 96 usi arrivava alla taglia del testo grande**, quindi la soglia era 4,5:1 per
tutti, non 3:1 per qualcuno.

### Quello che l'audit ha trovato oltre a ciò che cercavo

Il controllo ricavato dal codice ha subito pescato due classi che non avevo considerato,
e con esse difetti peggiori del 3,67:1 di partenza:

- **`text-gray-600` a 1,94:1 in `ProgressOverlay`** — «Tendenza da 10 sessioni» e i segni
  «—» che significano «nessun dato». Praticamente invisibili.
- **`placeholder:text-gray-600` a 2,35:1** nel campo email dell'invito: il segnaposto
  `nome@email.it` illeggibile in **entrambi** i temi.
- **Tre maniglie di trascinamento a 2,35:1.** Sono componenti d'interfaccia, quindi la
  soglia è 3:1 — e non la superavano.
- **Il pulsante «Ricarica» dell'avviso di aggiornamento a 4,28:1**, cioè la parte meno
  leggibile di un avviso che esiste per farsi leggere.

### Due trappole in cui sono caduto

1. **`bg-white/25` non è bianco.** Correggendo «Ricarica» ho schiarito il chip con
   `bg-white/25`, ma `white` qui è il token `--bianco`, che nel tema chiaro diventa quasi
   nero. Su un fondo `bg-green-600` **letterale**, che non si rovescia, il chip scuriva
   invece di schiarire: 8,6:1 nello scuro e 4,20:1 nel chiaro. Serve un letterale sopra un
   letterale — `bg-[#ffffff40]`.

2. **Il service worker mi ha misurato la CSS di ieri.** Per un giro intero l'audit ha
   riportato guasti stabili nel tema chiaro che non riuscivo a riprodurre a riposo. La
   pagina caricava `6edd8519c5fb492b.css`, un file **non più presente nel build**: era la
   cache del service worker. Le misure guardavano il vecchio design. La regola: prima di
   misurare su una build di produzione, **disiscrivere il worker e svuotare le cache**, e
   controllare che il nome del foglio caricato esista ancora in `.next/static/css/`.

## Verifica

Audit sul DOM, build di produzione, entrambi i temi, cinque viste: **zero guasti nel tema
chiaro, e nello scuro resta solo l'emoji del cestino** — un glifo che si colora da sé, e
che come componente d'interfaccia sta comunque sopra il 3:1.

Due controlli nuovi in `tema.test.ts`, entrambi verificati per mutazione: le classi di
testo si **contano nel codice** e vengono misurate sui tre fondi dell'app, e `grigio-500`
è vietato per nome.

## Lasciato fuori, di proposito

I fondi **chiari fissi** (popup di Leaflet, campi `bg-gray-100`) sono un difetto di natura
diversa e più grave: là nessuna classe grigia può funzionare nei due temi, perché il fondo
non si rovescia e la scala sì. Misurato: 7,56:1 nello scuro e **1,54:1** nel chiaro. È il
TASK-63.
