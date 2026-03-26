import LZString from 'lz-string';
import type { Waypoint, Leg } from './types';

const MAX_WAYPOINTS = 15;
const MAX_URL_LENGTH = 2000;

interface CompactItinerary {
  n: string;
  w: (string | number | null)[];
  l: (number | null)[];
}

export function encodeItinerary(
  name: string,
  waypoints: Waypoint[],
  legs: Leg[]
): string | null {
  if (waypoints.length > MAX_WAYPOINTS) return null;

  const compact: CompactItinerary = {
    n: name,
    w: waypoints.flatMap((wp) => [wp.name, wp.lat, wp.lon, wp.altitude]),
    l: legs.flatMap((lg) => [lg.distance, lg.elevationGain, lg.elevationLoss, lg.azimuth]),
  };

  const json = JSON.stringify(compact);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const hash = `#data=${compressed}`;

  if (hash.length > MAX_URL_LENGTH) return null;
  return hash;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function decodeItinerary(
  hash: string
): { name: string; waypoints: Waypoint[]; legs: Leg[] } | null {
  if (!hash.startsWith('#data=')) return null;
  const compressed = hash.slice(6);
  if (!compressed) return null;

  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;

    const data = JSON.parse(json) as CompactItinerary;
    if (typeof data.n !== 'string' || !Array.isArray(data.w) || !Array.isArray(data.l)) return null;
    if (data.w.length % 4 !== 0 || data.l.length % 4 !== 0) return null;

    if (data.n.length > 200) return null;

    const validNum = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? v : null;

    const waypoints: Waypoint[] = [];
    for (let i = 0; i < data.w.length; i += 4) {
      const name = data.w[i];
      if (typeof name !== 'string' || name.length > 100) return null;
      waypoints.push({
        id: generateId(),
        name,
        lat: validNum(data.w[i + 1]),
        lon: validNum(data.w[i + 2]),
        altitude: validNum(data.w[i + 3]),
        order: waypoints.length,
      });
    }

    const legs: Leg[] = [];
    for (let i = 0; i < data.l.length; i += 4) {
      if (legs.length >= waypoints.length - 1) break;
      const fromWp = waypoints[legs.length];
      const toWp = waypoints[legs.length + 1];
      legs.push({
        id: generateId(),
        fromWaypointId: fromWp.id,
        toWaypointId: toWp.id,
        distance: validNum(data.l[i]),
        elevationGain: validNum(data.l[i + 1]),
        elevationLoss: validNum(data.l[i + 2]),
        azimuth: validNum(data.l[i + 3]),
      });
    }

    return { name: data.n, waypoints, legs };
  } catch {
    return null;
  }
}
