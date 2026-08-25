'use client';

import type L from 'leaflet';
import { WMSTileLayer } from 'react-leaflet';
import type { EmergencyLayerDef } from '@/lib/emergency-layers';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function wmsTimeParam(mode: 'today' | 'yearToDate', now: Date): string {
  const today = ymd(now);
  return mode === 'today' ? today : `${now.getFullYear()}-01-01/${today}`;
}

export function EmergencyWmsLayer({ def }: { def: EmergencyLayerDef }) {
  if (!def.wms) return null;
  // TIME è un parametro WMS non tipizzato da Leaflet: il cast estende WMSParams.
  const params = {
    layers: def.wms.layers,
    format: 'image/png',
    transparent: true,
    time: wmsTimeParam(def.wms.timeMode, new Date()),
  } as L.WMSParams & { time: string };
  return (
    <WMSTileLayer
      key={`${def.id}-${params.time}`}
      url={def.wms.url}
      params={params}
      opacity={def.wms.opacity}
      pane={EMERGENCY_PANE}
    />
  );
}
