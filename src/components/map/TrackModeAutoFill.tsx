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
      // TASK-15 interaction:
      //  - routingChanged / itineraryChanged → full re-fill (need fresh geometry).
      //  - modeChanged only (Learn→Track) → re-fill only legs missing data;
      //    legs whose trackValues were just restored stay untouched.
      const fullRefill = routingChanged || itineraryChanged;
      const partialRefill = modeChanged && !fullRefill;

      if (fullRefill) {
        store.legs.forEach((leg) => {
          store.updateLeg(leg.id, { routeGeometry: undefined, elevationProfile: undefined });
        });
        autoFillAllTrackData();
      } else if (partialRefill) {
        // Only fill legs with null distance; preserve restored trackValues elsewhere.
        autoFillAllTrackData(true);
      }
    }

    prevMode.current = appMode;
    prevTrailRouting.current = trailRouting;
    prevItineraryId.current = itineraryId;
  }, [appMode, trailRouting, itineraryId]);

  return null;
}
