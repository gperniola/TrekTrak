'use client';

import { useCallback, useRef } from 'react';
import { Polyline } from 'react-leaflet';
import { useItineraryStore } from '@/stores/itineraryStore';
import { positionToDistance } from '@/lib/calculations';
import { ColoredLegSegments } from './ColoredLegSegments';
import type L from 'leaflet';

export function LegPolylines() {
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

export function LegPolylineHoverEvents() {
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
