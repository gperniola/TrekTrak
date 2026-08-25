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
