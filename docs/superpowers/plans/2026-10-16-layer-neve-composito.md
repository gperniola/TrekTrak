# Layer neve composito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il layer «Copertura nevosa» mostra, per ogni pixel, l'ultima vista senza nubi
degli ultimi 3 giorni con dati (5 sensori NASA). Dice «non visto» dove c'erano le nubi, e
non disegna mai rumore né dati vecchi spacciati per nuovi.

**Architecture:** Le mattonelle GIBS si scaricano con `fetch` (serve l'header
`layer-identifier-actual`) e si decodificano a mano (il canvas perde le classi
trasparenti). Un modulo puro compone i passaggi, un altro produce i pixel RGBA, e un
`L.GridLayer` sottile disegna. Lo store riceve un riassunto della vista, il pannello lo
scrive, la pressione lunga interroga un punto.

**Tech Stack:** Next.js 14.2, TypeScript, Leaflet 1.9.4 + react-leaflet 4.2.1, Zustand,
Jest (jsdom) + Playwright 1.62. **Nessuna dipendenza nuova.**

**Spec:** `docs/superpowers/specs/2026-10-16-layer-neve-composito-design.md` (numeri
dall'analisi `backlog/docs/neve-satellite-analisi.md`, rifacibili con
`backlog/docs/neve-satellite.py`).

## Global Constraints

- Lavoro su `develop`. **Nessun commit senza l'ok esplicito dell'utente**: ogni passo
  «Commit» = mostrare il riepilogo e il messaggio, aspettare la conferma. I subagent non
  committano mai.
- `npm run check` verde prima di ogni commit. Le correzioni chiave si verificano **per
  mutazione** (rompere la riga, vedere il test rosso, ripristinare).
- Commenti e testi in italiano. I commenti spiegano il perché.
- Date e numeri via `src/lib/formato.ts`. Vietati i getter locali di `Date` e i
  `toLocale*` senza `timeZone` (guardiano: `src/__tests__/fuso-orario.test.ts`). I giorni
  GIBS sono UTC, stringhe `YYYY-MM-DD`.
- Popup Leaflet in HTML → tutto il testo passa da `escapeMarkup`.
- `id: 'snow-cover'` invariato: è salvato in `mapDisplay.emergencyLayers`.
- Sensori, nell'ordine dei passaggi dentro un giorno (dal più tardo): `aqua`
  (`MODIS_Aqua_NDSI_Snow_Cover`), `noaa20` (`VIIRS_NOAA20_NDSI_Snow_Cover`), `snpp`
  (`VIIRS_SNPP_NDSI_Snow_Cover`), `noaa21` (`VIIRS_NOAA21_NDSI_Snow_Cover`), `terra`
  (`MODIS_Terra_NDSI_Snow_Cover`). Nessuna data di spegnimento nel codice.
- URL: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{giorno}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`
  (**`{y}` prima di `{x}`**), livelli 0-8.
- Esiti di un passaggio: 200 con header `layer-identifier-actual` e PNG a tavolozza 8 bit →
  **dati**; 200 senza quell'header, oppure corpo non a tavolozza → **nessun dato**; 404 →
  **non pubblicato**; 5xx, rete, timeout (20 s) → **errore**. L'`etag` non si legge mai
  (dal browser non è esposto).
- Finestra: 4 giorni candidati UTC (oggi + 3). Se per la mattonella nessun sensore ha
  dati oggi, si usano ieri e i 2 giorni prima; altrimenti oggi, ieri e l'altro ieri.
- Disegno: neve con i colori RGB della tavolozza della mattonella (indice = NDSI, 1-100),
  alfa **235**/255; velo «non visto» `rgba(71,85,105,0.45)` = RGBA `[71,85,105,115]`;
  senza neve e acqua trasparenti; pixel nitidi a ogni zoom; **nessun pixel di neve
  nascosto**.
- Legenda: `LEGENDA_NEVE` con prima voce `'~1-20: poca neve o incerta'`, più
  `{ color: 'rgba(71,85,105,0.45)', label: 'non visto (nubi)' }`.
- Ridisegno ogni **60 minuti**. GIBS `NetworkOnly` nel service worker.
- Safari ≥ 16.4 (`DecompressionStream('deflate')`).

## Review Focus

1. **Rete giù su tutti i passaggi di una mattonella**: la mattonella resta **vuota** (niente
   velo grigio) e il pannello va in `error` con «Riprova». Il velo non deve mai fingere
   delle nubi durante un guasto. → test in Task 6 e Task 4.
2. **Layer spento mentre le mattonelle scaricano**: un riassunto che arriva dopo lo
   spegnimento non riaccende lo stato. → test in Task 7.
3. **Zoom ≥ 9, cuciture**: due mattonelle a schermo vicine, figlie dello stesso genitore
   z8, si toccano senza salti né pixel ripetuti. → test in Task 6.
4. **Sessione lunga, molti spostamenti**: la cache dei passaggi decodificati resta sotto
   il tetto. → test in Task 5.
5. **Mattonella uscita dallo schermo durante il caricamento**: il suo riassunto esce dal
   pannello (il pannello descrive solo le mattonelle a schermo). → test in Task 7.

---

**Prima del Task 1:** proporre all'utente il commit dei documenti già scritti
(`backlog/docs/neve-satellite-analisi.md`, `backlog/docs/neve-satellite.py`, la spec e
questo piano). Messaggio proposto: `docs(neve): analisi delle fonti, spec e piano del
layer composito`.

### Task 1: Decodificatore PNG a tavolozza e fixture vere

**Files:**
- Create: `src/lib/png-tavolozza.ts`
- Create: `src/__tests__/png-tavolozza.test.ts`
- Create: `src/__tests__/fixtures/gibs/png-sintetico.ts`, aiuto condiviso dai test dei
  Task 1-6 e dallo scenario e2e:
  - `inflateNode: Inflate`;
  - `leggiFixture(nome: string): Uint8Array`;
  - `pngTavolozza(o: { larghezza: number; altezza: number; indici: Uint8Array; tavolozza: Uint8Array; alfa?: Uint8Array; filtri?: number[]; idatInPezzi?: number }): Uint8Array`;
  - `pngRgba(larghezza: number, altezza: number, rgba: [number, number, number, number]): Uint8Array`.

  Solo `zlib` e `fs` di Node.
- Create: `src/__tests__/fixtures/gibs/terra-2026-10-13-8-94-138.png`,
  `terra-2026-10-16-8-94-138.png`, `aqua-2026-10-14-8-94-137.png`. Sono copie dei file
  `MODIS_Terra_NDSI_Snow_Cover_2026-10-13_8_138_94.png`,
  `MODIS_Terra_NDSI_Snow_Cover_2026-10-16_8_138_94.png` e
  `MODIS_Aqua_NDSI_Snow_Cover_2026-10-14_8_137_94.png` della cache dello script. Se la
  cache non c'è, si riscaricano con l'URL dei Global Constraints.
  Attesi: 2477 B, 1916 B e 4786 B.

**Interfaces:**
- Produces:
  - `type Inflate = (compressi: Uint8Array) => Promise<Uint8Array>`
  - `interface PngTavolozza { larghezza: number; altezza: number; indici: Uint8Array /* un indice per pixel, riga per riga */; tavolozza: Uint8Array /* RGB, 3 byte per voce */; alfa: Uint8Array /* una voce per colore; 255 dove tRNS manca */ }`
  - `decodificaPngTavolozza(png: Uint8Array, inflate: Inflate): Promise<PngTavolozza | null>`
    → `null` per firma non PNG, tipo colore ≠ 3 o profondità ≠ 8.
  - `inflateDelBrowser: Inflate`, via `DecompressionStream('deflate')`.

- [ ] **Step 1: Test che falliscono.** `inflate` dei test:
  `(d) => Promise.resolve(new Uint8Array(zlib.inflateSync(d)))`.
  - `'una mattonella vera si legge per intero'`: la Terra del 13/10 dà
    `larghezza === 256`, `altezza === 256`, `indici.length === 65536`; contando gli
    indici, il 106 (nube) compare **1946** volte, il 105 (mare) **55559**, lo 0 (senza
    neve) **7757**; il pixel `(x=4, y=243)` vale **82**.
  - `'la tavolozza e le trasparenze arrivano con la mattonella'`: la tavolozza della Terra
    del 13/10 ha la voce 1 = `240,240,128` e la voce 100 = `255,0,0`; `alfa[106] === 0`,
    `alfa[82] > 0`.
  - `'i cinque filtri di riga'`: un PNG sintetico 4×5 a tavolozza, una riga per filtro
    0-4, creato nel test con `zlib.deflateSync`. Si decodifica negli stessi indici
    scritti.
  - `'piu blocchi IDAT si concatenano'`: lo stesso PNG con l'IDAT spezzato in tre blocchi.
  - `'un PNG non a tavolozza non e un dato'`: un RGBA sintetico (tipo 6) → `null`.
  - `'quello che non e un PNG non e un dato'`: 
    `new TextEncoder().encode('<html>')` → `null`.
- [ ] **Step 2:** `npx jest src/__tests__/png-tavolozza.test.ts` → FAIL (il modulo non
  esiste).
- [ ] **Step 3:** Implementare `src/lib/png-tavolozza.ts`. Contenuto: blocchi PNG (IHDR,
  PLTE, tRNS, IDAT concatenati), poi `inflate`, poi i filtri 0-4 con byte-per-pixel 1. Il
  commento di testa dice perché non il canvas: misurato in Chromium e WebKit, perde l'RGB
  dei pixel trasparenti.
- [ ] **Step 4:** stesso comando → PASS. Mutazione: invertire il filtro Paeth → il test
  dei filtri va rosso.
- [ ] **Step 5: Commit** (ok dell'utente): `feat(neve): decodifica a mano dei PNG a tavolozza di GIBS`

### Task 2: Sensori, URL, giorni e classi della tavolozza

**Files:**
- Modify: `src/lib/snow-cover.ts`. Per ora si **aggiunge**: `templateNeve`,
  `giorniDaProvare` e `GIORNI_INDIETRO_MAX` restano fino al Task 7, che li toglie.
- Modify: `src/__tests__/neve.test.ts`

**Interfaces:**
- Consumes: `PngTavolozza` (Task 1).
- Produces:
  - `type SensoreNeve = 'aqua' | 'noaa20' | 'snpp' | 'noaa21' | 'terra'`
  - `interface DefSensore { id: SensoreNeve; layer: string; famiglia: 'MODIS' | 'VIIRS'; nome: string }`.
    Nomi: `Aqua`, `NOAA-20`, `S-NPP`, `NOAA-21`, `Terra`.
  - `SENSORI_NEVE: readonly DefSensore[]`, nell'ordine dei Global Constraints.
  - `urlMattonellaNeve(layer: string, giorno: string, z: number, x: number, y: number): string`
  - `GIORNI_FINESTRA = 3`
  - `giorniCandidati(adesso: Date): string[]`: `GIORNI_FINESTRA + 1` giorni UTC, oggi per
    primo; usa `giornoUTC`, che resta.
  - Codici di pixel: `SENZA_NEVE = 0`, `ACQUA = -1`, `NON_VISTO = -2`; neve = 1..100 (NDSI).
  - `classificaTavolozza(t: PngTavolozza): Int8Array`: un codice per voce. Per RGB:
    - `0,255,0` → `SENZA_NEVE`;
    - `0,0,255` e `35,35,117` → `ACQUA`;
    - `0,191,255`, `189,0,189`, `255,200,255`, `200,200,200`, `170,0,0`,
      `255,255,255` → `NON_VISTO`;
    - voci 1-100 con alfa > 0 → il loro indice;
    - qualunque altra voce con alfa 0 → `NON_VISTO` (mai `SENZA_NEVE`).
  - `pixelZ8(lat: number, lon: number): { x: number; y: number; px: number; py: number }`
  - `OPACITA_NEVE = 235`, `VELO_NON_VISTO = [71, 85, 105, 115] as const`;
    `COLORE_VELO_CSS` **ricavata** da `VELO_NON_VISTO` (alfa/255 a due decimali → 
    `'rgba(71,85,105,0.45)'`), non scritta a mano. La spec vuole una sola costante per
    disegno e legenda.

- [ ] **Step 1: Test che falliscono** in `neve.test.ts`. I test di `templateNeve` vanno
  riscritti su `urlMattonellaNeve`, con le stesse asserzioni: `{y}` prima di `{x}`, data
  nel percorso, nessuna chiave, `GoogleMapsCompatible_Level8`. Più:
  - `'l URL ha la riga prima della colonna'`:
    `urlMattonellaNeve('MODIS_Terra_NDSI_Snow_Cover', '2026-10-13', 8, 138, 94)`
    finisce con `/2026-10-13/GoogleMapsCompatible_Level8/8/94/138.png`.
  - `'quattro giorni candidati, in UTC, oggi per primo'`:
    `giorniCandidati(new Date('2026-10-16T05:00:00Z'))` →
    `['2026-10-16','2026-10-15','2026-10-14','2026-10-13']`; e
    `giorniCandidati(new Date('2026-10-16T23:30:00Z'))[0] === '2026-10-16'`.
  - `'cinque sensori, dal passaggio piu tardo'`:
    `SENSORI_NEVE.map((s) => s.id)` →
    `['aqua','noaa20','snpp','noaa21','terra']`.
  - `'le classi vengono dalla tavolozza vera'`: sulla fixture Terra del 13/10 (decodificata
    con l'`inflate` di zlib) `classificaTavolozza(t)[106] === NON_VISTO`, `[105] === ACQUA`,
    `[0] === SENZA_NEVE`, `[82] === 82`.
  - `'un trasparente sconosciuto non diventa senza neve'`: su una tavolozza sintetica con
    la voce 120 = `1,2,3` e alfa 0 → `NON_VISTO`.
  - `'Monte Amaro cade nel pixel giusto'`: `pixelZ8(42.0858, 14.0858)` →
    `{ x: 138, y: 94, px: 4, py: 243 }`; `pixelZ8(42.4692, 13.5658)` →
    `{ x: 137, y: 94, px: 165, py: 148 }`.
  - Legenda: `LEGENDA_NEVE[0].label === '~1-20: poca neve o incerta'`; i test esistenti
    sui colori restano invariati.
  - `'il velo della legenda e quello disegnato sono lo stesso'`:
    `COLORE_VELO_CSS === 'rgba(71,85,105,0.45)'`, e cambiando l'alfa di
    `VELO_NON_VISTO` cambierebbe anche lei. Si verifica per mutazione: con l'alfa a 116
    il test va rosso.
- [ ] **Step 2:** `npx jest src/__tests__/neve.test.ts` → FAIL.
- [ ] **Step 3:** Implementare in `snow-cover.ts`. Aggiornare il commento di testa del
  modulo: niente più «un passaggio al giorno di Terra».
- [ ] **Step 4:** → PASS. Mutazione: far restituire `SENZA_NEVE` al trasparente
  sconosciuto → il test va rosso.
- [ ] **Step 5: Commit** (ok): `feat(neve): sensori, giorni e classi della tavolozza GIBS`

### Task 3: Scaricare un passaggio, e capire cosa è arrivato

**Files:**
- Create: `src/lib/neve-rete.ts`
- Create: `src/__tests__/neve-rete.test.ts`

**Interfaces:**
- Consumes: `decodificaPngTavolozza`, `Inflate`, `PngTavolozza` (Task 1).
- Produces:
  - `type EsitoPassaggio = { tipo: 'dati'; png: PngTavolozza } | { tipo: 'nessunDato' } | { tipo: 'nonPubblicato' } | { tipo: 'errore'; motivo: string }`
  - `interface RispostaMinima { status: number; headers: { get(nome: string): string | null }; arrayBuffer(): Promise<ArrayBuffer>; body?: { cancel(): Promise<void> } | null }`
  - `type FetchMinimo = (url: string, init?: { signal?: AbortSignal }) => Promise<RispostaMinima>`
  - `scaricaPassaggio(url: string, deps: { fetch: FetchMinimo; inflate: Inflate; signal?: AbortSignal }): Promise<EsitoPassaggio>`
  - `TIMEOUT_PASSAGGIO_MS = 20_000`

- [ ] **Step 1: Test che falliscono**, con un `fetch` finto che restituisce oggetti
  `RispostaMinima`:
  - `'200 con l header e un PNG a tavolozza: dati'`: corpo = fixture Terra 13/10, header
    `layer-identifier-actual` presente → `tipo === 'dati'`, `png.larghezza === 256`.
  - `'200 senza l header: nessun dato, e il corpo non si legge'`: `arrayBuffer` è un
    `jest.fn` che **non** viene chiamato; `body.cancel` viene chiamato → `nessunDato`.
  - `'200 con l header ma corpo RGBA: nessun dato'` → `nessunDato`.
  - `'404: non pubblicato'` → `nonPubblicato`.
  - `'500: errore'` → `errore`.
  - `'rete giu: errore'`: il fetch rifiuta con `TypeError` → `errore`.
  - `'oltre 20 secondi: errore'`: con i finti timer di Jest, il fetch non risolve mai e
    dopo `TIMEOUT_PASSAGGIO_MS` → `errore`.
  - `'annullato da chi l ha chiesto: si propaga, non e un errore'`: `signal` già annullato
    → la promessa rifiuta con un errore di nome `'AbortError'`.
- [ ] **Step 2:** `npx jest src/__tests__/neve-rete.test.ts` → FAIL.
- [ ] **Step 3:** Implementare. Un `AbortController` interno unisce il `signal` del
  chiamante e il timeout. Il commento racconta il difetto: il «nessun dato» è un 200 e
  il corpo può essere rumore da 170 KB; l'`etag` `1000000000000` non è leggibile dal
  browser.
- [ ] **Step 4:** → PASS. Mutazioni:
  - accettare il 200 senza header → il secondo test va rosso;
  - trattare il 404 come `errore` → il test del 404 va rosso.
- [ ] **Step 5: Commit** (ok): `feat(neve): un passaggio GIBS dice se ha dati, se non e pubblicato o se e fallito`

### Task 4: Il composito, i testi e il riassunto della vista

**Files:**
- Create: `src/lib/neve-composito.ts`
- Create: `src/__tests__/neve-composito.test.ts`
- Modify: `src/lib/formato.ts`, aggiungere `giornoMeseLungo`
- Modify: `src/__tests__/formato.test.ts` (crearlo se manca)

**Interfaces:**
- Consumes: `EsitoPassaggio` (Task 3); `SensoreNeve`, `SENSORI_NEVE`,
  `classificaTavolozza`, i codici di pixel (Task 2).
- Produces:
  - `giornoMeseLungo(giorno: string): string`: `'2026-10-01'` → `'1 ottobre'`;
    una stringa non valida torna com'è. In `formato.ts`.
  - `interface Passaggio { giorno: string; sensore: SensoreNeve; esito: EsitoPassaggio }`
  - `interface RiassuntoMattonella { giorni: string[] /* usati da almeno un pixel, crescenti */; sensori: SensoreNeve[]; dati: number; nessunDato: number; nonPubblicati: number; errori: number }`
  - `interface CompositoMattonella { codici: Int8Array; origine: Int8Array /* indice in passaggi, -1 = nessuna vista */; passaggi: Passaggio[]; colori: Uint8Array /* RGB delle voci 0-100, dalla tavolozza del primo passaggio con dati; length 0 se nessuno */; riassunto: RiassuntoMattonella }`
  - `interface Composizione { aggiungi(p: Passaggio): void; completa(): boolean; risultato(): CompositoMattonella }`
  - `creaComposizione(lato = 256): Composizione`
  - `giorniDellaFinestra(candidati: string[], oggiHaDati: boolean): string[]`
  - `type StatoPunto = { stato: 'neve'; ndsi: number; giorno: string; sensore: SensoreNeve } | { stato: 'senza' | 'acqua'; giorno: string; sensore: SensoreNeve } | { stato: 'nonVisto'; giorni: string[] } | { stato: 'ignoto' }`
  - `statoNelPunto(c: CompositoMattonella, px: number, py: number): StatoPunto`
  - `interface RiassuntoVista { stato: 'ready' | 'nodata' | 'error'; da: string | null; a: string | null; sensori: SensoreNeve[]; parziale: boolean }`
  - `riassumiVista(r: RiassuntoMattonella[]): RiassuntoVista | null` (`null` per un
    elenco vuoto)
  - `aggiornaRiassunti(m: Map<string, RiassuntoMattonella>, e: { tipo: 'composta'; chiave: string; riassunto: RiassuntoMattonella } | { tipo: 'uscita'; chiave: string }): RiassuntoVista | null`.
    Aggiorna la `Map` delle mattonelle a schermo e restituisce `riassumiVista` dei
    valori. Sta qui e non nel componente: il componente importa `L.GridLayer`, che nel
    finto Leaflet dei test non esiste.
  - `testoViste(r: RiassuntoVista): string`
  - `testoPunto(s: StatoPunto): string`

Regola del composito (non la determina la firma): i pixel partono `NON_VISTO` con
`origine -1`. `aggiungi` conta l'esito nel riassunto. Per un passaggio `dati`, ogni pixel
con `origine === -1` il cui codice di tavolozza è diverso da `NON_VISTO` prende quel
codice e quell'origine. `completa()` vale `true` quando nessun pixel ha più `origine -1`.
`stato` di `riassumiVista`:
- somma di `dati` > 0 → `ready`;
- altrimenti, somma di `nessunDato` > 0 → `nodata`;
- altrimenti → `error`.

`parziale` = somma degli `errori` > 0. `da`/`a` = minimo e massimo dei `giorni`.

- [ ] **Step 1: Test che falliscono.**
  - `giornoMeseLungo`: `'2026-10-14'` → `'14 ottobre'`, `'2026-09-30'` →
    `'30 settembre'`, `'boh'` → `'boh'`.
  - `'vince il passaggio piu recente che ha visto il suolo'`: Terra 16/10 (nube su Monte
    Amaro), poi Terra 13/10 (fixture vere) → `statoNelPunto(c, 4, 243)` è
    `{ stato: 'neve', ndsi: 82, giorno: '2026-10-13', sensore: 'terra' }`.
  - `'la nube si scavalca, l assente non diventa senza neve'`: un `errore` e un
    `nonPubblicato`, poi Terra 16/10 → il pixel `(4,243)` resta
    `{ stato: 'nonVisto', giorni: ['2026-10-16'] }`. `giorni` = i giorni dei passaggi
    con dati.
  - `'nessun passaggio con dati: ignoto'` → `{ stato: 'ignoto' }`.
  - `'completa quando ogni pixel ha una vista'`: una mattonella sintetica 2×2 tutta
    `SENZA_NEVE` → `completa()` dopo un solo passaggio.
  - `giorniDellaFinestra(['2026-10-16','2026-10-15','2026-10-14','2026-10-13'], true)` →
    i primi tre; con `false` → gli ultimi tre.
  - `riassumiVista`:
    - un 404 da solo non accende `parziale`;
    - un `errore` sì;
    - tutti 404 → `stato: 'error'` (non `nodata`);
    - un `nessunDato` e nessun dato → `nodata`;
    - due mattonelle con giorni `['2026-10-14']` e `['2026-10-15','2026-10-16']` →
      `da: '2026-10-14'`, `a: '2026-10-16'`.
  - `testoViste`, stringhe esatte:
    - `'Viste dal 14 al 16 ottobre · MODIS Terra, Aqua · VIIRS NOAA-20'`;
    - stesso giorno → `'Viste del 16 ottobre · MODIS Terra'`;
    - mesi diversi → `'Viste dal 30 settembre al 2 ottobre · VIIRS NOAA-21'`.

    Ordine di stampa dei sensori: Terra, Aqua, NOAA-20, NOAA-21, S-NPP; MODIS prima di
    VIIRS.
  - `'una mattonella uscita dallo schermo esce dal riassunto'` (Review Focus 5): con
    `aggiornaRiassunti`, `composta` A (giorni `['2026-10-14']`) e B (`['2026-10-16']`),
    poi `uscita` A → `da: '2026-10-16'`; uscita anche B → `null`.
  - `testoPunto`, stringhe esatte:
    - `'Neve (indice 45) · vista il 15 ottobre da MODIS Terra'`;
    - `'Senza neve · vista il 16 ottobre da VIIRS NOAA-20'`;
    - `'Acqua o mare · vista il 16 ottobre da MODIS Aqua'`;
    - `'Non visto: nubi in tutti i passaggi dal 14 al 16 ottobre'`;
    - un solo giorno → `'… del 16 ottobre'`;
    - `'Nessuna immagine per questo punto negli ultimi 3 giorni'`.
- [ ] **Step 2:** `npx jest src/__tests__/neve-composito.test.ts src/__tests__/formato.test.ts` → FAIL.
- [ ] **Step 3:** Implementare.
- [ ] **Step 4:** → PASS. Mutazioni:
  - fare vincere anche la nube → il test «vince il più recente» va rosso;
  - contare i 404 come errori → il test del 404 va rosso.
- [ ] **Step 5: Commit** (ok): `feat(neve): composito dell ultima vista libera, con testi e riassunto`

### Task 5: La sorgente — passaggi pigri, finestra, cache

**Files:**
- Create: `src/lib/neve-sorgente.ts`
- Create: `src/__tests__/neve-sorgente.test.ts`

**Interfaces:**
- Consumes: `Inflate` (Task 1); `scaricaPassaggio`, `FetchMinimo` (Task 3); `creaComposizione`,
  `giorniDellaFinestra`, `statoNelPunto`, `CompositoMattonella`, `StatoPunto` (Task 4);
  `SENSORI_NEVE`, `giorniCandidati`, `urlMattonellaNeve`, `pixelZ8` (Task 2).
- Produces:
  - `interface DipendenzeSorgente { fetch: FetchMinimo; inflate: Inflate; adesso: () => Date; maxPassaggiInCache?: number /* predefinito 400 */ }`
  - `interface SorgenteNeve { mattonella(z: number, x: number, y: number, signal?: AbortSignal): Promise<CompositoMattonella>; punto(lat: number, lon: number, signal?: AbortSignal): Promise<StatoPunto>; dimensioneCache(): number }`
  - `creaSorgenteNeve(deps: DipendenzeSorgente): SorgenteNeve`

Algoritmo (non lo determinano le firme):
1. Giorni candidati da `adesso()`. I 5 sensori di **oggi** si chiedono in parallelo e si
   aggiungono **sempre** alla composizione, nell'ordine di `SENSORI_NEVE`. Contano nel
   riassunto anche quando oggi esce dalla finestra.
2. `oggiHaDati` = almeno un esito `dati`. Poi `giorniDellaFinestra`.
3. Gli altri giorni della finestra, uno alla volta: i 5 sensori in parallelo, aggiunti in
   ordine. Ci si ferma appena `completa()`.
4. Cache: solo gli esiti `dati`, chiave `layer|giorno|z|x|y`, LRU con l'ordine di
   inserimento di una `Map`. Gli altri esiti non si ricordano: alla prossima richiesta si
   riprovano.
5. `punto`: `pixelZ8` → `mattonella(8, x, y)` → `statoNelPunto`.

- [ ] **Step 1: Test che falliscono**, con un `fetch` finto che sceglie la risposta per
  URL:
  - `'oggi con dati: oggi, ieri, l altro ieri'`: adesso `2026-10-16T12:00Z`, Terra del
    16 = fixture nube, Terra del 15 = fixture neve 13/10, tutto il resto 404 → Monte
    Amaro dà neve 82 dal `'2026-10-15'`; nessuna richiesta per il `2026-10-13`.
  - `'al mattino, senza dati di oggi, si parte da ieri'`: tutto il 16 «nessun dato» (200
    senza header), Terra del 13 = fixture neve → è stato chiesto anche il `2026-10-13`, e
    Monte Amaro dà neve dal `'2026-10-13'`.
  - `'ci si ferma quando ogni pixel ha una vista'`: il 16 una mattonella sintetica tutta
    `SENZA_NEVE` con l'header → nessuna richiesta per il 15.
  - `'un passaggio fallito si richiede la volta dopo, uno con dati no'`: due chiamate a
    `mattonella` con lo stesso fetch finto → l'URL in 500 è chiesto due volte, quello con
    dati una.
  - `'la cache ha un tetto'` (Review Focus 4): `maxPassaggiInCache: 3`, 5 mattonelle
    diverse con dati → `dimensioneCache() <= 3`.
- [ ] **Step 2:** `npx jest src/__tests__/neve-sorgente.test.ts` → FAIL.
- [ ] **Step 3:** Implementare.
- [ ] **Step 4:** → PASS. Mutazione: togliere il ripiego del mattino (finestra sempre
  i primi tre) → il secondo test va rosso.
- [ ] **Step 5: Commit** (ok): `feat(neve): sorgente con passaggi pigri, finestra di 3 giorni con dati e cache limitata`

### Task 6: I pixel da disegnare

**Files:**
- Create: `src/lib/neve-disegno.ts`
- Create: `src/__tests__/neve-disegno.test.ts`

**Interfaces:**
- Consumes: `CompositoMattonella` (Task 4); `OPACITA_NEVE`, `VELO_NON_VISTO`, i codici
  (Task 2).
- Produces:
  - `interface Ritaglio { z: number; x: number; y: number /* mattonella da comporre */; x0: number; y0: number; lato: number /* quadrante, in pixel della mattonella composta */ }`
  - `ritaglioPer(z: number, x: number, y: number): Ritaglio`. Per `z ≤ 8` è
    `{ z, x, y, x0: 0, y0: 0, lato: 256 }`. Per `z > 8`, con `s = 2^(z-8)`: genitore
    `(floor(x/s), floor(y/s))` a z 8, `lato = 256/s`, `x0 = (x mod s)·lato`,
    `y0 = (y mod s)·lato`.
  - `pixelDellaMattonella(c: CompositoMattonella, r: Ritaglio): Uint8ClampedArray`:
    256×256×4. Pixel d'uscita `(ox, oy)` ← sorgente
    `(floor(x0 + ox·lato/256), floor(y0 + oy·lato/256))`.

- [ ] **Step 1: Test che falliscono.**
  - `'la neve ha il colore della tavolozza e alfa 235'`: composito delle fixture (Terra
    16 → Terra 13) a z 8 → il pixel d'uscita `(4,243)` ha l'RGB della voce 82 letto
    dalla tavolozza della fixture (oggi `240,121,128`) e alfa 235. Il test lo legge
    dalla fixture, non lo scrive a mano.
  - `'il velo dove nessuno ha visto'`: un pixel nube in tutti i passaggi →
    `[71,85,105,115]`.
  - `'senza neve e acqua restano trasparenti'` → alfa 0.
  - `'rete giu: niente velo'` (Review Focus 1): un composito con soli passaggi `errore`
    → tutti i 65536 pixel con alfa 0.
  - `'z 9: due mattonelle vicine si cuciono'` (Review Focus 3): `ritaglioPer(9, 276, 188)`
    e `ritaglioPer(9, 277, 188)`. L'ultima colonna della prima e la prima colonna della
    seconda leggono le colonne sorgente 127 e 128 dello stesso genitore `(8, 138, 94)`.
  - `'z 12: pixel nitidi'`: con `ritaglioPer(12, …)` ogni pixel sorgente diventa un
    blocco 16×16 uguale.
- [ ] **Step 2:** `npx jest src/__tests__/neve-disegno.test.ts` → FAIL.
- [ ] **Step 3:** Implementare. Il velo si disegna **solo se**
  `c.riassunto.dati > 0`: «non visto» vuol dire «visto, ma coperto», non «non arrivato».
- [ ] **Step 4:** → PASS. Mutazione: disegnare il velo anche con `dati === 0` → il test
  «rete giù» va rosso.
- [ ] **Step 5: Commit** (ok): `feat(neve): pixel nitidi, velo solo dove il satellite ha visto le nubi`

### Task 7: Il layer sulla mappa, lo store e il pannello

**Files:**
- Create: `src/components/map/emergency/EmergencyNeveLayer.tsx`
- Delete: `src/components/map/emergency/EmergencyXyzLayer.tsx`
- Modify:
  - `src/lib/emergency-layers.ts`: il kind `'xyz'` diventa `'neve'`; via `XyzConfig` e il
    campo `xyz`; nuova descrizione, attribuzione e legenda della voce `snow-cover`.
  - `src/lib/snow-cover.ts`: via `templateNeve`, `giorniDaProvare`,
    `GIORNI_INDIETRO_MAX`; nuova `ATTRIBUZIONE_NEVE`.
  - `src/stores/emergencyStore.ts`: `xyzGiorno`/`reportXyzTile` → `neve`/`reportNeve`.
  - `src/components/map/emergency/EmergencyLayers.tsx`: creazione della sorgente e
    montaggio.
  - `src/components/map/emergency/AvvisiLayer.tsx`: riga «Viste…» e avviso parziale.
  - `src/app/globals.css`: pixel nitidi.
  - Test: `src/__tests__/components/LayerFase2.test.tsx` (via il `describe('copertura
    nevosa sulla mappa')`, che prova il ripiego per layer, tolto di proposito) e
    `src/__tests__/fase2-invarianti.test.ts` (l'URL passa a `urlMattonellaNeve`).
- Create: `src/__tests__/neve-store.test.ts`

**Interfaces:**
- Consumes: `creaSorgenteNeve`, `SorgenteNeve` (Task 5); `ritaglioPer`,
  `pixelDellaMattonella` (Task 6); `aggiornaRiassunti`, `testoViste`, `RiassuntoVista`,
  `RiassuntoMattonella` (Task 4); `inflateDelBrowser` (Task 1); `COLORE_VELO_CSS`,
  `LEGENDA_NEVE` (Task 2).
- Produces:
  - store `neve: RiassuntoVista | null`;
  - `reportNeve(r: RiassuntoVista): void`;
  - `EmergencyNeveLayer({ sorgente }: { sorgente: SorgenteNeve }): null`;
  - in `EmergencyLayers`, una `sorgenteNeve` con `useMemo` legata a
    `retryTick['snow-cover']`, che il Task 8 passa anche alla pressione lunga.

Testi esatti:
- descrizione: `'Neve vista dai satelliti MODIS e VIIRS: per ogni punto, l’ultima vista
  senza nubi degli ultimi 3 giorni. Dettaglio ~450 m. Grigio = non visto per le nubi. In
  pianura e sui versanti ripidi possono comparire pixel spuri'`;
- attribuzione: `'Neve: <a href="https://worldview.earthdata.nasa.gov/">NASA GIBS</a> / MODIS, VIIRS'`;
- legenda: `[...LEGENDA_NEVE, { color: COLORE_VELO_CSS, label: 'non visto (nubi)' }]`;
- `reportNeve`:
  - `nodata` → errore `'Nessuna immagine negli ultimi 3 giorni'`;
  - `error` → `'Il servizio NASA non risponde o non riconosce i layer della neve'`;
  - `ready` → `partial: r.parziale`, `lastFetch: Date.now()`;
- avviso parziale per `snow-cover`: `'⚠ alcune immagini non sono arrivate'`;
- riga del pannello: `testoViste(neve)`, al posto di «Immagine del …».

Componente: un `L.GridLayer.extend({ createTile(coords, done) })` con `pane:
EMERGENCY_PANE` e `className: 'strato-neve'`. Ogni mattonella:
- un canvas 256×256;
- con `r = ritaglioPer(coords.z, coords.x, coords.y)`, si chiama
  `sorgente.mattonella(r.z, r.x, r.y, signal)` con un `AbortController` suo, poi
  `putImageData(new ImageData(pixelDellaMattonella(c, r), 256, 256), 0, 0)`;
- il suo `riassunto` va in una `Map` per chiave di mattonella, e dopo ogni cambio si
  chiama `reportNeve(riassumiVista([...valori]))`.

Su `tileunload`: annullare la richiesta e togliere la chiave. Un `setInterval` di 60
minuti chiama `redraw()`. Allo smontaggio: rimuovere il layer, fermare il timer,
annullare tutto.

CSS: `.strato-neve canvas { image-rendering: pixelated; }`.

- [ ] **Step 1: Test che falliscono** in `neve-store.test.ts`:
  - `'un riassunto pronto fa ready e dice se e parziale'`;
  - `'nodata e error con i loro messaggi'`;
  - `'a layer spento un riassunto tardivo non riaccende niente'` (Review Focus 2):
    `stopLayer('snow-cover')` poi `reportNeve(...)` → status `'idle'`, `neve === null`;
  - `'spegnere butta il riassunto'`;
  - `'Riprova ricomincia da capo'`: `retryLayer` → `neve === null`, status `'loading'`,
    `retryTick` +1.

  Il componente usa `aggiornaRiassunti` (Task 4) per la `Map` delle mattonelle a schermo:
  `composta` dopo `putImageData`, `uscita` su `tileunload`.
- [ ] **Step 2:** `npx jest src/__tests__/neve-store.test.ts` → FAIL.
- [ ] **Step 3:** Implementare store, registro, `snow-cover.ts`, componente,
  `EmergencyLayers`, `AvvisiLayer`, CSS. Togliere `EmergencyXyzLayer.tsx` e il vecchio
  `describe` dei test. Il commento nel test spiega perché sparisce: «scende di un giorno
  per tutto il layer» è il difetto 2 della spec.
- [ ] **Step 4:** `npm run check` → verde.
- [ ] **Step 5: Verifica a schermo.** `npm run dev`, layer neve acceso, mappa
  sull'Abruzzo a zoom 9 e 12, screenshot con Playwright (non con chrome-devtools MCP: va
  in timeout con la mappa Leaflet):
  - colori nitidi;
  - velo dove ci sono nubi;
  - riga «Viste dal …» nel pannello.
- [ ] **Step 6: Commit** (ok): `feat(neve): il layer compone 5 sensori e 3 giorni, e dice cosa non ha visto`

### Task 8: Pressione lunga su un pixel

**Files:**
- Modify: `src/components/map/emergency/EmergencyFeatureInfo.tsx`,
  `src/components/map/emergency/EmergencyLayers.tsx`
- Modify: `src/__tests__/components/EmergencyFeatureInfo.test.tsx`

**Interfaces:**
- Consumes: `SorgenteNeve.punto` (Task 5); `testoPunto` (Task 4); `sorgenteNeve`
  (Task 7).
- Produces: `EmergencyFeatureInfo({ defs, neve }: { defs: EmergencyLayerDef[]; neve: SorgenteNeve | null })`.
  `EmergencyLayers` lo monta se `queryableDefs.length > 0` **oppure** se `snow-cover` è
  acceso (con `neve = sorgenteNeve`, altrimenti `null`).

Comportamento: su `contextmenu` un solo popup. Prima la riga della neve
(`testoPunto(await neve.punto(lat, lng))`), poi i risultati WMS come oggi. Se la neve
fallisce, la riga dice `'Neve: dettagli non disponibili'`. Tutto passa da
`escapeMarkup`.

- [ ] **Step 1: Test che falliscono** (`__fireMapEvent('contextmenu', { latlng })` e
  `__openedPopups()` dei mock esistenti):
  - `'col solo layer neve, la pressione lunga dice cosa ha visto il satellite'`: una
    `neve` finta il cui `punto` risolve
    `{ stato: 'neve', ndsi: 45, giorno: '2026-10-15', sensore: 'terra' }` → il popup
    contiene `'Neve (indice 45) · vista il 15 ottobre da MODIS Terra'`;
  - `'neve e WMS insieme: un popup solo'` → un solo popup aperto, con entrambe le righe;
  - `'neve che fallisce non spegne il WMS'`;
  - i test esistenti del WMS restano verdi senza modifiche (con `neve: null`).
- [ ] **Step 2:** `npx jest src/__tests__/components/EmergencyFeatureInfo.test.tsx` → FAIL.
- [ ] **Step 3:** Implementare.
- [ ] **Step 4:** → PASS; `npm run check` verde.
- [ ] **Step 5: Commit** (ok): `feat(neve): la pressione lunga dice cosa ha visto il satellite in quel punto, e quando`

### Task 9: GIBS fuori dalla cache del service worker

**Files:**
- Modify: `src/app/sw.ts`, nel blocco «Dati di emergenza», prima di `...defaultCache`
- Modify: `src/__tests__/service-worker-ordine.test.ts`
- Modify: `e2e/supporto.ts`: `gibs` nell'espressione dei layer di emergenza finti (503),
  così nessuno scenario chiede GIBS vero per sbaglio

- [ ] **Step 1: Test che fallisce**: `'la neve di GIBS non si serve mai da cache'`. Nelle
  righe di `righeRegole()` prima di `...defaultCache` c'è una riga che contiene `gibs` e
  `NetworkOnly`.
- [ ] **Step 2:** `npx jest src/__tests__/service-worker-ordine.test.ts` → FAIL.
- [ ] **Step 3:** Aggiungere
  `{ matcher: /^https:\/\/gibs\.earthdata\.nasa\.gov\//i, handler: new NetworkOnly() },`
  con il commento: un «nessun dato» o un passaggio di ieri serviti da cache come attuali.
- [ ] **Step 4:** → PASS; `npm run check` verde.
- [ ] **Step 5: Commit** (ok): `fix(sw): la neve di GIBS non passa dalla cache`

### Task 10: Scenario end-to-end sullo schermo vero

**Files:**
- Create: `e2e/neve.spec.ts`

Impianto:
- `page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'))`.
- `page.route(/gibs\.earthdata\.nasa\.gov/)`, registrato dopo `apriApp`/`fingiLaRete`, così
  vince sui 503 del Task 9:
  - Terra `2026-10-16` per `8/94/138` → fixture nube;
  - Terra `2026-10-15` per `8/94/138` → fixture neve del 13/10;
  - ogni altra richiesta → 200 **senza** header, con un PNG RGBA 256×256 rosso pieno
    (rumore finto), creato nel test con `zlib`.

  Le risposte con dati portano `access-control-allow-origin: *`,
  `access-control-expose-headers: layer-identifier-actual` e `layer-identifier-actual:
  MODIS_Terra_NDSI_Snow_Cover_v6.1_STD`.
- Impostazioni con `emergencyLayers: ['snow-cover']`, viewport predefinito 1280×900.
  Due viste in `sessionStorage` (`tt_map_view`):
  - per i primi due scenari, `{ lat: 42.565, lng: 14.766, z: 8 }`: il centro della
    mattonella `8/94/138`, che resta tutta a schermo. Misurato sulle due fixture: 1459
    pixel non visti in entrambi i giorni (velo) e 280 di neve nel composito;
  - per la pressione lunga, `{ lat: 42.0858, lng: 14.0858, z: 10 }` (Monte Amaro al
    centro).

- [ ] **Step 1: Scenari.**
  - `'la neve si vede, le nubi hanno il velo, il rumore non lascia segni'`. Nei canvas
    `.strato-neve canvas`:
    - almeno un pixel ha alfa 235 (neve);
    - almeno uno è `[71,85,105,115]` (velo);
    - **nessun** pixel ha `r > 200, g < 50, b < 50` con alfa > 0 (il rosso del rumore).
  - `'il pannello dice di che giorni sono le viste'`: il dettaglio del layer contiene
    `'Viste dal 15 al 16 ottobre · MODIS Terra'`.
  - `'la pressione lunga sulla vetta dice neve, e quando'`: clic destro al centro della
    mappa → popup con `'Neve (indice 82) · vista il 15 ottobre da MODIS Terra'`.
  - `'tutto 404: errore con Riprova, non nessun dato'`: un `route` che risponde sempre
    404 → nel dettaglio c'è il pulsante «Riprova».
- [ ] **Step 2:** `npx playwright test e2e/neve.spec.ts` → FAIL prima dei Task 7-8; PASS
  dopo.
- [ ] **Step 3:** `npm run test:e2e` (suite intera) e `npm run test:e2e:webkit` → verdi.
  WebKit prova `DecompressionStream`.
- [ ] **Step 4: Commit** (ok): `test(e2e): il layer neve a schermo, col rumore di GIBS che non passa`

### Task 11: Sui dati veri, e rilascio

**Files:**
- Modify: `CHANGELOG.md` (voce 0.33.0), `package.json` (`version: 0.33.0`)
- Modify: `CLAUDE.md`, riga dei layer di emergenza: «neve GIBS» → composito 5 sensori,
  `fetch` + decodifica a mano, «nessun dato» = 200 senza header, GIBS `NetworkOnly`
- KB Obsidian `02 - Projects/TrekTrak/` (scheda dei layer di emergenza): con un subagent,
  secondo `99 - Meta/Knowledge Sync Rules.md`, senza commit

- [ ] **Step 1: Verifica sui dati veri.** App in `npm run dev`, layer neve acceso, GIBS
  vero. Si confronta con `python3 backlog/docs/neve-satellite.py composito --sensori
  terra,aqua,noaa20,noaa21,snpp <oggi> 3`. Sulle quattro cime (pressione lunga su Monte
  Amaro, Corno Grande, Velino, Vettore), lo stato e il giorno della vista devono tornare
  con lo script. Le differenze vanno spiegate, non ignorate. Screenshot Playwright a zoom
  9 e 12.
- [ ] **Step 2:** `npm run check` verde; `npm run test:e2e:webkit` verde.
- [ ] **Step 3:** CHANGELOG, versione, `CLAUDE.md`, KB.
- [ ] **Step 4: Commit** (ok): `chore(rilascio): v0.33.0 — la neve vista da 5 satelliti, e quello che non hanno visto`.
  Merge su `master`, tag e push **solo su richiesta esplicita**.
