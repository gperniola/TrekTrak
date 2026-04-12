'use client';

import { useEffect, useRef } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { autoFillAllTrackData } from '@/lib/auto-fill';

export function TrackModeAutoFill() {
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
