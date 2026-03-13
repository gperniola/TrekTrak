const PROXY_URL = '/api/elevation';
// Server-side proxy may need up to 5s per upstream attempt (primary + fallback)
const TIMEOUT_MS = 12000;

export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `${PROXY_URL}?locations=${lat},${lon}`,
      { signal: controller.signal }
    );
    if (response.ok) {
      const data = await response.json();
      const elevation = data?.results?.[0]?.elevation;
      if (typeof elevation === 'number' && Number.isFinite(elevation)) return elevation;
    }
  } catch {
    // Proxy or network error
  } finally {
    clearTimeout(timer);
  }

  return null;
}
