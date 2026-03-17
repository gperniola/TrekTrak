const PROXY_URL = '/api/elevation';
// Server-side proxy may need up to 5s per upstream attempt (primary + fallback)
const TIMEOUT_MS = 12000;

function parseElevations(data: unknown): (number | null)[] {
  const results: unknown[] = (data as { results?: unknown[] })?.results ?? [];
  return results.map((r: unknown) => {
    const el = (r as { elevation?: number })?.elevation;
    return typeof el === 'number' && Number.isFinite(el) ? el : null;
  });
}

async function fetchFromProxy(locations: string): Promise<(number | null)[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `${PROXY_URL}?locations=${locations}`,
      { signal: controller.signal }
    );
    if (response.ok) {
      return parseElevations(await response.json());
    }
  } catch {
    // Proxy or network error
  } finally {
    clearTimeout(timer);
  }

  return null;
}

export async function fetchElevationProfile(
  points: [number, number][]
): Promise<(number | null)[]> {
  if (points.length === 0) return [];
  if (points.some(([lat, lon]) => !Number.isFinite(lat) || !Number.isFinite(lon))) {
    return points.map(() => null);
  }

  const locations = points.map(([lat, lon]) => `${lat},${lon}`).join('|');
  const result = await fetchFromProxy(locations);
  return result ?? points.map(() => null);
}

export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const result = await fetchFromProxy(`${lat},${lon}`);
  return result?.[0] ?? null;
}
