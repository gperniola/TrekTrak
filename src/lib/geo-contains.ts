import type { Feature, Geometry, Position } from 'geojson';

/**
 * Test "il punto è dentro il poligono?" per le geometrie dei bollettini DPC.
 *
 * Ray casting su lon/lat trattate come piano cartesiano. È corretto a questa scala:
 * le zone di allerta sono regioni italiane, quindi nessuna attraversa l'antimeridiano
 * né contiene un polo, che sono i due casi in cui la semplificazione cade.
 *
 * Le geometrie reali del bollettino sono 134 Polygon e 53 MultiPolygon, e i Polygon
 * possono avere anelli interni (isole di esclusione): entrambi i casi vanno gestiti,
 * altrimenti si dichiara "sei in allerta" a chi sta in un buco.
 */

/**
 * Ray casting su un singolo anello.
 *
 * **I punti esattamente sul bordo non hanno risposta definita.** Misurando: sui lati
 * sud e ovest escono "dentro", su nord ed est "fuori", e sul bordo di un anello
 * interno il verso si ribalta. Non è un contratto che si possa asserire, quindi non
 * viene affermato: con coordinate GPS reali (dodici cifre decimali, incertezza di
 * metri) la coincidenza esatta con un vertice del bollettino non si presenta.
 */
export function pointInRing(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // Il punto è "sopra" un solo estremo del segmento, e la sua x sta a sinistra
    // dell'intersezione fra il segmento e l'orizzontale che passa per il punto.
    const attraversa = (yi > lat) !== (yj > lat)
      && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (attraversa) inside = !inside;
  }
  return inside;
}

/** Dentro l'anello esterno e fuori da tutti quelli interni. */
export function pointInPolygon(lon: number, lat: number, rings: Position[][]): boolean {
  if (rings.length === 0 || !pointInRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lon, lat, rings[i])) return false; // in un buco
  }
  return true;
}

/**
 * `true` dentro, `false` fuori, **`null` quando non è possibile stabilirlo** — cioè
 * per un tipo di geometria che non sappiamo interrogare.
 *
 * La distinzione fra "fuori" e "non lo so" non è pedanteria: un tipo inatteso che
 * ricadesse su `false` diventerebbe silenziosamente "non sei in nessuna zona in
 * allerta", che è la risposta pericolosa. Leaflet, per esempio, disegna anche le
 * `GeometryCollection`: una zona così sarebbe colorata sulla mappa sotto la posizione
 * dell'utente senza produrre alcun avviso.
 */
function geometryContainsPoint(
  geometry: Geometry | null | undefined, lon: number, lat: number
): boolean | null {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    return pointInPolygon(lon, lat, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((rings) => pointInPolygon(lon, lat, rings));
  }
  if (geometry.type === 'GeometryCollection') {
    let indeterminato = false;
    for (const g of geometry.geometries) {
      const r = geometryContainsPoint(g, lon, lat);
      if (r === true) return true;
      if (r === null) indeterminato = true;
    }
    return indeterminato ? null : false;
  }
  return null;
}

export function featureContainsPoint(
  feature: Feature | null | undefined, lon: number, lat: number
): boolean | null {
  if (!feature) return null;
  return geometryContainsPoint(feature.geometry, lon, lat);
}
