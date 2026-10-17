'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMap } from 'react-leaflet';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_PANE, getEmergencyLayer } from '@/lib/emergency-layers';
import { dayOptions } from '@/lib/dpc';
import { creaSorgenteNeve } from '@/lib/neve-sorgente';
import { inflateDelBrowser } from '@/lib/png-tavolozza';
import { EmergencyWmsLayer } from './EmergencyWmsLayer';
import { EmergencyPointsLayer } from './EmergencyPointsLayer';
import { EmergencyZonesLayer } from './EmergencyZonesLayer';
import { EmergencyRadarLayer } from './EmergencyRadarLayer';
import { EmergencyShelterLayer } from './EmergencyShelterLayer';
import { EmergencyQuakeLayer } from './EmergencyQuakeLayer';
import { EmergencyNeveLayer } from './EmergencyNeveLayer';
import { EmergencyAvalancheLayer } from './EmergencyAvalancheLayer';
import { EmergencyFeatureInfo } from './EmergencyFeatureInfo';

export function EmergencyLayers() {
  const map = useMap();
  const activeIds = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers);
  const layers = useEmergencyStore((s) => s.layers);
  const startLayer = useEmergencyStore((s) => s.startLayer);
  const fires = useEmergencyStore((s) => s.fires);
  const dpc = useEmergencyStore((s) => s.dpc);
  const radar = useEmergencyStore((s) => s.radar);
  const shelters = useEmergencyStore((s) => s.shelters);
  const quakes = useEmergencyStore((s) => s.quakes);
  const avalanche = useEmergencyStore((s) => s.avalanche);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);
  const tentativoNeve = useEmergencyStore((s) => s.retryTick['snow-cover'] ?? 0);

  /*
    La sorgente della neve vive qui e non nel layer: la pressione lunga interroga la stessa.
    Il popup non legge il composito disegnato a schermo: ricompone la mattonella z8 del
    punto, ma dalla memoria della sorgente (passaggi con dati e assenti ricordati), quindi
    di solito senza tornare in rete.

    Una sorgente nuova a ogni «Riprova»: memoria vuota, e il layer, che dipende da lei, si
    rimonta da capo. E' la garanzia del `retryTick` per i WMS. Le composizioni in corso
    della vecchia non si fermano: si abbandonano, finiscono per conto loro (ogni passaggio
    ha il suo timeout) e il layer smontato ne ignora l'esito.
  */
  const sorgenteNeve = useMemo(
    () => {
      void tentativoNeve; // la chiave del «Riprova»: non entra nella sorgente, la rifa'
      return creaSorgenteNeve({
        fetch: (url, init) => fetch(url, init),
        inflate: inflateDelBrowser,
        adesso: () => new Date(),
      });
    },
    [tentativoNeve],
  );

  // Pane dedicato: sopra i tile (200), sotto i tracciati (overlayPane 400).
  // ATTENZIONE all'ordine: React esegue gli effetti dei FIGLI prima di quelli del padre,
  // quindi i layer figli si agganciavano alla mappa quando il pane non esisteva ancora e
  // Leaflet crashava su `getPane(pane).appendChild(...)`. Si vedeva al reload con layer
  // persistiti (activeIds già pieno al primo render). Perciò i figli si montano solo a
  // pane pronto.
  const [paneReady, setPaneReady] = useState(false);
  useEffect(() => {
    if (!map.getPane(EMERGENCY_PANE)) {
      const pane = map.createPane(EMERGENCY_PANE);
      pane.style.zIndex = '350';
    }
    setPaneReady(true);
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

  // Layer attivi che rispondono a GetFeatureInfo: sono quelli che la pressione lunga
  // sulla mappa può interrogare.
  const queryableDefs = activeIds.map(getEmergencyLayer).filter((d) => d.wms?.queryable);

  const neveAccesa = activeIds.includes('snow-cover');

  if (!paneReady) return null;

  return (
    <>
      {activeIds.map((id) => {
        const def = getEmergencyLayer(id);
        if (def.kind === 'wms') return <EmergencyWmsLayer key={id} def={def} />;
        if (def.kind === 'points' && fires) return <EmergencyPointsLayer key={id} points={fires.points} />;
        if (def.kind === 'tiles' && radar) return <EmergencyRadarLayer key={id} radar={radar} />;
        if (def.kind === 'viewport') return <EmergencyShelterLayer key={id} shelters={shelters} />;
        if (def.kind === 'neve') return <EmergencyNeveLayer key={id} sorgente={sorgenteNeve} />;
        if (def.kind === 'quakes' && quakes) return <EmergencyQuakeLayer key={id} quakes={quakes} />;
        // Il layer valanghe si monta SEMPRE, anche senza dati: e' lui che interroga la
        // vista, quindi senza montarlo non arriverebbe mai niente da mostrare.
        if (def.kind === 'avalanche') return <EmergencyAvalancheLayer key={id} bollettino={avalanche} />;
        if (def.kind === 'zones' && dpc && dpcDay) {
          return <EmergencyZonesLayer key={id} zones={dpcDay.zones} dayLabel={dpcLabel} issuedLabel={dpc.issuedLabel} />;
        }
        return null;
      })}
      {(queryableDefs.length > 0 || neveAccesa) && (
        <EmergencyFeatureInfo defs={queryableDefs} neve={neveAccesa ? sorgenteNeve : null} />
      )}
    </>
  );
}

export default EmergencyLayers;
