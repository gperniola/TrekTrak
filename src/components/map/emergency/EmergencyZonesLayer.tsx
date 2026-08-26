'use client';

import { useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import type L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { DPC_LEVEL_COLORS, zonePopupHtml, type DpcZone } from '@/lib/dpc';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';

export function zoneStyle(level: 1 | 2 | 3): L.PathOptions {
  const color = DPC_LEVEL_COLORS[level];
  return { color, fillColor: color, fillOpacity: 0.35, weight: 1.5 };
}

export function EmergencyZonesLayer({
  zones, dayLabel, issuedLabel,
}: { zones: DpcZone[]; dayLabel: string; issuedLabel: string }) {
  // Una sola FeatureCollection, e quindi un solo layer Leaflet. Prima si montava un
  // <GeoJSON> per zona: in una giornata arancione sono decine di layer separati,
  // aggiunti e distrutti a ogni refresh da 30 minuti e a ogni tap sul selettore
  // giorni, perché la key conteneva dayLabel e issuedLabel.
  const collection = useMemo<FeatureCollection<Geometry, { __zoneIndex: number }>>(() => ({
    type: 'FeatureCollection',
    features: zones
      .filter((z) => z.maxLevel > 0)
      .map((z, i) => ({
        ...(z.feature as Feature<Geometry>),
        properties: { __zoneIndex: i },
      })),
  }), [zones]);

  const alerted = useMemo(() => zones.filter((z) => z.maxLevel > 0), [zones]);

  if (alerted.length === 0) return null;

  return (
    <GeoJSON
      // La key cambia solo quando cambiano davvero i dati mostrati.
      key={`dpc-${dayLabel}-${issuedLabel}-${alerted.length}`}
      data={collection}
      pane={EMERGENCY_PANE}
      style={(f) => {
        const z = alerted[(f?.properties as { __zoneIndex?: number } | undefined)?.__zoneIndex ?? 0];
        return zoneStyle((z?.maxLevel ?? 1) as 1 | 2 | 3);
      }}
      onEachFeature={(f, layer) => {
        const z = alerted[(f.properties as { __zoneIndex?: number } | null)?.__zoneIndex ?? 0];
        if (z) layer.bindPopup(zonePopupHtml(z, dayLabel, `Bollettino del ${issuedLabel}`));
      }}
    />
  );
}
