'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import { fetchShelters, ZOOM_MINIMO_RIPARI, type Riparo, type TipoRiparo } from '@/lib/shelters-api';

/** Attesa dopo l'ultimo movimento: Overpass è un servizio pubblico condiviso. */
const ATTESA_MS = 900;

const COLORE: Record<TipoRiparo, string> = {
  rifugio: '#c084fc',
  bivacco: '#93c5fd',
  ricovero: '#a3a3a3',
};

const ETICHETTA: Record<TipoRiparo, string> = {
  rifugio: 'Rifugio',
  bivacco: 'Bivacco',
  ricovero: 'Ricovero',
};

const icone = new Map<TipoRiparo, L.DivIcon>();
function icona(tipo: TipoRiparo, nome: string | null): L.DivIcon {
  // Una icona per tipo, riusata: sono fino a 200 marker.
  const cached = icone.get(tipo);
  if (cached && nome == null) return cached;
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:4px;border:2px solid #fff;background:${COLORE[tipo]};box-shadow:0 1px 3px rgba(0,0,0,.5)">`
      // Il nome accessibile di un marker si calcola dal contenuto: senza questo testo
      // nascosto resterebbe un pulsante senza nome, che e' la failure corretta nella
      // v0.11.6 sui marker dei waypoint.
      + `<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">`
      + `${ETICHETTA[tipo]}${nome ? `: ${nome}` : ''}</span></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
  if (nome == null) icone.set(tipo, icon);
  return icon;
}

/**
 * Rifugi, bivacchi e ricoveri **dell'area inquadrata**.
 *
 * È il layer che rende azionabile un avviso di temporale: non "sta arrivando" ma "dove
 * mi metto". Si interroga sulla vista perché Overpass non regge una query nazionale, e
 * si attende dopo l'ultimo movimento perché è un servizio pubblico condiviso — che
 * durante la verifica ha risposto 504 due volte su tre.
 */
export function EmergencyShelterLayer({ shelters }: { shelters: Riparo[] | null }) {
  const map = useMap();
  const report = useEmergencyStore((s) => s.reportShelters);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  const interroga = useCallback(() => {
    controller.current?.abort();
    if (map.getZoom() < ZOOM_MINIMO_RIPARI) {
      // Non è un errore: la fonte non è stata nemmeno interrogata, e dirlo evita di
      // far credere che in zona non ci sia nulla.
      report({ nodata: `avvicinati per vedere i ripari (zoom ${ZOOM_MINIMO_RIPARI})` });
      return;
    }
    const b = map.getBounds();
    const ac = new AbortController();
    controller.current = ac;
    fetchShelters(
      { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      ac.signal
    )
      .then((lista) => { if (!ac.signal.aborted) report({ shelters: lista }); })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        report({ error: e instanceof Error ? e.message : 'Ripari non disponibili' });
      });
  }, [map, report]);

  const programma = useCallback(() => {
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = setTimeout(interroga, ATTESA_MS);
  }, [interroga]);

  useMapEvents({ moveend: programma, zoomend: programma });

  useEffect(() => {
    interroga();
    return () => {
      if (timer.current != null) clearTimeout(timer.current);
      controller.current?.abort();
    };
  }, [interroga]);

  if (shelters == null) return null;

  return (
    <>
      {shelters.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lon]} icon={icona(r.tipo, r.name)} pane={EMERGENCY_PANE}>
          <Popup>
            <div className="text-xs space-y-0.5">
              <div className="font-bold">{r.name ?? ETICHETTA[r.tipo]}</div>
              {/* Senza nome il titolo E' gia' il tipo: ripeterlo sotto sembrava un errore. */}
              {r.name != null && <div className="text-gray-600">{ETICHETTA[r.tipo]}</div>}
              {r.capacity != null && <div>{r.capacity} posti</div>}
              {r.phone != null && <div><a href={`tel:${r.phone.replace(/\s/g, '')}`}>{r.phone}</a></div>}
              {/* Un ricovero mappato non è una garanzia: può essere chiuso, diroccato o
                  stagionale. Dirlo qui è più utile che scoprirlo sotto la pioggia. */}
              <div className="text-gray-500">
                Da OpenStreetMap: apertura e stato non sono verificati.
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
