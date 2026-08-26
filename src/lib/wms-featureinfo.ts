/**
 * Interrogazione `GetFeatureInfo` di un layer WMS: è il modo previsto dallo standard
 * per sapere cosa c'è sotto un punto di un raster, che altrimenti è solo pixel.
 *
 * Usiamo EPSG:3857 e non EPSG:4326: la vista della mappa è in Mercatore, quindi
 * mappare linearmente i pixel su un intervallo di latitudini introdurrebbe un errore
 * che cresce con la latitudine. In metri la corrispondenza pixel↔coordinata è lineare
 * e il punto interrogato è esattamente quello toccato.
 */

const TIMEOUT_MS = 8000;

/**
 * Tolleranza di ricerca in pixel. Senza, serve centrare il poligono al pixel: sul
 * telefono, con un dito, è impraticabile. `RADIUS` è un'estensione MapServer (che è
 * ciò su cui gira EFFIS), non WMS standard: se un giorno cambiassero server verrebbe
 * ignorato e la ricerca tornerebbe puntuale, senza rompersi.
 */
const RADIUS_PX = 12;

export interface FeatureInfoField { label: string; value: string }
export interface FeatureInfoResult { title: string; fields: FeatureInfoField[] }

export interface FeatureInfoQuery {
  /** Endpoint WMS. */
  url: string;
  /** Nome del layer, usato sia per LAYERS sia per QUERY_LAYERS. */
  layer: string;
  /** Valore del parametro TIME, coerente con quello usato per i tile. */
  time: string;
  /** Estensione della vista in EPSG:3857: [minX, minY, maxX, maxY] in metri. */
  bbox3857: readonly [number, number, number, number];
  /** Dimensione della vista in pixel. */
  size: { x: number; y: number };
  /** Punto toccato, in pixel rispetto alla vista. */
  point: { x: number; y: number };
}

export function buildFeatureInfoUrl(q: FeatureInfoQuery): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    SRS: 'EPSG:3857',
    BBOX: q.bbox3857.join(','),
    WIDTH: String(Math.round(q.size.x)),
    HEIGHT: String(Math.round(q.size.y)),
    X: String(Math.round(q.point.x)),
    Y: String(Math.round(q.point.y)),
    LAYERS: q.layer,
    QUERY_LAYERS: q.layer,
    TIME: q.time,
    // MapServer >= 8 rifiuta la richiesta senza STYLES, anche vuoto.
    STYLES: '',
    FORMAT: 'image/png',
    // Solo text/html restituisce gli attributi: application/json non è supportato e
    // il GML torna la sola bounding box.
    INFO_FORMAT: 'text/html',
    RADIUS: String(RADIUS_PX),
  });
  return `${q.url}?${params.toString()}`;
}

/** Etichette EFFIS tradotte. Quelle non in elenco passano come sono. */
const LABELS: Record<string, string> = {
  'start date': 'Inizio incendio',
  'last update': 'Ultimo aggiornamento',
  'end date': 'Fine incendio',
  area: 'Area percorsa',
  'area_ha': 'Area percorsa (ha)',
  country: 'Paese',
  province: 'Provincia',
  commune: 'Comune',
  place: 'Località',
};

const TITLES: Record<string, string> = {
  'burntareas nrt': 'Area percorsa dal fuoco',
};

/**
 * `true` per i valori che non vanno mostrati: vuoti, o segnaposto di template non
 * risolti. EFFIS restituisce letteralmente `[external_id]` per il campo ID — un loro
 * bug, e mostrarlo all'utente sarebbe peggio che ometterlo.
 */
function isUnusable(value: string): boolean {
  return value === '' || /^\[[a-z_]+\]$/i.test(value);
}

/**
 * Estrae titolo e coppie etichetta/valore dalla risposta.
 *
 * Il corpo è HTML di terze parti: viene attraversato con DOMParser (che non esegue
 * script) e se ne prende solo `textContent`, così nulla di quel markup finisce mai
 * in un popup.
 */
export function parseFeatureInfoHtml(html: string): FeatureInfoResult | null {
  if (/no results/i.test(html)) return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }

  const rawTitle = (doc.querySelector('h2, h1')?.textContent ?? '').trim();
  const title = TITLES[rawTitle.toLowerCase()] ?? rawTitle;

  const fields: FeatureInfoField[] = [];
  doc.querySelectorAll('tr').forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length < 2) return;
    const rawLabel = (cells[0].textContent ?? '').trim();
    const value = (cells[1].textContent ?? '').trim();
    if (rawLabel === '' || isUnusable(value)) return;
    fields.push({ label: LABELS[rawLabel.toLowerCase()] ?? rawLabel, value });
  });

  if (fields.length === 0) return null;
  return { title: title || 'Dettagli', fields };
}

export class FeatureInfoError extends Error {}

export async function queryFeatureInfo(q: FeatureInfoQuery): Promise<FeatureInfoResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(buildFeatureInfoUrl(q), { signal: controller.signal });
    if (!res.ok) throw new FeatureInfoError('Dettagli non disponibili');
    // Il body va letto dentro il try: se il timer scadesse dopo il finally l'abort
    // sarebbe già disarmato e la lettura resterebbe appesa.
    return parseFeatureInfoHtml(await res.text());
  } catch (e) {
    if (e instanceof FeatureInfoError) throw e;
    throw new FeatureInfoError('Dettagli non disponibili');
  } finally {
    clearTimeout(timer);
  }
}
