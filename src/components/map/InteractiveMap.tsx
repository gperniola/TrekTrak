'use client';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useCallback } from 'react';
import { autoFillTrackData } from '@/lib/auto-fill';
import { greenIcon } from '@/lib/map-icons';
import { LocationSearch } from './LocationSearch';
import { CompassOverlay } from './CompassTool';
import { RulerTool } from './RulerTool';
import { CoordinateGrid } from './CoordinateGrid';
import { MyLocationButton } from './MyLocationButton';
import type { BaseMapDef } from '@/lib/types';
import { BASE_MAPS, HIKING_TRAILS_OVERLAY } from '@/lib/types';
import { GeolocateOnMount, DEFAULT_CENTER, DEFAULT_ZOOM, MAX_ZOOM } from './GeolocateOnMount';
import { TrackModeAutoFill } from './TrackModeAutoFill';
import { MapEvents } from './MapEvents';
import { LegPolylines, LegPolylineHoverEvents } from './LegPolylines';
import { ProfileHoverMarker } from './ProfileHoverMarker';
import { QuizBoundsSync } from './QuizBoundsSync';

function resolveBaseMap(chosen: string): BaseMapDef {
  const def = BASE_MAPS.find((m) => m.id === chosen && m.available);
  if (def) return def;
  // Fallback: first available map (OpenTopoMap or OSM)
  return BASE_MAPS.find((m) => m.available) ?? BASE_MAPS[BASE_MAPS.length - 1];
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
