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
    // Re-fill on itinerary load: saved/shared itineraries have no routeGeometry/elevationProfile,
    // since those are stripped on save (storage) and on encode (share URL) to limit size.
    const itineraryChanged = appMode === 'track' && prevItineraryId.current !== itineraryId;

    if (modeChanged || routingChanged || itineraryChanged) {
      // Clear stale route geometry and elevation profiles before recalculating
      const store = useItineraryStore.getState();
      store.legs.forEach((leg) => {
        store.updateLeg(leg.id, { routeGeometry: undefined, elevationProfile: undefined });
      });
      autoFillAllTrackData();
    }

    prevMode.current = appMode;
    prevTrailRouting.current = trailRouting;
    prevItineraryId.current = itineraryId;
  }, [appMode, trailRouting, itineraryId]);

  return null;
}
