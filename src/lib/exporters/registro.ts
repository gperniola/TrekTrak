import type { Itinerary } from '../types';
import { sanitizeFilename } from '../format';
import { generateGPX } from '../export-gpx';
import { conCoordinate, type Exporter } from './tipi';
import { kmlExporter } from './kml';

/**
 * I formati in cui l'itinerario può uscire, in ordine di quanto sono usati.
 *
 * Il PDF resta fuori di proposito: non produce testo, ha due varianti (sintetico e
 * roadbook) e ha bisogno di metriche calcolate. Costringerlo in questa forma
 * significherebbe piegare l'interfaccia intorno all'eccezione invece che intorno ai casi
 * normali.
 */

export const jsonExporter: Exporter = {
  id: 'json',
  etichetta: 'JSON',
  descrizione: 'Il formato dell\'app: si riapre qui con tutti i dati',
  estensione: 'json',
  mime: 'application/json',
  // Un itinerario vuoto si esporta anche: il file c'e', e' solo senza waypoint.
  impedimento: () => null,
  contenuto: (it) => JSON.stringify(
    // Il profilo altimetrico si ricalcola al caricamento e pesa: fuori.
    { ...it, legs: it.legs.map(({ elevationProfile, ...leg }) => leg) },
    null,
    2,
  ),
};

export const gpxExporter: Exporter = {
  id: 'gpx',
  etichetta: 'GPX',
  descrizione: 'Per GPS e altre app di trekking',
  estensione: 'gpx',
  mime: 'application/gpx+xml',
  impedimento: (it) =>
    conCoordinate(it).length < 2 ? 'servono almeno 2 waypoint con coordinate' : null,
  contenuto: (it) => generateGPX(it.name, it.waypoints, it.legs),
};

export const REGISTRO: readonly Exporter[] = [gpxExporter, kmlExporter, jsonExporter];

export function esportatore(id: string): Exporter | undefined {
  return REGISTRO.find((e) => e.id === id);
}

/**
 * Consegna il file al browser.
 *
 * Il pezzo che prima era copiato in `export-json.ts` e `export-gpx.ts`, riga per riga:
 * Blob, URL, `<a download>` appeso al documento, click, rimozione, e la revoca dell'URL
 * dopo un secondo — senza quella l'oggetto resta in memoria finche' la scheda vive.
 */
/**
 * Il nome del file. Sta fuori da `downloadAs` per poterlo verificare senza mettere le
 * mani nel DOM: il resto di quella funzione e' consegna, questo e' una decisione.
 */
export function nomeFile(exporter: Exporter, itinerary: Itinerary): string {
  return `${sanitizeFilename(itinerary.name || 'trektrak-itinerario')}.${exporter.estensione}`;
}

export function downloadAs(exporter: Exporter, itinerary: Itinerary): void {
  const blob = new Blob([exporter.contenuto(itinerary)], { type: exporter.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile(exporter, itinerary);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
