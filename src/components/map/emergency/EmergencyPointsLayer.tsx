'use client';

import { CircleMarker, Popup } from 'react-leaflet';
import type { FirePoint } from '@/lib/firms';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

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

export function EmergencyPointsLayer({ points }: { points: FirePoint[] }) {
  const now = new Date();
  return (
    <>
      {points.map((p, i) => (
        <CircleMarker
          key={`${p.lat}-${p.lon}-${p.acquiredAt}-${i}`}
          center={[p.lat, p.lon]}
          radius={6}
          pane={EMERGENCY_PANE}
          pathOptions={{ color: fireColor(p.acquiredAt, now), fillColor: fireColor(p.acquiredAt, now), fillOpacity: 0.7, weight: 1 }}
        >
          <Popup>
            <div className="min-w-[170px] text-xs">
              <div className="font-bold mb-1">🔥 Anomalia termica</div>
              <div>Rilevata: {formatAcquired(p.acquiredAt)}</div>
              <div>Satellite: {p.satellite}</div>
              <div>Potenza (FRP): {p.frp} MW</div>
              <div>Confidenza: {CONFIDENCE_LABELS[p.confidence]}</div>
              <div className="text-[10px] text-gray-500 mt-1">
                Rilevazione satellitare NASA FIRMS — non è la conferma di un incendio in corso.
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
