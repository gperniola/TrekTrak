'use client';

import { useEffect, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { BaseMapDef } from '@/lib/types';
import { useMapOverlayGuard } from './useMapOverlayGuard';

/**
 * Oltre lo zoom nativo il server non ha altre mattonelle: Leaflet prende l'ultima
 * disponibile e la **stira**. L'immagine diventa più grande, non più precisa.
 */
export function oltreIlDettaglio(zoom: number, zoomNativo: number): boolean {
  return zoom > zoomNativo;
}

/**
 * Avvisa quando si sta ingrandendo oltre il dettaglio che la mappa possiede davvero.
 *
 * Serve perché su una carta si è abituati al contrario: più ci si avvicina, più si vede.
 * Qui a un certo punto si smette di guadagnare informazione e si guadagnano solo pixel,
 * e la differenza conta se si sta leggendo un sentiero per decidere dove passare. Le
 * quattro mappe hanno limiti diversi — Thunderforest arriva a 22, OpenTopoMap si ferma a
 * 17 — quindi il punto in cui succede cambia con la mappa scelta, e l'avviso lo dice.
 *
 * Si può chiudere, e **ricompare cambiando mappa**: il limite di cui parlava non è più
 * quello, quindi il fatto che sia stato letto una volta non vale per l'altra.
 */
export function MaxZoomHint({ baseMap }: { baseMap: BaseMapDef }) {
  const map = useMap();
  const [zoom, setZoom] = useState<number>(() => map.getZoom());
  const [chiuso, setChiuso] = useState(false);
  /*
   * Sta DENTRO `MapContainer`, quindi senza guardia il tocco sulla ✕ risalirebbe a
   * `.leaflet-container` e diventerebbe «aggiungi waypoint»: e' successo due volte in
   * questo progetto, col pannello dei layer e col mirino del GPS.
   */
  const guardia = useMapOverlayGuard<HTMLDivElement>();

  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  useEffect(() => {
    setChiuso(false);
  }, [baseMap.id]);

  // La guardia dopo gli hook, come sempre: un hook non si salta.
  if (chiuso || !oltreIlDettaglio(zoom, baseMap.maxNativeZoom)) return null;

  return (
    <div
      ref={guardia}
      role="status"
      className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 max-w-[92%] px-2.5 py-1.5 rounded-lg bg-gray-900/90 border border-gray-600 shadow-lg text-[11px] text-gray-200 leading-snug"
    >
      <span aria-hidden className="shrink-0">🔍</span>
      <span>
        Stai ingrandendo oltre il dettaglio di <strong className="font-medium">{baseMap.label}</strong>
        {' '}(fino a {baseMap.maxNativeZoom}): le mattonelle sono stirate, non più precise.
      </span>
      <button
        onClick={() => setChiuso(true)}
        aria-label="Nascondi l'avviso sull'ingrandimento"
        className="shrink-0 text-gray-400 hover:text-white px-1 min-h-[28px]"
      >
        ✕
      </button>
    </div>
  );
}
