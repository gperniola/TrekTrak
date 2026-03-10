const OPENTOPO_URL = 'https://api.opentopodata.org/v1/eudem25m';
const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';
const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  // Try OpenTopoData first
  try {
    const response = await fetchWithTimeout(
      `${OPENTOPO_URL}?locations=${lat},${lon}`,
      TIMEOUT_MS
    );
    if (response.ok) {
      const data = await response.json();
      const elevation = data?.results?.[0]?.elevation;
      if (typeof elevation === 'number') return elevation;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: Open-Elevation
  try {
    const response = await fetchWithTimeout(
      `${OPEN_ELEVATION_URL}?locations=${lat},${lon}`,
      TIMEOUT_MS
    );
    if (response.ok) {
      const data = await response.json();
      const elevation = data?.results?.[0]?.elevation;
      if (typeof elevation === 'number') return elevation;
    }
  } catch {
    // Both failed
  }

  return null;
}
