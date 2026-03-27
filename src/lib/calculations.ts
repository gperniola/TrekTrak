import type { DifficultyGrade, Waypoint, Leg } from './types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function forwardAzimuth(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const dLon = toRad(lon2 - lon1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const x = Math.sin(dLon) * Math.cos(lat2R);
  const y =
    Math.cos(lat1R) * Math.sin(lat2R) -
    Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  const bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export function calculateMunterTime(
  distanceKm: number,
  elevationGainM: number,
  elevationLossM: number
): number {
  const d = Math.max(0, distanceKm);
  const g = Math.max(0, elevationGainM);
  const l = Math.max(0, elevationLossM);
  if (d === 0 && g === 0 && l === 0) return 0;
  const tHoriz = (d / 4) * 60;
  const tVertGain = (g / 400) * 60;
  const tVertLoss = (l / 800) * 60;
  const tVert = Math.max(tVertGain, tVertLoss);
  return Math.max(tHoriz, tVert) + 0.5 * Math.min(tHoriz, tVert);
}

export function calculateSlope(
  distanceKm: number,
  elevationGainM: number,
  elevationLossM: number
): number {
  const d = Math.max(0, distanceKm);
  if (d === 0) return 0;
  const maxElevation = Math.max(0, elevationGainM, elevationLossM);
  return (maxElevation / (d * 1000)) * 100;
}

/**
 * Approximate SAC-style difficulty from slope percentage.
 * Simplified heuristic -- the real SAC scale also considers
 * trail marking, exposure, and terrain type.
 */
export function calculateDifficulty(maxSlopePercent: number): DifficultyGrade {
  if (maxSlopePercent >= 55) return 'T6';
  if (maxSlopePercent >= 45) return 'T5';
  if (maxSlopePercent >= 35) return 'T4';
  if (maxSlopePercent >= 25) return 'T3';
  if (maxSlopePercent >= 15) return 'T2';
  return 'T1';
}

/**
 * Interpolate numPoints equidistant points along a straight line in lat/lon space from A to B.
 * For short distances this closely approximates the great-circle path.
 * Returns array of exactly numPoints elements, including A and B as first/last.
 */
export function interpolatePoints(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  numPoints: number
): [number, number][] {
  if (numPoints < 2) return [[lat1, lon1], [lat2, lon2]];
  const points: [number, number][] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    points.push([
      lat1 + t * (lat2 - lat1),
      lon1 + t * (lon2 - lon1),
    ]);
  }
  return points;
}

/**
 * Calculate cumulative elevation gain and loss from a profile of elevations.
 * Returns null values if fewer than 2 valid elevation points are available.
 */
export function cumulativeElevation(
  elevations: (number | null)[]
): { gain: number | null; loss: number | null } {
  let gain = 0;
  let loss = 0;
  let prev: number | null = null;
  let validPairs = 0;
  for (const el of elevations) {
    if (el != null && prev != null) {
      const diff = el - prev;
      if (diff > 0) gain += diff;
      else loss += -diff;
      validPairs++;
    }
    if (el != null) prev = el;
  }
  if (validPairs === 0) return { gain: null, loss: null };
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

const SLOPE_COLORS = [
  { threshold: 30, color: '#ef4444' },
  { threshold: 20, color: '#fb923c' },
  { threshold: 10, color: '#facc15' },
] as const;

export function slopeColor(slopePercent: number): string {
  const abs = Math.abs(slopePercent);
  for (const { threshold, color } of SLOPE_COLORS) {
    if (abs >= threshold) return color;
  }
  return '#4ade80';
}

/**
 * Return the sampling interval in meters.
 * When a user-chosen interval is provided, it is used directly.
 * Otherwise falls back to the legacy adaptive heuristic.
 */
export function sampleInterval(distanceM: number, userInterval?: number): number {
  if (userInterval != null && userInterval > 0) return userInterval;
  return distanceM > 500 ? 50 : 20;
}

export interface GradientStop {
  offset: string;
  color: string;
}

/**
 * Smooth altitude values with a weighted moving average to reduce DEM noise.
 * Window size 5 with weights [1, 2, 3, 2, 1]. Preserves first and last values.
 */
export function smoothAltitudes(data: { distance: number; altitude: number }[]): number[] {
  const altitudes = data.map((d) => d.altitude);
  if (altitudes.length <= 4) return altitudes;
  const smoothed = [...altitudes];
  for (let i = 2; i < altitudes.length - 2; i++) {
    smoothed[i] = (
      altitudes[i - 2] + 2 * altitudes[i - 1] + 3 * altitudes[i] + 2 * altitudes[i + 1] + altitudes[i + 2]
    ) / 9;
  }
  // Smooth edges with a 3-point window
  if (altitudes.length > 2) {
    smoothed[1] = (altitudes[0] + 2 * altitudes[1] + altitudes[2]) / 4;
    smoothed[altitudes.length - 2] = (
      altitudes[altitudes.length - 3] + 2 * altitudes[altitudes.length - 2] + altitudes[altitudes.length - 1]
    ) / 4;
  }
  return smoothed;
}

export function buildGradientStops(
  data: { distance: number; altitude: number }[],
  totalDistance: number
): GradientStop[] {
  if (data.length < 2 || totalDistance === 0) return [];

  const smoothed = smoothAltitudes(data);
  const stops: GradientStop[] = [];
  let prevColor: string | null = null;
  for (let i = 0; i < data.length - 1; i++) {
    const dx = data[i + 1].distance - data[i].distance;
    const dy = Math.abs(smoothed[i + 1] - smoothed[i]);
    // slope %: dy (m) / dx (km→m) * 100
    const slope = dx > 0 ? (dy / (dx * 1000)) * 100 : 0;
    const color = slopeColor(slope);
    const offsetStart = `${Math.min(100, Math.max(0, (data[i].distance / totalDistance) * 100)).toFixed(2)}%`;
    const offsetEnd = `${Math.min(100, Math.max(0, (data[i + 1].distance / totalDistance) * 100)).toFixed(2)}%`;

    if (color !== prevColor) {
      stops.push({ offset: offsetStart, color });
    }
    stops.push({ offset: offsetEnd, color });
    prevColor = color;
  }
  return stops;
}

export function azimuthToCardinal(azimuth: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((azimuth % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Given a cumulative distance (km) along the itinerary, return the [lat, lon]
 * position by interpolating along the legs (straight-line between waypoints).
 */
export function distanceToPosition(
  distance: number,
  waypoints: Waypoint[],
  legs: Leg[]
): [number, number] | null {
  if (waypoints.length === 0 || distance < 0) return null;
  if (waypoints.length === 1) {
    if (distance === 0 && waypoints[0].lat != null && waypoints[0].lon != null) {
      return [waypoints[0].lat, waypoints[0].lon];
    }
    return null;
  }

  let cumulative = 0;
  for (const leg of legs) {
    const from = waypoints.find((w) => w.id === leg.fromWaypointId);
    const to = waypoints.find((w) => w.id === leg.toWaypointId);
    if (!from || !to || from.lat == null || from.lon == null || to.lat == null || to.lon == null) continue;
    const legDist = leg.distance ?? 0;
    if (legDist <= 0) continue;

    if (distance <= cumulative + legDist + 0.0001) {
      const remaining = distance - cumulative;

      // Use routeGeometry when available for accurate trail positioning
      if (leg.routeGeometry && leg.routeGeometry.length >= 2) {
        return interpolateAlongPolyline(leg.routeGeometry, remaining, legDist);
      }

      // Fallback: linear interpolation between endpoints
      const t = Math.max(0, Math.min(1, remaining / legDist));
      return [
        from.lat + t * (to.lat - from.lat),
        from.lon + t * (to.lon - from.lon),
      ];
    }
    cumulative += legDist;
  }
  return null;
}

/** Compute the total haversine length of a polyline. */
function polylineLength(coords: [number, number][]): number {
  let len = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    len += haversineDistance(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return len;
}

/** Interpolate a position along a polyline at a given distance (km).
 *  `totalDist` is the ORS-reported leg distance which may differ from the
 *  haversine sum of the polyline vertices, so we scale internally. */
function interpolateAlongPolyline(
  coords: [number, number][],
  targetDist: number,
  totalDist: number
): [number, number] {
  if (targetDist <= 0) return coords[0];
  if (targetDist >= totalDist) return coords[coords.length - 1];

  // Scale target from ORS-distance space to haversine-polyline space
  const polyLen = polylineLength(coords);
  if (polyLen <= 0) return coords[0];
  const scaledTarget = targetDist * (polyLen / totalDist);

  let walked = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const segLen = haversineDistance(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    if (walked + segLen >= scaledTarget - 0.0001) {
      const t = segLen > 0 ? Math.max(0, Math.min(1, (scaledTarget - walked) / segLen)) : 0;
      return [
        coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
        coords[i][1] + t * (coords[i + 1][1] - coords[i][1]),
      ];
    }
    walked += segLen;
  }
  return coords[coords.length - 1];
}

/**
 * Given a [lat, lon] position, find the closest point on the itinerary path
 * and return its cumulative distance (km) from the start.
 */
export function positionToDistance(
  lat: number, lon: number,
  waypoints: Waypoint[],
  legs: Leg[]
): number | null {
  if (waypoints.length < 2 || legs.length === 0) return null;

  let bestDist = Infinity;
  let bestCumulative = 0;
  let cumulative = 0;

  for (const leg of legs) {
    const from = waypoints.find((w) => w.id === leg.fromWaypointId);
    const to = waypoints.find((w) => w.id === leg.toWaypointId);
    if (!from || !to || from.lat == null || from.lon == null || to.lat == null || to.lon == null) continue;
    const legDist = leg.distance ?? 0;
    if (legDist <= 0) continue;

    if (leg.routeGeometry && leg.routeGeometry.length >= 2) {
      // Project onto each segment of the route polyline
      const polyLen = polylineLength(leg.routeGeometry);
      const scale = polyLen > 0 ? legDist / polyLen : 1;
      let walked = 0;
      for (let i = 0; i < leg.routeGeometry.length - 1; i++) {
        const a = leg.routeGeometry[i];
        const b = leg.routeGeometry[i + 1];
        const segLen = haversineDistance(a[0], a[1], b[0], b[1]);

        const cosL = Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
        const dx = b[0] - a[0];
        const dy = (b[1] - a[1]) * cosL;
        const pxLat = lat - a[0];
        const pxLon = (lon - a[1]) * cosL;
        const lenSq = dx * dx + dy * dy;
        let t = 0;
        if (lenSq > 0) {
          t = Math.max(0, Math.min(1, (pxLat * dx + pxLon * dy) / lenSq));
        }
        const projLat = a[0] + t * (b[0] - a[0]);
        const projLon = a[1] + t * (b[1] - a[1]);
        const dist = haversineDistance(lat, lon, projLat, projLon);
        if (dist < bestDist) {
          bestDist = dist;
          // Scale from haversine-polyline space back to ORS-distance space
          bestCumulative = cumulative + (walked + t * segLen) * scale;
        }
        walked += segLen;
      }
    } else {
      // Fallback: project onto straight line between endpoints
      const cosLat = Math.cos(((from.lat + to.lat) / 2) * Math.PI / 180);
      const dx = to.lat - from.lat;
      const dy = (to.lon - from.lon) * cosLat;
      const pxLat = lat - from.lat;
      const pxLon = (lon - from.lon) * cosLat;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 0) {
        t = Math.max(0, Math.min(1, (pxLat * dx + pxLon * dy) / lenSq));
      }
      const projLat = from.lat + t * (to.lat - from.lat);
      const projLon = from.lon + t * (to.lon - from.lon);
      const dist = haversineDistance(lat, lon, projLat, projLon);
      if (dist < bestDist) {
        bestDist = dist;
        bestCumulative = cumulative + t * legDist;
      }
    }
    cumulative += legDist;
  }

  return bestDist < Infinity ? bestCumulative : null;
}
