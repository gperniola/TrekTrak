'use client';

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import { slopeColor, smoothAltitudes, distanceToPosition, positionToDistance } from '@/lib/calculations';
import { reverseGeocode } from '@/lib/reverse-geocoding-api';
import { autoFillTrackData, autoFillAllTrackData } from '@/lib/auto-fill';
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
      if (compassActive || rulerActive || quizActive) return;
      const btn = (e.originalEvent as MouseEvent).button;
      if (btn != null && btn !== 0) return;
      if (useItineraryStore.getState().waypoints.length >= 50) return;
      addWaypointAtPosition(e.latlng.lat, e.latlng.lng);

      const newState = useItineraryStore.getState();
      const newWp = newState.waypoints[newState.waypoints.length - 1];
      if (!newWp) return;

      if (newState.appMode === 'track') {
        autoFillTrackData(newWp.id);
      }

      // Auto-name: fetch reverse geocode, apply only if name still default
      const wpId = newWp.id;
      const defaultName = newWp.name;
      reverseGeocode(e.latlng.lat, e.latlng.lng).then((name) => {
        if (!name) return;
        const current = useItineraryStore.getState().waypoints.find((w) => w.id === wpId);
        if (current && current.name === defaultName) {
          useItineraryStore.getState().updateWaypoint(wpId, { name });
        }
      });
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
