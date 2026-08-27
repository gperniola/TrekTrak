/**
 * Rifugi, bivacchi e ricoveri da **OpenStreetMap**, via Overpass.
 *
 * È il layer che rende *azionabile* un avviso di temporale: non "sta arrivando", ma
 * "dove mi metto". Per questo sta accanto ai layer di emergenza e non fra i punti di
 * interesse.
 *
 * Due limiti misurati il 2026-08-27, che il progetto deve tollerare:
 * - l'istanza pubblica ha risposto **504**, e il mirror kumi **502**: l'indisponibilità
 *   è normale, non eccezionale, quindi il layer deve dirlo invece di sembrare vuoto;
 * - la risposta è per **area inquadrata**, non per l'Italia: si interroga la vista, e
 *   sotto un certo zoom si chiede di avvicinarsi invece di scaricare mezza Europa.
 */

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

export const ATTRIBUZIONE_RIPARI = 'Rifugi e ricoveri: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Sotto questo zoom la bbox è troppo grande: la query diventa lenta e inutile. */
export const ZOOM_MINIMO_RIPARI = 11;

/** Tetto ai risultati: oltre, la mappa diventa illeggibile e la risposta pesante. */
export const MAX_RISULTATI = 200;

export type TipoRiparo = 'rifugio' | 'bivacco' | 'ricovero';

export interface Riparo {
  id: string;
  lat: number;
  lon: number;
  /** `null` quando OSM non ha il nome: si mostra il tipo, non si inventa un nome. */
  name: string | null;
  tipo: TipoRiparo;
  /** Posti letto, se noti. */
  capacity: number | null;
  phone: string | null;
}

export interface BBox { south: number; west: number; north: number; east: number; }

export function buildSheltersQuery(b: BBox): string {
  const bbox = `${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`;
  // `nwr` prende nodi, way e relazioni; `out center` dà un punto anche per le way,
  // che è tutto quello che serve per posare un marker.
  return `[out:json][timeout:20];(`
    + `nwr["tourism"~"^(alpine_hut|wilderness_hut)$"](${bbox});`
    + `nwr["amenity"="shelter"](${bbox});`
    + `);out center ${MAX_RISULTATI};`;
}

function tipoDa(tags: Record<string, string> | undefined): TipoRiparo | null {
  if (tags == null) return null;
  if (tags.tourism === 'alpine_hut') return 'rifugio';
  if (tags.tourism === 'wilderness_hut') return 'bivacco';
  if (tags.amenity === 'shelter') return 'ricovero';
  return null;
}

function numero(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseShelters(raw: unknown): Riparo[] {
  const o = raw as Record<string, unknown> | null;
  if (!Array.isArray(o?.elements)) throw new Error('Ripari in un formato non riconosciuto');

  const out: Riparo[] = [];
  for (const e of o.elements as Record<string, unknown>[]) {
    const tags = e.tags as Record<string, string> | undefined;
    const tipo = tipoDa(tags);
    if (tipo == null) continue;
    // I nodi portano lat/lon, le way il `center` chiesto con `out center`.
    const centro = e.center as { lat?: number; lon?: number } | undefined;
    const lat = typeof e.lat === 'number' ? e.lat : centro?.lat;
    const lon = typeof e.lon === 'number' ? e.lon : centro?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: `${e.type ?? 'n'}${e.id ?? out.length}`,
      lat: lat as number,
      lon: lon as number,
      name: typeof tags?.name === 'string' && tags.name.trim() !== '' ? tags.name : null,
      tipo,
      capacity: numero(tags?.capacity ?? tags?.beds),
      phone: typeof tags?.phone === 'string' ? tags.phone : null,
    });
  }
  return out;
}

export interface RisultatoRipari {
  shelters: Riparo[];
  /**
   * `true` quando la risposta ha toccato il tetto: quello che si vede e' una parte, e
   * va detto. Un elenco troncato mostrato come completo e' la stessa classe di difetto
   * dei layer di emergenza che dichiaravano dati freschi essendo vecchi.
   */
  troncato: boolean;
}

export async function fetchShelters(b: BBox, signal?: AbortSignal): Promise<RisultatoRipari> {
  const res = await fetch(`${ENDPOINT}?data=${encodeURIComponent(buildSheltersQuery(b))}`, { signal });
  // 429 e 504 sono la norma su un'istanza pubblica condivisa: il messaggio deve
  // suggerire di riprovare, non far pensare che non ci siano ripari.
  if (res.status === 429 || res.status === 504) {
    throw new Error('Il servizio dei ripari è occupato: riprova fra poco');
  }
  if (!res.ok) throw new Error('Ripari non disponibili in questo momento');
  const raw = await res.json();
  const shelters = parseShelters(raw);
  // Il conteggio da confrontare col tetto e' quello degli ELEMENTI restituiti, non dei
  // ripari riconosciuti: Overpass taglia prima che noi filtriamo.
  const elementi = Array.isArray((raw as { elements?: unknown[] })?.elements)
    ? ((raw as { elements: unknown[] }).elements).length
    : 0;
  return { shelters, troncato: elementi >= MAX_RISULTATI };
}
