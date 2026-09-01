'use client';

import { useMapEvents } from 'react-leaflet';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { autoFillTrackData } from '@/lib/auto-fill';
import { reverseGeocode } from '@/lib/reverse-geocoding-api';

export function MapEvents() {
  const compassActive = useUIStore((s) => s.compassActive);
  const rulerActive = useUIStore((s) => s.rulerActive);
  const quizActive = useUIStore((s) => s.quizActive);
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

      // Auto-name: fetch reverse geocode, apply only if name still default.
      // Disambiguate when reverse-geocode returns the same POI for several nearby
      // clicks: append " (2)", " (3)", etc. so the user can still tell waypoints apart.
      const wpId = newWp.id;
      const defaultName = newWp.name;
      reverseGeocode(e.latlng.lat, e.latlng.lng).then((name) => {
        if (!name) return;
        const wps = useItineraryStore.getState().waypoints;
        const current = wps.find((w) => w.id === wpId);
        if (!current || current.name !== defaultName) return;
        let finalName = name;
        const taken = new Set(wps.filter((w) => w.id !== wpId).map((w) => w.name));
        if (taken.has(finalName)) {
          let n = 2;
          while (taken.has(`${name} (${n})`)) n++;
          finalName = `${name} (${n})`;
        }
        /*
         * Il nome arriva dal geocoder, non da chi tocca la mappa: `calcolata` lo tiene
         * fuori dalla storia di annulla/rifai. Visto solo a schermo — dopo aver messo un
         * punto, «Annulla» diceva «modifica del waypoint» e il primo colpo toglieva il
         * nome invece del punto, costringendo a premere due volte per disfare un gesto.
         */
        useItineraryStore.getState().updateWaypoint(wpId, { name: finalName }, { calcolata: true });
      });
    },
    contextmenu() {
      // Prevent right-click from adding waypoints
    },
  });

  return null;
}
