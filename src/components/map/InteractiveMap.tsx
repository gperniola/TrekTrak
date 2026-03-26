'use client';

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import { fetchElevation, fetchElevationProfile } from '@/lib/elevation-api';
import { haversineDistance, forwardAzimuth, interpolatePoints, cumulativeElevation, sampleInterval, slopeColor, smoothAltitudes, distanceToPosition, positionToDistance } from '@/lib/calculations';
import { fetchTrailRoute } from '@/lib/routing-api';
import { LocationSearch } from './LocationSearch';
import { CompassOverlay } from './CompassTool';
import { RulerTool } from './RulerTool';
import { CoordinateGrid } from './CoordinateGrid';
import { QuizMarkers } from './QuizMarkers';
import { setQuizMapBounds } from '@/components/quiz/QuizOverlay';
import type { QuizPoint } from '@/lib/quiz';
import { MyLocationButton } from './MyLocationButton';
import type { Leg, BaseMapDef } from '@/lib/types';
import { BASE_MAPS, HIKING_TRAILS_OVERLAY } from '@/lib/types';

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

async function autoFillTrackData(waypointId: string) {
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
const MAX_ZOOM = 19;

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
  const trailRouting = useItineraryStore((s) => s.settings.mapDisplay.trailRouting);
  const prevMode = useRef(appMode);
  const prevTrailRouting = useRef(trailRouting);

  useEffect(() => {
    const modeChanged = prevMode.current !== 'track' && appMode === 'track';
    const routingChanged = appMode === 'track' && prevTrailRouting.current !== trailRouting;

    if (modeChanged || routingChanged) {
      // Clear stale route geometry and elevation profiles before recalculating
      const store = useItineraryStore.getState();
      store.legs.forEach((leg) => {
        store.updateLeg(leg.id, { routeGeometry: undefined, elevationProfile: undefined });
      });
      autoFillAllTrackData();
    }

    prevMode.current = appMode;
    prevTrailRouting.current = trailRouting;
  }, [appMode, trailRouting]);

  return null;
}

function MapEvents({ compassActive, rulerActive, quizActive }: { compassActive?: boolean; rulerActive?: boolean; quizActive?: boolean }) {
  const addWaypointAtPosition = useItineraryStore((s) => s.addWaypointAtPosition);

  useMapEvents({
    click(e) {
      if (compassActive || rulerActive || quizActive) return; // Suppress waypoint placement in compass/ruler/quiz mode
      // Ignore right-click (some browsers may emit click for contextmenu)
      const btn = (e.originalEvent as MouseEvent).button;
      if (btn != null && btn !== 0) return;
      if (useItineraryStore.getState().waypoints.length >= 50) return;
      addWaypointAtPosition(e.latlng.lat, e.latlng.lng);

      const newState = useItineraryStore.getState();
      if (newState.appMode === 'track') {
        const newWp = newState.waypoints[newState.waypoints.length - 1];
        if (newWp) autoFillTrackData(newWp.id);
      }
    },
    contextmenu() {
      // Prevent right-click from adding waypoints
    },
  });

  return null;
}

function ColoredLegSegments({ leg, fromLat, fromLon, toLat, toLon }: {
  leg: Leg; fromLat: number; fromLon: number; toLat: number; toLon: number;
}) {
  const profile = leg.elevationProfile;
  const hasRoute = leg.routeGeometry && leg.routeGeometry.length >= 2;

  if (!profile || profile.length < 2) {
    // No profile data — fall back to appropriate non-colored style
    if (hasRoute) {
      return <Polyline positions={leg.routeGeometry!} color="#4ade80" weight={4} />;
    }
    return <Polyline positions={[[fromLat, fromLon], [toLat, toLon]]} color="#9ca3af" weight={2} dashArray="8 4" />;
  }

  const totalDist = profile[profile.length - 1].distance;
  if (totalDist === 0) {
    const pos: [number, number][] = hasRoute ? leg.routeGeometry! : [[fromLat, fromLon], [toLat, toLon]];
    return <Polyline positions={pos} color="#4ade80" weight={3} />;
  }

  // Smooth altitudes to match the elevation chart gradient colors.
  const smoothed = smoothAltitudes(profile);

  type ColorGroup = { color: string; positions: [number, number][] };
  const groups: ColorGroup[] = [];

  // Use route geometry positions if available, otherwise interpolate straight line
  const getPosition = (t: number): [number, number] => {
    if (hasRoute) {
      // Map t (0-1) to the route geometry by index fraction
      const geo = leg.routeGeometry!;
      const idx = t * (geo.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, geo.length - 1);
      const frac = idx - lo;
      return [
        geo[lo][0] + frac * (geo[hi][0] - geo[lo][0]),
        geo[lo][1] + frac * (geo[hi][1] - geo[lo][1]),
      ];
    }
    return [fromLat + t * (toLat - fromLat), fromLon + t * (toLon - fromLon)];
  };

  for (let i = 0; i < profile.length - 1; i++) {
    const t1 = profile[i].distance / totalDist;
    const t2 = profile[i + 1].distance / totalDist;
    const p1 = getPosition(t1);
    const p2 = getPosition(t2);

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
          weight={hasRoute ? 4 : 3}
          dashArray={hasRoute ? undefined : '8 4'}
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

        if (coloredPath) {
          // Colored path works for both straight-line and route geometry
          return (
            <ColoredLegSegments
              key={`${leg.id}-colored-${leg.routeGeometry ? 'route' : 'line'}`}
              leg={leg}
              fromLat={fromWp.lat}
              fromLon={fromWp.lon}
              toLat={toWp.lat!}
              toLon={toWp.lon!}
            />
          );
        }

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

function resolveBaseMap(chosen: string): BaseMapDef {
  const def = BASE_MAPS.find((m) => m.id === chosen && m.available);
  if (def) return def;
  // Fallback: first available map (OpenTopoMap or OSM)
  return BASE_MAPS.find((m) => m.available) ?? BASE_MAPS[BASE_MAPS.length - 1];
}

const profileHoverIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;background:#facc15;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(250,204,21,0.6);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function ProfileHoverMarker() {
  const profileHover = useItineraryStore((s) => s.profileHover);
  const profileFlyTo = useItineraryStore((s) => s.profileFlyTo);
  const clearProfileFlyTo = useItineraryStore((s) => s.clearProfileFlyTo);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const map = useMap();

  // Handle click-to-fly from chart
  useEffect(() => {
    if (profileFlyTo == null) return;
    const flyPos = distanceToPosition(profileFlyTo, waypoints, legs);
    if (flyPos) map.flyTo(flyPos, Math.max(map.getZoom(), 15), { duration: 0.8 });
    clearProfileFlyTo();
  }, [profileFlyTo, waypoints, legs, map, clearProfileFlyTo]);

  if (!profileHover || profileHover.source !== 'chart') return null;

  const pos = distanceToPosition(profileHover.distance, waypoints, legs);
  if (!pos) return null;

  return (
    <Marker
      position={pos}
      icon={profileHoverIcon}
      interactive={false}
    />
  );
}

function LegPolylineHoverEvents() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const setProfileHover = useItineraryStore((s) => s.setProfileHover);
  const clearProfileHover = useItineraryStore((s) => s.clearProfileHover);
  const lastHoverTime = useRef(0);

  const handleMouseMove = useCallback((e: L.LeafletMouseEvent) => {
    const now = Date.now();
    if (now - lastHoverTime.current < 60) return;
    lastHoverTime.current = now;
    const { lat, lng } = e.latlng;
    const dist = positionToDistance(lat, lng, waypoints, legs);
    if (dist != null) setProfileHover(dist, 'map');
  }, [waypoints, legs, setProfileHover]);

  const handleMouseOut = useCallback(() => {
    clearProfileHover();
  }, [clearProfileHover]);

  return (
    <>
      {legs.map((leg) => {
        const from = waypoints.find((w) => w.id === leg.fromWaypointId);
        const to = waypoints.find((w) => w.id === leg.toWaypointId);
        if (!from || !to || from.lat == null || from.lon == null || to.lat == null || to.lon == null) return null;

        const positions: [number, number][] = leg.routeGeometry && leg.routeGeometry.length >= 2
          ? leg.routeGeometry
          : [[from.lat, from.lon], [to.lat, to.lon]];

        return (
          <Polyline
            key={`hover-${leg.id}`}
            positions={positions}
            color="transparent"
            weight={20}
            eventHandlers={{
              mousemove: handleMouseMove,
              mouseout: handleMouseOut,
            }}
          />
        );
      })}
    </>
  );
}

function QuizBoundsSync({ quizActive }: { quizActive?: boolean }) {
  const map = useMap();
  const [quizPoints, setQuizPoints] = useState<{ a: QuizPoint | null; b: QuizPoint | null }>({ a: null, b: null });

  useEffect(() => {
    if (!quizActive) {
      setQuizMapBounds(null);
      setQuizPoints({ a: null, b: null });
      return;
    }
    const updateBounds = () => {
      const b = map.getBounds();
      setQuizMapBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    };
    updateBounds();
    map.on('moveend', updateBounds);

    const handlePoints = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setQuizPoints(detail);
    };
    window.addEventListener('quiz-points', handlePoints);

    return () => {
      map.off('moveend', updateBounds);
      window.removeEventListener('quiz-points', handlePoints);
      setQuizMapBounds(null);
    };
  }, [quizActive, map]);

  if (!quizActive) return null;
  return <QuizMarkers pointA={quizPoints.a} pointB={quizPoints.b} />;
}

export function InteractiveMap({ mobileSearchOpen, compassActive, onCompassDeactivate, rulerActive, onRulerDeactivate, quizActive }: {
  mobileSearchOpen?: boolean;
  compassActive?: boolean;
  onCompassDeactivate?: () => void;
  rulerActive?: boolean;
  onRulerDeactivate?: () => void;
  quizActive?: boolean;
}) {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const updateWaypointPosition = useItineraryStore((s) => s.updateWaypointPosition);
  const baseMapId = useItineraryStore((s) => s.settings.mapDisplay.baseMap);
  const showHikingTrails = useItineraryStore((s) => s.settings.mapDisplay.showHikingTrails);
  const showCoordinateGrid = useItineraryStore((s) => s.settings.mapDisplay.showCoordinateGrid);

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

  const baseMap = resolveBaseMap(baseMapId);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      maxZoom={MAX_ZOOM}
      className="h-full w-full"
    >
      <TileLayer
        key={baseMapId}
        attribution={baseMap.attribution}
        url={baseMap.url}
        maxNativeZoom={baseMap.maxNativeZoom}
        maxZoom={MAX_ZOOM}
      />
      {showHikingTrails && (
        <TileLayer
          url={HIKING_TRAILS_OVERLAY.url}
          attribution={HIKING_TRAILS_OVERLAY.attribution}
          maxNativeZoom={17}
          maxZoom={MAX_ZOOM}
          opacity={0.8}
        />
      )}
      {showCoordinateGrid && <CoordinateGrid />}
      <GeolocateOnMount />
      <TrackModeAutoFill />
      <MapEvents compassActive={compassActive} rulerActive={rulerActive} quizActive={quizActive} />
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
      <LegPolylineHoverEvents />
      <ProfileHoverMarker />
      <MyLocationButton hidden={compassActive} />
      <CompassOverlay active={!!compassActive} onDeactivate={onCompassDeactivate ?? (() => {})} />
      <RulerTool active={!!rulerActive} onDeactivate={onRulerDeactivate ?? (() => {})} />
      <QuizBoundsSync quizActive={quizActive} />
    </MapContainer>
  );
}
