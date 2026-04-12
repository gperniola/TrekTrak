'use client';

import { useEffect } from 'react';
import { Marker, useMap } from 'react-leaflet';
import { useItineraryStore } from '@/stores/itineraryStore';
import { distanceToPosition } from '@/lib/calculations';
import { profileHoverIcon } from '@/lib/map-icons';

export function ProfileHoverMarker() {
  const profileHover = useItineraryStore((s) => s.profileHover);
  const profileFlyTo = useItineraryStore((s) => s.profileFlyTo);
  const clearProfileFlyTo = useItineraryStore((s) => s.clearProfileFlyTo);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const map = useMap();

  // Handle click-to-fly from chart
  useEffect(() => {
    if (profileFlyTo == null) return;
    const flyPos = distanceToPosition(profileFlyTo, waypoints, legs);
    if (flyPos) map.flyTo(flyPos, Math.max(map.getZoom(), 15), { duration: 0.8 });
    clearProfileFlyTo();
  }, [profileFlyTo, waypoints, legs, map, clearProfileFlyTo]);

  if (!profileHover || profileHover.source !== 'chart') return null;

  const pos = distanceToPosition(profileHover.distance, waypoints, legs);
  if (!pos) return null;

  return (
    <Marker
      position={pos}
      icon={profileHoverIcon}
      interactive={false}
    />
  );
}
