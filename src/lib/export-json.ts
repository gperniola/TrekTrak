import type { Itinerary } from './types';

export function exportItineraryJSON(itinerary: Itinerary): void {
  const json = JSON.stringify(itinerary, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${itinerary.name || 'trektrak-itinerario'}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
  for (const wp of obj.waypoints) {
    if (typeof wp !== 'object' || wp == null) return false;
    if (typeof wp.id !== 'string' || typeof wp.order !== 'number') return false;
    if (wp.lat != null && typeof wp.lat !== 'number') return false;
    if (wp.lon != null && typeof wp.lon !== 'number') return false;
    if (wp.altitude != null && typeof wp.altitude !== 'number') return false;
  }
  for (const leg of obj.legs) {
    if (typeof leg !== 'object' || leg == null) return false;
    if (typeof leg.id !== 'string' || typeof leg.fromWaypointId !== 'string' || typeof leg.toWaypointId !== 'string') return false;
    if (leg.distance != null && typeof leg.distance !== 'number') return false;
    if (leg.elevationGain != null && typeof leg.elevationGain !== 'number') return false;
    if (leg.elevationLoss != null && typeof leg.elevationLoss !== 'number') return false;
    if (leg.azimuth != null && typeof leg.azimuth !== 'number') return false;
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
