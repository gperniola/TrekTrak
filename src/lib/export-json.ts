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
        const itinerary = JSON.parse(ev.target?.result as string) as Itinerary;
        if (!itinerary.waypoints || !itinerary.legs) {
          alert('File JSON non valido: mancano waypoints o legs');
          return;
        }
        onLoad(itinerary);
      } catch {
        alert('Errore nel parsing del file JSON');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
