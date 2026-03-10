'use client';

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useCallback } from 'react';

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

function MapEvents() {
  const addWaypoint = useItineraryStore((s) => s.addWaypoint);
  const updateWaypointPosition = useItineraryStore((s) => s.updateWaypointPosition);

  useMapEvents({
    click(e) {
      const currentState = useItineraryStore.getState();
      if (currentState.waypoints.length >= 50) return;
      addWaypoint();
      // After adding, update the latest waypoint with clicked coordinates
      const state = useItineraryStore.getState();
      const lastWp = state.waypoints[state.waypoints.length - 1];
      if (lastWp) {
        updateWaypointPosition(lastWp.id, e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return null;
}

export function InteractiveMap() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const updateWaypointPosition = useItineraryStore((s) => s.updateWaypointPosition);

  const validWaypoints = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  const routePositions = validWaypoints.map((wp) => [wp.lat!, wp.lon!] as [number, number]);

  const handleDragEnd = useCallback(
    (wpId: string, e: L.DragEndEvent) => {
      const { lat, lng } = e.target.getLatLng();
      updateWaypointPosition(wpId, lat, lng);
    },
    [updateWaypointPosition]
  );

  return (
    <MapContainer
      center={[46.07, 11.12]}
      zoom={12}
      className="h-full w-full"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents />

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

      {routePositions.length >= 2 && (
        <Polyline positions={routePositions} color="#4ade80" weight={3} />
      )}
    </MapContainer>
  );
}
