'use client';

import { useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import type { FirePoint } from '@/lib/firms';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import { escapeMarkup } from '@/lib/escape-markup';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Rete di sicurezza sul numero di marker, per il caso patologico della mappa
 * zoomata su mezza Europa. NON è il meccanismo principale: quello è il culling sulla
 * vista, qui sotto.
 *
 * Attenzione al perché: la prima versione applicava questo tetto ordinando per
 * potenza su TUTTA l'Italia, e il risultato è stato che i focolai della zona
 * guardata sparivano. Con 2298 punti in Italia e 289 nella vista, per entrare nei
 * primi 400 serviva una potenza di 53,8 MW mentre lì la media era 6,4: ne restavano
 * disegnati 3. Per chi guardava la mappa, "i focolai non compaiono più". Che un
 * incendio a 600 km sia più potente non ha alcuna rilevanza per ciò che va disegnato
 * qui.
 */
const MAX_RENDERED = 400;

/** Margine oltre il bordo, così un pan breve non scopre aree vuote. */
const VIEW_PAD = 0.25;

export function fireColor(acquiredAt: string, now: Date): string {
  return now.getTime() - new Date(acquiredAt).getTime() < SIX_HOURS_MS ? '#ef4444' : '#f97316';
}

const CONFIDENCE_LABELS: Record<FirePoint['confidence'], string> = {
  low: 'Bassa', nominal: 'Media', high: 'Alta',
};

function formatAcquired(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Chiave stabile e unica: i granuli sovrapposti possono dare righe identiche su
 *  lat/lon/ora/satellite, e chiavi duplicate fanno sbagliare la riconciliazione. */
function pointKey(p: FirePoint, i: number): string {
  return `${p.lat}-${p.lon}-${p.acquiredAt}-${p.satellite}-${i}`;
}

export function EmergencyPointsLayer({ points }: { points: FirePoint[] }) {
  const map = useMap();

  // Spec §4.5: CircleMarker su renderer canvas. Con l'SVG di default ogni punto è un
  // nodo <path> nel DOM; su canvas sono disegni in un singolo elemento.
  const renderer = useMemo(() => L.canvas({ pane: EMERGENCY_PANE, padding: 0.3 }), []);

  // Ricalcolo a fine pan/zoom (non a ogni frame): il culling dipende dalla vista.
  const [viewTick, setViewTick] = useState(0);
  useMapEvents({
    moveend: () => setViewTick((t) => t + 1),
    zoomend: () => setViewTick((t) => t + 1),
  });

  const visible = useMemo(() => {
    const b = map.getBounds();
    const latPad = (b.getNorth() - b.getSouth()) * VIEW_PAD;
    const lonPad = (b.getEast() - b.getWest()) * VIEW_PAD;
    const inView = points.filter((p) => (
      p.lat >= b.getSouth() - latPad && p.lat <= b.getNorth() + latPad
      && p.lon >= b.getWest() - lonPad && p.lon <= b.getEast() + lonPad
    ));
    if (inView.length <= MAX_RENDERED) return inView;
    // Solo se la vista da sola supera il tetto (mappa molto larga) si sceglie, e
    // allora la potenza è il criterio sensato.
    return [...inView].sort((a, b2) => b2.frp - a.frp).slice(0, MAX_RENDERED);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, map, viewTick]);

  const now = new Date();
  return (
    <>
      {visible.map((p, i) => {
        const c = fireColor(p.acquiredAt, now);
        return (
          <CircleMarker
            key={pointKey(p, i)}
            center={[p.lat, p.lon]}
            radius={6}
            pane={EMERGENCY_PANE}
            renderer={renderer}
            // Col renderer canvas il bersaglio DOM del click è la tela, non un <path>:
            // `Map._findEventTargets` non riconosce il layer e aggiunge la MAPPA come
            // bersaglio di fallback, quindi `_fireDOMEvent` fa scattare marker *e* mappa
            // (leaflet-src.js:4535-4541) e MapEvents aggiunge un waypoint. `Path` ha
            // `bubblingMouseEvents: true` per default — `Marker` no, ed è la ragione per
            // cui i waypoint non hanno mai avuto questo problema.
            bubblingMouseEvents={false}
            pathOptions={{ color: c, fillColor: c, fillOpacity: 0.7, weight: 1 }}
            // Il popup si costruisce al click, non al mount: prima ogni punto creava
            // subito un'istanza L.Popup con i suoi listener sulla mappa, rendendo il
            // dispatch degli eventi proporzionale al numero di focolai.
            eventHandlers={{
              click: (e) => {
                L.popup({ className: 'emergency-fire-popup' })
                  .setLatLng(e.latlng)
                  .setContent(firePopupHtml(p))
                  .openOn(map);
              },
            }}
          />
        );
      })}
    </>
  );
}

/** Contenuto del popup come HTML: i valori vengono da un CSV esterno, quindi passano
 *  dall'escaping condiviso prima di finire in innerHTML. */
export function firePopupHtml(p: FirePoint): string {
  const rows = [
    `Rilevata: ${formatAcquired(p.acquiredAt)}`,
    `Satellite: ${p.satellite}`,
    `Potenza (FRP): ${p.frp} MW`,
    `Confidenza: ${CONFIDENCE_LABELS[p.confidence]}`,
  ];
  return (
    '<div style="min-width:170px;font-size:12px">'
    + '<div style="font-weight:700;margin-bottom:4px">🔥 Anomalia termica</div>'
    + rows.map((r) => `<div>${escapeMarkup(r)}</div>`).join('')
    + '<div style="font-size:10px;color:#6b7280;margin-top:4px">'
    + 'Rilevazione satellitare NASA FIRMS — non è la conferma di un incendio in corso.'
    + '</div></div>'
  );
}

/** Esportato per i test: quanti punti al massimo vengono disegnati. */
export const MAX_RENDERED_POINTS = MAX_RENDERED;
