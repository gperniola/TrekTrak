'use client';

import { useRef } from 'react';
import L from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import type { EmergencyLayerDef } from '@/lib/emergency-layers';
import { queryFeatureInfo, type FeatureInfoResult } from '@/lib/wms-featureinfo';
import { escapeMarkup } from '@/lib/escape-markup';
import type { SorgenteNeve } from '@/lib/neve-sorgente';
import { testoPunto } from '@/lib/neve-composito';
import { wmsTimeParam } from './EmergencyWmsLayer';

/**
 * Rende interrogabili i layer WMS di emergenza con una **pressione lunga** sulla mappa
 * (click destro su desktop).
 *
 * Perché non il click normale: sulla mappa il click significa già "aggiungi waypoint",
 * ed è il gesto centrale dell'app. Sovraccaricarlo ricreerebbe esattamente il difetto
 * per cui un tap dava popup *e* waypoint. `contextmenu` invece è un gesto già
 * riservato — `MapEvents` lo gestisce come no-op proprio per non creare waypoint — ed
 * è disponibile su tutte le piattaforme: click destro su desktop, pressione lunga
 * nativa su Android, e su Safari iOS la sintetizza Leaflet (handler `TapHold`).
 * Leaflet fa già `preventDefault` sul contextmenu, quindi il menu del browser non
 * compare.
 */
export function EmergencyFeatureInfo({
  defs,
  neve = null,
}: {
  defs: EmergencyLayerDef[];
  neve?: SorgenteNeve | null;
}) {
  const map = useMap();
  // Una pressione lunga che ne segue un'altra ancora in corso la sostituisce: la
  // vecchia non deve riaprire un popup (o riscriverlo) quando la sua risposta arriva tardi.
  const richiestaRef = useRef<AbortController | null>(null);

  useMapEvents({
    contextmenu: (e) => {
      const queryable = defs.filter((d) => d.wms?.queryable);
      if (queryable.length === 0 && !neve) return;

      richiestaRef.current?.abort();
      const richiesta = new AbortController();
      richiestaRef.current = richiesta;

      const popup = L.popup({ className: 'emergency-featureinfo-popup' })
        .setLatLng(e.latlng)
        .setContent('<div style="font-size:12px">Interrogazione in corso…</div>')
        .openOn(map);

      const size = map.getSize();
      const bounds = map.getBounds();
      const sw = map.options.crs!.project(bounds.getSouthWest());
      const ne = map.options.crs!.project(bounds.getNorthEast());
      const point = map.latLngToContainerPoint(e.latlng);

      void (async () => {
        // La neve parte subito e corre in parallelo al WMS. `punto` non rifiuta se non
        // per l'abort nostro: qualunque altro guasto diventa «dettagli non disponibili».
        const rigaNeve: Promise<string | null> = neve
          ? neve.punto(e.latlng.lat, e.latlng.lng, richiesta.signal).then(
              (stato) => testoPunto(stato),
              () => 'Neve: dettagli non disponibili',
            )
          : Promise.resolve(null);
        const results: Array<{ def: EmergencyLayerDef; result: FeatureInfoResult }> = [];
        let failed = false;
        for (const def of queryable) {
          try {
            const result = await queryFeatureInfo({
              url: def.wms!.url,
              layer: def.wms!.layers,
              time: wmsTimeParam(def.wms!.timeMode, new Date()),
              bbox3857: [sw.x, sw.y, ne.x, ne.y],
              size: { x: size.x, y: size.y },
              point: { x: point.x, y: point.y },
            });
            if (result) results.push({ def, result });
          } catch {
            failed = true;
          }
        }
        const testoNeve = await rigaNeve;
        if (richiesta.signal.aborted) return;
        popup.setContent(renderContent(results, failed, testoNeve, queryable.length > 0));
      })();
    },
  });

  return null;
}

function renderContent(
  results: Array<{ def: EmergencyLayerDef; result: FeatureInfoResult }>,
  failed: boolean,
  testoNeve: string | null,
  haWms: boolean
): string {
  const riga = testoNeve === null
    ? ''
    : `<div style="font-size:12px;font-weight:600">${escapeMarkup(testoNeve)}</div>`;
  const wms = renderWms(results, failed, haWms);
  if (!riga) return wms;
  if (!wms) return riga;
  return riga + '<hr style="border:0;border-top:1px solid #374151;margin:6px 0">' + wms;
}

function renderWms(
  results: Array<{ def: EmergencyLayerDef; result: FeatureInfoResult }>,
  failed: boolean,
  haWms: boolean
): string {
  // Col solo layer neve non c'e' nessun WMS da interrogare: niente riga «nessun dato».
  if (!haWms) return '';
  if (results.length === 0) {
    // "Qui non c'è nulla" è un'informazione, non un errore: va detta come tale.
    const msg = failed
      ? 'Dettagli non disponibili'
      : 'Nessun dato di emergenza in questo punto';
    return `<div style="font-size:12px;color:var(--tenue)">${escapeMarkup(msg)}</div>`;
  }
  // Tutto ciò che arriva da EFFIS passa dall'escaping: sono dati di terze parti.
  return results
    .map(({ result }) => (
      '<div style="min-width:190px;font-size:12px">'
      + `<div style="font-weight:700;margin-bottom:4px">${escapeMarkup(result.title)}</div>`
      + result.fields
        .map((f) => (
          '<div style="display:flex;justify-content:space-between;gap:8px">'
          + `<span>${escapeMarkup(f.label)}</span>`
          + `<span style="font-weight:600">${escapeMarkup(f.value)}</span>`
          + '</div>'
        ))
        .join('')
      + '</div>'
    ))
    .join('<hr style="border:0;border-top:1px solid #374151;margin:6px 0">');
}
