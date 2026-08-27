'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { usePositionStore } from '@/stores/positionStore';

// Chieti, Italy - default center
export const DEFAULT_CENTER: [number, number] = [42.351, 14.168];
export const DEFAULT_ZOOM = 13;
export const MAX_ZOOM = 19;

const VIEW_KEY = 'tt_map_view';

export function GeolocateOnMount() {
  const map = useMap();
  const userInteracted = useRef(false);

  useEffect(() => {
    let unmounted = false;
    const onMove = () => { userInteracted.current = true; };

    // Persisti la vista (centro+zoom) ad ogni spostamento: così un eventuale remount o
    // reload della pagina NON ri-centra bruscamente sul GPS — ripristiniamo dov'eravamo.
    const saveView = () => {
      try {
        const c = map.getCenter();
        sessionStorage.setItem(VIEW_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, z: map.getZoom() }));
      } catch { /* sessionStorage non disponibile */ }
    };

    // Se c'è una vista salvata in questa sessione, ripristinala e NON geolocalizzare:
    // evita il "salto" sulla posizione attuale ad ogni mount.
    let restored = false;
    try {
      const raw = sessionStorage.getItem(VIEW_KEY);
      if (raw) {
        const v = JSON.parse(raw) as { lat: number; lng: number; z: number };
        map.setView([v.lat, v.lng], v.z, { animate: false });
        restored = true;
      }
    } catch { /* JSON malformato → ignora e geolocalizza */ }

    map.once('movestart', onMove);
    map.on('moveend', saveView);
    map.on('zoomend', saveView);

    // Geolocalizzazione solo alla PRIMA apertura della sessione (nessuna vista salvata).
    if (!restored && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Pubblica la posizione: chi ne ha bisogno la legge da qui invece di
          // richiederla, evitando un secondo fix GPS e qualunque nuovo prompt.
          usePositionStore.getState().setLastKnown({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          if (!unmounted && !userInteracted.current) {
            map.flyTo([pos.coords.latitude, pos.coords.longitude], DEFAULT_ZOOM, { duration: 1.5 });
          }
        },
        () => { /* permesso negato o errore — resta sul centro di default */ }
      );
    }

    return () => {
      unmounted = true;
      map.off('movestart', onMove);
      map.off('moveend', saveView);
      map.off('zoomend', saveView);
    };
  }, [map]);

  return null;
}
