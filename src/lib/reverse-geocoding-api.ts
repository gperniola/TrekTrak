const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const TIMEOUT_MS = 5000;
const MAX_NAME_LENGTH = 30;
// Nominatim usage policy: at most 1 request per second.
// We enforce a 1100ms minimum gap between consecutive requests to stay safely below the limit.
const NOMINATIM_MIN_INTERVAL_MS = 1100;

/** Address fields checked in hiking-priority order when no top-level name exists. */
const HIKING_ADDRESS_FIELDS = [
  'peak',
  'alpine_hut',
  'wilderness_hut',
  'saddle',
  'mountain_pass',
  'tourism',
  'natural',
  'hamlet',
  'village',
  'town',
  'suburb',
  'neighbourhood',
] as const;

/** Abbreviation rules applied in order (case-insensitive prefix match). */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/^Rifugio\b/i, 'Rif.'],
  [/^Monte\b/i, 'M.te'],
  [/^Sentiero\b/i, 'Sent.'],
  [/^Bivacco\b/i, 'Biv.'],
  [/^Malga\b/i, 'Mlg.'],
];

function applyAbbreviations(name: string): string {
  for (const [pattern, replacement] of ABBREVIATIONS) {
    if (pattern.test(name)) {
      return name.replace(pattern, replacement);
    }
  }
  return name;
}

function truncate(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return name.slice(0, MAX_NAME_LENGTH) + '…';
}

/**
 * Extracts a short hiking-friendly name from a Nominatim reverse-geocoding response.
 * Returns null if no useful name is found.
 */
export function extractHikingName(data: unknown): string | null {
  if (data === null || data === undefined || typeof data !== 'object') return null;

  const record = data as Record<string, unknown>;

  // 1. Try top-level `name` first (most specific)
  if (typeof record.name === 'string' && record.name.trim().length > 0) {
    return truncate(applyAbbreviations(record.name.trim()));
  }

  // 2. Try hiking-priority address fields
  const address = record.address;
  if (address !== null && address !== undefined && typeof address === 'object') {
    const addrRecord = address as Record<string, unknown>;
    for (const field of HIKING_ADDRESS_FIELDS) {
      const value = addrRecord[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        return truncate(applyAbbreviations(value.trim()));
      }
    }
  }

  return null;
}

// Module-level chain of pending reverseGeocode calls. Each new request waits
// for the previous one to finish (or for the min-interval to elapse) before
// starting its own network call. This serialises calls and enforces Nominatim's
// 1 req/s policy even when the user adds waypoints in rapid succession.
let nominatimChain: Promise<unknown> = Promise.resolve();
let lastNominatimAt = 0;

async function rateLimitedFetch(url: string, init: RequestInit): Promise<Response> {
  const elapsed = Date.now() - lastNominatimAt;
  const wait = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - elapsed);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
  return fetch(url, init);
}

/**
 * Calls the Nominatim reverse geocoding API and returns a hiking-friendly name,
 * or null on error / when no useful name is found.
 * Requests are serialised at module level to respect Nominatim's 1 req/s rate limit.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // Chain this call after any previously queued call. The chain is best-effort:
  // we always proceed even if a previous link rejects.
  const myTurn = nominatimChain.catch(() => undefined);
  nominatimChain = myTurn.then(async () => {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), TIMEOUT_MS);

    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        format: 'json',
        zoom: '18',
        addressdetails: '1',
      });

      const response = await rateLimitedFetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
        signal: timeoutController.signal,
        headers: {
          'Accept-Language': 'it,en',
          'User-Agent': 'TrekTrak/1.0 (didactic cartography app)',
        },
      });

      if (!response.ok) return null;

      const data: unknown = await response.json();
      return extractHikingName(data);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  });

  return nominatimChain as Promise<string | null>;
}
