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
