# Meteo: modelli scelti dall'utente e soglie misurate — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il pannello «Quando partire» smette di dichiarare «nessuna criticità» sotto un temporale: i codici di precipitazione entrano nel giudizio, l'utente sceglie il modello, e le soglie sono quelle misurate.

**Architecture:** Una sola chiamata a Open-Meteo porta **due** modelli (`ecmwf_ifs`, `icon_seamless`); il modello scelto nelle impostazioni ne possiede **uno solo** e da lì vengono righe, motivi, verdetto e fasce. Cambiare modello è un ricalcolo locale (`useMemo`), non una nuova richiesta. Le soglie di probabilità sono un **parametro** di `classifyHour`, diverse per modello.

**Tech Stack:** Next.js 14.2 · TypeScript · Zustand · Jest + Testing Library · Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-meteo-modelli-e-soglie-design.md`
**Misure di riferimento:** `backlog/docs/meteo-verifica-modelli-analisi.md` (rifattibili con `backlog/docs/meteo-verifica-modelli.py`)

## Global Constraints

- **Italiano** in commenti, testi a schermo e messaggi di commit. I commenti spiegano il *perché* (di norma il difetto che la riga previene), non il *cosa*.
- **Ora e formato italiani**: numeri via `lib/formato.ts` (`numero`, `metri`, `oraItaliana`), fuso sempre `Europe/Rome`. **Vietati** `getHours`/`getDate`/`toLocale*` senza `timeZone` — c'è un guardiano (`__tests__/fuso-orario.test.ts`).
- **Un dato assente si dichiara** («n/d», «dati non disponibili»), non si disegna a zero.
- **`npm run check` verde prima di ogni commit** (typecheck prodotto/test/e2e + lint + jest).
- **Nessun test si modifica per far passare un refactoring.** Le correzioni si verificano **per mutazione**: rompere di proposito la riga corretta e vedere un test rosso.
- **Mai committare senza chiedere**: ogni task finisce con un commit *proposto*, la sessione principale chiede conferma all'utente.
- Bersagli tocco **≥ 44 px** su mobile (`max-lg:`).
- Soglie misurate, da usare verbatim: **ECMWF giallo 15 / arancione 32**, **ICON giallo 5 / arancione 10**. Predefinito **ECMWF**.

## Struttura dei file

| file | responsabilità | task |
|---|---|---|
| `src/lib/route-weather.ts` | giudizio puro: codici, soglie, righe | 1, 2, 4, 7 |
| `src/lib/weather-api.ts` | rete: URL, due modelli, lettura risposta | 2, 3 |
| `src/lib/types.ts` | `ModelloMeteo`, `AppSettings.modelloMeteo` | 3, 5 |
| `src/lib/meteoblue.ts` *(nuovo)* | costruzione del link per coordinate | 7 |
| `src/components/weather/RouteWeatherPanel.tsx` | tendina, scelta del modello, attribuzione | 3, 5 |
| `src/components/weather/TabellaPuntiMeteo.tsx` | colonne: via CAPE, dentro mm | 6 |
| `src/components/weather/MenuRigaMeteo.tsx` *(nuovo)* | menu ⋮ di riga | 7 |

---

### Task 1: I codici di precipitazione entrano nel giudizio

Il difetto segnalato dall'utente: «anche con "piogge deboli" segna verde». `classifyHour` legge solo 95/96/99; pioggia, pioviggine, rovesci e neve non li guarda nessuno.

**Files:**
- Modify: `src/lib/route-weather.ts:126-135` (dopo `CODICI_TEMPORALE`) e `:302-350` (`classifyHour`)
- Test: `src/__tests__/route-weather.test.ts`

**Interfaces:**
- Consumes: niente
- Produces: `classifyHour` invariata nella firma; nuovi motivi in `Classificazione.reasons`

- [ ] **Step 1: Scrivere il test che fallisce**

In `src/__tests__/route-weather.test.ts`, dentro il `describe` di `classifyHour`:

```ts
describe('classifyHour: i codici di precipitazione contano', () => {
  /**
   * Segnalato il 2026-09-09: «anche con "piogge deboli" segna verde». Il codice WMO
   * diceva pioggia e il giudizio guardava solo la probabilità: ad Altamura, alle 17:00,
   * il modello aveva in mano `80 = rovesci deboli` e l'unico motivo scritto era il vento.
   */
  const ora = (weatherCode: number) => ({
    time: '2026-09-09T15:00', cape: 0, weatherCode, gusts: 0, precipProb: 0,
  });

  test('rovesci deboli (80) non sono più verdi', () => {
    const c = classifyHour(ora(80));
    expect(c.level).toBe(1);
    expect(c.reasons).toContain('rovesci deboli');
  });

  test('pioggia (63) vale attenzione', () => {
    expect(classifyHour(ora(63)).level).toBe(2);
  });

  test('pioggia forte (65) e rovesci violenti (82) valgono il massimo', () => {
    expect(classifyHour(ora(65)).level).toBe(3);
    expect(classifyHour(ora(82)).level).toBe(3);
  });

  test('la pioggia che gela vale il massimo: in montagna è ghiaccio', () => {
    expect(classifyHour(ora(66)).level).toBe(3);
    expect(classifyHour(ora(56)).level).toBe(3);
  });

  test('un cielo senza precipitazione resta verde', () => {
    expect(classifyHour(ora(3)).level).toBe(0);
    expect(classifyHour(ora(45)).level).toBe(0);
  });

  test('il temporale resta il massimo e non viene sovrascritto', () => {
    const c = classifyHour(ora(95));
    expect(c.level).toBe(3);
    expect(c.reasons).toContain('temporale');
  });
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx jest src/__tests__/route-weather.test.ts -t "codici di precipitazione"`
Expected: FAIL — `expect(received).toBe(1)` con `received` 0, perché il codice 80 non viene letto.

- [ ] **Step 3: Implementare**

In `src/lib/route-weather.ts`, subito dopo `CODICI_TEMPORALE`:

```ts
/**
 * Gli altri codici WMO di precipitazione, col livello che meritano.
 *
 * Prima esisteva solo `CODICI_TEMPORALE`: la tabella WMO era completa in `cielo.ts` per
 * **disegnare** l'iconcina, e ignorata da chi **giudica**. Il risultato, misurato il
 * 2026-09-09 su 288 ore, erano 7 ore con la pioggia scritta nel codice e il verdetto a
 * verde — fra cui cinque `80 = rovesci deboli`.
 *
 * La scala: pioviggine e rovesci deboli sono un fastidio (1), pioggia e neve continue
 * bagnano e raffreddano (2), le forme forti e **tutto ciò che gela** sono un pericolo (3)
 * — in quota il ghiaccio non è pioggia intensa, è un altro problema.
 */
const CODICI_PRECIPITAZIONE: Record<number, { testo: string; livello: 1 | 2 | 3 }> = {
  51: { testo: 'pioviggine leggera', livello: 1 },
  53: { testo: 'pioviggine', livello: 1 },
  55: { testo: 'pioviggine intensa', livello: 1 },
  56: { testo: 'pioviggine che gela', livello: 3 },
  57: { testo: 'pioviggine che gela, intensa', livello: 3 },
  61: { testo: 'pioggia debole', livello: 2 },
  63: { testo: 'pioggia', livello: 2 },
  65: { testo: 'pioggia forte', livello: 3 },
  66: { testo: 'pioggia che gela', livello: 3 },
  67: { testo: 'pioggia che gela, forte', livello: 3 },
  71: { testo: 'neve debole', livello: 1 },
  73: { testo: 'neve', livello: 2 },
  75: { testo: 'neve forte', livello: 3 },
  77: { testo: 'granelli di neve', livello: 1 },
  80: { testo: 'rovesci deboli', livello: 1 },
  81: { testo: 'rovesci', livello: 2 },
  82: { testo: 'rovesci violenti', livello: 3 },
  85: { testo: 'rovesci di neve', livello: 2 },
  86: { testo: 'rovesci di neve forti', livello: 3 },
};
```

In `classifyHour`, subito dopo il blocco `// 1. Temporale esplicito`:

```ts
  // 1-bis. Le altre precipitazioni dichiarate dal codice: il modello sta dicendo che
  // cade qualcosa, e finora nessuno lo ascoltava.
  const precipitazione = codiceNoto ? CODICI_PRECIPITAZIONE[o.weatherCode] : undefined;
  if (precipitazione != null) {
    reasons.push(precipitazione.testo);
    alza(precipitazione.livello);
  }
```

- [ ] **Step 4: Eseguire e vedere verde**

Run: `npx jest src/__tests__/route-weather.test.ts`
Expected: PASS, tutti.

- [ ] **Step 5: Verificare per mutazione**

Cambiare `alza(precipitazione.livello)` in `alza(0)`, rilanciare: i test dei codici devono diventare **rossi**. Rimettere la riga giusta e rilanciare: verdi.

- [ ] **Step 6: `npm run check` e commit proposto**

```bash
npm run check
git add src/lib/route-weather.ts src/__tests__/route-weather.test.ts
git commit -m "fix(meteo): la pioggia dichiarata dal modello non è più «nessuna criticità»"
```

---

### Task 2: I millimetri entrano nel dato orario (ma non nel giudizio)

**Files:**
- Modify: `src/lib/weather-api.ts:19-26` (`VARIABILI`), `:75-83` (`serieValida`)
- Modify: `src/lib/route-weather.ts:65-83` (`PuntoOrario`, `OraDaClassificare`), `:86-96` (`SerieOraria`), `:470-495` (`letturaVicina`)
- Test: `src/__tests__/route-weather.test.ts`

**Interfaces:**
- Consumes: Task 1
- Produces: `PuntoOrario.mm: number`; `OraDaClassificare = Omit<PuntoOrario, 'temp' | 'mm'>`; `SerieOraria.precipitation: number[]`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
describe('letturaVicina porta i millimetri', () => {
  test('i mm dell’ora scelta finiscono nel dato', () => {
    const serie = {
      time: ['2026-09-09T14:00', '2026-09-09T15:00'],
      cape: [0, 0], weather_code: [3, 63], wind_gusts_10m: [0, 0],
      precipitation_probability: [0, 0], temperature_2m: [10, 10],
      precipitation: [0, 6.9],
    };
    const r = buildRouteWeather({
      waypoints: [{ id: 'a', name: 'A', order: 0, lat: 42, lon: 14, altitude: 100 }],
      legs: [], departure: new Date('2026-09-09T15:00:00Z'),
      punti: [{ waypointIndex: 0, lat: 42, lon: 14, name: 'A', alt: 100 }],
      serie: [serie],
    });
    expect(r.rows[0].hour?.mm).toBe(6.9);
  });
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx jest src/__tests__/route-weather.test.ts -t "millimetri"`
Expected: FAIL — typecheck/`mm` non esiste su `PuntoOrario`.

- [ ] **Step 3: Implementare**

`weather-api.ts`, in `VARIABILI` dopo `'temperature_2m'`:

```ts
  'precipitation',              // i millimetri: la probabilità dice «se», questi «quanto»
```

`weather-api.ts`, in `serieValida`, aggiungere alla catena:

```ts
    && Array.isArray(o.precipitation)
```

`route-weather.ts`, in `SerieOraria`:

```ts
  precipitation: number[];
```

`route-weather.ts`, in `PuntoOrario` dopo `temp`:

```ts
  /** Millimetri nell'ora. La probabilità dice «se piove», questo «quanto». */
  mm: number;
```

`route-weather.ts`, `OraDaClassificare` — nota il **doppio** `Omit`:

```ts
/**
 * Quel che basta per **giudicare** un'ora: temperatura e millimetri non entrano.
 *
 * I mm restano fuori di proposito: la verifica del 2026-09-09 ha misurato soglie di
 * **probabilità** (ECMWF 32%, ICON 10%), non di millimetri. Aggiungere qui una soglia in
 * mm senza averla misurata sarebbe tornare al difetto di partenza, le soglie a occhio.
 * E chiedere al giudice un campo che non guarda obbliga a inventarne un valore in ogni
 * chiamata: è lì che nascono i dati finti.
 */
export type OraDaClassificare = Omit<PuntoOrario, 'temp' | 'mm'>;
```

`route-weather.ts`, in `letturaVicina`, nel valore restituito dopo `temp`:

```ts
    mm: serie.precipitation?.[migliore] ?? Number.NaN,
```

- [ ] **Step 4: Eseguire e vedere verde**

Run: `npm test`
Expected: PASS. Se un test esistente costruisce una `SerieOraria` letterale senza `precipitation`, aggiungere il campo **al test**, non allentare il tipo.

- [ ] **Step 5: `npm run check` e commit proposto**

```bash
npm run check
git add src/lib/weather-api.ts src/lib/route-weather.ts src/__tests__
git commit -m "feat(meteo): i millimetri arrivano nel dato orario, fuori dal giudizio"
```

---

### Task 3: Due modelli in una chiamata, ECMWF predefinito

**Files:**
- Modify: `src/lib/types.ts` (in fondo, accanto a `Tema`)
- Modify: `src/lib/weather-api.ts:15-30`, `:58-73` (`buildForecastUrl`), `:75-108` (lettura risposta)
- Modify: `src/components/weather/RouteWeatherPanel.tsx:113-119`
- Test: `src/__tests__/weather-api.test.ts` *(se non esiste, crearlo)*

**Interfaces:**
- Consumes: Task 2
- Produces: `type ModelloMeteo = 'ecmwf' | 'icon'`; `MODELLO_METEO_PREDEFINITO`; `RouteForecast.serie: Record<ModelloMeteo, SerieOraria[]>`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
import { buildForecastUrl, leggiRisposta } from '@/lib/weather-api';

describe('due modelli in una sola chiamata', () => {
  const punti = [{ waypointIndex: 0, lat: 42.2, lon: 14.28, name: 'A', alt: 2100 }];

  test('l’URL chiede ECMWF e ICON insieme', () => {
    const u = decodeURIComponent(buildForecastUrl(punti, 2));
    expect(u).toContain('models=ecmwf_ifs,icon_seamless');
    expect(u).toContain('precipitation');
  });

  /**
   * Con più modelli Open-Meteo suffissa OGNI variabile col nome del modello, mentre
   * `time` ed `elevation` restano unici. Verificato sulla risposta vera il 2026-09-09.
   */
  test('le serie si separano per modello dalle chiavi suffissate', () => {
    const risposta = [{
      elevation: 2100,
      hourly: {
        time: ['2026-09-09T15:00'],
        cape_ecmwf_ifs: [1000], weather_code_ecmwf_ifs: [95], wind_gusts_10m_ecmwf_ifs: [20],
        precipitation_probability_ecmwf_ifs: [65], temperature_2m_ecmwf_ifs: [12],
        precipitation_ecmwf_ifs: [2.4],
        cape_icon_seamless: [900], weather_code_icon_seamless: [3], wind_gusts_10m_icon_seamless: [32],
        precipitation_probability_icon_seamless: [28], temperature_2m_icon_seamless: [13],
        precipitation_icon_seamless: [0.3],
      },
    }];
    const f = leggiRisposta(risposta);
    expect(f.serie.ecmwf[0].weather_code[0]).toBe(95);
    expect(f.serie.icon[0].weather_code[0]).toBe(3);
    expect(f.elevations[0]).toBe(2100);
  });
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx jest src/__tests__/weather-api.test.ts`
Expected: FAIL — `leggiRisposta` non esiste.

- [ ] **Step 3: Implementare**

`src/lib/types.ts`, accanto a `Tema`:

```ts
/**
 * Quale modello meteo interroga il pannello del percorso.
 *
 * Non è un dettaglio da nascondere: i due dicono cose diverse, e la verifica del
 * 2026-09-09 su 171 temporali osservati li separa (AUC 0,927 ECMWF contro 0,891 ICON).
 * Il modello scelto possiede **tutto** — righe, motivi, verdetto, fasce: mescolare le
 * fonti dentro una riga mostrerebbe una previsione che nessun modello ha mai fatto.
 */
export type ModelloMeteo = 'ecmwf' | 'icon';

/** ECMWF: discrimina meglio, ed è l'unico dei due che arriva a coprire il 90% dei temporali. */
export const MODELLO_METEO_PREDEFINITO: ModelloMeteo = 'ecmwf';
```

`src/lib/weather-api.ts`:

```ts
import type { ModelloMeteo } from './types';

/** Gli identificativi di Open-Meteo. `ecmwf_ifs_hres` NON esiste: l'API lo rifiuta. */
const MODELLI_API: Record<ModelloMeteo, string> = {
  ecmwf: 'ecmwf_ifs',
  icon: 'icon_seamless',
};

export interface RouteForecast {
  /** Una serie per punto, nello stesso ordine dei punti richiesti, per ogni modello. */
  serie: Record<ModelloMeteo, SerieOraria[]>;
  elevations: number[];
}
```

In `buildForecastUrl`, prima del `return`:

```ts
  // Due modelli in una sola richiesta: misurato, 17 KB. Averli entrambi in mano permette
  // di cambiare modello dalla tendina SENZA rifare la rete.
  u.searchParams.set('models', Object.values(MODELLI_API).join(','));
```

Sostituire `serieValida` con la lettura per modello:

```ts
/**
 * Con più modelli il servizio suffissa ogni variabile (`weather_code_ecmwf_ifs`), mentre
 * `time` ed `elevation` restano unici. Verificato sulla risposta vera il 2026-09-09.
 */
function serieDelModello(orarie: Record<string, unknown>, api: string): SerieOraria | null {
  const time = orarie.time;
  if (!Array.isArray(time)) return null;
  const v = (nome: string) => orarie[`${nome}_${api}`];
  const campi = {
    cape: v('cape'), weather_code: v('weather_code'), wind_gusts_10m: v('wind_gusts_10m'),
    precipitation_probability: v('precipitation_probability'),
    temperature_2m: v('temperature_2m'), precipitation: v('precipitation'),
  };
  if (!Object.values(campi).every(Array.isArray)) return null;
  return { time, ...campi } as SerieOraria;
}

/** Estratta dalla `fetch` per poterla provare senza rete. */
export function leggiRisposta(dati: unknown): RouteForecast {
  const elenco = Array.isArray(dati) ? dati : [dati];
  const serie: Record<ModelloMeteo, SerieOraria[]> = { ecmwf: [], icon: [] };
  const elevations: number[] = [];
  for (const voce of elenco) {
    const o = voce as Record<string, unknown> | null;
    const orarie = o?.hourly as Record<string, unknown> | undefined;
    if (orarie == null) throw new Error('Previsione in un formato non riconosciuto');
    for (const modello of Object.keys(MODELLI_API) as ModelloMeteo[]) {
      const s = serieDelModello(orarie, MODELLI_API[modello]);
      if (s == null) throw new Error('Previsione in un formato non riconosciuto');
      serie[modello].push(s);
    }
    elevations.push(typeof o?.elevation === 'number' ? o.elevation : Number.NaN);
  }
  return { serie, elevations };
}
```

In `fetchRouteForecast`, sostituire il corpo dopo `res.json()` con `return leggiRisposta(dati);`.

`RouteWeatherPanel.tsx`, nel `useMemo` del report:

```ts
      serie: datiMeteo.serie[MODELLO_METEO_PREDEFINITO], elevations: datiMeteo.elevations,
```

(importare `MODELLO_METEO_PREDEFINITO` da `@/lib/types`; la tendina arriva al Task 5.)

- [ ] **Step 4: Eseguire e vedere verde**

Run: `npm test`
Expected: PASS. Gli e2e che fingono Open-Meteo (`e2e/meteo-percorso.spec.ts`, `e2e/meteo-intermedio-critico.spec.ts`) rispondono ancora con chiavi **non** suffissate e vanno adeguati nel Task 8: qui basta che jest sia verde.

- [ ] **Step 5: Verificare sulla rete vera**

```bash
node -e "const{buildForecastUrl}=require('./src/lib/weather-api');" # solo per l'URL
curl -s "$(URL costruito a mano dal test, con 2 punti)" | head -c 300
```
Deve contenere `weather_code_ecmwf_ifs` **e** `weather_code_icon_seamless`.

- [ ] **Step 6: `npm run check` e commit proposto**

```bash
npm run check
git add src/lib/types.ts src/lib/weather-api.ts src/components/weather/RouteWeatherPanel.tsx src/__tests__/weather-api.test.ts
git commit -m "feat(meteo): due modelli in una chiamata, ECMWF come predefinito"
```

---

### Task 4: Soglie per modello, passate a `classifyHour`

**Files:**
- Modify: `src/lib/route-weather.ts:302-350` (`classifyHour`), `:505-540` (`fasceCritiche`), `:633-660` (`buildRouteWeather`)
- Test: `src/__tests__/route-weather.test.ts`

**Interfaces:**
- Consumes: Task 3 (`ModelloMeteo`)
- Produces: `SoglieModello`, `SOGLIE_MODELLO`, `classifyHour(o, soglie)`, `buildRouteWeather({ …, modello? })`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
import { SOGLIE_MODELLO } from '@/lib/route-weather';

describe('soglie per modello: misurate, non a occhio', () => {
  /**
   * Verifica del 2026-09-09 su 171 temporali osservati: con ICON la probabilità media
   * nelle ore in cui il temporale c'è davvero vale 38,7%, quindi una soglia a 70% era
   * irraggiungibile per costruzione. ECMWF 32 e ICON 10 danno la stessa sensibilità
   * (81% e 78% dei temporali presi).
   */
  const ora = (precipProb: number) => ({
    time: '2026-09-09T15:00', cape: 0, weatherCode: 3, gusts: 0, precipProb,
  });

  test('32% è attenzione per ECMWF, e non lo è per ICON… anzi lo è di più', () => {
    expect(classifyHour(ora(32), SOGLIE_MODELLO.ecmwf).level).toBe(2);
    expect(classifyHour(ora(31), SOGLIE_MODELLO.ecmwf).level).toBe(1);
  });

  test('con ICON bastano 10 punti di probabilità', () => {
    expect(classifyHour(ora(10), SOGLIE_MODELLO.icon).level).toBe(2);
    expect(classifyHour(ora(5), SOGLIE_MODELLO.icon).level).toBe(1);
    expect(classifyHour(ora(4), SOGLIE_MODELLO.icon).level).toBe(0);
  });

  test('la stessa ora giudicata coi due modelli: ICON non può tacere dove ECMWF grida', () => {
    // 28% era il valore vero di ICON ad Altamura alle 17:00 del 2026-09-09.
    expect(classifyHour(ora(28), SOGLIE_MODELLO.icon).level).toBe(2);
  });
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx jest src/__tests__/route-weather.test.ts -t "soglie per modello"`
Expected: FAIL — `SOGLIE_MODELLO` non esiste.

- [ ] **Step 3: Implementare**

In `route-weather.ts`, vicino alle altre costanti:

```ts
/** Le due soglie di probabilità di un modello: sotto la prima è verde. */
export interface SoglieModello { giallo: number; arancione: number }

/**
 * Soglie **misurate**, non scelte a occhio.
 *
 * Verifica del 2026-09-09 (`backlog/docs/meteo-verifica-modelli-analisi.md`): 171
 * temporali osservati al METAR su 8 stazioni italiane, luglio-agosto, tolleranza ±1 ora.
 * I due arancioni sono tarati per **avvisare allo stesso modo** — 81% dei temporali presi
 * per ECMWF a 32%, 78% per ICON a 10% — così cambiare modello dalla tendina non cambia di
 * nascosto quanto l'app allarma. I due gialli no, e non possono: la probabilità di ICON
 * satura, e oltre l'83% quel modello non arriva a nessuna soglia.
 */
export const SOGLIE_MODELLO: Record<ModelloMeteo, SoglieModello> = {
  ecmwf: { giallo: 15, arancione: 32 },
  icon: { giallo: 5, arancione: 10 },
};
```

`classifyHour` prende le soglie come parametro (nessun valore predefinito: chi giudica deve dire con quale metro):

```ts
export function classifyHour(o: OraDaClassificare, soglie: SoglieModello): Classificazione {
```

e nel blocco della pioggia:

```ts
  if (pioggiaNota) {
    if (o.precipProb >= soglie.arancione) { reasons.push(`pioggia ${Math.round(o.precipProb)}%`); alza(2); }
    else if (o.precipProb >= soglie.giallo) { reasons.push(`pioggia ${Math.round(o.precipProb)}%`); alza(1); }
  }
```

`fasceCritiche` prende e inoltra le soglie:

```ts
function fasceCritiche(serie: SerieOraria[], da: Date, a: Date, soglie: SoglieModello): FinestraCritica[] {
```
e nella chiamata interna: `classifyHour({ … }, soglie)`.

`buildRouteWeather` accetta il modello e ne ricava le soglie:

```ts
  /** Quale modello sta parlando: decide le soglie, che sono diverse per ognuno. */
  modello?: ModelloMeteo;
```
e in cima al corpo:

```ts
  const soglie = SOGLIE_MODELLO[input.modello ?? MODELLO_METEO_PREDEFINITO];
```
poi `classifyHour(hour, soglie)` in `riga()` e `fasceCritiche(serie, …, soglie)`.

- [ ] **Step 4: Eseguire e vedere verde**

Run: `npm test`
Expected: PASS. I test esistenti che chiamano `classifyHour(o)` con un argomento vanno aggiornati a `classifyHour(o, SOGLIE_MODELLO.ecmwf)` — è un cambio di firma, non un test allentato.

- [ ] **Step 5: Verificare per mutazione**

Portare `ecmwf.arancione` da 32 a 70: il test «32% è attenzione per ECMWF» deve diventare rosso. Rimettere 32.

- [ ] **Step 6: `npm run check` e commit proposto**

```bash
npm run check
git add src/lib/route-weather.ts src/__tests__/route-weather.test.ts
git commit -m "feat(meteo): soglie per modello, ricavate da 171 temporali osservati"
```

---

### Task 5: L'impostazione e la tendina nel pannello

**Files:**
- Modify: `src/lib/types.ts` (`AppSettings`)
- Modify: `src/components/weather/RouteWeatherPanel.tsx` (tendina accanto a «Il tuo passo»; report e attribuzione)
- Test: `src/__tests__/components/RouteWeatherPanel.test.tsx` *(se non esiste, crearlo)*

**Interfaces:**
- Consumes: Task 3 (`ModelloMeteo`), Task 4 (`buildRouteWeather({ modello })`)
- Produces: `AppSettings.modelloMeteo?: ModelloMeteo`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
describe('la tendina del modello', () => {
  test('cambiare modello cambia il verdetto senza chiedere di nuovo la rete', async () => {
    // fetchRouteForecast è finta e conta le chiamate; la risposta ha ECMWF critico
    // (prob 65) e ICON tranquillo (prob 8) — i valori veri di Altamura, 2026-09-09 17:00.
    render(<RouteWeatherPanel open />);
    await screen.findByRole('table');
    expect(chiamate).toBe(1);

    await userEvent.selectOptions(screen.getByLabelText(/modello/i), 'icon');

    expect(chiamate).toBe(1);                       // nessuna nuova richiesta
    expect(screen.getByText(/secondo ICON/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx jest src/__tests__/components/RouteWeatherPanel.test.tsx`
Expected: FAIL — nessun controllo etichettato «modello».

- [ ] **Step 3: Implementare**

`types.ts`, in `AppSettings`:

```ts
  /**
   * Quale modello meteo usa il pannello del percorso. Facoltativo: le impostazioni
   * salvate prima di questa versione non lo hanno, e assente vale
   * `MODELLO_METEO_PREDEFINITO` — nessuna migrazione.
   */
  modelloMeteo?: ModelloMeteo;
```

`RouteWeatherPanel.tsx`, sotto il riquadro del passo (stessa meccanica: globale + salvato):

```tsx
        {punti.length > 0 && (
          <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-3">
            <label htmlFor="modello-meteo" className="text-xs font-medium text-gray-300 block mb-1">
              Modello di previsione
            </label>
            <select
              id="modello-meteo"
              value={modello}
              onChange={(e) => {
                const scelto = e.target.value as ModelloMeteo;
                updateSettings({ ...settings, modelloMeteo: scelto });
                saveSettings(useItineraryStore.getState().settings);
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-200 max-lg:min-h-[44px]"
            >
              <option value="ecmwf">ECMWF — il più accurato nei confronti pubblicati</option>
              <option value="icon">ICON — avvisa un po' meno spesso</option>
            </select>
          </div>
        )}
```

Nel `useMemo` del report: `serie: datiMeteo.serie[modello], modello,` e aggiungere `modello` alle dipendenze.

Sotto la tabella, l'attribuzione di chi ha parlato:

```tsx
            <p className="text-[11px] text-gray-400">
              Tutti i valori di questa tabella vengono da{' '}
              <strong className="font-medium text-gray-300">{NOME_MODELLO[modello]}</strong>.
              Un altro modello direbbe numeri diversi: non si mescolano.
            </p>
```

con `const NOME_MODELLO: Record<ModelloMeteo, string> = { ecmwf: 'ECMWF', icon: 'ICON' };`

- [ ] **Step 4: Eseguire e vedere verde**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: `npm run check` e commit proposto**

```bash
npm run check
git add src/lib/types.ts src/components/weather/RouteWeatherPanel.tsx src/__tests__/components/RouteWeatherPanel.test.tsx
git commit -m "feat(meteo): la tendina sceglie il modello, e quel modello possiede la tabella"
```

---

### Task 6: La tabella — via il CAPE, dentro i millimetri

**Files:**
- Modify: `src/components/weather/TabellaPuntiMeteo.tsx:50-100`
- Test: `src/__tests__/components/TabellaPuntiMeteo.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`PuntoOrario.mm`)
- Produces: colonne `Punto · Arrivo · Cielo · mm · Piogg. · Raffiche`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
describe('la colonna dei millimetri', () => {
  test('il CAPE non si mostra più: è un numero che non dice niente a chi cammina', () => {
    render(<TabellaPuntiMeteo righe={[riga({ hour: oraCon({ cape: 2500, mm: 0 }) })]} />);
    expect(screen.queryByText('CAPE')).not.toBeInTheDocument();
    expect(screen.queryByText('2500')).not.toBeInTheDocument();
  });

  test('i mm si scrivono all’italiana e si colorano per gravità', () => {
    render(<TabellaPuntiMeteo righe={[riga({ hour: oraCon({ mm: 9.7 }) })]} />);
    const cella = screen.getByText('9,7 mm');
    expect(cella).toHaveClass('text-orange-300');
  });

  test('zero millimetri è un trattino, un dato assente è n/d', () => {
    render(<TabellaPuntiMeteo righe={[
      riga({ name: 'asciutto', hour: oraCon({ mm: 0 }) }),
      riga({ name: 'ignoto', hour: null }),
    ]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getAllByText('n/d').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx jest src/__tests__/components/TabellaPuntiMeteo.test.tsx -t "millimetri"`
Expected: FAIL — la colonna CAPE c'è ancora.

- [ ] **Step 3: Implementare**

In `TabellaPuntiMeteo.tsx`, aggiungere:

```tsx
/**
 * Il colore dei millimetri: la scala convenzionale dell'intensità oraria, con gli stessi
 * colori che l'app usa già per la gravità. Non entra nel giudizio (le soglie misurate sono
 * di probabilità): dice a colpo d'occhio se è pioggerella o un rovescio.
 */
function classeMm(mm: number | undefined): string {
  if (mm == null || !Number.isFinite(mm) || mm < 1) return 'text-gray-300';
  if (mm < 4) return 'text-amber-300';
  if (mm < 10) return 'text-orange-300';
  return 'text-red-400';
}

function testoMm(mm: number | undefined): string {
  if (mm == null || !Number.isFinite(mm)) return 'n/d';
  if (mm === 0) return '—';
  return `${numero(mm, 1)} mm`;
}
```

Sostituire l'intestazione `CAPE` con `mm`:

```tsx
            <th scope="col" className="py-1 pr-2 font-medium">mm</th>
```

e la cella corrispondente:

```tsx
              <td className={`py-1.5 pr-2 whitespace-nowrap ${classeMm(r.hour?.mm)}`}>
                {testoMm(r.hour?.mm)}
              </td>
```

- [ ] **Step 4: Eseguire e vedere verde**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Guardare lo schermo**

`npm run dev`, aprire «Quando partire» su un itinerario vero a 412 px: la tabella non deve far scorrere la **pagina** di lato (la tabella scorre dentro il suo contenitore).

- [ ] **Step 6: `npm run check` e commit proposto**

```bash
npm run check
git add src/components/weather/TabellaPuntiMeteo.tsx src/__tests__/components/TabellaPuntiMeteo.test.tsx
git commit -m "feat(meteo): i millimetri al posto del CAPE, colorati per gravità"
```

---

### Task 7: Il menu ⋮ di riga con «Apri su Meteoblue»

**Files:**
- Create: `src/lib/meteoblue.ts`
- Create: `src/components/weather/MenuRigaMeteo.tsx`
- Modify: `src/lib/route-weather.ts` (`RigaPercorso` guadagna `lat`/`lon`; `riga()` li valorizza)
- Modify: `src/components/weather/TabellaPuntiMeteo.tsx` (settima colonna)
- Test: `src/__tests__/meteoblue.test.ts`, `src/__tests__/components/MenuRigaMeteo.test.tsx`

**Interfaces:**
- Consumes: Task 6
- Produces: `linkMeteoblue(lat, lon): string`; `RigaPercorso.lat/.lon: number`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
import { linkMeteoblue } from '@/lib/meteoblue';

describe('linkMeteoblue', () => {
  /** Verificato con un browser vero il 2026-09-09: titolo «Meteo 42.2°N 14.28°E». */
  test('costruisce l’indirizzo per coordinate', () => {
    expect(linkMeteoblue(42.2, 14.28)).toBe('https://www.meteoblue.com/it/tempo/settimana/42.200N14.280E');
  });

  test('i segni si ricavano dal valore, non si danno per scontati', () => {
    expect(linkMeteoblue(-33.9, -18.4)).toContain('33.900S18.400W');
  });
});
```

```tsx
describe('MenuRigaMeteo', () => {
  test('apre il menu e offre Meteoblue per quel punto', async () => {
    render(<MenuRigaMeteo lat={42.2} lon={14.28} nome="Blockhaus" />);
    await userEvent.click(screen.getByRole('button', { name: /altre azioni per «Blockhaus»/i }));
    const voce = screen.getByRole('menuitem', { name: /Apri su Meteoblue/i });
    expect(voce).toHaveAttribute('href', 'https://www.meteoblue.com/it/tempo/settimana/42.200N14.280E');
    expect(voce).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  test('Escape lo chiude', async () => {
    render(<MenuRigaMeteo lat={42.2} lon={14.28} nome="Blockhaus" />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Eseguirlo e vederlo fallire**

Run: `npx jest src/__tests__/meteoblue.test.ts src/__tests__/components/MenuRigaMeteo.test.tsx`
Expected: FAIL — moduli inesistenti.

- [ ] **Step 3: Implementare**

`src/lib/meteoblue.ts`:

```ts
/**
 * L'indirizzo della pagina Meteoblue per un punto qualsiasi.
 *
 * Meteoblue non è fra i modelli di Open-Meteo e la sua API vuole una chiave: il **link**
 * invece non chiede niente, e porta l'utente alla fonte che consulta di suo.
 * Verificato con un browser vero il 2026-09-09: titolo «Meteo 42.2°N 14.28°E - meteoblue».
 */
export function linkMeteoblue(lat: number, lon: number): string {
  // I segni si ricavano dal valore: darli per scontati funziona finché l'app resta in
  // Italia, e smette il primo giorno che non ci resta.
  const ns = lat >= 0 ? 'N' : 'S';
  const eo = lon >= 0 ? 'E' : 'W';
  return `https://www.meteoblue.com/it/tempo/settimana/`
    + `${Math.abs(lat).toFixed(3)}${ns}${Math.abs(lon).toFixed(3)}${eo}`;
}
```

`src/components/weather/MenuRigaMeteo.tsx`: pulsante `aria-haspopup="menu"` + `aria-expanded`, nome accessibile «Altre azioni per «{nome}»», chiusura con `Escape` e con clic fuori (`pointerdown` sul documento), `role="menu"` con un `role="menuitem"` che è un `<a target="_blank" rel="noopener noreferrer">`. Bersaglio `max-lg:min-w-[44px] max-lg:min-h-[44px]`.

`route-weather.ts`: `RigaPercorso` guadagna

```ts
  /** Coordinate del punto: servono alle azioni di riga (aprire la previsione altrove). */
  lat: number;
  lon: number;
```
e in `riga()`: `lat: p.lat, lon: p.lon,`.

`TabellaPuntiMeteo.tsx`: settima intestazione `<th><span className="sr-only">Azioni</span></th>` e la cella col menu.

- [ ] **Step 4: Eseguire e vedere verde**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: `npm run check` e commit proposto**

```bash
npm run check
git add src/lib/meteoblue.ts src/components/weather/MenuRigaMeteo.tsx src/lib/route-weather.ts src/components/weather/TabellaPuntiMeteo.tsx src/__tests__
git commit -m "feat(meteo): ogni riga apre la sua previsione su Meteoblue"
```

---

### Task 8: e2e adeguati e il caso vero di Altamura

**Files:**
- Modify: `e2e/meteo-percorso.spec.ts`, `e2e/meteo-intermedio-critico.spec.ts` (chiavi suffissate per modello)
- Create: `src/__tests__/meteo-caso-altamura.test.ts`
- Test: entrambe le suite

**Interfaces:**
- Consumes: tutti i task precedenti

- [ ] **Step 1: Scrivere il test di regressione col caso vero**

Valori **misurati** ad Altamura (40,8264 / 16,5540) il 2026-09-09, con temporale osservato al METAR di Gioia del Colle (`VCTS`, `RETS`) alle 16:55 e 17:55 italiane:

```ts
/**
 * Il pomeriggio del 2026-09-09 sulla Murgia: temporale OSSERVATO, app che diceva verde.
 * I numeri sono quelli veri dei due modelli, non inventati.
 */
const ALTAMURA_17 = { ecmwf: { cod: 0, prob: 65, cape: 960, raff: 24 },
                      icon:  { cod: 80, prob: 28, cape: 1390, raff: 33 } };

test('con ECMWF le 17:00 sono critiche', () => {
  const c = classifyHour({ time: 't', weatherCode: 0, precipProb: 65, cape: 960, gusts: 24 },
                         SOGLIE_MODELLO.ecmwf);
  expect(c.level).toBe(3);
  expect(c.reasons).toContain('possibili temporali forti');
});

test('con ICON le 17:00 non sono più «solo raffiche»: la pioggia si nomina', () => {
  const c = classifyHour({ time: 't', weatherCode: 80, precipProb: 28, cape: 1390, gusts: 33 },
                         SOGLIE_MODELLO.icon);
  expect(c.reasons).toContain('rovesci deboli');
  expect(c.level).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Eseguirlo**

Run: `npx jest src/__tests__/meteo-caso-altamura.test.ts`
Expected: PASS (i task precedenti l'hanno già reso vero). Se fallisce, il difetto è ancora lì.

- [ ] **Step 3: Adeguare le risposte finte degli e2e**

In entrambi gli spec, la funzione `previsione(...)` deve produrre **chiavi suffissate per modello** invece di quelle nude:

```ts
const perModello = (s: Serie) => ({
  time: s.time,
  ...Object.fromEntries(['ecmwf_ifs', 'icon_seamless'].flatMap((m) => [
    [`cape_${m}`, s.cape], [`weather_code_${m}`, s.weather_code],
    [`wind_gusts_10m_${m}`, s.wind_gusts_10m],
    [`precipitation_probability_${m}`, s.precipitation_probability],
    [`temperature_2m_${m}`, s.temperature_2m], [`precipitation_${m}`, s.precipitation ?? s.time.map(() => 0)],
  ])),
});
```

- [ ] **Step 4: Aggiungere l'e2e della tendina**

```ts
test('cambiare modello non richiede una nuova previsione', async ({ page }) => {
  const chiesti = await apriIlMeteo(page);
  const prima = chiesti.length;
  await page.getByLabel(/Modello di previsione/i).selectOption('icon');
  await expect(page.getByText(/vengono da .*ICON/i)).toBeVisible();
  expect(chiesti.length).toBe(prima);          // nessuna nuova richiesta di rete
});
```

- [ ] **Step 5: Eseguire tutto**

```bash
npm run check
npm run test:e2e
```
Expected: jest verde; Playwright verde.

- [ ] **Step 6: Commit proposto**

```bash
git add e2e src/__tests__/meteo-caso-altamura.test.ts
git commit -m "test(meteo): il pomeriggio di Altamura come caso di regressione, e2e a due modelli"
```

---

### Task 9: CHANGELOG e versione

**Files:**
- Modify: `CHANGELOG.md`, `package.json`

- [ ] **Step 1: Aggiungere la voce in cima al CHANGELOG**

Titolo proposto: **«Il meteo dice quando piove, e lo dice chi scegli tu»**. Contenuto: i due difetti (codici di precipitazione ignorati; soglie irraggiungibili per ICON), le soglie misurate con il numero di temporali osservati, la tendina, i mm al posto del CAPE, il menu ⋮. Citare `backlog/docs/meteo-verifica-modelli-analisi.md`.

- [ ] **Step 2: Alzare la versione minore in `package.json`** (da `0.30.4` a `0.31.0`: cambia il comportamento degli avvisi).

- [ ] **Step 3: `npm run check` e commit proposto**

```bash
npm run check
git add CHANGELOG.md package.json
git commit -m "chore(rilascio): v0.31.0 — meteo a due modelli con soglie misurate"
```

---

## Autorevisione del piano

**Copertura della spec.** Difetto B → Task 1. Rete a due modelli e chiavi suffissate → Task 3. `elevation` unico → confermato nel Task 3 (`elevations` invariato). Soglie per modello → Task 4. `mm` in `PuntoOrario` ed escluso da `OraDaClassificare` → Task 2. CAPE fuori dalla tabella e dentro il giudizio → Task 6 (tabella) e Task 4 (il blocco CAPE di `classifyHour` non si tocca). Tendina + attribuzione → Task 5. Menu ⋮ + `lat`/`lon` su `RigaPercorso` → Task 7. Predefinito ECMWF senza migrazione → Task 3 e 5. Verifica per mutazione → Task 1 e 4. Caso reale Altamura → Task 8. **Nessuna sezione della spec è scoperta.**

**Segnaposto.** Nessun «TBD»/«TODO»; ogni step di codice porta il codice.

**Coerenza dei tipi.** `ModelloMeteo` (Task 3) è usato con lo stesso nome in Task 4, 5, 6, 7. `SOGLIE_MODELLO` (Task 4) coi campi `giallo`/`arancione` definiti in `SoglieModello`. `RouteForecast.serie` è `Record<ModelloMeteo, SerieOraria[]>` in Task 3 e indicizzato allo stesso modo in Task 5. `PuntoOrario.mm` (Task 2) è letto come `r.hour?.mm` in Task 6. `linkMeteoblue` (Task 7) ha la stessa firma nel test e nell'implementazione.

**Ordine.** I task 1-2 sono puri e sicuri; il 3 cambia la fonte dati **prima** che il 4 cambi le soglie, così non esiste uno stato intermedio in cui dati ICON vengono giudicati con soglie ECMWF.
