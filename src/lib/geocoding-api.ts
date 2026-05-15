const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_MS = 5000;

export interface GeocodingResult {
  displayName: string;
  lat: number;
  lon: number;
  type: string;
  boundingbox?: [number, number, number, number]; // [south, north, west, east]
}

export interface SearchOptions {
  /** Optional viewbox to bias results [west, south, east, north]. Nominatim format. */
  viewbox?: { west: number; south: number; east: number; north: number };
}

export async function searchLocation(
  query: string,
  signal?: AbortSignal,
  options?: SearchOptions
): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 3) return [];

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), TIMEOUT_MS);

  // Combine caller signal (cancellation) with timeout signal.
  // Use AbortSignal.any when available (Chrome 116+/Safari 17+), otherwise
  // bridge manually so older browsers keep working.
  let combinedSignal: AbortSignal;
  if (signal && typeof (AbortSignal as { any?: unknown }).any === 'function') {
    combinedSignal = (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([signal, timeoutController.signal]);
  } else if (signal) {
    const bridgeAbort = () => timeoutController.abort();
    if (signal.aborted) timeoutController.abort();
    else signal.addEventListener('abort', bridgeAbort, { once: true });
    combinedSignal = timeoutController.signal;
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      limit: '8',
      addressdetails: '0',
    });
    // TASK-9: map-bias. viewbox + bounded=0 means results inside the box come
    // first, but global matches still appear afterwards. Helps disambiguate
    // toponyms like "Corno Grande" (Bolzano vs Abruzzo).
    if (options?.viewbox) {
      const { west, south, east, north } = options.viewbox;
      params.set('viewbox', `${west},${south},${east},${north}`);
      params.set('bounded', '0');
    }

    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: combinedSignal,
      headers: {
        'Accept-Language': 'it,en',
        'User-Agent': 'TrekTrak/1.0 (didactic cartography app)',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((item: Record<string, unknown>) =>
        typeof item.lat === 'string' && typeof item.lon === 'string' && typeof item.display_name === 'string'
      )
      .map((item: Record<string, unknown>) => {
        const result: GeocodingResult = {
          displayName: item.display_name as string,
          lat: parseFloat(item.lat as string),
          lon: parseFloat(item.lon as string),
          type: (item.type as string) ?? '',
        };
        // Parse boundingbox for adaptive zoom
        if (Array.isArray(item.boundingbox) && item.boundingbox.length === 4) {
          const bb = (item.boundingbox as string[]).map(Number);
          if (bb.every(Number.isFinite)) {
            result.boundingbox = bb as [number, number, number, number];
          }
        }
        return result;
      })
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
