import { useItineraryStore } from '@/stores/itineraryStore';
import { fetchElevation, fetchElevationProfile } from '@/lib/elevation-api';
import { haversineDistance, forwardAzimuth, interpolatePoints, cumulativeElevation, sampleInterval } from '@/lib/calculations';
import { fetchTrailRoute } from '@/lib/routing-api';
import type { Leg } from '@/lib/types';

// Generation counter to cancel stale auto-fill operations
let autoFillGeneration = 0;

// Round to ~1m precision (6 decimal degrees of latitude ≈ 0.11m) so
// the elevation cache hits across float-precision drift on the same physical point.
function elevationCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

async function getCachedElevation(
  lat: number, lon: number,
  cache: Map<string, number | null>
): Promise<number | null> {
  const key = elevationCacheKey(lat, lon);
  if (cache.has(key)) return cache.get(key) ?? null;
  const result = await fetchElevation(lat, lon);
  cache.set(key, result);
  return result;
}

async function autoFillLegClassic(
  leg: Leg,
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  updateWaypoint: ReturnType<typeof useItineraryStore.getState>['updateWaypoint'],
  updateLeg: ReturnType<typeof useItineraryStore.getState>['updateLeg'],
  isStale: () => boolean,
  elevationCache: Map<string, number | null>
) {
  const distanceKm = haversineDistance(fromLat, fromLon, toLat, toLon);
  const legUpdate: Partial<Leg> = {
    distance: Math.round(distanceKm * 1000) / 1000,
    azimuth: Math.round(forwardAzimuth(fromLat, fromLon, toLat, toLon) * 10) / 10,
    routeGeometry: undefined,
  };

  // Skip elevation profile for zero/near-zero distance legs (< 1m)
  const distanceM = distanceKm * 1000;
  if (distanceM < 1) {
    if (isStale()) return;
    updateLeg(leg.id, legUpdate);
    return;
  }

  const userInterval = useItineraryStore.getState().settings.mapDisplay.sampleInterval;
  const numPoints = Math.max(2, Math.ceil(distanceM / sampleInterval(distanceM, userInterval)));
  const points = interpolatePoints(fromLat, fromLon, toLat, toLon, numPoints);

  // Check cache for all points, identify which need fetching
  const elevations: (number | null)[] = points.map(([lat, lon]) => {
    const key = elevationCacheKey(lat, lon);
    return elevationCache.has(key) ? (elevationCache.get(key) ?? null) : null;
  });
  const uncachedIndices = points
    .map((_, i) => i)
    .filter((i) => !elevationCache.has(elevationCacheKey(points[i][0], points[i][1])));

  if (uncachedIndices.length > 0) {
    const uncachedPoints = uncachedIndices.map((i) => points[i]);
    const fetched = await fetchElevationProfile(uncachedPoints);
    if (isStale()) return;
    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      const [lat, lon] = points[idx];
      elevationCache.set(elevationCacheKey(lat, lon), fetched[j]);
      elevations[idx] = fetched[j];
    }
  }

  // Update waypoint altitudes from first/last sample
  const freshWaypoints = useItineraryStore.getState().waypoints;
  const fromWp = freshWaypoints.find((w) => w.id === leg.fromWaypointId);
  const toWp = freshWaypoints.find((w) => w.id === leg.toWaypointId);
  const firstEl = elevations[0];
  const lastEl = elevations[elevations.length - 1];
  if (fromWp && fromWp.altitude == null && firstEl != null) {
    updateWaypoint(leg.fromWaypointId, { altitude: Math.round(firstEl) });
  }
  if (toWp && toWp.altitude == null && lastEl != null) {
    updateWaypoint(leg.toWaypointId, { altitude: Math.round(lastEl) });
  }

  // Calculate cumulative D+/D- from the full elevation profile
  const { gain, loss } = cumulativeElevation(elevations);
  if (gain != null) legUpdate.elevationGain = gain;
  if (loss != null) legUpdate.elevationLoss = loss;

  // Build elevation profile for chart rendering
  const profileData: { distance: number; altitude: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (elevations[i] != null) {
      const pointDist = (i / (points.length - 1)) * distanceKm;
      profileData.push({ distance: Math.round(pointDist * 10000) / 10000, altitude: elevations[i]! });
    }
  }
  if (profileData.length >= 2) {
    legUpdate.elevationProfile = profileData;
  }

  if (isStale()) return;
  updateLeg(leg.id, legUpdate);
}

async function autoFillLegGuided(
  leg: Leg,
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  fromWpName: string, toWpName: string,
  updateWaypoint: ReturnType<typeof useItineraryStore.getState>['updateWaypoint'],
  updateLeg: ReturnType<typeof useItineraryStore.getState>['updateLeg'],
  isStale: () => boolean,
  routingWarnings: string[],
  elevationCache: Map<string, number | null>
) {
  const route = await fetchTrailRoute(fromLat, fromLon, toLat, toLon);
  if (isStale()) return;

  if (route) {
    const legUpdate: Partial<Leg> = {
      distance: Math.round(route.distanceKm * 1000) / 1000,
      azimuth: Math.round(forwardAzimuth(fromLat, fromLon, toLat, toLon) * 10) / 10,
      elevationGain: Math.round(route.ascent),
      elevationLoss: Math.round(route.descent),
      routeGeometry: route.geometry,
      elevationProfile: route.elevationProfile.length >= 2 ? route.elevationProfile : undefined,
    };

    // Fill waypoint altitudes from ORS route data (same elevation source as D+/D-)
    const freshWps = useItineraryStore.getState().waypoints;
    const fromWp = freshWps.find((w) => w.id === leg.fromWaypointId);
    const toWp = freshWps.find((w) => w.id === leg.toWaypointId);
    if (fromWp && fromWp.altitude == null && route.fromElevation != null) {
      updateWaypoint(fromWp.id, { altitude: Math.round(route.fromElevation) });
    }
    if (toWp && toWp.altitude == null && route.toElevation != null) {
      updateWaypoint(toWp.id, { altitude: Math.round(route.toElevation) });
    }
    if (isStale()) return;

    updateLeg(leg.id, legUpdate);
  } else {
    // Fallback to classic with non-blocking warning
    console.warn(`[TrekTrak] Nessun sentiero trovato tra "${fromWpName || '?'}" e "${toWpName || '?'}". Fallback linea d'aria.`);
    routingWarnings.push(`${fromWpName || '?'} → ${toWpName || '?'}`);
    if (isStale()) return;
    await autoFillLegClassic(leg, fromLat, fromLon, toLat, toLon, updateWaypoint, updateLeg, isStale, elevationCache);
  }
}

export async function autoFillTrackData(waypointId: string) {
  const generation = ++autoFillGeneration;
  const store = useItineraryStore.getState();
  const useTrailRouting = store.settings.mapDisplay.trailRouting;
  const isStale = () =>
    autoFillGeneration !== generation ||
    useItineraryStore.getState().appMode !== 'track';

  const { updateWaypoint, updateLeg } = store;
  const waypoints = store.waypoints;
  const legs = store.legs;
  const routingWarnings: string[] = [];
  const elevationCache = new Map<string, number | null>();

  const wp = waypoints.find((w) => w.id === waypointId);
  if (!wp || wp.lat == null || wp.lon == null) return;

  // In classic mode, fetch elevation for this waypoint
  // In trail routing mode, defer to ORS-provided elevation for consistency
  if (!useTrailRouting) {
    const currentWp = useItineraryStore.getState().waypoints.find((w) => w.id === wp.id);
    if (currentWp && currentWp.altitude == null) {
      const wpElevation = await getCachedElevation(wp.lat, wp.lon, elevationCache);
      if (isStale()) return;
      if (wpElevation != null) {
        updateWaypoint(wp.id, { altitude: Math.round(wpElevation) });
      }
    }
  }

  // Find and update adjacent legs
  const adjacentLegs = legs.filter(
    (l) => l.fromWaypointId === wp.id || l.toWaypointId === wp.id
  );
  for (const leg of adjacentLegs) {
    if (isStale()) return;

    const freshWaypoints = useItineraryStore.getState().waypoints;
    const fromWp = freshWaypoints.find((w) => w.id === leg.fromWaypointId);
    const toWp = freshWaypoints.find((w) => w.id === leg.toWaypointId);
    if (!fromWp || !toWp) continue;
    if (fromWp.lat == null || fromWp.lon == null || toWp.lat == null || toWp.lon == null) continue;

    if (useTrailRouting) {
      await autoFillLegGuided(
        leg, fromWp.lat, fromWp.lon, toWp.lat, toWp.lon,
        fromWp.name, toWp.name,
        updateWaypoint, updateLeg, isStale, routingWarnings, elevationCache
      );
    } else {
      await autoFillLegClassic(
        leg, fromWp.lat, fromWp.lon, toWp.lat, toWp.lon,
        updateWaypoint, updateLeg, isStale, elevationCache
      );
    }
  }

  if (routingWarnings.length > 0 && !isStale()) {
    console.warn(`[TrekTrak] Nessun sentiero trovato per: ${routingWarnings.join(', ')}. Usato calcolo in linea d'aria.`);
    // TASK-6: surface the fallback to the user via toast so they know the path
    // shown is a straight line, not the real sentiero. Lazy-import to keep this
    // pure-logic module free of UI deps in tests.
    try {
      const mod = await import('@/stores/notificationStore');
      const list = routingWarnings.slice(0, 3).join(', ') + (routingWarnings.length > 3 ? ' …' : '');
      mod.toast.warning(`Sentiero non trovato per ${routingWarnings.length} tratta/e (${list}). Usata linea d'aria.`, 6000);
    } catch {
      // best-effort
    }
  }
}

/**
 * Refill all legs.
 * @param onlyMissing if true, skip waypoints whose adjacent legs are already populated.
 *                    Used after TASK-15 mode-restore and on itinerary load: a leg is
 *                    considered "missing" if it has no distance, OR (in trail-routing mode)
 *                    no routeGeometry. This preserves the trail geometry of routes loaded
 *                    from the cloud (Fase 5) while still reconstructing legs that lack it
 *                    (e.g. share-URL imports or pre-Fase-5 saves).
 */
export async function autoFillAllTrackData(onlyMissing: boolean = false) {
  const store = useItineraryStore.getState();
  if (store.appMode !== 'track') return;
  const useTrailRouting = store.settings.mapDisplay.trailRouting;
  // Process only the "from" waypoint of each leg to avoid double-processing shared legs
  const processed = new Set<string>();
  const { waypoints, legs } = store;
  const needsFill = (wpId: string): boolean => {
    if (!onlyMissing) return true;
    return legs.some(
      (l) => (l.fromWaypointId === wpId || l.toWaypointId === wpId)
        && (l.distance == null || (useTrailRouting && l.routeGeometry == null)),
    );
  };
  for (const leg of legs) {
    if (useItineraryStore.getState().appMode !== 'track') return;
    if (!processed.has(leg.fromWaypointId) && needsFill(leg.fromWaypointId)) {
      const wp = waypoints.find((w) => w.id === leg.fromWaypointId);
      if (wp && wp.lat != null && wp.lon != null) {
        await autoFillTrackData(wp.id);
        processed.add(wp.id);
      }
    }
  }
  // Process the last waypoint (only a "to", never a "from" for its inbound leg)
  if (legs.length > 0) {
    const lastLeg = legs[legs.length - 1];
    if (!processed.has(lastLeg.toWaypointId) && needsFill(lastLeg.toWaypointId)) {
      const wp = waypoints.find((w) => w.id === lastLeg.toWaypointId);
      if (wp && wp.lat != null && wp.lon != null) {
        if (useItineraryStore.getState().appMode !== 'track') return;
        await autoFillTrackData(wp.id);
      }
    }
  }
}
