'use client';

import { useMemo } from 'react';
import type L from 'leaflet';
import { WMSTileLayer } from 'react-leaflet';
import type { EmergencyLayerDef } from '@/lib/emergency-layers';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { toYmd } from '@/lib/dpc';

export function wmsTimeParam(mode: 'today' | 'yearToDate', now: Date): string {
  const today = toYmd(now);
  return mode === 'today' ? today : `${now.getFullYear()}-01-01/${today}`;
}

export function EmergencyWmsLayer({ def }: { def: EmergencyLayerDef }) {
  // `nowTick` (5 min) fa ricalcolare TIME al cambio di giorno: senza, una sessione
  // aperta oltre la mezzanotte continuava a chiedere il FWI del giorno prima sotto
  // l'etichetta "Pericolo incendio oggi".
  const nowTick = useEmergencyStore((s) => s.nowTick);
  const reportWmsTile = useEmergencyStore((s) => s.reportWmsTile);

  const time = def.wms ? wmsTimeParam(def.wms.timeMode, new Date(nowTick)) : '';

  // I params DEVONO essere memoizzati: react-leaflet li confronta per riferimento
  // (`props.params !== prevProps.params` in WMSTileLayer.js) e su differenza chiama
  // `setParams`, che fa `redraw()` — cioè scarta e riscarica tutti i tile visibili.
  // Con un oggetto letterale ricostruito a ogni render, ogni re-render bombardava il
  // WMS pubblico di Copernicus.
  const params = useMemo(
    () => ({
      layers: def.wms?.layers ?? '',
      format: 'image/png',
      transparent: true,
      time,
    }) as L.WMSParams & { time: string },
    [def.wms?.layers, time]
  );

  if (!def.wms) return null;
  return (
    <WMSTileLayer
      key={`${def.id}-${time}`}
      url={def.wms.url}
      params={params}
      opacity={def.wms.opacity}
      pane={EMERGENCY_PANE}
      eventHandlers={{
        tileload: () => reportWmsTile(def.id, 'load'),
        tileerror: () => reportWmsTile(def.id, 'error'),
      }}
    />
  );
}
