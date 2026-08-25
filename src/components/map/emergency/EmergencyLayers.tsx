'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_PANE, getEmergencyLayer } from '@/lib/emergency-layers';
import { dayOptions } from '@/lib/dpc';
import { EmergencyWmsLayer } from './EmergencyWmsLayer';
import { EmergencyPointsLayer } from './EmergencyPointsLayer';
import { EmergencyZonesLayer } from './EmergencyZonesLayer';

export function EmergencyLayers() {
  const map = useMap();
  const activeIds = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers);
  const layers = useEmergencyStore((s) => s.layers);
  const startLayer = useEmergencyStore((s) => s.startLayer);
  const fires = useEmergencyStore((s) => s.fires);
  const dpc = useEmergencyStore((s) => s.dpc);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);

  // Pane dedicato: sopra i tile (200), sotto i tracciati (overlayPane 400).
  useEffect(() => {
    if (!map.getPane(EMERGENCY_PANE)) {
      const pane = map.createPane(EMERGENCY_PANE);
      pane.style.zIndex = '350';
    }
  }, [map]);

  // Riattivazione dei layer persistiti (startLayer è idempotente).
  useEffect(() => {
    for (const id of activeIds) {
      if (layers[id].status === 'idle') startLayer(id);
    }
  }, [activeIds, layers, startLayer]);

  // Attribution dinamica delle fonti attive.
  useEffect(() => {
    const defs = activeIds.map(getEmergencyLayer);
    defs.forEach((d) => map.attributionControl.addAttribution(d.attribution));
    return () => defs.forEach((d) => map.attributionControl.removeAttribution(d.attribution));
  }, [activeIds, map]);

  const dpcDay = dpc?.days.find((d) => d.date === dpcSelectedDate);
  const dpcLabel = dpc && dpcSelectedDate
    ? dayOptions(dpc.days.map((d) => d.date), new Date()).find((o) => o.date === dpcSelectedDate)?.label ?? ''
    : '';

  return (
    <>
      {activeIds.map((id) => {
        const def = getEmergencyLayer(id);
        if (def.kind === 'wms') return <EmergencyWmsLayer key={id} def={def} />;
        if (def.kind === 'points' && fires) return <EmergencyPointsLayer key={id} points={fires.points} />;
        if (def.kind === 'zones' && dpc && dpcDay) {
          return <EmergencyZonesLayer key={id} zones={dpcDay.zones} dayLabel={dpcLabel} issuedLabel={dpc.issuedLabel} />;
        }
        return null;
      })}
    </>
  );
}

export default EmergencyLayers;
