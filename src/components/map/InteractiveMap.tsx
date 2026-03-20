'use client';

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useCallback, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { fetchElevation, fetchElevationProfile } from '@/lib/elevation-api';
import { haversineDistance, forwardAzimuth, interpolatePoints, cumulativeElevation, sampleInterval, slopeColor, smoothAltitudes } from '@/lib/calculations';
import { fetchTrailRoute } from '@/lib/routing-api';
import { LocationSearch } from './LocationSearch';
import type { Leg } from '@/lib/types';

// Icon cache to avoid recreating on every render
const iconCache = new Map<number, L.DivIcon>();

function greenIcon(label: number) {
  if (iconCache.has(label)) return iconCache.get(label)!;
  const icon = L.divIcon({
    className: '',
    html: `<div style="background:#4ade80;color:#000;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid #fff;">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  iconCache.set(label, icon);
  return icon;
}

// Generation counter to cancel stale auto-fill operations
let autoFillGeneration = 0;

async function getCachedElevation(
  lat: number, lon: number,
  cache: Map<string, number | null>
): Promise<number | null> {
  const key = `${lat},${lon}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const result = await fetchElevation(lat, lon);
  cache.set(key, result);
  return result;
}

const MAX_SAMPLE_POINTS = 100;

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

  const distanceM = distanceKm * 1000;
  const numPoints = Math.min(MAX_SAMPLE_POINTS, Math.max(2, Math.ceil(distanceM / sampleInterval(distanceM))));
  const points = interpolatePoints(fromLat, fromLon, toLat, toLon, numPoints);

  // Check cache for all points, identify which need fetching
  const elevations: (number | null)[] = points.map(([lat, lon]) => {
    const key = `${lat},${lon}`;
    return elevationCache.has(key) ? (elevationCache.get(key) ?? null) : null;
  });
  const uncachedIndices = points
    .map((_, i) => i)
    .filter((i) => !elevationCache.has(`${points[i][0]},${points[i][1]}`));

  if (uncachedIndices.length > 0) {
    const uncachedPoints = uncachedIndices.map((i) => points[i]);
    const fetched = await fetchElevationProfile(uncachedPoints);
    if (isStale()) return;
    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      const [lat, lon] = points[idx];
      elevationCache.set(`${lat},${lon}`, fetched[j]);
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

async function autoFillTrackData(waypointId: string) {
  const generation = ++autoFillGeneration;
  const capturedRouting = useItineraryStore.getState().trackRouting;
  const isStale = () =>
    autoFillGeneration !== generation ||
    useItineraryStore.getState().appMode !== 'track' ||
    useItineraryStore.getState().trackRouting !== capturedRouting;

  const store = useItineraryStore.getState();
  const { updateWaypoint, updateLeg } = store;
  const waypoints = store.waypoints;
  const legs = store.legs;
  const isGuided = capturedRouting === 'guided';
  const routingWarnings: string[] = [];
  const elevationCache = new Map<string, number | null>();

  const wp = waypoints.find((w) => w.id === waypointId);
  if (!wp || wp.lat == null || wp.lon == null) return;

  // In classic mode, fetch elevation for this waypoint (cached for reuse in leg processing)
  // In guided mode, defer to ORS-provided elevation in autoFillLegGuided for consistency
  if (!isGuided) {
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

    if (isGuided) {
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
  }
}

async function autoFillAllTrackData() {
  const store = useItineraryStore.getState();
  if (store.appMode !== 'track') return;
  // Process only the "from" waypoint of each leg to avoid double-processing shared legs
  const processed = new Set<string>();
  const { waypoints, legs } = store;
  for (const leg of legs) {
    if (useItineraryStore.getState().appMode !== 'track') return;
    if (!processed.has(leg.fromWaypointId)) {
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
    if (!processed.has(lastLeg.toWaypointId)) {
      const wp = waypoints.find((w) => w.id === lastLeg.toWaypointId);
      if (wp && wp.lat != null && wp.lon != null) {
        if (useItineraryStore.getState().appMode !== 'track') return;
        await autoFillTrackData(wp.id);
      }
    }
  }
}

// Chieti, Italy - default center
const DEFAULT_CENTER: [number, number] = [42.351, 14.168];
const DEFAULT_ZOOM = 13;

function GeolocateOnMount() {
  const map = useMap();
  const userInteracted = useRef(false);

  useEffect(() => {
    let unmounted = false;
    const onMove = () => { userInteracted.current = true; };
    map.once('movestart', onMove);
    if (!navigator.geolocation) return () => { map.off('movestart', onMove); };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!unmounted && !userInteracted.current) {
          map.flyTo([pos.coords.latitude, pos.coords.longitude], DEFAULT_ZOOM, { duration: 1.5 });
        }
      },
      () => { /* permission denied or error — stay on default center */ }
    );
    return () => { unmounted = true; map.off('movestart', onMove); };
  }, [map]);

  return null;
}

function TrackModeAutoFill() {
  const appMode = useItineraryStore((s) => s.appMode);
  const prevMode = useRef(appMode);

  useEffect(() => {
    if (prevMode.current !== 'track' && appMode === 'track') {
      autoFillAllTrackData();
    }
    prevMode.current = appMode;
  }, [appMode]);

  return null;
}

function MapEvents() {
  const addWaypointAtPosition = useItineraryStore((s) => s.addWaypointAtPosition);

  useMapEvents({
    click(e) {
      if (useItineraryStore.getState().waypoints.length >= 50) return;
      addWaypointAtPosition(e.latlng.lat, e.latlng.lng);

      const newState = useItineraryStore.getState();
      if (newState.appMode === 'track') {
        const newWp = newState.waypoints[newState.waypoints.length - 1];
        if (newWp) autoFillTrackData(newWp.id);
      }
    },
  });

  return null;
}

function ColoredLegSegments({ leg, fromLat, fromLon, toLat, toLon }: {
  leg: Leg; fromLat: number; fromLon: number; toLat: number; toLon: number;
}) {
  const profile = leg.elevationProfile;
  if (!profile || profile.length < 2) {
    return (
      <Polyline
        positions={[[fromLat, fromLon], [toLat, toLon]]}
        color="#9ca3af"
        weight={2}
        dashArray="8 4"
      />
    );
  }

  const totalDist = profile[profile.length - 1].distance;
  if (totalDist === 0) {
    return (
      <Polyline
        positions={[[fromLat, fromLon], [toLat, toLon]]}
        color="#4ade80"
        weight={3}
        dashArray="6 4"
      />
    );
  }

  // Smooth altitudes to match the elevation chart gradient colors.
  // Group consecutive same-color segments into single Polylines so the
  // dashArray pattern flows correctly instead of restarting per segment.
  const smoothed = smoothAltitudes(profile);

  type ColorGroup = { color: string; positions: [number, number][] };
  const groups: ColorGroup[] = [];

  for (let i = 0; i < profile.length - 1; i++) {
    const t1 = profile[i].distance / totalDist;
    const t2 = profile[i + 1].distance / totalDist;
    const p1: [number, number] = [fromLat + t1 * (toLat - fromLat), fromLon + t1 * (toLon - fromLon)];
    const p2: [number, number] = [fromLat + t2 * (toLat - fromLat), fromLon + t2 * (toLon - fromLon)];

    const dx = profile[i + 1].distance - profile[i].distance;
    const dy = Math.abs(smoothed[i + 1] - smoothed[i]);
    const slope = dx > 0 ? (dy / (dx * 1000)) * 100 : 0;
    const color = slopeColor(slope);

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.color === color) {
      lastGroup.positions.push(p2);
    } else {
      groups.push({ color, positions: [p1, p2] });
    }
  }

  return (
    <>
      {groups.map((g, i) => (
        <Polyline
          key={`${i}`}
          positions={g.positions}
          color={g.color}
          weight={3}
          dashArray="8 4"
        />
      ))}
    </>
  );
}

function LegPolylines() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const coloredPath = useItineraryStore((s) => s.settings.mapDisplay.coloredPath);

  return (
    <>
      {legs.map((leg) => {
        const fromWp = waypoints.find((w) => w.id === leg.fromWaypointId);
        const toWp = waypoints.find((w) => w.id === leg.toWaypointId);
        if (!fromWp || !toWp) return null;
        if (fromWp.lat == null || fromWp.lon == null || toWp.lat == null || toWp.lon == null) return null;

        if (leg.routeGeometry && leg.routeGeometry.length >= 2) {
          return (
            <Polyline
              key={leg.id}
              positions={leg.routeGeometry}
              color="#4ade80"
              weight={4}
            />
          );
        }

        if (coloredPath) {
          return (
            <ColoredLegSegments
              key={`${leg.id}-colored`}
              leg={leg}
              fromLat={fromWp.lat}
              fromLon={fromWp.lon}
              toLat={toWp.lat!}
              toLon={toWp.lon!}
            />
          );
        }

        return (
          <Polyline
            key={`${leg.id}-gray`}
            positions={[
              [fromWp.lat, fromWp.lon],
              [toWp.lat, toWp.lon],
            ]}
            color="#9ca3af"
            weight={2}
            dashArray="8 4"
          />
        );
      })}
    </>
  );
}

export function InteractiveMap({ mobileSearchOpen }: { mobileSearchOpen?: boolean }) {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const updateWaypointPosition = useItineraryStore((s) => s.updateWaypointPosition);

  const validWaypoints = waypoints.filter((wp) => wp.lat != null && wp.lon != null);

  const handleDragEnd = useCallback(
    (wpId: string, e: L.DragEndEvent) => {
      const { lat, lng } = e.target.getLatLng();
      updateWaypointPosition(wpId, lat, lng);

      if (useItineraryStore.getState().appMode === 'track') {
        autoFillTrackData(wpId);
      }
    },
    [updateWaypointPosition]
  );

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution={process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY
          ? '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}
        url={process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY
          ? `https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY}`
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
      />
      <GeolocateOnMount />
      <TrackModeAutoFill />
      <MapEvents />
      <LocationSearch mobileSearchOpen={mobileSearchOpen} />

      {validWaypoints.map((wp) => (
        <Marker
          key={wp.id}
          position={[wp.lat!, wp.lon!]}
          icon={greenIcon(wp.order + 1)}
          draggable
          eventHandlers={{
            dragend: (e) => handleDragEnd(wp.id, e),
          }}
        />
      ))}

      <LegPolylines />
    </MapContainer>
  );
}
