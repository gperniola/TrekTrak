const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface HikingPOI {
  lat: number;
  lon: number;
  name?: string;
  type: string;
}

export interface OverpassBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

export function buildOverpassQuery(bounds: OverpassBounds): string {
  const { south, north, west, east } = bounds;
  const bbox = `${south},${west},${north},${east}`;

  return [
    '[out:json][timeout:8];',
    '(',
    `  node[natural=peak](${bbox});`,
    `  node[natural=saddle](${bbox});`,
    `  node[mountain_pass=yes](${bbox});`,
    `  node[natural=spring](${bbox});`,
    `  node[tourism=alpine_hut](${bbox});`,
    `  node[tourism=wilderness_hut](${bbox});`,
    `  way[tourism=alpine_hut](${bbox});`,
    `  way[tourism=wilderness_hut](${bbox});`,
    `  node[highway~"path|footway"][sac_scale](${bbox});`,
    `  way[highway~"path|footway"][sac_scale](${bbox});`,
    ');',
    'out center 200;',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

// Priority: sac_scale trail nodes first (most common from way queries),
// then mountain_pass (boolean tag), then natural/tourism tag values.
function resolveType(tags: Record<string, string>): string {
  if (tags.sac_scale) return 'trail_node';
  if (tags.mountain_pass === 'yes') return 'mountain_pass';
  if (tags.natural) return tags.natural;
  if (tags.tourism) return tags.tourism;
  return 'unknown';
}

export function parseOverpassResponse(data: unknown): HikingPOI[] {
  if (!data) return [];

  const response = data as OverpassResponse;
  const elements = response.elements;
  if (!Array.isArray(elements) || elements.length === 0) return [];

  const pois: HikingPOI[] = [];

  for (const el of elements) {
    // Determine coordinates: direct for nodes, center for ways/relations
    let lat: number | undefined;
    let lon: number | undefined;

    if (typeof el.lat === 'number' && typeof el.lon === 'number') {
      lat = el.lat;
      lon = el.lon;
    } else if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
      lat = el.center.lat;
      lon = el.center.lon;
    }

    if (lat === undefined || lon === undefined) continue;

    const tags = el.tags ?? {};
    const type = resolveType(tags);
    const poi: HikingPOI = { lat, lon, type };
    if (tags.name) poi.name = tags.name;

    pois.push(poi);
  }

  return pois;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  pois: HikingPOI[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function boundsToKey(bounds: OverpassBounds): string {
  const s = roundTo(bounds.south, 2);
  const n = roundTo(bounds.north, 2);
  const w = roundTo(bounds.west, 2);
  const e = roundTo(bounds.east, 2);
  return `${s},${n},${w},${e}`;
}

// ---------------------------------------------------------------------------
// Public fetch function
// ---------------------------------------------------------------------------

export async function fetchHikingPOIs(bounds: OverpassBounds): Promise<HikingPOI[]> {
  const key = boundsToKey(bounds);
  const now = Date.now();

  // Prune expired entries to prevent unbounded memory growth
  if (cache.size > 20) {
    cache.forEach((v, k) => {
      if (v.expiresAt <= now) cache.delete(k);
    });
  }

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.pois;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const query = buildOverpassQuery(bounds);
    const body = `data=${encodeURIComponent(query)}`;

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TrekTrak/1.0 (didactic cartography app)',
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const data = await response.json();
    const pois = parseOverpassResponse(data);

    cache.set(key, { pois, expiresAt: now + CACHE_TTL_MS });
    return pois;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
