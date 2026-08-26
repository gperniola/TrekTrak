'use client';

import { useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, useMap } from 'react-leaflet';
import type { FirePoint } from '@/lib/firms';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import { escapeMarkup } from '@/lib/escape-markup';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Tetto ai marker disegnati. In stagione la bbox italiana su 24 ore per tre sensori
 * VIIRS può dare migliaia di righe: montarle tutte insieme, ognuna con il suo popup,
 * bloccava la mappa per secondi sul telefono — che è il dispositivo per cui la
 * feature esiste. Si tengono i focolai più potenti, che sono quelli che contano.
 */
const MAX_RENDERED = 400;

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

  const visible = useMemo(() => {
    if (points.length <= MAX_RENDERED) return points;
    return [...points].sort((a, b) => b.frp - a.frp).slice(0, MAX_RENDERED);
  }, [points]);

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
