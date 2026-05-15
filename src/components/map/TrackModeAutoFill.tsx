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
      const store = useItineraryStore.getState();
      // BUG-FIX (TASK-15 interaction): on a pure mode switch where TASK-15 just
      // restored populated trackValues, skip the re-fetch — those values are
      // still valid. Only re-fill when:
      //   - routing setting flipped (must recompute either way)
      //   - itinerary just loaded (data came from storage/URL without geometry)
      //   - mode change AND at least one leg has null distance (= no trackValues to restore)
      const allLegsPopulated = store.legs.length > 0 && store.legs.every((l) => l.distance != null);
      const shouldRefill = routingChanged || itineraryChanged || (modeChanged && !allLegsPopulated);

      if (shouldRefill) {
        // Clear stale route geometry and elevation profiles before recalculating
        store.legs.forEach((leg) => {
          store.updateLeg(leg.id, { routeGeometry: undefined, elevationProfile: undefined });
        });
        autoFillAllTrackData();
      }
    }

    prevMode.current = appMode;
    prevTrailRouting.current = trailRouting;
    prevItineraryId.current = itineraryId;
  }, [appMode, trailRouting, itineraryId]);

  return null;
}
