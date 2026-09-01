import type { Rettangolo } from './tile-offline';

/**
 * Cosa deve guardare la mappa quando si apre, e se seguire il GPS quando arriva (task-61).
 *
 * **Il difetto che ha reso necessario questo file.** Si scaricavano le mattonelle del
 * proprio itinerario e poi, riaprendo l'app, la mappa mostrava il centro predefinito.
 * Con il GPS acceso non si nota — sei sul percorso e la mappa ti segue. Il caso che
 * brucia è l'altro, ed è **esattamente quello per cui esiste il pre-caricamento**: apro
 * l'app senza segnale e senza posizione, ho la mappa del mio itinerario sul telefono, e
 * mi trovo davanti un altro pezzo d'Italia. Il percorso c'è, ma per arrivarci devo
 * trascinare la mappa a mano finché non lo incontro — attraversando, per giunta, aree
 * che non ho scaricato.
 *
 * Le decisioni stanno qui, senza Leaflet, perché sono decisioni: quale vista vince
 * all'apertura, e se un fix GPS deve spostare la mappa o no. In `GeolocateOnMount`
 * resta solo il fare.
 *
 * `Rettangolo` arriva da `tile-offline` invece di essere ridichiarato: è lo stesso
 * riquadro che quel modulo calcola dall'itinerario, ed è proprio il legame che questo
 * lavoro vuole rendere vero — si inquadra ciò che si è scaricato.
 */

export interface VistaSalvata {
  lat: number;
  lng: number;
  z: number;
}

export type VistaIniziale =
  | { tipo: 'salvata'; vista: VistaSalvata }
  | { tipo: 'itinerario'; rettangolo: Rettangolo }
  | { tipo: 'predefinita' };

/**
 * Entro quanti chilometri dall'itinerario un fix GPS conta come «sei lì».
 *
 * Cinque: la distanza fra un parcheggio e l'attacco di un sentiero sta dentro; la
 * distanza fra casa e la montagna no. È la soglia che separa «sto camminando» da «sto
 * preparando la gita al tavolo», e sono i due soli modi in cui questa app viene aperta.
 */
export const VICINANZA_KM = 5;

/**
 * Il massimo ingrandimento a cui l'inquadramento automatico può arrivare.
 *
 * Serve al caso di **un waypoint solo**: il riquadro è di dimensione zero, e `fitBounds`
 * su un riquadro nullo porta Leaflet al massimo consentito — si aprirebbe l'app incollati
 * a un tetto, senza contesto. Quindici è la scala a cui si vede ancora dove si è.
 */
export const MAX_ZOOM_INQUADRAMENTO = 15;

/**
 * Quale vista vince all'apertura.
 *
 * L'ordine non è arbitrario. La **vista salvata** è una promessa che l'app faceva già
 * prima di questo lavoro: dentro una sessione, un remount o una ricarica non spostano la
 * mappa da dove la si stava guardando. Un itinerario ripristinato non è una buona ragione
 * per romperla — se stai guardando lì, ci sei andato apposta.
 */
export function vistaIniziale(
  salvata: VistaSalvata | null,
  itinerario: Rettangolo | null,
): VistaIniziale {
  if (salvata != null) return { tipo: 'salvata', vista: salvata };
  if (itinerario != null) return { tipo: 'itinerario', rettangolo: itinerario };
  return { tipo: 'predefinita' };
}

/**
 * Quanto dista un punto dal rettangolo, in chilometri. Zero se ci sta dentro.
 *
 * In longitudine un grado vale meno che in latitudine, e quanto meno dipende da dove ci
 * si trova: alle latitudini italiane il fattore è circa 0,74. Ignorarlo gonfierebbe le
 * distanze est-ovest di un terzo — abbastanza da far sembrare «lontano» chi è al
 * parcheggio.
 */
export function distanzaDalRettangoloKm(
  punto: { lat: number; lon: number },
  r: Rettangolo,
): number {
  const fuoriLat = Math.max(r.south - punto.lat, punto.lat - r.north, 0);
  const fuoriLon = Math.max(r.west - punto.lon, punto.lon - r.east, 0);
  const km = (g: number, fattore: number) => g * fattore;
  return Math.hypot(
    km(fuoriLat, 110.574),
    km(fuoriLon, 111.32 * Math.cos((punto.lat * Math.PI) / 180)),
  );
}

/**
 * Se, arrivato il fix GPS, la mappa deve spostarcisi.
 *
 * Il caso che ha motivato la regola: si prepara la gita **da casa**. La mappa inquadra
 * l'itinerario, poi il GPS dice «Roma». Seguirlo vorrebbe dire sbalzare via dal percorso
 * proprio la persona che lo sta guardando — e per giunta su mattonelle che non sono
 * state scaricate.
 */
export function seguireLaPosizione(args: {
  posizione: { lat: number; lon: number };
  partenza: VistaIniziale;
  utenteHaMosso: boolean;
}): boolean {
  const { posizione, partenza, utenteHaMosso } = args;
  // Chi ha toccato la mappa ha detto dove vuole guardare: e' una garanzia che c'era gia'.
  if (utenteHaMosso) return false;
  if (partenza.tipo === 'salvata') return false;
  if (partenza.tipo === 'predefinita') return true;
  return distanzaDalRettangoloKm(posizione, partenza.rettangolo) <= VICINANZA_KM;
}
