import type { Itinerary, Leg, Waypoint } from '../types';
import { escapeMarkup } from '../escape-markup';
import { conCoordinate, type Exporter } from './tipi';

/**
 * KML, il formato di Google Earth.
 *
 * È stato aggiunto come **prova che il registry funziona**: se aggiungere un formato
 * costa un file come questo e una riga nell'elenco, allora la struttura ha fatto il suo
 * mestiere. È anche utile di suo — Google Earth mostra il percorso drappeggiato sul
 * rilievo, che per capire un itinerario di montagna dice più di una mappa piatta.
 */

/**
 * **In KML le coordinate si scrivono `lon,lat,quota`**, cioè longitudine per prima.
 *
 * È l'inverso di GPX, di Leaflet e di come si dicono a voce, ed è l'errore classico di
 * chi scrive un KML la prima volta: il percorso finisce in mezzo all'oceano al largo
 * della Somalia, dove (lat, lon) scambiate mandano quasi tutta l'Europa.
 */
function coordinata(wp: Pick<Waypoint, 'lat' | 'lon' | 'altitude'>): string {
  const quota = wp.altitude != null && Number.isFinite(wp.altitude) ? wp.altitude : 0;
  return `${wp.lon},${wp.lat},${quota}`;
}

/** La linea segue i sentieri veri dove ci sono, come fa il GPX. */
function puntiDelPercorso(waypoints: Waypoint[], legs: Leg[]): string[] {
  const punti: string[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (i > 0) {
      const precedente = waypoints[i - 1];
      const leg = legs.find((l) => l.fromWaypointId === precedente.id && l.toWaypointId === wp.id);
      if (leg?.routeGeometry && leg.routeGeometry.length >= 2) {
        for (let j = 1; j < leg.routeGeometry.length - 1; j++) {
          const [lat, lon] = leg.routeGeometry[j];
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          punti.push(`${lon},${lat},0`);
        }
      }
    }
    punti.push(coordinata(wp));
  }
  return punti;
}

export function generateKML(itinerary: Itinerary): string {
  const wps = conCoordinate(itinerary);
  const nome = escapeMarkup(itinerary.name || 'Itinerario TrekTrak');

  const segnaposti = wps.map((wp, i) => `    <Placemark>
      <name>${escapeMarkup(wp.name || `Waypoint ${i + 1}`)}</name>
      <Point><coordinates>${coordinata(wp)}</coordinates></Point>
    </Placemark>`).join('\n');

  // `tessellate` fa aderire la linea al terreno invece di farla volare in linea retta
  // fra le quote: su un itinerario di montagna e' la differenza fra vedere il sentiero
  // e vedere un filo teso sopra le valli.
  const linea = wps.length >= 2 ? `    <Placemark>
      <name>${nome}</name>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${puntiDelPercorso(wps, itinerary.legs).join(' ')}</coordinates>
      </LineString>
    </Placemark>` : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    `    <name>${nome}</name>`,
    segnaposti,
    linea,
    '  </Document>',
    '</kml>',
  ].filter((r) => r !== '').join('\n');
}

export const kmlExporter: Exporter = {
  id: 'kml',
  etichetta: 'KML',
  descrizione: 'Per Google Earth: il percorso drappeggiato sul rilievo',
  estensione: 'kml',
  mime: 'application/vnd.google-earth.kml+xml',
  impedimento: (it) =>
    conCoordinate(it).length < 2 ? 'servono almeno 2 waypoint con coordinate' : null,
  contenuto: generateKML,
};
