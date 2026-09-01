import { REGISTRO, esportatore, gpxExporter, jsonExporter, nomeFile } from '@/lib/exporters/registro';
import { generateKML, kmlExporter } from '@/lib/exporters/kml';
import { conCoordinate } from '@/lib/exporters/tipi';
import type { Itinerary, Leg, Waypoint } from '@/lib/types';

/**
 * TASK-28. JSON e GPX ripetevano lo stesso pezzo di codice per consegnare il file —
 * Blob, `<a download>`, appendi, clicca, rimuovi, revoca dopo un secondo — e ogni
 * formato nuovo l'avrebbe ripetuto una terza volta. Il registry tiene il **cosa** nel
 * formato e il **come** in un posto solo.
 */

const wp = (id: string, nome: string, lat: number | null, lon: number | null, alt: number | null = 1000): Waypoint =>
  ({ id, name: nome, lat, lon, altitude: alt, order: 0 });

const itinerario = (over: Partial<Itinerary> = {}): Itinerary => ({
  id: 'i1',
  name: 'Anello del Gran Sasso',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  waypoints: [wp('a', 'Campo Imperatore', 42.4419, 13.5595, 2130), wp('b', 'Corno Grande', 42.4715, 13.5642, 2912)],
  legs: [{ id: 'l0', fromWaypointId: 'a', toWaypointId: 'b' } as Leg],
  ...over,
});

describe('il registry', () => {
  test('gli id sono unici: sono chiavi React e chiavi dei test', () => {
    const ids = REGISTRO.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('ogni formato dichiara etichetta, descrizione, estensione e mime', () => {
    for (const e of REGISTRO) {
      expect(e.etichetta.length).toBeGreaterThan(1);
      expect(e.descrizione.length).toBeGreaterThan(10);
      expect(e.estensione).toMatch(/^[a-z]+$/);
      expect(e.mime).toContain('/');
    }
  });

  /**
   * `impedimento` torna la RAGIONE e non un booleano: chi disegna il menu deve poter
   * dire cosa manca. Un pulsante grigio senza spiegazione era il difetto della v0.11.8.
   */
  test('l impedimento e una frase, non un no secco', () => {
    const vuoto = itinerario({ waypoints: [] });
    expect(gpxExporter.impedimento(vuoto)).toMatch(/almeno 2 waypoint con coordinate/);
    expect(kmlExporter.impedimento(vuoto)).toMatch(/almeno 2 waypoint con coordinate/);
  });

  test('con due waypoint validi nessuno ha impedimenti', () => {
    for (const e of REGISTRO) expect(e.impedimento(itinerario())).toBeNull();
  });

  /** Un itinerario vuoto si esporta comunque in JSON: il file c'e', e' solo senza punti. */
  test('il JSON non ha impedimenti nemmeno a vuoto', () => {
    expect(jsonExporter.impedimento(itinerario({ waypoints: [], legs: [] }))).toBeNull();
  });

  test('i waypoint senza coordinate non contano', () => {
    const misto = itinerario({ waypoints: [wp('a', 'A', 42, 13), wp('b', 'B', null, null)] });
    expect(conCoordinate(misto)).toHaveLength(1);
    expect(gpxExporter.impedimento(misto)).not.toBeNull();
  });

  test('esportatore trova per id e non inventa', () => {
    expect(esportatore('kml')).toBe(kmlExporter);
    expect(esportatore('shapefile')).toBeUndefined();
  });

  /** Il profilo altimetrico si ricalcola al caricamento e pesa: fuori dal JSON. */
  test('il JSON non porta il profilo altimetrico', () => {
    const conProfilo = itinerario({
      legs: [{ id: 'l0', fromWaypointId: 'a', toWaypointId: 'b', elevationProfile: [{ distance: 0, altitude: 100 }] } as Leg],
    });
    expect(jsonExporter.contenuto(conProfilo)).not.toContain('elevationProfile');
  });
});

describe('il nome del file', () => {
  test('viene dal nome dell itinerario, con l estensione del formato', () => {
    expect(nomeFile(kmlExporter, itinerario())).toBe('Anello del Gran Sasso.kml');
    expect(nomeFile(gpxExporter, itinerario())).toBe('Anello del Gran Sasso.gpx');
  });

  test('senza nome c e un ripiego, non un file che si chiama punto-kml', () => {
    expect(nomeFile(kmlExporter, itinerario({ name: '' }))).toBe('trektrak-itinerario.kml');
  });

  /** I caratteri che Windows non accetta nei nomi di file diventano trattini bassi. */
  test('i caratteri proibiti non arrivano al disco', () => {
    expect(nomeFile(kmlExporter, itinerario({ name: 'Giro: "A/B" <2026>' })))
      .toBe('Giro_ _A_B_ _2026_.kml');
  });
});

/**
 * Il KML e' entrato come **prova che il registry funziona**: se aggiungere un formato
 * costa un file e una riga nell'elenco, la struttura ha fatto il suo mestiere.
 */
describe('KML', () => {
  test('e un documento con i segnaposti e la linea', () => {
    const kml = generateKML(itinerario());
    expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(kml).toContain('xmlns="http://www.opengis.net/kml/2.2"');
    expect(kml).toContain('<name>Campo Imperatore</name>');
    expect(kml).toContain('<name>Corno Grande</name>');
    expect(kml).toContain('<LineString>');
  });

  /**
   * **In KML si scrive `lon,lat,quota`**, longitudine per prima: e' l'inverso di GPX, di
   * Leaflet e di come si dicono a voce. Scambiarle manda il percorso al largo della
   * Somalia, dove finisce quasi tutta l'Europa con le coordinate invertite.
   */
  test('le coordinate hanno la longitudine per prima', () => {
    const kml = generateKML(itinerario());
    expect(kml).toContain('<coordinates>13.5595,42.4419,2130</coordinates>');
    // e non il contrario
    expect(kml).not.toContain('42.4419,13.5595');
  });

  test('senza quota nota scrive zero, non lascia il campo a meta', () => {
    const kml = generateKML(itinerario({
      waypoints: [wp('a', 'A', 42, 13, null), wp('b', 'B', 43, 14, null)],
    }));
    expect(kml).toContain('<coordinates>13,42,0</coordinates>');
  });

  test('la linea segue la geometria del sentiero dove c e', () => {
    const kml = generateKML(itinerario({
      legs: [{ id: 'l0', fromWaypointId: 'a', toWaypointId: 'b', routeGeometry: [[42.44, 13.55], [42.45, 13.56], [42.47, 13.56]] } as Leg],
    }));
    // il punto intermedio della geometria, con lon per prima
    expect(kml).toContain('13.56,42.45,0');
  });

  test('con un waypoint solo non inventa una linea', () => {
    const kml = generateKML(itinerario({ waypoints: [wp('a', 'A', 42, 13)], legs: [] }));
    expect(kml).not.toContain('<LineString>');
    expect(kml).toContain('<name>A</name>');
  });

  /** `tessellate` fa aderire la linea al terreno: senza, e' un filo teso sopra le valli. */
  test('la linea aderisce al terreno', () => {
    expect(generateKML(itinerario())).toContain('<tessellate>1</tessellate>');
  });

  test('i nomi con caratteri speciali non rompono il documento', () => {
    const kml = generateKML(itinerario({
      name: 'Giro <dei> "Tre" & Compagni',
      waypoints: [wp('a', 'Rifugio <A>', 42, 13), wp('b', 'B & C', 43, 14)],
    }));
    expect(kml).toContain('&lt;dei&gt;');
    expect(kml).toContain('&amp;');
    expect(kml).not.toMatch(/<name>[^<]*<dei>/);
  });
});
