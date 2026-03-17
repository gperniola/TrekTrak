const OPENTOPO_URL = 'https://api.opentopodata.org/v1/eudem25m';
const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';
const TIMEOUT_MS = 5000;

// Matches one or more pipe-separated "lat,lon" pairs (e.g. "46.0,11.0|46.1,11.1")
const COORD_PAIR = '-?\\d{1,3}(\\.\\d+)?,-?\\d{1,3}(\\.\\d+)?';
export const LOCATION_RE = new RegExp(`^${COORD_PAIR}(\\|${COORD_PAIR})*$`);

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type ProxyResult =
  | { status: 200; data: unknown }
  | { status: 400 | 502; error: string };

function validateCoordinateRanges(locations: string): boolean {
  return locations.split('|').every((pair) => {
    const [lat, lon] = pair.split(',').map(Number);
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  });
}

export async function fetchElevationUpstream(locations: string): Promise<ProxyResult> {
  if (!locations || !LOCATION_RE.test(locations) || !validateCoordinateRanges(locations)) {
    return { status: 400, error: 'Invalid or missing locations parameter' };
  }

  // Try OpenTopoData first
  try {
    const response = await fetchWithTimeout(
      `${OPENTOPO_URL}?locations=${encodeURIComponent(locations)}`,
      TIMEOUT_MS
    );
    if (response.ok) {
      const data = await response.json();
      return { status: 200, data };
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: Open-Elevation
  try {
    const response = await fetchWithTimeout(
      `${OPEN_ELEVATION_URL}?locations=${encodeURIComponent(locations)}`,
      TIMEOUT_MS
    );
    if (response.ok) {
      const data = await response.json();
      return { status: 200, data };
    }
  } catch {
    // Both failed
  }

  return { status: 502, error: 'Elevation services unavailable' };
}
