'use client';

import { useEffect, useState, useRef } from 'react';
import { useMap, useMapEvents, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { haversineDistance, forwardAzimuth } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';
import { useMapOverlayGuard } from './useMapOverlayGuard';
import { AnelloBussola } from './AnelloBussola';
import { usePositionStore } from '@/stores/positionStore';
import { distanza, gradi } from '@/lib/formato';

interface CompassData {
  userLat: number;
  userLon: number;
  userAlt: number | null;
  targetLat: number;
  targetLon: number;
  targetAlt: number | null;
}

const AZIMUTH_MIN_DISTANCE_KM = 0.01; // 10m — below this, azimuth is unstable

/**
 * Il mirino del bersaglio.
 *
 * **Contorno bianco sotto, colore sopra.** Segnalato il 2026-09-03: «i punti sono poco
 * visibili». La croce di prima era due linee da 2 px di verde o rosso, senza contorno,
 * sopra una mappa escursionistica piena di sentieri arancioni e rossi: si perdeva nel
 * disegno. Ogni linea qui è tracciata due volte — bianca e spessa, poi colorata e
 * sottile — che è il modo in cui i simboli delle carte restano leggibili su qualunque
 * fondo, e non un vezzo grafico.
 *
 * Più grande di prima (28 px contro 20) e con l'ombra: al dito serve un bersaglio, non
 * un dettaglio.
 */
const MIRINO_BERSAGLIO = L.divIcon({
  className: '',
  html: '<svg width="28" height="28" viewBox="0 0 28 28" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">'
    + '<line x1="14" y1="1" x2="14" y2="9" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>'
    + '<line x1="14" y1="19" x2="14" y2="27" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>'
    + '<line x1="1" y1="14" x2="9" y2="14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>'
    + '<line x1="19" y1="14" x2="27" y2="14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>'
    + '<circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" stroke-width="4.5"/>'
    + '<line x1="14" y1="1" x2="14" y2="9" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>'
    + '<line x1="14" y1="19" x2="14" y2="27" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>'
    + '<line x1="1" y1="14" x2="9" y2="14" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>'
    + '<line x1="19" y1="14" x2="27" y2="14" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>'
    + '<circle cx="14" cy="14" r="6.5" fill="none" stroke="#dc2626" stroke-width="2"/>'
    + '<circle cx="14" cy="14" r="1.8" fill="#dc2626"/>'
    + '</svg>'
    // Il nome accessibile si calcola dal contenuto del marker.
    + '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);'
    + 'white-space:nowrap">Punto mirato</span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function CompassOverlay({ active, onDeactivate }: { active: boolean; onDeactivate: () => void }) {
  const map = useMap();
  const [data, setData] = useState<CompassData | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchGenRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable deactivate ref to avoid effect re-runs
  const deactivateRef = useRef(onDeactivate);
  deactivateRef.current = onDeactivate;

  // GPS watch — continuous position updates
  useEffect(() => {
    if (!active) {
      setData(null);
      setError(null);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (errorTimeoutRef.current != null) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
      return;
    }

    setLocating(true);
    setError(null);
    let firstFix = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        /*
          Pubblicata nello store: il punto sulla mappa lo disegna `PosizioneUtente`, che
          legge da li'. Cosi' "dove sono" e' una cosa sola — e la posizione resta anche
          dopo che la bussola si spegne, che e' quello che serve.
        */
        usePositionStore.getState().setLastKnown({
          lat: latitude, lon: longitude, accuracy: pos.coords.accuracy ?? null,
        });
        if (firstFix) {
          map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 1 });
          firstFix = false;
          setLocating(false);
        }
        const alt = await fetchElevation(latitude, longitude);
        setData((prev) => ({
          userLat: latitude,
          userLon: longitude,
          userAlt: alt != null ? Math.round(alt) : (prev?.userAlt ?? null),
          targetLat: prev?.targetLat ?? map.getCenter().lat,
          targetLon: prev?.targetLon ?? map.getCenter().lng,
          targetAlt: prev?.targetAlt ?? null,
        }));
      },
      (err) => {
        setLocating(false);
        const msg = err.code === 1 ? 'Permesso GPS negato. Abilitalo nelle impostazioni del browser.'
          : err.code === 3 ? 'Timeout GPS. Riprova all\'aperto.'
          : 'Posizione non disponibile.';
        setError(msg);
        if (errorTimeoutRef.current != null) clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = setTimeout(() => {
          errorTimeoutRef.current = null;
          deactivateRef.current();
        }, 3000);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (errorTimeoutRef.current != null) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, [active, map]);

  // Update target position as map moves (real-time)
  useMapEvents({
    move() {
      if (!active || !data) return;
      const center = map.getCenter();
      setData((prev) => prev ? { ...prev, targetLat: center.lat, targetLon: center.lng } : null);
    },
    async moveend() {
      if (!active || !data) return;
      const gen = ++fetchGenRef.current;
      const center = map.getCenter();
      const alt = await fetchElevation(center.lat, center.lng);
      if (gen !== fetchGenRef.current) return; // stale, discard
      setData((prev) => prev ? {
        ...prev,
        targetLat: center.lat,
        targetLon: center.lng,
        targetAlt: alt != null ? Math.round(alt) : null,
      } : null);
    },
  });

  // Il pannello copre una fetta di mappa: senza guardia, toccarlo piazza un punto
  // sotto di esso. I tre riquadri sono mutuamente esclusivi, quindi una guardia sola
  // basta: passando da uno all'altro scollega il nodo precedente.
  const guardiaPannello = useMapOverlayGuard<HTMLDivElement>();

  if (!active) return null;

  if (error) {
    return (
      <div ref={guardiaPannello} className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/90 rounded-lg px-4 py-2 text-sm text-[#fecaca] max-w-[calc(100%-1rem)] text-center">
        {error}
      </div>
    );
  }

  if (locating) {
    return (
      <div ref={guardiaPannello} className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 text-sm text-gray-300">
        Localizzazione in corso...
      </div>
    );
  }

  if (!data) return null;

  const distance = haversineDistance(data.userLat, data.userLon, data.targetLat, data.targetLon);
  const azimuth = distance > AZIMUTH_MIN_DISTANCE_KM
    ? forwardAzimuth(data.userLat, data.userLon, data.targetLat, data.targetLon)
    : null;
  const altDiff = data.targetAlt != null && data.userAlt != null
    ? data.targetAlt - data.userAlt
    : null;

  const distDisplay = distanza(distance, 2);

  return (
    <>
      {/*
        **L'anello del compasso**: un cerchio che passa per il punto mirato.

        Il raggio è la distanza misurata, quindi spostando la mappa si apre e si chiude
        insieme al mirino — come un compasso che si allarga fino al bersaglio. Dice una
        cosa che il numero da solo non dice: tutto quello che sta sul cerchio è lontano
        quanto ciò che stai puntando.

        `distance` è in chilometri (viene da `haversineDistance`), il raggio di Leaflet è
        in **metri**: la conversione sta qui e non dentro il componente, perché è
        un'unità di questo modulo, non di quello.
      */}
      <AnelloBussola lat={data.userLat} lon={data.userLon} raggioMetri={distance * 1000} />

      {/*
        La linea, bianca sotto e gialla sopra: da sola, sopra una mappa coi sentieri
        arancioni, la tratteggiata gialla si confondeva col resto.
      */}
      <Polyline
        positions={[[data.userLat, data.userLon], [data.targetLat, data.targetLon]]}
        color="#ffffff"
        weight={5}
        opacity={0.8}
        interactive={false}
      />
      <Polyline
        positions={[[data.userLat, data.userLon], [data.targetLat, data.targetLon]]}
        color="#facc15"
        weight={2.5}
        dashArray="6 4"
        interactive={false}
      />

      {/*
        Il mirino del bersaglio. Il punto in cui SEI lo disegna `PosizioneUtente`, che
        legge la posizione dallo store: una cosa sola, un disegno solo — prima la bussola
        ne aveva uno suo, e passando da uno strumento all'altro ci si ritrovava con due
        simboli diversi per lo stesso posto.
      */}
      <Marker
        position={[data.targetLat, data.targetLon]}
        icon={MIRINO_BERSAGLIO}
        interactive={false}
        keyboard={false}
        /*
          Sopra il punto della posizione (che sta a 500): all'accensione il bersaglio E'
          il centro della mappa, che dopo il volo coincide con dove sei — i due simboli
          finiscono uno sull'altro, e se sotto c'e' il mirino sembra che accendere la
          bussola non abbia fatto niente. Appena si sposta la mappa si separano.
        */
        zIndexOffset={600}
      />

      {/* Overlay with compass data */}
      <div ref={guardiaPannello} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 flex gap-4 items-center text-sm max-w-[calc(100%-1rem)]">
        <div className="text-center">
          <div className="text-amber-400 font-bold text-base">{azimuth != null ? gradi(azimuth) : '--'}</div>
          <div className="text-gray-400 text-[10px]">Azimuth</div>
        </div>
        <div className="w-px h-8 bg-gray-700" />
        <div className="text-center">
          <div className="text-green-400 font-bold text-base">{distDisplay}</div>
          <div className="text-gray-400 text-[10px]">Distanza</div>
        </div>
        <div className="w-px h-8 bg-gray-700" />
        <div className="text-center">
          <div className={`font-bold text-base ${altDiff != null ? (altDiff >= 0 ? 'text-red-400' : 'text-blue-400') : 'text-gray-400'}`}>
            {altDiff != null ? `${altDiff >= 0 ? '+' : ''}${altDiff} m` : '...'}
          </div>
          <div className="text-gray-400 text-[10px]">Δ Quota</div>
        </div>
      </div>
    </>
  );
}
