# Layer di emergenza fase 1 (v0.11.0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer overlay di emergenza sulla mappa: focolai FIRMS (proxy), aree bruciate + FWI EFFIS (WMS), allerte meteo-idro/frane DPC (zone GeoJSON), con pannello toggle, popup, disclaimer e refresh automatico.

**Architecture:** Registry statico di layer (`EMERGENCY_LAYERS`) + 3 renderer generici react-leaflet (WMS/points/zones) + store Zustand runtime (`emergencyStore`) + 2 API route proxy (FIRMS key; discovery bollettino DPC). Attivazione persistita in `settings.mapDisplay.emergencyLayers`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, react-leaflet 4.2, Zustand 5, `topojson-client` (nuova dep), Jest 30 + RTL, Serwist.

**Spec:** `backlog/docs/emergency-layers-design.md` (leggerla PRIMA di ogni task; l'Appendice A elenca le trappole).

## Global Constraints

- Branch di lavoro: `feature/emergency-layers` (da `develop`). MAI toccare `master`.
- **Commit: solo se la sessione principale ha ottenuto dall'utente l'autorizzazione ai commit sul branch feature** (chiesta una volta a inizio esecuzione). I subagent NON committano di propria iniziativa senza quella autorizzazione.
- Tutte le stringhe UI in **italiano**.
- La chiave FIRMS è `FIRMS_MAP_KEY`, **server-only**: mai prefisso `NEXT_PUBLIC_`, mai importata in codice client.
- react-leaflet è **mockato globalmente** nei test via `jest.config.js` → `src/__tests__/components/__mocks__/react-leaflet.tsx`: ogni nuovo componente react-leaflet usato va aggiunto lì.
- Test: `npm test -- <path>` (Jest 30, ts-jest, jsdom). Suite completa: `npm test`. Lint: `npm run lint`. Build: `npm run build`.
- TDD rigoroso: prima il test che fallisce, poi l'implementazione minimale.
- Touch target ≥44px su mobile (`max-lg:min-h-[44px]`), dark theme Tailwind coerente con l'esistente (gray-800/900, accenti green-400).
- Import path alias: `@/` → `src/`.

---

### Task 1: Registry layer + campo settings persistito

**Files:**
- Create: `src/lib/emergency-layers.ts`
- Modify: `src/lib/types.ts` (MapDisplaySettings + DEFAULT_MAP_DISPLAY)
- Modify: `src/lib/storage.ts:234-246` (filtro merge mapDisplay in `loadSettings`)
- Test: `src/__tests__/emergency-layers.test.ts`, aggiunte a `src/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: `MapDisplaySettings`, `DEFAULT_MAP_DISPLAY` da `types.ts`
- Produces (usati da TUTTI i task successivi):

```ts
// src/lib/emergency-layers.ts — NON deve importare types.ts (evita ciclo: types.ts importerà da qui)
export type EmergencyLayerId = 'fires-hotspots' | 'fires-burned' | 'fires-fwi' | 'dpc-alerts';
export type EmergencyLayerKind = 'wms' | 'points' | 'zones';
export type EmergencyCategory = 'incendi' | 'alluvioni';
export interface LegendEntry { color: string; label: string; }
export interface WmsConfig {
  url: string;            // base WMS senza query
  layers: string;         // nome layer WMS
  timeMode: 'today' | 'yearToDate';
  opacity: number;
}
export interface EmergencyLayerDef {
  id: EmergencyLayerId;
  category: EmergencyCategory;
  label: string;
  description: string;
  kind: EmergencyLayerKind;
  attribution: string;
  refreshMinutes: number | null;  // null = nessun polling (WMS)
  legend: LegendEntry[];
  wms?: WmsConfig;                // presente sse kind === 'wms'
}
export const EMERGENCY_PANE = 'emergency';           // pane Leaflet, zIndex 350
export const EMERGENCY_LAYERS: EmergencyLayerDef[];  // 4 entry
export function getEmergencyLayer(id: EmergencyLayerId): EmergencyLayerDef;
export function isEmergencyLayerId(v: unknown): v is EmergencyLayerId;
```

- [x] **Step 1: Write the failing tests**

```ts
// src/__tests__/emergency-layers.test.ts
import { EMERGENCY_LAYERS, getEmergencyLayer, isEmergencyLayerId } from '@/lib/emergency-layers';

describe('EMERGENCY_LAYERS registry', () => {
  test('contiene 4 layer con id univoci', () => {
    const ids = EMERGENCY_LAYERS.map((l) => l.id);
    expect(ids).toEqual(['fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts']);
    expect(new Set(ids).size).toBe(4);
  });

  test('i layer wms hanno config wms, gli altri no', () => {
    for (const l of EMERGENCY_LAYERS) {
      if (l.kind === 'wms') {
        expect(l.wms).toBeDefined();
        expect(l.wms!.url).toMatch(/^https:\/\//);
        expect(l.refreshMinutes).toBeNull();
      } else {
        expect(l.wms).toBeUndefined();
        expect(l.refreshMinutes).toBeGreaterThan(0);
      }
    }
  });

  test('ogni layer ha label, description, attribution e legenda non vuoti', () => {
    for (const l of EMERGENCY_LAYERS) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.description.length).toBeGreaterThan(0);
      expect(l.attribution.length).toBeGreaterThan(0);
      expect(l.legend.length).toBeGreaterThan(0);
    }
  });

  test('getEmergencyLayer risolve un id, isEmergencyLayerId valida', () => {
    expect(getEmergencyLayer('fires-fwi').kind).toBe('wms');
    expect(isEmergencyLayerId('fires-hotspots')).toBe(true);
    expect(isEmergencyLayerId('nope')).toBe(false);
    expect(isEmergencyLayerId(42)).toBe(false);
  });
});
```

```ts
// aggiunte a src/__tests__/storage.test.ts (describe nuovo, in coda al file)
describe('loadSettings — emergencyLayers', () => {
  test('default [] quando assente (settings legacy)', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: {}, mapDisplay: { coloredPath: false },
    }));
    expect(loadSettings().mapDisplay.emergencyLayers).toEqual([]);
    expect(loadSettings().mapDisplay.coloredPath).toBe(false);
  });

  test('id validi preservati, id sconosciuti scartati', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: {}, mapDisplay: { emergencyLayers: ['fires-fwi', 'gone-layer', 'dpc-alerts'] },
    }));
    expect(loadSettings().mapDisplay.emergencyLayers).toEqual(['fires-fwi', 'dpc-alerts']);
  });

  test('valore non-array ignorato → default []', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: {}, mapDisplay: { emergencyLayers: 'fires-fwi' },
    }));
    expect(loadSettings().mapDisplay.emergencyLayers).toEqual([]);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/emergency-layers.test.ts src/__tests__/storage.test.ts`
Expected: FAIL — modulo `@/lib/emergency-layers` inesistente; `emergencyLayers` undefined nei settings.

- [x] **Step 3: Implementa registry + estensioni types/storage**

```ts
// src/lib/emergency-layers.ts (completo)
export type EmergencyLayerId = 'fires-hotspots' | 'fires-burned' | 'fires-fwi' | 'dpc-alerts';
export type EmergencyLayerKind = 'wms' | 'points' | 'zones';
export type EmergencyCategory = 'incendi' | 'alluvioni';

export interface LegendEntry { color: string; label: string; }

export interface WmsConfig {
  url: string;
  layers: string;
  timeMode: 'today' | 'yearToDate';
  opacity: number;
}

export interface EmergencyLayerDef {
  id: EmergencyLayerId;
  category: EmergencyCategory;
  label: string;
  description: string;
  kind: EmergencyLayerKind;
  attribution: string;
  refreshMinutes: number | null;
  legend: LegendEntry[];
  wms?: WmsConfig;
}

/** Pane Leaflet dedicato: sopra i tile (200), sotto overlayPane dei tracciati (400). */
export const EMERGENCY_PANE = 'emergency';

const EFFIS_WMS_URL = 'https://maps.effis.emergency.copernicus.eu/effis';

export const EMERGENCY_LAYERS: EmergencyLayerDef[] = [
  {
    id: 'fires-hotspots',
    category: 'incendi',
    label: 'Focolai attivi (24h)',
    description: 'Anomalie termiche rilevate da satellite (VIIRS, ~375 m)',
    kind: 'points',
    attribution: 'Fire data: <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>',
    refreshMinutes: 15,
    legend: [
      { color: '#ef4444', label: 'Rilevato nelle ultime 6 ore' },
      { color: '#f97316', label: 'Rilevato oltre 6 ore fa' },
    ],
  },
  {
    id: 'fires-burned',
    category: 'incendi',
    label: 'Aree bruciate (anno corrente)',
    description: 'Perimetri incendi >30 ha (Copernicus EFFIS)',
    kind: 'wms',
    attribution: '<a href="https://forest-fire.emergency.copernicus.eu/">Copernicus EFFIS</a>',
    refreshMinutes: null,
    legend: [{ color: '#7f1d1d', label: 'Area percorsa dal fuoco' }],
    wms: { url: EFFIS_WMS_URL, layers: 'effis.nrt.ba.poly', timeMode: 'yearToDate', opacity: 0.7 },
  },
  {
    id: 'fires-fwi',
    category: 'incendi',
    label: 'Pericolo incendio oggi (FWI)',
    description: 'Fire Weather Index previsionale (Copernicus EFFIS)',
    kind: 'wms',
    attribution: '<a href="https://forest-fire.emergency.copernicus.eu/">Copernicus EFFIS</a>',
    refreshMinutes: null,
    legend: [
      { color: '#22c55e', label: 'Basso' },
      { color: '#eab308', label: 'Moderato' },
      { color: '#f97316', label: 'Alto' },
      { color: '#dc2626', label: 'Molto alto' },
      { color: '#7f1d1d', label: 'Estremo' },
    ],
    wms: { url: EFFIS_WMS_URL, layers: 'mf010.fwi', timeMode: 'today', opacity: 0.55 },
  },
  {
    id: 'dpc-alerts',
    category: 'alluvioni',
    label: 'Allerte meteo-idro (DPC)',
    description: 'Criticità idraulica, temporali e idrogeologica/frane per zona di allerta',
    kind: 'zones',
    attribution: '<a href="https://github.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica">Dipartimento Protezione Civile</a> (CC-BY 4.0)',
    refreshMinutes: 30,
    legend: [
      { color: '#eab308', label: 'Allerta gialla' },
      { color: '#f97316', label: 'Allerta arancione' },
      { color: '#dc2626', label: 'Allerta rossa' },
    ],
  },
];

export function getEmergencyLayer(id: EmergencyLayerId): EmergencyLayerDef {
  const def = EMERGENCY_LAYERS.find((l) => l.id === id);
  if (!def) throw new Error(`Unknown emergency layer: ${id}`);
  return def;
}

export function isEmergencyLayerId(v: unknown): v is EmergencyLayerId {
  return typeof v === 'string' && EMERGENCY_LAYERS.some((l) => l.id === v);
}
```

In `src/lib/types.ts`: aggiungi in cima `import type { EmergencyLayerId } from './emergency-layers';` poi estendi:

```ts
export interface MapDisplaySettings {
  coloredPath: boolean;
  trailRouting: boolean;
  sampleInterval: SampleIntervalOption;
  baseMap: BaseMapId;
  showHikingTrails: boolean;
  showCoordinateGrid: boolean;
  emergencyLayers: EmergencyLayerId[];   // NUOVO
}

export const DEFAULT_MAP_DISPLAY: MapDisplaySettings = {
  coloredPath: true,
  trailRouting: true,
  sampleInterval: 50,
  baseMap: 'thunderforest-outdoors',
  showHikingTrails: true,
  showCoordinateGrid: false,
  emergencyLayers: [],                   // NUOVO
};
```

In `src/lib/storage.ts`: importa `import { isEmergencyLayerId } from './emergency-layers';`. Nel filtro del merge `mapDisplay` (righe ~239-244), il ramo finale `return typeof v === 'boolean'` scarterebbe l'array: aggiungi PRIMA di quel ramo:

```ts
if (k === 'emergencyLayers') return Array.isArray(v);
```

e dopo la costruzione di `settings` (prima del fallback baseMap, riga ~248) sanifica gli id:

```ts
settings.mapDisplay.emergencyLayers =
  (settings.mapDisplay.emergencyLayers as unknown[]).filter(isEmergencyLayerId);
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/emergency-layers.test.ts src/__tests__/storage.test.ts`
Expected: PASS (tutti, inclusi i test storage preesistenti).

- [x] **Step 5: Run full suite (i settings toccano molti test)**

Run: `npm test`
Expected: PASS — se qualche test fallisce per il nuovo campo (fixture di settings), aggiorna SOLO le fixture, non la logica.

- [x] **Step 6: Commit**

```bash
git add src/lib/emergency-layers.ts src/lib/types.ts src/lib/storage.ts src/__tests__/emergency-layers.test.ts src/__tests__/storage.test.ts
git commit -m "feat(emergency): registry layer emergenza + settings persistiti"
```

---

### Task 2: Parser CSV FIRMS

**Files:**
- Create: `src/lib/firms.ts`
- Test: `src/__tests__/firms.test.ts`

**Interfaces:**
- Consumes: nulla (modulo puro, usabile sia server che client)
- Produces:

```ts
export interface FirePoint {
  lat: number;
  lon: number;
  frp: number;                    // MW
  confidence: 'low' | 'nominal' | 'high';
  acquiredAt: string;             // ISO UTC, es. "2026-08-25T13:12:00Z"
  satellite: string;              // es. "N20"
}
export function parseFirmsCsv(csv: string): FirePoint[];
```

- [x] **Step 1: Write the failing test**

```ts
// src/__tests__/firms.test.ts
import { parseFirmsCsv } from '@/lib/firms';

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight';

describe('parseFirmsCsv', () => {
  test('parse riga valida (acq_time a 3 cifre → padding)', () => {
    const csv = `${HEADER}\n42.10,13.50,330.1,0.4,0.4,2026-08-25,312,N20,VIIRS,n,2.0NRT,290.0,12.5,D`;
    const pts = parseFirmsCsv(csv);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toEqual({
      lat: 42.10, lon: 13.50, frp: 12.5, confidence: 'nominal',
      acquiredAt: '2026-08-25T03:12:00Z', satellite: 'N20',
    });
  });

  test('mappa confidence l/n/h e valori ignoti → nominal', () => {
    const rows = ['l', 'h', 'x'].map((c, i) =>
      `42.${i},13.0,330,0.4,0.4,2026-08-25,1200,N21,VIIRS,${c},2.0NRT,290,5.0,D`);
    const pts = parseFirmsCsv(`${HEADER}\n${rows.join('\n')}`);
    expect(pts.map((p) => p.confidence)).toEqual(['low', 'high', 'nominal']);
  });

  test('salta righe malformate senza lanciare', () => {
    const csv = `${HEADER}\nnot,a,row\n42.0,13.0,330,0.4,0.4,2026-08-25,1200,N20,VIIRS,n,2.0NRT,290,3.3,D\n`;
    expect(parseFirmsCsv(csv)).toHaveLength(1);
  });

  test('csv vuoto o solo header → []', () => {
    expect(parseFirmsCsv('')).toEqual([]);
    expect(parseFirmsCsv(HEADER)).toEqual([]);
  });

  test('colonne risolte dal header, non per posizione', () => {
    const csv = `frp,latitude,longitude,acq_date,acq_time,satellite,confidence\n7.7,41.9,12.5,2026-08-25,0005,N,h`;
    const pts = parseFirmsCsv(csv);
    expect(pts[0].frp).toBe(7.7);
    expect(pts[0].acquiredAt).toBe('2026-08-25T00:05:00Z');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/firms.test.ts`
Expected: FAIL — `@/lib/firms` inesistente.

- [x] **Step 3: Write minimal implementation**

```ts
// src/lib/firms.ts (completo)
export interface FirePoint {
  lat: number;
  lon: number;
  frp: number;
  confidence: 'low' | 'nominal' | 'high';
  acquiredAt: string;
  satellite: string;
}

const CONFIDENCE_MAP: Record<string, FirePoint['confidence']> = {
  l: 'low', low: 'low', n: 'nominal', nominal: 'nominal', h: 'high', high: 'high',
};

/**
 * Parser CSV dell'area API FIRMS. Risolve le colonne dal header (l'ordine
 * varia tra sensori); le righe malformate vengono scartate silenziosamente.
 */
export function parseFirmsCsv(csv: string): FirePoint[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const cols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const idx = {
    lat: cols.indexOf('latitude'),
    lon: cols.indexOf('longitude'),
    frp: cols.indexOf('frp'),
    conf: cols.indexOf('confidence'),
    date: cols.indexOf('acq_date'),
    time: cols.indexOf('acq_time'),
    sat: cols.indexOf('satellite'),
  };
  if (idx.lat < 0 || idx.lon < 0 || idx.date < 0 || idx.time < 0) return [];

  const points: FirePoint[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    const lat = Number(f[idx.lat]);
    const lon = Number(f[idx.lon]);
    const date = f[idx.date];
    const rawTime = f[idx.time];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^\d{1,4}$/.test(rawTime ?? '')) continue;
    const hhmm = rawTime.padStart(4, '0');
    const frp = idx.frp >= 0 ? Number(f[idx.frp]) : NaN;
    points.push({
      lat, lon,
      frp: Number.isFinite(frp) ? frp : 0,
      confidence: CONFIDENCE_MAP[(f[idx.conf] ?? '').trim().toLowerCase()] ?? 'nominal',
      acquiredAt: `${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`,
      satellite: idx.sat >= 0 ? (f[idx.sat] ?? '').trim() : '',
    });
  }
  return points;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/firms.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/firms.ts src/__tests__/firms.test.ts
git commit -m "feat(emergency): parser CSV hotspot FIRMS"
```

---

### Task 3: Proxy `/api/fires` con cache

**Files:**
- Create: `src/lib/fires-proxy.ts`, `src/app/api/fires/route.ts`
- Modify: `.env.example` (nuova variabile)
- Test: `src/__tests__/fires-proxy.test.ts`

**Interfaces:**
- Consumes: `parseFirmsCsv`, `FirePoint` da `@/lib/firms` (Task 2)
- Produces:

```ts
// src/lib/fires-proxy.ts
export interface FiresPayload { points: FirePoint[]; fetchedAt: string; }
export type FiresProxyResult =
  | { status: 200; data: FiresPayload }
  | { status: 502 | 503; error: string };
export async function fetchFiresUpstream(): Promise<FiresProxyResult>;
export function _resetFiresCacheForTests(): void;
```
- Route: `GET /api/fires` → 200 `FiresPayload` | 502/503 `{ error }` (consumata dal Task 6)

- [x] **Step 1: Write the failing tests**

```ts
// src/__tests__/fires-proxy.test.ts
import { fetchFiresUpstream, _resetFiresCacheForTests } from '@/lib/fires-proxy';

const CSV = 'latitude,longitude,frp,confidence,acq_date,acq_time,satellite\n42.0,13.0,5.0,n,2026-08-25,1200,N20';

describe('fetchFiresUpstream', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    _resetFiresCacheForTests();
    process.env.FIRMS_MAP_KEY = 'testkey';
    jest.useFakeTimers();
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.FIRMS_MAP_KEY;
    jest.useRealTimers();
  });

  test('503 senza FIRMS_MAP_KEY', async () => {
    delete process.env.FIRMS_MAP_KEY;
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(503);
  });

  test('fonde i 3 sensori e risponde 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => CSV });
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.points).toHaveLength(3); // 1 punto × 3 sensori
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain('/api/area/csv/testkey/');
    expect(urls[0]).toContain('6.6,35.4,18.6,47.1/1');
  });

  test('successo parziale: un sensore giù non fa fallire', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => CSV })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ok: false, status: 500 });
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.points).toHaveLength(1);
  });

  test('tutti i sensori giù → 502', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(502);
  });

  test('cache: la seconda chiamata entro il TTL non rifà fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => CSV });
    await fetchFiresUpstream();
    await fetchFiresUpstream();
    expect(global.fetch).toHaveBeenCalledTimes(3); // solo il primo giro
    jest.advanceTimersByTime(16 * 60 * 1000);      // oltre il TTL di 15 min
    await fetchFiresUpstream();
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/fires-proxy.test.ts`
Expected: FAIL — modulo inesistente.

- [x] **Step 3: Write implementation**

```ts
// src/lib/fires-proxy.ts (completo)
import { parseFirmsCsv, type FirePoint } from './firms';

const SENSORS = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];
const ITALY_BBOX = '6.6,35.4,18.6,47.1'; // west,south,east,north
const CACHE_TTL_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 8000;

export interface FiresPayload { points: FirePoint[]; fetchedAt: string; }
export type FiresProxyResult =
  | { status: 200; data: FiresPayload }
  | { status: 502 | 503; error: string };

let cache: { data: FiresPayload; expiresAt: number } | null = null;

export function _resetFiresCacheForTests(): void { cache = null; }

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFiresUpstream(): Promise<FiresProxyResult> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return { status: 503, error: 'FIRMS_MAP_KEY non configurata' };

  if (cache && Date.now() < cache.expiresAt) return { status: 200, data: cache.data };

  const results = await Promise.allSettled(
    SENSORS.map(async (sensor) => {
      const res = await fetchWithTimeout(
        `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${sensor}/${ITALY_BBOX}/1`
      );
      if (!res.ok) throw new Error(`FIRMS ${sensor}: HTTP ${res.status}`);
      return parseFirmsCsv(await res.text());
    })
  );

  const points = results
    .filter((r): r is PromiseFulfilledResult<FirePoint[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  if (results.every((r) => r.status === 'rejected')) {
    return { status: 502, error: 'FIRMS non raggiungibile' };
  }

  const data: FiresPayload = { points, fetchedAt: new Date().toISOString() };
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return { status: 200, data };
}
```

```ts
// src/app/api/fires/route.ts (completo, pattern api/elevation)
import { NextResponse } from 'next/server';
import { fetchFiresUpstream } from '@/lib/fires-proxy';

export async function GET() {
  const result = await fetchFiresUpstream();
  if (result.status === 200) return NextResponse.json(result.data);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
```

In `.env.example`, dopo il blocco Thunderforest aggiungi:

```
# NASA FIRMS MAP_KEY — layer "Focolai attivi" (hotspot incendi da satellite).
# Chiave gratuita: https://firms.modaps.eosdis.nasa.gov/api/map_key/
# Server-only (usata dalla API route /api/fires): MAI prefissarla con NEXT_PUBLIC_.
# Senza chiave il layer risulta "non disponibile"; gli altri layer funzionano comunque.
FIRMS_MAP_KEY=
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/fires-proxy.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/fires-proxy.ts src/app/api/fires/route.ts src/__tests__/fires-proxy.test.ts .env.example
git commit -m "feat(emergency): proxy /api/fires con cache 15min e merge 3 sensori VIIRS"
```

---

### Task 4: Libreria DPC (TopoJSON → zone, livelli, popup, giorni)

**Files:**
- Create: `src/lib/dpc.ts`
- Modify: `package.json` (dipendenze: `npm install topojson-client` e `npm install -D @types/topojson-client @types/geojson`)
- Test: `src/__tests__/dpc.test.ts`

**Interfaces:**
- Consumes: `topojson-client` (`feature()`)
- Produces:

```ts
export type DpcLevel = 0 | 1 | 2 | 3;   // 0 verde/nessuna, 1 gialla, 2 arancione, 3 rossa
export interface DpcZone {
  name: string;
  idraulico: DpcLevel;
  temporali: DpcLevel;
  idrogeologico: DpcLevel;
  maxLevel: DpcLevel;
  feature: GeoJSON.Feature;              // geometria della zona
}
export const DPC_LEVEL_COLORS: Record<1 | 2 | 3, string>; // giallo/arancio/rosso
export const DPC_LEVEL_LABELS: Record<DpcLevel, string>;
export function parseAlertLevel(text: unknown): DpcLevel;
export function parseDpcTopology(topology: unknown): DpcZone[];  // [] se input invalido
export function zonePopupHtml(zone: DpcZone, dayLabel: string, issuedLabel: string): string;
export interface DayOption { date: string; label: string; disabled: boolean; }
export function dayOptions(dates: string[], now: Date): DayOption[];
export function defaultDpcDate(dates: string[], now: Date): string | null;
export function bulletinDates(bulletinId: string): { today: string; tomorrow: string; issuedLabel: string };
```

- [x] **Step 1: Write the failing tests**

```ts
// src/__tests__/dpc.test.ts
import {
  parseAlertLevel, parseDpcTopology, zonePopupHtml,
  dayOptions, defaultDpcDate, bulletinDates,
} from '@/lib/dpc';

// Mini-topology con 2 zone (quadrati), stessa struttura dei file DPC reali
const TOPO = {
  type: 'Topology',
  objects: {
    zone: {
      type: 'GeometryCollection',
      geometries: [
        {
          type: 'Polygon', arcs: [[0]],
          properties: {
            'Nome zona': 'Abru-A', 'Rappresentata nella mappa': 'si',
            'Per rischio idraulico': 'NESSUNA ALLERTA',
            'Per rischio temporali': "ORDINARIA CRITICITA' / ALLERTA GIALLA",
            'Per rischio idrogeologico': "MODERATA CRITICITA' / ALLERTA ARANCIONE",
          },
        },
        {
          type: 'Polygon', arcs: [[1]],
          properties: {
            'Nome zona': 'Abru-B',
            'Per rischio idraulico': "ELEVATA CRITICITA' / ALLERTA ROSSA",
            'Per rischio temporali': 'NESSUNA ALLERTA',
            'Per rischio idrogeologico': 'NESSUNA ALLERTA',
          },
        },
      ],
    },
  },
  arcs: [
    [[13.0, 42.0], [13.1, 42.0], [13.1, 42.1], [13.0, 42.1], [13.0, 42.0]],
    [[14.0, 42.0], [14.1, 42.0], [14.1, 42.1], [14.0, 42.1], [14.0, 42.0]],
  ],
};

describe('parseAlertLevel', () => {
  test.each([
    ['NESSUNA ALLERTA', 0],
    ["ORDINARIA CRITICITA' / ALLERTA GIALLA", 1],
    ["MODERATA CRITICITA' / ALLERTA ARANCIONE", 2],
    ["ELEVATA CRITICITA' / ALLERTA ROSSA", 3],
    [undefined, 0],
    ['testo ignoto', 0],
  ])('%s → %i', (text, expected) => {
    expect(parseAlertLevel(text)).toBe(expected);
  });
});

describe('parseDpcTopology', () => {
  test('estrae zone con livelli e maxLevel', () => {
    const zones = parseDpcTopology(TOPO);
    expect(zones).toHaveLength(2);
    expect(zones[0]).toMatchObject({ name: 'Abru-A', idraulico: 0, temporali: 1, idrogeologico: 2, maxLevel: 2 });
    expect(zones[1].maxLevel).toBe(3);
    expect(zones[0].feature.geometry.type).toBe('Polygon');
  });

  test('input invalido → []', () => {
    expect(parseDpcTopology(null)).toEqual([]);
    expect(parseDpcTopology({ type: 'Topology', objects: {} })).toEqual([]);
  });
});

describe('zonePopupHtml', () => {
  test('contiene nome, i 3 rischi con label e il giorno', () => {
    const [zone] = parseDpcTopology(TOPO);
    const html = zonePopupHtml(zone, 'Oggi 25/08', 'bollettino del 25/08 14:15');
    expect(html).toContain('Abru-A');
    expect(html).toContain('Idrogeologico');
    expect(html).toContain('Arancione');
    expect(html).toContain('Oggi 25/08');
    expect(html).toContain('bollettino del 25/08 14:15');
  });
});

describe('bulletinDates / dayOptions / defaultDpcDate', () => {
  const now = new Date('2026-08-25T10:00:00');

  test('bollettino di oggi → Oggi/Domani', () => {
    const { today, tomorrow, issuedLabel } = bulletinDates('20260825_1415');
    expect(today).toBe('2026-08-25');
    expect(tomorrow).toBe('2026-08-26');
    expect(issuedLabel).toBe('25/08 14:15');
    const opts = dayOptions([today, tomorrow], now);
    expect(opts).toEqual([
      { date: '2026-08-25', label: 'Oggi 25/08', disabled: false },
      { date: '2026-08-26', label: 'Domani 26/08', disabled: false },
    ]);
    expect(defaultDpcDate([today, tomorrow], now)).toBe('2026-08-25');
  });

  test('bollettino di ieri → Ieri disabilitato, Oggi selezionabile (regola della spec §6)', () => {
    const { today, tomorrow } = bulletinDates('20260824_1500');
    const opts = dayOptions([today, tomorrow], now);
    expect(opts[0]).toEqual({ date: '2026-08-24', label: 'Ieri 24/08', disabled: true });
    expect(opts[1]).toEqual({ date: '2026-08-25', label: 'Oggi 25/08', disabled: false });
    expect(defaultDpcDate([today, tomorrow], now)).toBe('2026-08-25');
  });

  test('nessuna data copre oggi → default null-safe sull\'ultima non passata', () => {
    expect(defaultDpcDate(['2026-08-22', '2026-08-23'], now)).toBeNull();
  });
});
```

- [x] **Step 2: Install deps + run test to verify it fails**

Run: `npm install topojson-client` poi `npm install -D @types/topojson-client @types/geojson`
Run: `npm test -- src/__tests__/dpc.test.ts`
Expected: FAIL — `@/lib/dpc` inesistente.

- [x] **Step 3: Write implementation**

```ts
// src/lib/dpc.ts (completo)
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

export type DpcLevel = 0 | 1 | 2 | 3;

export interface DpcZone {
  name: string;
  idraulico: DpcLevel;
  temporali: DpcLevel;
  idrogeologico: DpcLevel;
  maxLevel: DpcLevel;
  feature: GeoJSON.Feature;
}

export const DPC_LEVEL_COLORS: Record<1 | 2 | 3, string> = {
  1: '#eab308', 2: '#f97316', 3: '#dc2626',
};

export const DPC_LEVEL_LABELS: Record<DpcLevel, string> = {
  0: 'Nessuna', 1: 'Gialla', 2: 'Arancione', 3: 'Rossa',
};

/** I valori DPC sono testuali (es. "MODERATA CRITICITA' / ALLERTA ARANCIONE"). */
export function parseAlertLevel(text: unknown): DpcLevel {
  if (typeof text !== 'string') return 0;
  const t = text.toUpperCase();
  if (t.includes('ROSSA')) return 3;
  if (t.includes('ARANCIONE')) return 2;
  if (t.includes('GIALLA')) return 1;
  return 0;
}

export function parseDpcTopology(topology: unknown): DpcZone[] {
  const topo = topology as Topology | null;
  if (!topo || topo.type !== 'Topology' || !topo.objects) return [];
  // Il nome dell'object può variare: prendi la prima GeometryCollection.
  const objName = Object.keys(topo.objects).find(
    (k) => (topo.objects[k] as GeometryCollection).type === 'GeometryCollection'
  );
  if (!objName) return [];
  let fc: GeoJSON.FeatureCollection;
  try {
    fc = feature(topo, topo.objects[objName]) as unknown as GeoJSON.FeatureCollection;
  } catch {
    return [];
  }
  return fc.features.map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const idraulico = parseAlertLevel(p['Per rischio idraulico']);
    const temporali = parseAlertLevel(p['Per rischio temporali']);
    const idrogeologico = parseAlertLevel(p['Per rischio idrogeologico']);
    return {
      name: typeof p['Nome zona'] === 'string' ? (p['Nome zona'] as string) : 'Zona sconosciuta',
      idraulico, temporali, idrogeologico,
      maxLevel: Math.max(idraulico, temporali, idrogeologico) as DpcLevel,
      feature: f,
    };
  });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function riskRow(label: string, level: DpcLevel): string {
  const color = level === 0 ? '#22c55e' : DPC_LEVEL_COLORS[level];
  return `<div style="display:flex;justify-content:space-between;gap:8px">` +
    `<span>${label}</span>` +
    `<span style="color:${color};font-weight:bold">${DPC_LEVEL_LABELS[level]}</span></div>`;
}

/** HTML puro per layer.bindPopup (le zone DPC usano il popup nativo Leaflet). */
export function zonePopupHtml(zone: DpcZone, dayLabel: string, issuedLabel: string): string {
  return `<div style="min-width:190px;font-size:12px">` +
    `<div style="font-weight:bold;margin-bottom:4px">${esc(zone.name)}</div>` +
    `<div style="color:#6b7280;margin-bottom:6px">${esc(dayLabel)}</div>` +
    riskRow('Idraulico', zone.idraulico) +
    riskRow('Temporali', zone.temporali) +
    riskRow('Idrogeologico', zone.idrogeologico) +
    `<div style="color:#6b7280;margin-top:6px;font-size:10px">${esc(issuedLabel)}</div></div>`;
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ddmm(ymd: string): string {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

/** Da "YYYYMMDD_HHMM" alle date coperte dai file _today/_tomorrow + label emissione. */
export function bulletinDates(bulletinId: string): { today: string; tomorrow: string; issuedLabel: string } {
  const y = Number(bulletinId.slice(0, 4));
  const m = Number(bulletinId.slice(4, 6));
  const d = Number(bulletinId.slice(6, 8));
  const base = new Date(y, m - 1, d);
  const next = new Date(y, m - 1, d + 1);
  return {
    today: toYmd(base),
    tomorrow: toYmd(next),
    issuedLabel: `${bulletinId.slice(6, 8)}/${bulletinId.slice(4, 6)} ${bulletinId.slice(9, 11)}:${bulletinId.slice(11, 13)}`,
  };
}

export interface DayOption { date: string; label: string; disabled: boolean; }

/** Regola spec §6: le opzioni sono i giorni coperti dal bollettino, etichettati con la data reale. */
export function dayOptions(dates: string[], now: Date): DayOption[] {
  const today = toYmd(now);
  const tomorrow = toYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  return dates.map((date) => {
    let prefix: string;
    if (date === today) prefix = 'Oggi';
    else if (date === tomorrow) prefix = 'Domani';
    else if (date < today) prefix = 'Ieri';
    else prefix = 'Il';
    return { date, label: `${prefix} ${ddmm(date)}`, disabled: date < today };
  });
}

export function defaultDpcDate(dates: string[], now: Date): string | null {
  const today = toYmd(now);
  if (dates.includes(today)) return today;
  const future = dates.filter((d) => d > today).sort();
  return future[0] ?? null;
}
```

Nota TS: se `topojson-specification` non è risolto dai types installati, sostituisci i tipi `Topology`/`GeometryCollection` con interfacce locali minime (`{ type: string; objects: Record<string, unknown>; arcs: unknown[] }`) e passa da `feature(topo as never, ...)` — la validazione runtime resta quella del try/catch.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/dpc.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/dpc.ts src/__tests__/dpc.test.ts package.json package-lock.json
git commit -m "feat(emergency): parsing bollettino DPC (zone, livelli, popup, giorni)"
```

---

### Task 5: Discovery bollettino DPC + route `/api/dpc-alerts`

**Files:**
- Create: `src/lib/dpc-discovery.ts`, `src/app/api/dpc-alerts/route.ts`
- Test: `src/__tests__/dpc-discovery.test.ts`

**Interfaces:**
- Consumes: GitHub REST API (mockata nei test)
- Produces:

```ts
export interface DpcBulletinInfo {
  bulletinId: string;        // "YYYYMMDD_HHMM"
  topojsonToday: string;     // URL raw.githubusercontent
  topojsonTomorrow: string;
}
export type DpcDiscoveryResult =
  | { status: 200; data: DpcBulletinInfo }
  | { status: 502; error: string };
export async function discoverLatestBulletin(): Promise<DpcDiscoveryResult>;
export function _resetDpcCacheForTests(): void;
```
- Route: `GET /api/dpc-alerts` → 200 `DpcBulletinInfo` | 502 `{ error }` (consumata dal Task 6)

- [x] **Step 1: Write the failing tests**

```ts
// src/__tests__/dpc-discovery.test.ts
import { discoverLatestBulletin, _resetDpcCacheForTests } from '@/lib/dpc-discovery';

const COMMITS = [{ sha: 'abc123' }, { sha: 'def456' }];
const COMMIT_DETAIL = {
  sha: 'abc123',
  files: [{ filename: 'files/preview/20260825_1415_domani.png' }, { filename: 'files/20260825_1415.json' }],
};
const COMMIT_NO_BULLETIN = { sha: 'abc123', files: [{ filename: 'README.md' }] };

function mockFetchSequence(...responses: Array<{ ok: boolean; status?: number; json: unknown }>) {
  const fn = jest.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({ ok: r.ok, status: r.status ?? 200, json: async () => r.json });
  }
  return fn;
}

describe('discoverLatestBulletin', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    _resetDpcCacheForTests();
    jest.useFakeTimers();
  });
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  test('estrae bulletinId dai file del commit e costruisce gli URL raw', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: COMMITS }, { ok: true, json: COMMIT_DETAIL });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) {
      expect(r.data.bulletinId).toBe('20260825_1415');
      expect(r.data.topojsonToday).toBe(
        'https://raw.githubusercontent.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/topojson/20260825_1415_today.json'
      );
      expect(r.data.topojsonTomorrow).toContain('20260825_1415_tomorrow.json');
    }
  });

  test('scorre più commit finché trova un bollettino', async () => {
    global.fetch = mockFetchSequence(
      { ok: true, json: COMMITS },
      { ok: true, json: COMMIT_NO_BULLETIN },
      { ok: true, json: { sha: 'def456', files: [{ filename: 'files/preview/20260824_1500_domani.png' }] } },
    );
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260824_1500');
  });

  test('cache 30 min: seconda chiamata senza fetch, scaduta rifà', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: COMMITS }, { ok: true, json: COMMIT_DETAIL });
    await discoverLatestBulletin();
    await discoverLatestBulletin();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => COMMIT_DETAIL });
    jest.advanceTimersByTime(31 * 60 * 1000);
    // dopo il TTL rifà la discovery (il mock generico sopra risponde a entrambe le chiamate)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => COMMITS })
      .mockResolvedValueOnce({ ok: true, json: async () => COMMIT_DETAIL });
    await discoverLatestBulletin();
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(2);
  });

  test('rate limit (403) con cache stantia → serve la cache', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: COMMITS }, { ok: true, json: COMMIT_DETAIL });
    await discoverLatestBulletin();
    jest.advanceTimersByTime(31 * 60 * 1000);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260825_1415');
  });

  test('errore senza cache → 502', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(502);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/dpc-discovery.test.ts`
Expected: FAIL — modulo inesistente.

- [x] **Step 3: Write implementation**

```ts
// src/lib/dpc-discovery.ts (completo)
const REPO = 'pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica';
const COMMITS_API = `https://api.github.com/repos/${REPO}/commits`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/master/files/topojson`;
const CACHE_TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 8000;
const BULLETIN_RE = /files\/(?:preview\/)?(\d{8}_\d{4})/;

export interface DpcBulletinInfo {
  bulletinId: string;
  topojsonToday: string;
  topojsonTomorrow: string;
}

export type DpcDiscoveryResult =
  | { status: 200; data: DpcBulletinInfo }
  | { status: 502; error: string };

let cache: { data: DpcBulletinInfo; expiresAt: number } | null = null;

export function _resetDpcCacheForTests(): void { cache = null; }

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API: HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function toInfo(bulletinId: string): DpcBulletinInfo {
  return {
    bulletinId,
    topojsonToday: `${RAW_BASE}/${bulletinId}_today.json`,
    topojsonTomorrow: `${RAW_BASE}/${bulletinId}_tomorrow.json`,
  };
}

export async function discoverLatestBulletin(): Promise<DpcDiscoveryResult> {
  if (cache && Date.now() < cache.expiresAt) return { status: 200, data: cache.data };

  try {
    const commits = (await getJson(`${COMMITS_API}?per_page=5`)) as Array<{ sha: string }>;
    for (const { sha } of commits) {
      const detail = (await getJson(`${COMMITS_API}/${sha}`)) as { files?: Array<{ filename: string }> };
      for (const f of detail.files ?? []) {
        const m = BULLETIN_RE.exec(f.filename);
        if (m) {
          const data = toInfo(m[1]);
          cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
          return { status: 200, data };
        }
      }
    }
    throw new Error('Nessun bollettino trovato negli ultimi commit');
  } catch (e) {
    // Fallback: cache stantia meglio di niente (bollettino giornaliero).
    if (cache) return { status: 200, data: cache.data };
    return { status: 502, error: e instanceof Error ? e.message : 'Discovery DPC fallita' };
  }
}
```

```ts
// src/app/api/dpc-alerts/route.ts (completo)
import { NextResponse } from 'next/server';
import { discoverLatestBulletin } from '@/lib/dpc-discovery';

export async function GET() {
  const result = await discoverLatestBulletin();
  if (result.status === 200) return NextResponse.json(result.data);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/dpc-discovery.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/dpc-discovery.ts src/app/api/dpc-alerts/route.ts src/__tests__/dpc-discovery.test.ts
git commit -m "feat(emergency): discovery bollettino DPC via GitHub API con cache e fallback"
```

---

### Task 6: Client API + emergencyStore (dati runtime, refresh, staleness)

**Files:**
- Create: `src/lib/emergency-api.ts`, `src/stores/emergencyStore.ts`
- Test: `src/__tests__/emergency-api.test.ts`, `src/__tests__/emergencyStore.test.ts`

**Interfaces:**
- Consumes: `FirePoint` (Task 2), `FiresPayload` shape (Task 3), `DpcBulletinInfo` shape (Task 5), `parseDpcTopology`, `bulletinDates`, `defaultDpcDate`, `DpcZone` (Task 4), `EmergencyLayerId`, `getEmergencyLayer` (Task 1)
- Produces:

```ts
// src/lib/emergency-api.ts — fetch client-side; lanciano Error(messaggio it) su fallimento
export interface DpcDay { date: string; zones: DpcZone[]; }
export interface DpcData { bulletinId: string; issuedLabel: string; days: DpcDay[]; }
export async function fetchFiresClient(): Promise<{ points: FirePoint[]; fetchedAt: string }>;
export async function fetchDpcClient(): Promise<DpcData>;

// src/stores/emergencyStore.ts
export type LayerStatus = 'idle' | 'loading' | 'ready' | 'error';
interface LayerRuntime { status: LayerStatus; error: string | null; lastFetch: number | null; }
interface EmergencyState {
  layers: Record<EmergencyLayerId, LayerRuntime>;
  fires: { points: FirePoint[]; fetchedAt: string } | null;
  dpc: DpcData | null;
  dpcSelectedDate: string | null;
  startLayer: (id: EmergencyLayerId) => void;   // fetch + avvia auto-refresh (idempotente)
  stopLayer: (id: EmergencyLayerId) => void;    // ferma il refresh, azzera a idle
  refreshLayer: (id: EmergencyLayerId) => Promise<void>;
  setDpcSelectedDate: (date: string) => void;
  isStale: (id: EmergencyLayerId) => boolean;   // lastFetch più vecchio di 2× refreshMinutes
}
export const useEmergencyStore: UseBoundStore<StoreApi<EmergencyState>>;
```

Note implementative vincolanti:
- I layer `wms` non hanno dati da fetchare: `startLayer` li porta subito a `ready` (lastFetch = ora) e non crea interval.
- Gli interval vivono in una `Map<EmergencyLayerId, ReturnType<typeof setInterval>>` a livello di modulo (non nello stato Zustand).
- `refreshLayer('dpc-alerts')` dopo il fetch imposta `dpcSelectedDate = defaultDpcDate(...)` SOLO se quello corrente è null o non è tra le date disponibili.
- In `fetchDpcClient`: chiama `/api/dpc-alerts`, poi scarica i due TopoJSON con `Promise.allSettled` — basta che UNO riesca; giorno fallito = escluso da `days`. Entrambi falliti → throw.
- Errore di refresh con dati già presenti: mantieni i dati, `status: 'error'` + `error` valorizzato (il pannello mostra il badge, la mappa continua a disegnare i dati vecchi).

- [x] **Step 1: Write the failing tests**

```ts
// src/__tests__/emergency-api.test.ts
import { fetchFiresClient, fetchDpcClient } from '@/lib/emergency-api';

const TOPO = { // stessa mini-topology del Task 4, 1 zona basta
  type: 'Topology',
  objects: { zone: { type: 'GeometryCollection', geometries: [{
    type: 'Polygon', arcs: [[0]],
    properties: { 'Nome zona': 'Z1', 'Per rischio idraulico': 'NESSUNA ALLERTA',
      'Per rischio temporali': 'NESSUNA ALLERTA', 'Per rischio idrogeologico': "ORDINARIA CRITICITA' / ALLERTA GIALLA" },
  }] } },
  arcs: [[[13.0, 42.0], [13.1, 42.0], [13.1, 42.1], [13.0, 42.1], [13.0, 42.0]]],
};

describe('fetchFiresClient', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('ritorna il payload del proxy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ points: [], fetchedAt: '2026-08-25T10:00:00Z' }),
    });
    const r = await fetchFiresClient();
    expect(r.fetchedAt).toBe('2026-08-25T10:00:00Z');
    expect(global.fetch).toHaveBeenCalledWith('/api/fires');
  });

  test('errore HTTP → throw con messaggio', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'no key' }) });
    await expect(fetchFiresClient()).rejects.toThrow();
  });
});

describe('fetchDpcClient', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const INFO = {
    bulletinId: '20260825_1415',
    topojsonToday: 'https://raw.example/today.json',
    topojsonTomorrow: 'https://raw.example/tomorrow.json',
  };

  test('discovery + 2 topojson → DpcData con 2 giorni', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO });
    const data = await fetchDpcClient();
    expect(data.bulletinId).toBe('20260825_1415');
    expect(data.issuedLabel).toBe('25/08 14:15');
    expect(data.days.map((d) => d.date)).toEqual(['2026-08-25', '2026-08-26']);
    expect(data.days[0].zones).toHaveLength(1);
  });

  test('un topojson fallito → resta il giorno buono', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO })
      .mockRejectedValueOnce(new Error('404'));
    const data = await fetchDpcClient();
    expect(data.days).toHaveLength(1);
    expect(data.days[0].date).toBe('2026-08-25');
  });

  test('entrambi falliti → throw', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockRejectedValue(new Error('down'));
    await expect(fetchDpcClient()).rejects.toThrow();
  });
});
```

```ts
// src/__tests__/emergencyStore.test.ts
import { useEmergencyStore } from '@/stores/emergencyStore';

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn(),
  fetchDpcClient: jest.fn(),
}));
import { fetchFiresClient, fetchDpcClient } from '@/lib/emergency-api';

const firesOk = { points: [{ lat: 42, lon: 13, frp: 5, confidence: 'nominal', acquiredAt: '2026-08-25T09:00:00Z', satellite: 'N20' }], fetchedAt: '2026-08-25T10:00:00Z' };
const dpcOk = { bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [{ date: '2026-08-25', zones: [] }, { date: '2026-08-26', zones: [] }] };

// helper: attende i micro-task pendenti con i fake timers attivi
const flush = () => new Promise((r) => { setTimeout(r, 0); jest.advanceTimersByTime(0); });

describe('emergencyStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (fetchFiresClient as jest.Mock).mockReset().mockResolvedValue(firesOk);
    (fetchDpcClient as jest.Mock).mockReset().mockResolvedValue(dpcOk);
    // reset stato tra i test
    const s = useEmergencyStore.getState();
    (['fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts'] as const).forEach((id) => s.stopLayer(id));
  });
  afterEach(() => jest.useRealTimers());

  test('startLayer(points): loading → ready con dati', async () => {
    useEmergencyStore.getState().startLayer('fires-hotspots');
    expect(useEmergencyStore.getState().layers['fires-hotspots'].status).toBe('loading');
    await flush();
    const st = useEmergencyStore.getState();
    expect(st.layers['fires-hotspots'].status).toBe('ready');
    expect(st.fires?.points).toHaveLength(1);
  });

  test('startLayer è idempotente (secondo start non rifetcha)', async () => {
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    await flush();
    s.startLayer('fires-hotspots');
    await flush();
    expect(fetchFiresClient).toHaveBeenCalledTimes(1);
  });

  test('layer wms: ready immediato senza fetch', () => {
    useEmergencyStore.getState().startLayer('fires-fwi');
    expect(useEmergencyStore.getState().layers['fires-fwi'].status).toBe('ready');
    expect(fetchFiresClient).not.toHaveBeenCalled();
  });

  test('auto-refresh: dopo refreshMinutes rifetcha', async () => {
    useEmergencyStore.getState().startLayer('fires-hotspots');
    await flush();
    jest.advanceTimersByTime(15 * 60 * 1000 + 100);
    await flush();
    expect(fetchFiresClient).toHaveBeenCalledTimes(2);
  });

  test('stopLayer ferma il refresh', async () => {
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    await flush();
    s.stopLayer('fires-hotspots');
    jest.advanceTimersByTime(60 * 60 * 1000);
    await flush();
    expect(fetchFiresClient).toHaveBeenCalledTimes(1);
    expect(useEmergencyStore.getState().layers['fires-hotspots'].status).toBe('idle');
  });

  test('errore al refresh con dati presenti: dati mantenuti + status error', async () => {
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    await flush();
    (fetchFiresClient as jest.Mock).mockRejectedValue(new Error('rete giù'));
    await s.refreshLayer('fires-hotspots');
    const st = useEmergencyStore.getState();
    expect(st.layers['fires-hotspots'].status).toBe('error');
    expect(st.layers['fires-hotspots'].error).toBe('rete giù');
    expect(st.fires?.points).toHaveLength(1);
  });

  test('dpc: imposta dpcSelectedDate col default e non lo sovrascrive se valido', async () => {
    jest.setSystemTime(new Date('2026-08-25T10:00:00'));
    const s = useEmergencyStore.getState();
    s.startLayer('dpc-alerts');
    await flush();
    expect(useEmergencyStore.getState().dpcSelectedDate).toBe('2026-08-25');
    s.setDpcSelectedDate('2026-08-26');
    await s.refreshLayer('dpc-alerts');
    expect(useEmergencyStore.getState().dpcSelectedDate).toBe('2026-08-26');
  });

  test('isStale: true oltre 2× refreshMinutes', async () => {
    useEmergencyStore.getState().startLayer('fires-hotspots');
    await flush();
    expect(useEmergencyStore.getState().isStale('fires-hotspots')).toBe(false);
    (fetchFiresClient as jest.Mock).mockRejectedValue(new Error('giù'));
    jest.advanceTimersByTime(31 * 60 * 1000);
    expect(useEmergencyStore.getState().isStale('fires-hotspots')).toBe(true);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/emergency-api.test.ts src/__tests__/emergencyStore.test.ts`
Expected: FAIL — moduli inesistenti.

- [x] **Step 3: Write implementation**

```ts
// src/lib/emergency-api.ts (completo)
import type { FirePoint } from './firms';
import { parseDpcTopology, bulletinDates, type DpcZone } from './dpc';

export interface DpcDay { date: string; zones: DpcZone[]; }
export interface DpcData { bulletinId: string; issuedLabel: string; days: DpcDay[]; }

export async function fetchFiresClient(): Promise<{ points: FirePoint[]; fetchedAt: string }> {
  const res = await fetch('/api/fires');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { error?: string })?.error ?? 'Focolai non disponibili');
  }
  return res.json();
}

export async function fetchDpcClient(): Promise<DpcData> {
  const res = await fetch('/api/dpc-alerts');
  if (!res.ok) throw new Error('Bollettino DPC non disponibile');
  const info = (await res.json()) as { bulletinId: string; topojsonToday: string; topojsonTomorrow: string };
  const { today, tomorrow, issuedLabel } = bulletinDates(info.bulletinId);

  const [todayRes, tomorrowRes] = await Promise.allSettled([
    fetch(info.topojsonToday).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    fetch(info.topojsonTomorrow).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
  ]);

  const days: DpcDay[] = [];
  if (todayRes.status === 'fulfilled') days.push({ date: today, zones: parseDpcTopology(todayRes.value) });
  if (tomorrowRes.status === 'fulfilled') days.push({ date: tomorrow, zones: parseDpcTopology(tomorrowRes.value) });
  if (days.length === 0) throw new Error('Geometrie del bollettino DPC non scaricabili');
  return { bulletinId: info.bulletinId, issuedLabel, days };
}
```

```ts
// src/stores/emergencyStore.ts (completo)
import { create } from 'zustand';
import { EMERGENCY_LAYERS, getEmergencyLayer, type EmergencyLayerId } from '@/lib/emergency-layers';
import { fetchFiresClient, fetchDpcClient, type DpcData } from '@/lib/emergency-api';
import { defaultDpcDate } from '@/lib/dpc';
import { toast } from '@/stores/notificationStore';
import type { FirePoint } from '@/lib/firms';

export type LayerStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LayerRuntime { status: LayerStatus; error: string | null; lastFetch: number | null; }

interface EmergencyState {
  layers: Record<EmergencyLayerId, LayerRuntime>;
  fires: { points: FirePoint[]; fetchedAt: string } | null;
  dpc: DpcData | null;
  dpcSelectedDate: string | null;
  startLayer: (id: EmergencyLayerId) => void;
  stopLayer: (id: EmergencyLayerId) => void;
  refreshLayer: (id: EmergencyLayerId) => Promise<void>;
  setDpcSelectedDate: (date: string) => void;
  isStale: (id: EmergencyLayerId) => boolean;
}

const IDLE: LayerRuntime = { status: 'idle', error: null, lastFetch: null };

const initialLayers = Object.fromEntries(
  EMERGENCY_LAYERS.map((l) => [l.id, { ...IDLE }])
) as Record<EmergencyLayerId, LayerRuntime>;

// Interval fuori dallo stato React: non serve reattività, solo lifecycle.
const timers = new Map<EmergencyLayerId, ReturnType<typeof setInterval>>();

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  layers: initialLayers,
  fires: null,
  dpc: null,
  dpcSelectedDate: null,

  startLayer: (id) => {
    const def = getEmergencyLayer(id);
    const current = get().layers[id];
    if (current.status !== 'idle') return; // idempotente

    if (def.kind === 'wms') {
      set((s) => ({ layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } } }));
      return;
    }
    set((s) => ({ layers: { ...s.layers, [id]: { status: 'loading', error: null, lastFetch: null } } }));
    void get().refreshLayer(id);
    if (def.refreshMinutes != null && !timers.has(id)) {
      timers.set(id, setInterval(() => { void get().refreshLayer(id); }, def.refreshMinutes * 60 * 1000));
    }
  },

  stopLayer: (id) => {
    const t = timers.get(id);
    if (t) { clearInterval(t); timers.delete(id); }
    set((s) => ({ layers: { ...s.layers, [id]: { ...IDLE } } }));
  },

  refreshLayer: async (id) => {
    try {
      if (id === 'fires-hotspots') {
        const fires = await fetchFiresClient();
        set((s) => ({ fires, layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } } }));
      } else if (id === 'dpc-alerts') {
        const dpc = await fetchDpcClient();
        set((s) => {
          const dates = dpc.days.map((d) => d.date);
          const keep = s.dpcSelectedDate != null && dates.includes(s.dpcSelectedDate);
          return {
            dpc,
            dpcSelectedDate: keep ? s.dpcSelectedDate : defaultDpcDate(dates, new Date()),
            layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } },
          };
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Errore di rete';
      // Spec §6: toast UNA volta per transizione in errore (non a ogni retry fallito).
      if (get().layers[id].status !== 'error') {
        toast.error(`${getEmergencyLayer(id).label}: ${message}`);
      }
      set((s) => ({
        layers: { ...s.layers, [id]: { ...s.layers[id], status: 'error', error: message } },
      }));
    }
  },

  setDpcSelectedDate: (date) => set({ dpcSelectedDate: date }),

  isStale: (id) => {
    const def = getEmergencyLayer(id);
    const { lastFetch } = get().layers[id];
    if (def.refreshMinutes == null || lastFetch == null) return false;
    return Date.now() - lastFetch > 2 * def.refreshMinutes * 60 * 1000;
  },
}));
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/emergency-api.test.ts src/__tests__/emergencyStore.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/emergency-api.ts src/stores/emergencyStore.ts src/__tests__/emergency-api.test.ts src/__tests__/emergencyStore.test.ts
git commit -m "feat(emergency): store runtime con auto-refresh, staleness e client API"
```

---

### Task 7: Renderer WMS + estensione mock react-leaflet

**Files:**
- Create: `src/components/map/emergency/EmergencyWmsLayer.tsx`
- Modify: `src/__tests__/components/__mocks__/react-leaflet.tsx` (aggiungi `WMSTileLayer`, `CircleMarker`, `GeoJSON`; estendi `useMap` con `getPane`, `createPane`, `attributionControl`)
- Test: `src/__tests__/components/EmergencyWmsLayer.test.tsx`

**Interfaces:**
- Consumes: `EmergencyLayerDef` con `wms` (Task 1)
- Produces: `export function EmergencyWmsLayer({ def }: { def: EmergencyLayerDef }): JSX.Element | null` (usato dal Task 11). Esporta anche `export function wmsTimeParam(mode: 'today' | 'yearToDate', now: Date): string` per i test.

- [x] **Step 1: Estendi il mock react-leaflet (prerequisito di TUTTI i test componente successivi)**

Aggiungi a `src/__tests__/components/__mocks__/react-leaflet.tsx`:

```tsx
export const WMSTileLayer = (props: Record<string, unknown>) => (
  <div data-testid="wms-tile-layer" data-params={JSON.stringify(props.params ?? {})} data-opacity={String(props.opacity ?? '')} />
);

export const CircleMarker = ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
  <div data-testid="circle-marker" data-pathoptions={JSON.stringify(props.pathOptions ?? {})}>{children}</div>
);

export const GeoJSON = (props: Record<string, unknown>) => (
  <div data-testid="geojson-layer" data-features={JSON.stringify((props.data as { features?: unknown[] })?.features?.length ?? 0)} />
);
```

e dentro l'oggetto ritornato da `useMap` aggiungi:

```ts
  getPane: (_name: string) => undefined,
  createPane: jest.fn(() => ({ style: {} })),
  attributionControl: { addAttribution: jest.fn(), removeAttribution: jest.fn() },
```

- [x] **Step 2: Write the failing test**

```tsx
// src/__tests__/components/EmergencyWmsLayer.test.tsx
import { render, screen } from '@testing-library/react';
import { EmergencyWmsLayer, wmsTimeParam } from '@/components/map/emergency/EmergencyWmsLayer';
import { getEmergencyLayer } from '@/lib/emergency-layers';

describe('wmsTimeParam', () => {
  const now = new Date('2026-08-25T10:00:00');
  test('today → data odierna', () => {
    expect(wmsTimeParam('today', now)).toBe('2026-08-25');
  });
  test('yearToDate → intervallo da inizio anno', () => {
    expect(wmsTimeParam('yearToDate', now)).toBe('2026-01-01/2026-08-25');
  });
});

describe('EmergencyWmsLayer', () => {
  test('renderizza WMSTileLayer con layers, TIME e opacity dal def', () => {
    render(<EmergencyWmsLayer def={getEmergencyLayer('fires-fwi')} />);
    const el = screen.getByTestId('wms-tile-layer');
    const params = JSON.parse(el.getAttribute('data-params')!);
    expect(params.layers).toBe('mf010.fwi');
    expect(params.time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.transparent).toBe(true);
    expect(el.getAttribute('data-opacity')).toBe('0.55');
  });

  test('def senza wms → non renderizza nulla', () => {
    render(<EmergencyWmsLayer def={getEmergencyLayer('fires-hotspots')} />);
    expect(screen.queryByTestId('wms-tile-layer')).toBeNull();
  });
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/EmergencyWmsLayer.test.tsx`
Expected: FAIL — componente inesistente.

- [x] **Step 4: Write implementation**

```tsx
// src/components/map/emergency/EmergencyWmsLayer.tsx (completo)
'use client';

import { WMSTileLayer } from 'react-leaflet';
import type { EmergencyLayerDef } from '@/lib/emergency-layers';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function wmsTimeParam(mode: 'today' | 'yearToDate', now: Date): string {
  const today = ymd(now);
  return mode === 'today' ? today : `${now.getFullYear()}-01-01/${today}`;
}

export function EmergencyWmsLayer({ def }: { def: EmergencyLayerDef }) {
  if (!def.wms) return null;
  // TIME è un parametro WMS non tipizzato da Leaflet: il cast estende WMSParams.
  const params = {
    layers: def.wms.layers,
    format: 'image/png',
    transparent: true,
    time: wmsTimeParam(def.wms.timeMode, new Date()),
  } as L.WMSParams & { time: string };
  return (
    <WMSTileLayer
      key={`${def.id}-${params.time}`}
      url={def.wms.url}
      params={params}
      opacity={def.wms.opacity}
      pane={EMERGENCY_PANE}
    />
  );
}
```

Aggiungi in cima `import type L from 'leaflet';`.

- [x] **Step 5: Run tests to verify they pass (inclusa la suite componenti esistente, per il mock modificato)**

Run: `npm test -- src/__tests__/components/`
Expected: PASS — tutti, nessuna regressione da mock esteso.

- [x] **Step 6: Commit**

```bash
git add src/components/map/emergency/EmergencyWmsLayer.tsx src/__tests__/components/EmergencyWmsLayer.test.tsx src/__tests__/components/__mocks__/react-leaflet.tsx
git commit -m "feat(emergency): renderer WMS con parametro TIME (EFFIS)"
```

---

### Task 8: Renderer punti FIRMS con popup

**Files:**
- Create: `src/components/map/emergency/EmergencyPointsLayer.tsx`
- Test: `src/__tests__/components/EmergencyPointsLayer.test.tsx`

**Interfaces:**
- Consumes: `FirePoint` (Task 2), `EMERGENCY_PANE` (Task 1), mock `CircleMarker`/`Popup` (Task 7)
- Produces: `export function EmergencyPointsLayer({ points }: { points: FirePoint[] }): JSX.Element`; esporta anche `export function fireColor(acquiredAt: string, now: Date): string` per i test (usati dal Task 11)

- [x] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/EmergencyPointsLayer.test.tsx
import { render, screen } from '@testing-library/react';
import { EmergencyPointsLayer, fireColor } from '@/components/map/emergency/EmergencyPointsLayer';
import type { FirePoint } from '@/lib/firms';

const P = (over: Partial<FirePoint> = {}): FirePoint => ({
  lat: 42.1, lon: 13.4, frp: 12.5, confidence: 'high',
  acquiredAt: '2026-08-25T08:00:00Z', satellite: 'N20', ...over,
});

describe('fireColor', () => {
  const now = new Date('2026-08-25T10:00:00Z');
  test('< 6h → rosso vivo', () => expect(fireColor('2026-08-25T08:00:00Z', now)).toBe('#ef4444'));
  test('> 6h → arancio', () => expect(fireColor('2026-08-25T01:00:00Z', now)).toBe('#f97316'));
});

describe('EmergencyPointsLayer', () => {
  test('un CircleMarker per punto, con popup dettagli', () => {
    render(<EmergencyPointsLayer points={[P(), P({ lat: 43 })]} />);
    expect(screen.getAllByTestId('circle-marker')).toHaveLength(2);
    expect(screen.getAllByText(/12\.5 MW/)).toHaveLength(2);
    expect(screen.getAllByText(/N20/)).toHaveLength(2);
    expect(screen.getAllByText(/Alta/)).toHaveLength(2); // confidenza high → "Alta"
  });

  test('nessun punto → nessun marker', () => {
    render(<EmergencyPointsLayer points={[]} />);
    expect(screen.queryByTestId('circle-marker')).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/EmergencyPointsLayer.test.tsx`
Expected: FAIL — componente inesistente.

- [x] **Step 3: Write implementation**

```tsx
// src/components/map/emergency/EmergencyPointsLayer.tsx (completo)
'use client';

import { CircleMarker, Popup } from 'react-leaflet';
import type { FirePoint } from '@/lib/firms';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function fireColor(acquiredAt: string, now: Date): string {
  return now.getTime() - new Date(acquiredAt).getTime() < SIX_HOURS_MS ? '#ef4444' : '#f97316';
}

const CONFIDENCE_LABELS: Record<FirePoint['confidence'], string> = {
  low: 'Bassa', nominal: 'Media', high: 'Alta',
};

function formatAcquired(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function EmergencyPointsLayer({ points }: { points: FirePoint[] }) {
  const now = new Date();
  return (
    <>
      {points.map((p, i) => (
        <CircleMarker
          key={`${p.lat}-${p.lon}-${p.acquiredAt}-${i}`}
          center={[p.lat, p.lon]}
          radius={6}
          pane={EMERGENCY_PANE}
          pathOptions={{ color: fireColor(p.acquiredAt, now), fillColor: fireColor(p.acquiredAt, now), fillOpacity: 0.7, weight: 1 }}
        >
          <Popup>
            <div className="min-w-[170px] text-xs">
              <div className="font-bold mb-1">🔥 Anomalia termica</div>
              <div>Rilevata: {formatAcquired(p.acquiredAt)}</div>
              <div>Satellite: {p.satellite}</div>
              <div>Potenza (FRP): {p.frp} MW</div>
              <div>Confidenza: {CONFIDENCE_LABELS[p.confidence]}</div>
              <div className="text-[10px] text-gray-500 mt-1">
                Rilevazione satellitare NASA FIRMS — non è la conferma di un incendio in corso.
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/components/EmergencyPointsLayer.test.tsx`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/map/emergency/EmergencyPointsLayer.tsx src/__tests__/components/EmergencyPointsLayer.test.tsx
git commit -m "feat(emergency): renderer punti FIRMS con popup e colore per recency"
```

---

### Task 9: Renderer zone DPC

**Files:**
- Create: `src/components/map/emergency/EmergencyZonesLayer.tsx`
- Test: `src/__tests__/components/EmergencyZonesLayer.test.tsx`

**Interfaces:**
- Consumes: `DpcZone`, `DPC_LEVEL_COLORS`, `zonePopupHtml` (Task 4), `EMERGENCY_PANE` (Task 1), mock `GeoJSON` (Task 7)
- Produces: `export function EmergencyZonesLayer({ zones, dayLabel, issuedLabel }: { zones: DpcZone[]; dayLabel: string; issuedLabel: string }): JSX.Element`; esporta `export function zoneStyle(level: 1 | 2 | 3): L.PathOptions` per i test (usato dal Task 11)

- [x] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/EmergencyZonesLayer.test.tsx
import { render, screen } from '@testing-library/react';
import { EmergencyZonesLayer, zoneStyle } from '@/components/map/emergency/EmergencyZonesLayer';
import type { DpcZone } from '@/lib/dpc';

const zone = (maxLevel: 0 | 1 | 2 | 3): DpcZone => ({
  name: `Z${maxLevel}`, idraulico: maxLevel, temporali: 0, idrogeologico: 0, maxLevel,
  feature: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[13, 42], [13.1, 42], [13.1, 42.1], [13, 42]]] } },
});

describe('zoneStyle', () => {
  test('colore per livello', () => {
    expect(zoneStyle(1).color).toBe('#eab308');
    expect(zoneStyle(3).fillColor).toBe('#dc2626');
  });
});

describe('EmergencyZonesLayer', () => {
  test('disegna solo le zone con allerta (verdi filtrate)', () => {
    render(<EmergencyZonesLayer zones={[zone(0), zone(1), zone(3)]} dayLabel="Oggi 25/08" issuedLabel="25/08 14:15" />);
    const layers = screen.getAllByTestId('geojson-layer');
    expect(layers).toHaveLength(2); // la zona verde non viene disegnata
  });

  test('nessuna zona in allerta → nulla', () => {
    render(<EmergencyZonesLayer zones={[zone(0)]} dayLabel="Oggi" issuedLabel="x" />);
    expect(screen.queryByTestId('geojson-layer')).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/EmergencyZonesLayer.test.tsx`
Expected: FAIL — componente inesistente.

- [x] **Step 3: Write implementation**

```tsx
// src/components/map/emergency/EmergencyZonesLayer.tsx (completo)
'use client';

import { GeoJSON } from 'react-leaflet';
import type L from 'leaflet';
import { DPC_LEVEL_COLORS, zonePopupHtml, type DpcZone } from '@/lib/dpc';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';

export function zoneStyle(level: 1 | 2 | 3): L.PathOptions {
  const color = DPC_LEVEL_COLORS[level];
  return { color, fillColor: color, fillOpacity: 0.35, weight: 1.5 };
}

export function EmergencyZonesLayer({
  zones, dayLabel, issuedLabel,
}: { zones: DpcZone[]; dayLabel: string; issuedLabel: string }) {
  const alerted = zones.filter((z) => z.maxLevel > 0);
  return (
    <>
      {alerted.map((z) => (
        <GeoJSON
          // key con giorno+bollettino: al cambio dati il layer viene ricreato
          key={`${z.name}-${dayLabel}-${issuedLabel}`}
          data={z.feature}
          pane={EMERGENCY_PANE}
          style={() => zoneStyle(z.maxLevel as 1 | 2 | 3)}
          onEachFeature={(_f, layer) => {
            layer.bindPopup(zonePopupHtml(z, dayLabel, `Bollettino del ${issuedLabel}`));
          }}
        />
      ))}
    </>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/components/EmergencyZonesLayer.test.tsx`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/map/emergency/EmergencyZonesLayer.tsx src/__tests__/components/EmergencyZonesLayer.test.tsx
git commit -m "feat(emergency): renderer zone allerta DPC con popup nativo"
```

---

### Task 10: Pannello layer + pulsante mappa + disclaimer

**Files:**
- Create: `src/components/map/emergency/EmergencyLayersPanel.tsx`, `src/components/map/emergency/EmergencyLayersButton.tsx`
- Modify: `src/stores/uiStore.ts` (+ `emergencyPanelOpen`), `src/lib/storage.ts` (+ chiave `emergencyDisclaimer` in `KEYS`)
- Test: `src/__tests__/components/EmergencyLayersPanel.test.tsx`

**Interfaces:**
- Consumes: `EMERGENCY_LAYERS`, `isEmergencyLayerId` (Task 1), `useEmergencyStore` (Task 6), `useItineraryStore` (`settings`, `updateSettings`), `saveSettings` da `@/lib/storage`, `confirm` da `@/stores/notificationStore`, `dayOptions` (Task 4)
- Produces:
  - `uiStore`: `emergencyPanelOpen: boolean` + `setEmergencyPanelOpen: (open: boolean) => void` (usati da Task 11 e 12)
  - `export function EmergencyLayersButton(): JSX.Element` — pulsante ⚠️ assoluto sulla mappa (`bottom-16 right-3`, sotto MyLocationButton), `aria-label="Layer di emergenza"`, badge con numero layer attivi; onClick → `setEmergencyPanelOpen(!open)`
  - `export function EmergencyLayersPanel(): JSX.Element | null` — null se `!emergencyPanelOpen`; desktop popover `absolute bottom-16 right-14 z-[1000] lg:max-w-xs`, mobile bottom sheet `max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[1190]`
  - `KEYS.emergencyDisclaimer = 'trektrak_emergency_disclaimer_seen'`

Comportamento del pannello (vincolante):
- Righe raggruppate per categoria (`🔥 Incendi`, `🌊 Alluvioni e frane`), una riga per layer del registry con toggle `role="switch"` + `aria-checked` (stile ToggleSwitch di MapSettings, min-h 44px su mobile).
- Toggle ON: se `localStorage[KEYS.emergencyDisclaimer]` assente → `await confirm({ title: 'Layer di emergenza', message: 'I dati provengono da satelliti e bollettini ufficiali ma possono essere incompleti o in ritardo. Non sostituiscono i canali ufficiali di allerta. In caso di emergenza chiama il 112.', variant: 'info', confirmText: 'Ho capito', cancelText: 'Annulla' })`; su false → abort senza attivare; su true → salva flag e prosegui. Poi: aggiorna `settings.mapDisplay.emergencyLayers` via `updateSettings` + `saveSettings` (pattern MapSettings) e chiama `startLayer(id)`.
- Toggle OFF: rimuovi l'id dai settings (updateSettings+saveSettings) e `stopLayer(id)`.
- Sotto ogni layer attivo: legenda (quadratini `legend`), riga stato: `aggiornato alle HH:MM` da `lastFetch` (`toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})`), badge `⚠ dati non aggiornati` se `isStale(id)`, badge errore rosso con `error` se `status === 'error'`, "Caricamento..." se `loading`.
- Per `dpc-alerts` attivo: bottoni giorno da `dayOptions(dpc.days.map(d => d.date), new Date())` — disabled → `disabled`, selezionato → evidenziato; onClick → `setDpcSelectedDate(date)`. Più riga `Bollettino del {issuedLabel}`.
- Footer: nota disclaimer breve + attribution testuale delle fonti attive.
- Chiusura: pulsante ✕ (`aria-label="Chiudi"`) e tasto `Escape` (pattern MapSettings).

- [x] **Step 1: Write the failing tests**

```tsx
// src/__tests__/components/EmergencyLayersPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmergencyLayersPanel } from '@/components/map/emergency/EmergencyLayersPanel';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';

jest.mock('@/stores/notificationStore', () => ({
  ...jest.requireActual('@/stores/notificationStore'),
  confirm: jest.fn().mockResolvedValue(true),
}));
import { confirm } from '@/stores/notificationStore';

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({ points: [], fetchedAt: '2026-08-25T10:00:00Z' }),
  fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [] }),
}));

describe('EmergencyLayersPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    (confirm as jest.Mock).mockClear().mockResolvedValue(true);
    useUIStore.setState({ emergencyPanelOpen: true });
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: [] } },
    });
  });

  test('chiuso → non renderizza nulla', () => {
    useUIStore.setState({ emergencyPanelOpen: false });
    const { container } = render(<EmergencyLayersPanel />);
    expect(container.firstChild).toBeNull();
  });

  test('mostra i 4 layer con switch spenti', () => {
    render(<EmergencyLayersPanel />);
    expect(screen.getByText('Focolai attivi (24h)')).toBeInTheDocument();
    expect(screen.getByText('Allerte meteo-idro (DPC)')).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(4);
    screen.getAllByRole('switch').forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'));
  });

  test('prima attivazione: disclaimer, poi settings aggiornati e switch acceso', async () => {
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toContain('fires-hotspots'));
    expect(localStorage.getItem('trektrak_emergency_disclaimer_seen')).toBe('1');
  });

  test('disclaimer rifiutato → layer NON attivato', async () => {
    (confirm as jest.Mock).mockResolvedValue(false);
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toEqual([]);
  });

  test('disclaimer già visto → nessun confirm alla seconda attivazione', async () => {
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[1]);
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toContain('fires-burned'));
    expect(confirm).not.toHaveBeenCalled();
  });

  test('toggle OFF rimuove dai settings', async () => {
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ['fires-fwi'] } },
    });
    render(<EmergencyLayersPanel />);
    const fwiSwitch = screen.getAllByRole('switch')[2];
    expect(fwiSwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(fwiSwitch);
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toEqual([]));
  });

  test('layer in errore mostra il badge', () => {
    useEmergencyStore.setState((s) => ({
      layers: { ...s.layers, 'fires-hotspots': { status: 'error', error: 'FIRMS non raggiungibile', lastFetch: null } },
    }));
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ['fires-hotspots'] } },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.getByText(/FIRMS non raggiungibile/)).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/EmergencyLayersPanel.test.tsx`
Expected: FAIL — componente/campo store inesistenti.

- [x] **Step 3: Implementa uiStore, KEYS, Button e Panel**

`uiStore.ts`: aggiungi `emergencyPanelOpen: false` allo stato, `setEmergencyPanelOpen: (open: boolean) => void` all'interfaccia e `setEmergencyPanelOpen: (open) => set({ emergencyPanelOpen: open }),` all'implementazione.

`storage.ts`: in `KEYS` aggiungi `emergencyDisclaimer: 'trektrak_emergency_disclaimer_seen',`.

`EmergencyLayersButton.tsx`:

```tsx
'use client';

import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';

export function EmergencyLayersButton() {
  const open = useUIStore((s) => s.emergencyPanelOpen);
  const setOpen = useUIStore((s) => s.setEmergencyPanelOpen);
  const activeCount = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers.length);

  return (
    <button
      onClick={() => setOpen(!open)}
      aria-label="Layer di emergenza"
      aria-expanded={open}
      title="Layer di emergenza (incendi, allerte)"
      className="absolute bottom-16 right-3 z-[1000] w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-lg bg-gray-800/90 text-amber-400 hover:bg-gray-700 transition-colors"
    >
      ⚠️
      {activeCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}
```

`EmergencyLayersPanel.tsx` — struttura completa (adatta i dettagli di stile all'esistente, il comportamento è quello dei test e delle note d'interfaccia sopra):

```tsx
'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { saveSettings, KEYS } from '@/lib/storage';
import { confirm as appConfirm } from '@/stores/notificationStore';
import { EMERGENCY_LAYERS, type EmergencyLayerDef, type EmergencyLayerId, type EmergencyCategory } from '@/lib/emergency-layers';
import { dayOptions } from '@/lib/dpc';

const CATEGORY_LABELS: Record<EmergencyCategory, string> = {
  incendi: '🔥 Incendi',
  alluvioni: '🌊 Alluvioni e frane',
};

const DISCLAIMER =
  'I dati provengono da satelliti e bollettini ufficiali ma possono essere incompleti o in ritardo. ' +
  'Non sostituiscono i canali ufficiali di allerta. In caso di emergenza chiama il 112.';

function LayerRow({ def }: { def: EmergencyLayerDef }) {
  const settings = useItineraryStore((s) => s.settings);
  const updateSettings = useItineraryStore((s) => s.updateSettings);
  const runtime = useEmergencyStore((s) => s.layers[def.id]);
  const startLayer = useEmergencyStore((s) => s.startLayer);
  const stopLayer = useEmergencyStore((s) => s.stopLayer);
  const isStale = useEmergencyStore((s) => s.isStale);
  const dpc = useEmergencyStore((s) => s.dpc);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);
  const setDpcSelectedDate = useEmergencyStore((s) => s.setDpcSelectedDate);

  const active = settings.mapDisplay.emergencyLayers.includes(def.id);

  const persist = (list: EmergencyLayerId[]) => {
    const newSettings = { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: list } };
    updateSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleToggle = async () => {
    if (active) {
      persist(settings.mapDisplay.emergencyLayers.filter((id) => id !== def.id));
      stopLayer(def.id);
      return;
    }
    let seen = false;
    try { seen = localStorage.getItem(KEYS.emergencyDisclaimer) === '1'; } catch { /* noop */ }
    if (!seen) {
      const ok = await appConfirm({
        title: 'Layer di emergenza', message: DISCLAIMER,
        variant: 'info', confirmText: 'Ho capito', cancelText: 'Annulla',
      });
      if (!ok) return;
      try { localStorage.setItem(KEYS.emergencyDisclaimer, '1'); } catch { /* noop */ }
    }
    persist([...settings.mapDisplay.emergencyLayers, def.id]);
    startLayer(def.id);
  };

  return (
    <div className="py-2 border-b border-gray-700 last:border-0">
      <div className="flex items-center justify-between max-lg:min-h-[44px]">
        <div className="pr-2">
          <div className="text-sm text-gray-100">{def.label}</div>
          <div className="text-[10px] text-gray-400">{def.description}</div>
        </div>
        <button
          role="switch"
          aria-checked={active}
          aria-label={def.label}
          onClick={handleToggle}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${active ? 'bg-amber-500' : 'bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${active ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {active && (
        <div className="mt-1 space-y-1">
          <div className="flex flex-wrap gap-2">
            {def.legend.map((e) => (
              <span key={e.label} className="flex items-center gap-1 text-[10px] text-gray-300">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: e.color }} />
                {e.label}
              </span>
            ))}
          </div>
          {runtime.status === 'loading' && <div className="text-[10px] text-gray-400">Caricamento...</div>}
          {runtime.status === 'error' && (
            <div className="text-[10px] text-red-400">⚠ {runtime.error}</div>
          )}
          {runtime.lastFetch != null && def.refreshMinutes != null && (
            <div className="text-[10px] text-gray-400">
              Aggiornato alle {new Date(runtime.lastFetch).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              {isStale(def.id) && <span className="text-amber-400 ml-1">⚠ dati non aggiornati</span>}
            </div>
          )}
          {def.id === 'dpc-alerts' && dpc && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {dayOptions(dpc.days.map((d) => d.date), new Date()).map((o) => (
                  <button
                    key={o.date}
                    disabled={o.disabled}
                    onClick={() => setDpcSelectedDate(o.date)}
                    className={`px-2 py-1 rounded text-[10px] ${
                      o.date === dpcSelectedDate ? 'bg-amber-500 text-black font-bold' : 'bg-gray-700 text-gray-300'
                    } disabled:opacity-40`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-gray-400">Bollettino del {dpc.issuedLabel}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmergencyLayersPanel() {
  const open = useUIStore((s) => s.emergencyPanelOpen);
  const setOpen = useUIStore((s) => s.setEmergencyPanelOpen);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, setOpen]);

  if (!open) return null;

  const categories = [...new Set(EMERGENCY_LAYERS.map((l) => l.category))];

  return (
    <div
      role="dialog"
      aria-label="Layer di emergenza"
      className="absolute bottom-16 right-14 z-[1000] w-72 max-h-[70vh] overflow-y-auto bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3
                 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:right-auto max-lg:w-full max-lg:rounded-b-none max-lg:z-[1190] max-lg:max-h-[60vh]"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-200">Layer di emergenza</span>
        <button onClick={() => setOpen(false)} aria-label="Chiudi" className="text-gray-500 hover:text-white max-lg:min-h-[44px] max-lg:min-w-[44px]">✕</button>
      </div>
      {categories.map((cat) => (
        <div key={cat} className="mb-1">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-2">{CATEGORY_LABELS[cat]}</div>
          {EMERGENCY_LAYERS.filter((l) => l.category === cat).map((def) => (
            <LayerRow key={def.id} def={def} />
          ))}
        </div>
      ))}
      <div className="text-[9px] text-gray-500 mt-2">{DISCLAIMER}</div>
    </div>
  );
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/components/EmergencyLayersPanel.test.tsx`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/map/emergency/EmergencyLayersPanel.tsx src/components/map/emergency/EmergencyLayersButton.tsx src/stores/uiStore.ts src/lib/storage.ts src/__tests__/components/EmergencyLayersPanel.test.tsx
git commit -m "feat(emergency): pannello layer con toggle, legenda, stato e disclaimer"
```

---

### Task 11: Orchestratore + integrazione InteractiveMap (pane, attribution, dynamic import, riattivazione)

**Files:**
- Create: `src/components/map/emergency/EmergencyLayers.tsx`
- Modify: `src/components/map/InteractiveMap.tsx` (mount di orchestratore + button + panel)
- Test: `src/__tests__/components/EmergencyLayers.test.tsx`

**Interfaces:**
- Consumes: tutto quanto prodotto dai Task 1, 6, 7, 8, 9, 10
- Produces: `export function EmergencyLayers(): JSX.Element` (default export separato per il dynamic import: `export default EmergencyLayers`)

Comportamento (vincolante):
- `useMap()` + effect di mount: se `map.getPane(EMERGENCY_PANE)` è undefined → `map.createPane(EMERGENCY_PANE)` e `pane.style.zIndex = '350'`.
- Legge `settings.mapDisplay.emergencyLayers`; per ogni id attivo che è `idle` nello store chiama `startLayer(id)` (riattivazione al load della pagina dei layer persistiti); NON chiama `stopLayer` per id rimossi (lo fa già il pannello) MA un effect di sync tiene allineato lo store se i settings cambiano da fuori.
- Attribution: effect che per ogni def attivo chiama `map.attributionControl.addAttribution(def.attribution)` e in cleanup `removeAttribution`.
- Render per kind: `wms` → `<EmergencyWmsLayer def={def} />`; `points` (se `fires` presente) → `<EmergencyPointsLayer points={fires.points} />`; `zones` (se `dpc` e `dpcSelectedDate` presenti) → `<EmergencyZonesLayer zones={dayCorrente.zones} dayLabel={labelDaDayOptions} issuedLabel={dpc.issuedLabel} />`.
- In `InteractiveMap.tsx`: `const EmergencyLayers = dynamic(() => import('./emergency/EmergencyLayers'), { ssr: false });` a livello di modulo (pattern `MapWrapper`/`page.tsx`), import statico invece per `EmergencyLayersButton` e `EmergencyLayersPanel` (sono leggeri); mount dentro `<MapContainer>`: `<EmergencyLayers />` subito dopo `<CoordinateGrid />`, e `<EmergencyLayersButton />` + `<EmergencyLayersPanel />` accanto a `<MyLocationButton />`.

- [x] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/EmergencyLayers.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import EmergencyLayers from '@/components/map/emergency/EmergencyLayers';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({
    points: [{ lat: 42, lon: 13, frp: 5, confidence: 'high', acquiredAt: '2026-08-25T09:00:00Z', satellite: 'N20' }],
    fetchedAt: '2026-08-25T10:00:00Z',
  }),
  fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [] }),
}));

function setActive(ids: string[]) {
  const settings = useItineraryStore.getState().settings;
  useItineraryStore.setState({
    settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ids as never } },
  });
}

describe('EmergencyLayers', () => {
  beforeEach(() => {
    (['fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts'] as const)
      .forEach((id) => useEmergencyStore.getState().stopLayer(id));
    setActive([]);
  });

  test('nessun layer attivo → nulla sulla mappa', () => {
    render(<EmergencyLayers />);
    expect(screen.queryByTestId('wms-tile-layer')).toBeNull();
    expect(screen.queryByTestId('circle-marker')).toBeNull();
  });

  test('layer wms attivo → WMSTileLayer renderizzato', () => {
    setActive(['fires-fwi']);
    render(<EmergencyLayers />);
    expect(screen.getByTestId('wms-tile-layer')).toBeInTheDocument();
  });

  test('layer points attivo → startLayer al mount e marker dopo il fetch', async () => {
    setActive(['fires-hotspots']);
    render(<EmergencyLayers />);
    await waitFor(() => expect(screen.getByTestId('circle-marker')).toBeInTheDocument());
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/EmergencyLayers.test.tsx`
Expected: FAIL — componente inesistente.

- [x] **Step 3: Write implementation**

```tsx
// src/components/map/emergency/EmergencyLayers.tsx (completo)
'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_LAYERS, EMERGENCY_PANE, getEmergencyLayer } from '@/lib/emergency-layers';
import { dayOptions } from '@/lib/dpc';
import { EmergencyWmsLayer } from './EmergencyWmsLayer';
import { EmergencyPointsLayer } from './EmergencyPointsLayer';
import { EmergencyZonesLayer } from './EmergencyZonesLayer';

export function EmergencyLayers() {
  const map = useMap();
  const activeIds = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers);
  const layers = useEmergencyStore((s) => s.layers);
  const startLayer = useEmergencyStore((s) => s.startLayer);
  const fires = useEmergencyStore((s) => s.fires);
  const dpc = useEmergencyStore((s) => s.dpc);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);

  // Pane dedicato: sopra i tile (200), sotto i tracciati (overlayPane 400).
  useEffect(() => {
    if (!map.getPane(EMERGENCY_PANE)) {
      const pane = map.createPane(EMERGENCY_PANE);
      pane.style.zIndex = '350';
    }
  }, [map]);

  // Riattivazione dei layer persistiti (startLayer è idempotente).
  useEffect(() => {
    for (const id of activeIds) {
      if (layers[id].status === 'idle') startLayer(id);
    }
  }, [activeIds, layers, startLayer]);

  // Attribution dinamica delle fonti attive.
  useEffect(() => {
    const defs = activeIds.map(getEmergencyLayer);
    defs.forEach((d) => map.attributionControl.addAttribution(d.attribution));
    return () => defs.forEach((d) => map.attributionControl.removeAttribution(d.attribution));
  }, [activeIds, map]);

  const dpcDay = dpc?.days.find((d) => d.date === dpcSelectedDate);
  const dpcLabel = dpc && dpcSelectedDate
    ? dayOptions(dpc.days.map((d) => d.date), new Date()).find((o) => o.date === dpcSelectedDate)?.label ?? ''
    : '';

  return (
    <>
      {activeIds.map((id) => {
        const def = getEmergencyLayer(id);
        if (def.kind === 'wms') return <EmergencyWmsLayer key={id} def={def} />;
        if (def.kind === 'points' && fires) return <EmergencyPointsLayer key={id} points={fires.points} />;
        if (def.kind === 'zones' && dpc && dpcDay) {
          return <EmergencyZonesLayer key={id} zones={dpcDay.zones} dayLabel={dpcLabel} issuedLabel={dpc.issuedLabel} />;
        }
        return null;
      })}
    </>
  );
}

export default EmergencyLayers;
```

In `InteractiveMap.tsx`:
- import a livello modulo: `import dynamic from 'next/dynamic';`, `import { EmergencyLayersButton } from './emergency/EmergencyLayersButton';`, `import { EmergencyLayersPanel } from './emergency/EmergencyLayersPanel';`
- sotto gli import: `const EmergencyLayers = dynamic(() => import('./emergency/EmergencyLayers'), { ssr: false });`
- nel JSX, dopo `{showCoordinateGrid && <CoordinateGrid />}`: `<EmergencyLayers />`
- dopo `<MyLocationButton hidden={compassActive} />`: `<EmergencyLayersButton />` e `<EmergencyLayersPanel />`

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/components/`
Expected: PASS — inclusi gli smoke test esistenti di InteractiveMap.
Nota: se uno smoke test esistente fallisse sul nuovo `next/dynamic` in InteractiveMap, aggiungi in `jest.config.js` → `moduleNameMapper` un mock di `next/dynamic` che risolve subito il componente (pattern: mock che chiama la factory e ritorna il default export); non riscrivere i test esistenti.

- [x] **Step 5: Verifica manuale sul dev server**

Run: `npm run dev` → attiva ogni layer, controlla: pane sotto i tracciati, popup, attribution, badge sul pulsante ⚠️, persistenza al reload (layer riattivati). Con `FIRMS_MAP_KEY` mancante il layer focolai deve mostrare l'errore nel pannello senza rompere gli altri.

- [x] **Step 6: Commit**

```bash
git add src/components/map/emergency/EmergencyLayers.tsx src/components/map/InteractiveMap.tsx src/__tests__/components/EmergencyLayers.test.tsx
git commit -m "feat(emergency): orchestratore layer su mappa con pane, attribution e riattivazione"
```

---

### Task 12: Tasto Indietro mobile (back-nav)

**Files:**
- Modify: `src/lib/back-nav.ts`, `src/app/page.tsx` (backRef + backDepth), test esistente di back-nav (`src/__tests__/back-nav.test.ts`)

**Interfaces:**
- Consumes: `uiStore.emergencyPanelOpen`/`setEmergencyPanelOpen` (Task 10)
- Produces: `BackNavState` esteso con `emergencyPanelOpen: boolean`; nuova azione `'closeEmergencyPanel'`

- [x] **Step 1: Write the failing test (aggiunte a back-nav.test.ts)**

Nel test esistente ogni stato base andrà esteso col nuovo campo `emergencyPanelOpen: false` (aggiorna la fixture/helper esistente). Aggiungi:

```ts
test('pannello emergenza aperto → closeEmergencyPanel, con priorità dopo moreMenu', () => {
  expect(nextBackAction({ ...base, emergencyPanelOpen: true })).toBe('closeEmergencyPanel');
  expect(nextBackAction({ ...base, emergencyPanelOpen: true, moreMenuOpen: true })).toBe('closeMore');
  expect(nextBackAction({ ...base, emergencyPanelOpen: true, mapSettingsOpen: true })).toBe('closeEmergencyPanel');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/back-nav.test.ts`
Expected: FAIL — campo/azione inesistenti (errore TS).

- [x] **Step 3: Implementa**

`back-nav.ts`: aggiungi `emergencyPanelOpen: boolean;` a `BackNavState`, `'closeEmergencyPanel'` alla union `BackNavAction`, e in `nextBackAction` — subito dopo il check `moreMenuOpen`:

```ts
if (s.emergencyPanelOpen) return 'closeEmergencyPanel';
```

`page.tsx`: nel componente leggi `const emergencyPanelOpen = useUIStore((s) => s.emergencyPanelOpen);` e `const setEmergencyPanelOpen = useUIStore((s) => s.setEmergencyPanelOpen);`; in `backRef.current` passa `emergencyPanelOpen` allo stato e aggiungi il case:

```ts
case 'closeEmergencyPanel': setEmergencyPanelOpen(false); return true;
```

e in `backDepth` aggiungi `(emergencyPanelOpen ? 1 : 0) +`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/back-nav.test.ts`
Expected: PASS

- [x] **Step 5: Verifica manuale mobile (dev server, viewport mobile)**

Apri il pannello ⚠️ → tasto Indietro lo chiude senza uscire dall'app né cambiare tab.

- [x] **Step 6: Commit**

```bash
git add src/lib/back-nav.ts src/app/page.tsx src/__tests__/back-nav.test.ts
git commit -m "feat(emergency): tasto Indietro mobile chiude il pannello layer"
```

---

### Task 13: Esclusioni service worker

**Files:**
- Modify: `src/app/sw.ts`

**Interfaces:**
- Consumes: nulla di nuovo
- Produces: regole `NetworkOnly` PRIMA di `...defaultCache` (l'ordine è first-match-wins)

- [x] **Step 1: Implementa (niente unit test: il SW non gira in jsdom — verifica via build + manuale)**

In `src/app/sw.ts`: aggiungi `NetworkOnly` all'import da `'serwist'` e inserisci in `runtimeCaching` — **PRIMA** di `...defaultCache`:

```ts
// Dati di emergenza: MAI serviti da cache (dati stantii = rischio, non feature).
{ matcher: /\/api\/(fires|dpc-alerts)/, handler: new NetworkOnly() },
{ matcher: /^https:\/\/maps\.effis\.emergency\.copernicus\.eu\//i, handler: new NetworkOnly() },
{ matcher: /^https:\/\/raw\.githubusercontent\.com\/pcm-dpc\//i, handler: new NetworkOnly() },
```

- [x] **Step 2: Verify build**

Run: `npm run build`
Expected: build ok, service worker generato senza errori.

- [x] **Step 3: Commit**

```bash
git add src/app/sw.ts
git commit -m "feat(emergency): dati emergenza esclusi dal caching del service worker"
```

---

### Task 14: Release chores v0.11.0 + verifica finale

**Files:**
- Modify: `package.json` (version), `CHANGELOG.md`, `src/components/tutorial/WhatsNew.tsx`, `README.md`, `backlog/tasks/task-52 - Emergency-layers-fase-1-incendi-allerte-DPC.md`

**Interfaces:**
- Consumes: tutto il lavoro precedente
- Produces: release pronta per la review finale

- [x] **Step 1: Version bump + CHANGELOG**

`package.json`: `"version": "0.11.0"`. In `CHANGELOG.md` aggiungi in cima la sezione `## [0.11.0]` con data odierna: layer emergenza (focolai FIRMS, aree bruciate e FWI EFFIS, allerte meteo-idro/frane DPC), pannello ⚠️ sulla mappa, disclaimer, refresh automatico, esclusione dal caching offline — stile delle sezioni esistenti.

- [x] **Step 2: WhatsNew**

In `RELEASES` (in TESTA all'array, `src/components/tutorial/WhatsNew.tsx:76`):

```ts
{
  version: '0.11.0',
  date: '2026-08-25', // ← sostituire con la data effettiva del giorno di release

  steps: [
    {
      title: 'Layer di emergenza',
      text: 'Nuovo pulsante ⚠️ sulla mappa: attiva i layer con i focolai rilevati da satellite (NASA FIRMS), le aree bruciate e il pericolo incendio previsto (Copernicus EFFIS).',
      icon: '🔥',
    },
    {
      title: 'Allerte meteo-idro',
      text: 'Il layer Allerte DPC colora le zone di allerta della Protezione Civile (rischio idraulico, temporali e idrogeologico/frane), per oggi e domani, direttamente dal bollettino ufficiale.',
      icon: '🌊',
    },
    {
      title: 'Tocca per i dettagli',
      text: 'Ogni focolaio e ogni zona di allerta è tappabile: data di rilevamento, potenza, confidenza, livelli di criticità. Con legenda, orario di aggiornamento e fonti sempre visibili.',
      icon: '👆',
    },
  ],
},
```

- [x] **Step 3: README**

In `README.md`: aggiungi `FIRMS_MAP_KEY` al blocco `.env.local` (sezione setup, dopo ORS) con le due righe di commento su come ottenerla e che è server-only; nella tabella delle fonti/servizi aggiungi NASA FIRMS, Copernicus EFFIS e DPC (bollettini criticità, CC-BY 4.0).

- [x] **Step 4: Aggiorna task-52**

In `backlog/tasks/task-52 - Emergency-layers-fase-1-incendi-allerte-DPC.md`: spunta le voci "Piano di implementazione" e "Implementazione TDD"; la voce "Release v0.11.0" e lo status Done SOLO dopo il merge/release effettivi.

- [x] **Step 5: Verifica finale completa**

Run: `npm test` → Expected: PASS, ~600+ test.
Run: `npm run lint` → Expected: nessun errore.
Run: `npm run build` → Expected: build ok; annota il First Load JS della route `/` e confronta con ~253 kB (l'orchestratore è dynamic: l'aumento deve essere marginale).

- [x] **Step 6: Commit**

```bash
git add package.json CHANGELOG.md src/components/tutorial/WhatsNew.tsx README.md "backlog/tasks/task-52 - Emergency-layers-fase-1-incendi-allerte-DPC.md"
git commit -m "chore(release): v0.11.0 — layer di emergenza fase 1"
```

---

## Checklist manuale pre-merge (sessione principale, con l'utente)

Verificata il 2026-08-26 su dev server, in emulazione mobile con Chrome DevTools.

- [x] `FIRMS_MAP_KEY` reale in `.env.local`: i focolai compaiono (se ci sono incendi in Italia oggi)
      → 685 hotspot da 3 sensori VIIRS; `/api/fires` 200 con punti, `frp`/`confidence`/`acquiredAt` parsati
- [x] FWI EFFIS visibile e semi-trasparente sotto il tracciato; TIME corretto (data odierna)
      → GetMap 200 `image/png` con `TIME=2026-08-26`; il tracciato resta sopra (pane z-index 350).
      Nota: il MapServer di EFFIS richiede il parametro `STYLES`, che Leaflet manda di default
- [x] Selettore giorni: comportamento corretto prima/dopo le ~16:00 (bollettino di ieri vs oggi)
      → verificato nel caso reale del 26/08 mattina con bollettino `20260825_1415`:
      "Ieri 25/08" disabilitato, "Oggi 26/08" selezionato di default
- [x] Mobile: pannello come bottom sheet, tasto Indietro lo chiude, touch target ok
      → Indietro chiude il pannello senza uscire né ricaricare; sheet ora sopra la BottomNav
      (prima la copriva), con backdrop che chiude al tocco fuori
- [ ] Bollettino DPC del giorno: zone colorate coerenti con https://mappe.protezionecivile.gov.it,
      popup con i 3 rischi — **richiede confronto visivo con la mappa ufficiale**
- [ ] Offline (devtools): righe "non disponibile offline" nel pannello, nessun dato emergenza da cache
      → le righe sono state implementate e coperte da test; **la verifica del service worker
      richiede build di produzione** (`npm run build && npm start`), Serwist è disabilitato in dev
- [ ] Lighthouse a11y ≥ 97 — **non raggiunto: 92-96**. Le due failure sono preesistenti ed
      estranee a questo task: `aria-command-name` sui marker divIcon di Leaflet e
      `color-contrast` sui pulsanti della `BottomNav` (v0.10.0). Da valutare a parte

## Campagna di code review (2026-08-26)

Tre round di review approfondita sul diff `develop..feature/emergency-layers`, deduplicati in
29 problemi distinti e chiusi in quattro ondate. Dettaglio nel CHANGELOG v0.11.0, sezione Fixed.

- [x] Ondata A — bloccanti: propagazione dei click sugli overlay, sheet sopra la BottomNav,
      timeout che copre la lettura del body, errori DPC in italiano, punti fantasma a (0,0), focus ring
- [x] Ondata B — integrità dei dati: payload azzerato con il layer, stato d'errore reale per i WMS,
      stato `nodata` esplicito, tetto d'età sulla cache di discovery, TIME ricalcolato al cambio giorno,
      riselezione del giorno DPC, guardia in-flight, cache negativa, validazione dei payload, regex bollettino
- [x] Ondata C — perf e spec: renderer canvas + popup on-demand + tetto sui focolai, zone in una sola
      FeatureCollection, `params` WMS memoizzati, righe offline, 404 come "nessun dato", chiave FIRMS assente
- [x] Ondata D — test e contabilità: handler delle route API coperti davvero, harness del pane a prova
      di mutazione ed estesa a punti e zone, reset dello store nella suite del pannello, caselle del piano
