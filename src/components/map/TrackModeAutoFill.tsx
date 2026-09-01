'use client';

import { useEffect, useRef } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { autoFillAllTrackData } from '@/lib/auto-fill';

export function TrackModeAutoFill() {
  const appMode = useItineraryStore((s) => s.appMode);
  const trailRouting = useItineraryStore((s) => s.settings.mapDisplay.trailRouting);
  const itineraryId = useItineraryStore((s) => s.itineraryId);
  const prevMode = useRef(appMode);
  const prevTrailRouting = useRef(trailRouting);
  const prevItineraryId = useRef(itineraryId);

  useEffect(() => {
    const modeChanged = prevMode.current !== 'track' && appMode === 'track';
    const routingChanged = appMode === 'track' && prevTrailRouting.current !== trailRouting;
    // On itinerary load: routes from the cloud (Fase 5) already carry routeGeometry/
    // elevationProfile → preserve them; only legs that LACK geometry (share-URL imports,
    // pre-Fase-5 saves) get reconstructed via the geometry-aware onlyMissing refill.
    const itineraryChanged = appMode === 'track' && prevItineraryId.current !== itineraryId;

    if (modeChanged || routingChanged || itineraryChanged) {
      // routingChanged = user toggled trail routing → re-route EVERYTHING (clear all geometry).
      if (routingChanged) {
        const store = useItineraryStore.getState();
        store.legs.forEach((leg) => {
          // Pulizia prima di ricalcolare: e' lavoro del programma, non un gesto.
          store.updateLeg(leg.id, { routeGeometry: undefined, elevationProfile: undefined }, { calcolata: true });
        });
        autoFillAllTrackData();
      } else {
        // modeChanged (Learn→Track) or itineraryChanged → fill only legs missing
        // data/geometry; legs that already have geometry are left untouched.
        autoFillAllTrackData(true);
      }
    }

    prevMode.current = appMode;
    prevTrailRouting.current = trailRouting;
    prevItineraryId.current = itineraryId;
  }, [appMode, trailRouting, itineraryId]);

  return null;
}
