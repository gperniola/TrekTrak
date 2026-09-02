'use client';

import dynamic from 'next/dynamic';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useItineraryStore } from '@/stores/itineraryStore';
import { toast, confirm as appConfirm } from '@/stores/notificationStore';
import { useUIStore } from '@/stores/uiStore';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { autoFillTrackData } from '@/lib/auto-fill';
import { greenIcon } from '@/lib/map-icons';
import { LocationSearch } from './LocationSearch';
import { CompassOverlay } from './CompassTool';
import { RulerTool } from './RulerTool';
import { CoordinateGrid } from './CoordinateGrid';
import { MyLocationButton } from './MyLocationButton';
import { ClearWaypointsButton } from './ClearWaypointsButton';
import { EmergencyLayersButton } from './emergency/EmergencyLayersButton';
import { EmergencyLayersPanel } from './emergency/EmergencyLayersPanel';
import type { BaseMapDef } from '@/lib/types';
import { BASE_MAPS, HIKING_TRAILS_OVERLAY } from '@/lib/types';
import { GeolocateOnMount, DEFAULT_CENTER, DEFAULT_ZOOM, MAX_ZOOM } from './GeolocateOnMount';
import { TrackModeAutoFill } from './TrackModeAutoFill';
import { MapEvents } from './MapEvents';
import { LegPolylines, LegPolylineHoverEvents } from './LegPolylines';
import { ProfileHoverMarker } from './ProfileHoverMarker';
import { QuizBoundsSync } from './QuizBoundsSync';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { PreviewRouteLayer } from './PreviewRouteLayer';
import { mostra } from '@/lib/profilo';
import { MaxZoomHint } from './MaxZoomHint';

const EmergencyLayers = dynamic(() => import('./emergency/EmergencyLayers'), { ssr: false });

function resolveBaseMap(chosen: string): BaseMapDef {
  const def = BASE_MAPS.find((m) => m.id === chosen && m.available);
  if (def) return def;
  // Fallback: first available map (OpenTopoMap or OSM)
  return BASE_MAPS.find((m) => m.available) ?? BASE_MAPS[BASE_MAPS.length - 1];
}

/** TASK-17: quick-action panel inside the Leaflet popup on marker tap.
 * Rename inline, delete (with confirm), copy coordinates. */
function WaypointQuickActions({ wpId }: { wpId: string }) {
  const wp = useItineraryStore((s) => s.waypoints.find((w) => w.id === wpId));
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const removeWaypoint = useItineraryStore((s) => s.removeWaypoint);

  if (!wp) return null;

  const handleRename = (e: React.FocusEvent<HTMLInputElement>) => {
    const name = e.target.value.trim().slice(0, 100);
    if (name && name !== wp.name) updateWaypoint(wpId, { name });
  };

  const handleDelete = async () => {
    const ok = await appConfirm({
      title: 'Eliminare il waypoint?',
      message: `"${wp.name}" verrà rimosso dall'itinerario.`,
      variant: 'error',
      confirmText: 'Elimina',
    });
    if (ok) {
      removeWaypoint(wpId);
      toast.success('Waypoint rimosso');
    }
  };

  const handleCopy = () => {
    if (wp.lat == null || wp.lon == null) return;
    const text = `${wp.lat.toFixed(6)}, ${wp.lon.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Coordinate copiate: ${text}`),
      () => toast.error('Impossibile copiare le coordinate'),
    );
  };

  return (
    <div className="min-w-[180px] text-xs">
      <input
        type="text"
        defaultValue={wp.name}
        onBlur={handleRename}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label="Nome waypoint"
        maxLength={100}
        className="w-full px-2 py-1 mb-2 bg-gray-100 border border-gray-300 rounded text-sm text-gray-900"
      />
      {wp.lat != null && wp.lon != null && (
        <div className="text-[10px] text-gray-400 mb-2 font-mono">
          {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)}
        </div>
      )}
      <div className="flex gap-1">
        <button
          onClick={handleCopy}
          className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-600 text-su-colore rounded text-xs"
          aria-label="Copia coordinate"
        >
          📋 Copia
        </button>
        <button
          onClick={handleDelete}
          className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-600 text-su-colore rounded text-xs"
          aria-label="Elimina waypoint"
        >
          🗑 Elimina
        </button>
      </div>
    </div>
  );
}

export function InteractiveMap() {
  const compassActive = useUIStore((s) => s.compassActive);
  const profiloAttivo = useUIStore((s) => s.profilo);
  const rulerActive = useUIStore((s) => s.rulerActive);
  const deactivateCompass = useUIStore((s) => s.deactivateCompass);
  const deactivateRuler = useUIStore((s) => s.deactivateRuler);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const mainView = useUIStore((s) => s.mainView);
  const selectedRouteId = useRouteLibraryStore((s) => s.selectedRouteId);
  const previewRoute = useRouteLibraryStore((s) => s.routes.find((r) => r.id === s.selectedRouteId));

  const waypoints = useItineraryStore((s) => s.waypoints);
  const updateWaypointPosition = useItineraryStore((s) => s.updateWaypointPosition);
  const baseMapId = useItineraryStore((s) => s.settings.mapDisplay.baseMap);
  const showHikingTrails = useItineraryStore((s) => s.settings.mapDisplay.showHikingTrails);
  const showCoordinateGrid = useItineraryStore((s) => s.settings.mapDisplay.showCoordinateGrid);

  const validWaypoints = useMemo(
    () => waypoints.filter((wp) => wp.lat != null && wp.lon != null),
    [waypoints]
  );

  // TASK-12: debounce autoFill on rapid drags. Each marker gets its own pending timer
  // keyed by waypointId. The new position is applied immediately (for visual feedback),
  // but the elevation/route fetch is delayed so successive micro-adjustments coalesce.
  const dragDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = dragDebounceRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const handleDragEnd = useCallback(
    (wpId: string, e: L.DragEndEvent) => {
      const { lat, lng } = e.target.getLatLng();
      updateWaypointPosition(wpId, lat, lng);

      const timers = dragDebounceRef.current;
      const existing = timers.get(wpId);
      if (existing) clearTimeout(existing);
      const next = setTimeout(() => {
        timers.delete(wpId);
        if (useItineraryStore.getState().appMode === 'track') {
          autoFillTrackData(wpId);
        }
      }, 500);
      timers.set(wpId, next);
    },
    [updateWaypointPosition]
  );

  const baseMap = resolveBaseMap(baseMapId);
  const libraryPreview = mainView === 'library' && selectedRouteId != null && previewRoute != null;

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
      {/*
        Terzo ingresso dei layer di emergenza, dopo il pulsante e il pannello: qui si
        montano i layer VERI. Senza questa guardia, in Imparo restavano disegnati sulla
        mappa e continuavano a scaricare, mentre il pulsante per spegnerli era nascosto.
        Si guarda il punto di montaggio e non l'interno del componente: dentro, la
        guardia dovrebbe stare dopo gli hook, e l'effetto che riattiva i layer girerebbe
        comunque.
      */}
      {mostra('layerEmergenza', profiloAttivo) && <EmergencyLayers />}
      <GeolocateOnMount />
      <LocationSearch mobileSearchOpen={searchOpen} />
      {/*
        Le quattro mappe hanno limiti di dettaglio diversi (22, 20, 19, 17): oltre il
        loro zoom nativo le mattonelle si stirano, e su una carta ci si aspetta il
        contrario — piu' ci si avvicina, piu' si vede.
      */}
      <MaxZoomHint baseMap={baseMap} />

      {libraryPreview && previewRoute && <PreviewRouteLayer route={previewRoute} />}

      {!libraryPreview && (
        <>
          <TrackModeAutoFill />
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
            >
              <Popup>
                <WaypointQuickActions wpId={wp.id} />
              </Popup>
            </Marker>
          ))}

          <LegPolylines />
          <LegPolylineHoverEvents />
          <ProfileHoverMarker />
        </>
      )}
      <MyLocationButton hidden={compassActive} />
      {!libraryPreview && <ClearWaypointsButton />}
      <EmergencyLayersButton />
      <EmergencyLayersPanel />
      <CompassOverlay active={compassActive} onDeactivate={deactivateCompass} />
      <RulerTool active={rulerActive} onDeactivate={deactivateRuler} />
      <QuizBoundsSync />
    </MapContainer>
  );
}
