'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

// Chieti, Italy - default center
export const DEFAULT_CENTER: [number, number] = [42.351, 14.168];
export const DEFAULT_ZOOM = 13;
export const MAX_ZOOM = 19;

export function GeolocateOnMount() {
  const map = useMap();
  const userInteracted = useRef(false);

  useEffect(() => {
    let unmounted = false;
    const onMove = () => { userInteracted.current = true; };
    map.once('movestart', onMove);
    if (!navigator.geolocation) return () => { map.off('movestart', onMove); };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!unmounted && !userInteracted.current) {
          map.flyTo([pos.coords.latitude, pos.coords.longitude], DEFAULT_ZOOM, { duration: 1.5 });
        }
      },
      () => { /* permission denied or error — stay on default center */ }
    );
    return () => { unmounted = true; map.off('movestart', onMove); };
  }, [map]);

  return null;
}
