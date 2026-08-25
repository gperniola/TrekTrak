'use client';

import { GeoJSON } from 'react-leaflet';
import type L from 'leaflet';
import { DPC_LEVEL_COLORS, zonePopupHtml, type DpcZone } from '@/lib/dpc';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';

export function zoneStyle(level: 1 | 2 | 3): L.PathOptions {
  const color = DPC_LEVEL_COLORS[level];
  return { color, fillColor: color, fillOpacity: 0.35, weight: 1.5 };
}

export function EmergencyZonesLayer({
  zones, dayLabel, issuedLabel,
}: { zones: DpcZone[]; dayLabel: string; issuedLabel: string }) {
  const alerted = zones.filter((z) => z.maxLevel > 0);
  return (
    <>
      {alerted.map((z) => (
        <GeoJSON
          // key con giorno+bollettino: al cambio dati il layer viene ricreato
          key={`${z.name}-${dayLabel}-${issuedLabel}`}
          data={z.feature}
          pane={EMERGENCY_PANE}
          style={() => zoneStyle(z.maxLevel as 1 | 2 | 3)}
          onEachFeature={(_f, layer) => {
            layer.bindPopup(zonePopupHtml(z, dayLabel, `Bollettino del ${issuedLabel}`));
          }}
        />
      ))}
    </>
  );
}
