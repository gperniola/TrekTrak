import type { Itinerary } from './types';
import { sanitizeFilename } from './format';

export function exportItineraryJSON(itinerary: Itinerary): void {
  const json = JSON.stringify(itinerary, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(itinerary.name || 'trektrak-itinerario')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function validateItinerarySchema(data: unknown): data is Itinerary {
  if (typeof data !== 'object' || data == null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== 'string') return false;
  if (typeof obj.name !== 'string') return false;
  if (!Array.isArray(obj.waypoints)) return false;
  if (!Array.isArray(obj.legs)) return false;
  if (typeof obj.createdAt !== 'string') return false;
  if (typeof obj.updatedAt !== 'string') return false;
  const wpIds = new Set<string>();
  for (const wp of obj.waypoints) {
    if (typeof wp !== 'object' || wp == null) return false;
    if (typeof wp.id !== 'string' || typeof wp.name !== 'string' || typeof wp.order !== 'number') return false;
    if (wpIds.has(wp.id)) return false;
    wpIds.add(wp.id);
    if (wp.lat != null && (typeof wp.lat !== 'number' || !Number.isFinite(wp.lat) || wp.lat < -90 || wp.lat > 90)) return false;
    if (wp.lon != null && (typeof wp.lon !== 'number' || !Number.isFinite(wp.lon) || wp.lon < -180 || wp.lon > 180)) return false;
    if (wp.altitude != null && (typeof wp.altitude !== 'number' || !Number.isFinite(wp.altitude))) return false;
  }
  const legIds = new Set<string>();
  for (const leg of obj.legs) {
    if (typeof leg !== 'object' || leg == null) return false;
    if (typeof leg.id !== 'string' || typeof leg.fromWaypointId !== 'string' || typeof leg.toWaypointId !== 'string') return false;
    if (legIds.has(leg.id)) return false;
    legIds.add(leg.id);
    if (leg.distance != null && (typeof leg.distance !== 'number' || !Number.isFinite(leg.distance) || leg.distance < 0)) return false;
    if (leg.elevationGain != null && (typeof leg.elevationGain !== 'number' || !Number.isFinite(leg.elevationGain) || leg.elevationGain < 0)) return false;
    if (leg.elevationLoss != null && (typeof leg.elevationLoss !== 'number' || !Number.isFinite(leg.elevationLoss) || leg.elevationLoss < 0)) return false;
    if (leg.azimuth != null && (typeof leg.azimuth !== 'number' || !Number.isFinite(leg.azimuth) || leg.azimuth < 0 || leg.azimuth > 360)) return false;
  }
  return true;
}

export function importItineraryJSON(onLoad: (itinerary: Itinerary) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!validateItinerarySchema(parsed)) {
          alert('File JSON non valido: struttura dati non conforme');
          return;
        }
        onLoad(parsed);
      } catch {
        alert('Errore nel parsing del file JSON');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
