/**
 * Pericolo valanghe: la parte **pura**, senza rete.
 *
 * I bollettini arrivano dall'aggregato EAWS su `static.avalanche.report`, che copre tutte
 * le regioni italiane — Alpi per regione amministrativa più `IT-MeteoMont` per gli
 * Appennini. La rete sta in `avalanche-proxy.ts` (lato server) e `avalanche-api.ts` (lato
 * client); qui ci sono le decisioni, che sono la parte che si può sbagliare in silenzio.
 *
 * ## Perché passa da un proxy nostro invece di andare diretto
 *
 * MISURATO il 2026-09-03: le geometrie delle micro-regioni italiane pesano **4,85 MB**, e
 * il server che le pubblica **non comprime** (nessun `content-encoding`, verificato
 * chiedendo con `--compressed`). Il solo `IT-MeteoMont` è 2,5 MB per 43 micro-regioni,
 * 90.308 vertici. Scaricarle dal telefono per accendere un layer non è accettabile, e
 * nemmeno filtrarle per regione: il rettangolo di MeteoMont copre l'Italia intera, isole
 * comprese, quindi "la regione che ti serve" è sempre anche quella grossa.
 *
 * Quindi il server scarica, tiene in memoria (sono confini, cambiano una volta l'anno),
 * **ritaglia sulla vista** e **semplifica** in base allo zoom. Al client arrivano le poche
 * micro-regioni inquadrate.
 */

/** Le nove regioni EAWS italiane, coi rettangoli MISURATI dai file veri il 2026-09-03. */
export interface RegioneEaws {
  id: string;
  /** `west, south, east, north`. Serve solo a decidere cosa scaricare, mai a disegnare. */
  bbox: readonly [number, number, number, number];
}

/*
  I rettangoli sono calcolati sui vertici dei file pubblicati, poi allargati di un
  decimo di grado: sono un filtro per non scaricare l'inutile, e un filtro troppo
  stretto farebbe sparire zone vere (mentre uno troppo largo costa solo una richiesta
  in più che il server tiene comunque in cache). Se EAWS ridisegna le regioni, il modo
  di ricalcolarli è nel commento del test.
*/
export const REGIONI_EAWS: readonly RegioneEaws[] = [
  { id: 'IT-21', bbox: [6.53, 43.96, 8.80, 46.56] },
  { id: 'IT-23', bbox: [6.70, 45.37, 8.04, 46.09] },
  { id: 'IT-25', bbox: [8.49, 44.58, 10.93, 46.73] },
  { id: 'IT-32-BZ', bbox: [10.28, 46.12, 12.58, 47.19] },
  { id: 'IT-32-TN', bbox: [10.35, 45.57, 12.06, 46.63] },
  { id: 'IT-34', bbox: [10.61, 45.43, 12.83, 46.78] },
  { id: 'IT-36', bbox: [12.22, 45.88, 13.82, 46.75] },
  { id: 'IT-57', bbox: [12.09, 42.59, 13.84, 44.00] },
  { id: 'IT-MeteoMont', bbox: [6.53, 37.52, 16.93, 46.78] },
];

/** Rettangolo geografico, nello stesso ordine che usa il resto dell'app. */
export interface BBoxGeo {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Il pericolo, nella scala europea: **1-5**.
 *
 * `0` NON è "nessun pericolo": nell'aggregato EAWS vuol dire **nessuna valutazione** —
 * misurato nei dati veri di IT-MeteoMont, dove compare accanto a 1, 2 e 3. Trattarlo come
 * verde sarebbe la direzione di errore peggiore che esista in un'app di montagna, quindi
 * ha un nome e un colore suoi, e la mappa non lo disegna affatto.
 */
export type Pericolo = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Colori della scala EAWS, **letti dal CSS dell'app che pubblica i bollettini**
 * (`avalanche.report/assets/main-*.css`, il 2026-09-03): `.warning-level-1` `#cf6`,
 * `-2` `#ff0`, `-3` `#f90`, `-4` `red`, `-5` rosso **con tratteggio nero**.
 *
 * Il livello 5 sul sito ufficiale è un motivo a righe, non un colore pieno: qui si rende
 * con lo stesso rosso e un bordo nero, e la legenda lo dice. Inventare un colore per un
 * livello che ne ha uno pubblicato è l'errore corretto due volte in questo progetto con
 * le legende Copernicus.
 */
export const SCALA_EAWS: Record<Pericolo, { colore: string; nome: string }> = {
  0: { colore: '#9ca3af', nome: 'Nessuna valutazione' },
  1: { colore: '#ccff66', nome: 'Debole' },
  2: { colore: '#ffff00', nome: 'Moderato' },
  3: { colore: '#ff9900', nome: 'Marcato' },
  4: { colore: '#ff0000', nome: 'Forte' },
  5: { colore: '#ff0000', nome: 'Molto forte' },
};

/**
 * Sotto questo zoom non si interroga: le micro-regioni diventano schegge illeggibili e la
 * risposta cresce con l'area inquadrata. È la stessa soglia dei ripari, per la stessa
 * ragione — e come là, non interrogare **si dichiara**, invece di lasciar credere che in
 * zona non ci sia niente.
 */
export const ZOOM_MINIMO_VALANGHE = 9;

/** Il bollettino del giorno D vale fino alle 16:00 UTC di D (misurato nel CAAML). */
export const ORA_SCADENZA_UTC = 16;

/**
 * Lato massimo della vista che si accetta di servire, in gradi.
 *
 * Alla soglia di zoom 9 una vista da telefono copre meno di un grado, quindi cinque gradi
 * sono larghi il quadruplo del necessario. Il tetto non serve contro l'utente: serve
 * contro un errore nostro — una lettura sbagliata dei confini della mappa farebbe chiedere
 * mezzo continente, e il server risponderebbe **ubbidiente** ritagliando e semplificando
 * 4,85 MB di confini. Un limite dichiarato trasforma quel guasto in un errore visibile.
 */
export const LATO_MASSIMO_VISTA_GRADI = 5;

/** Se la vista chiesta è troppo grande per essere servita. */
export function vistaTroppoGrande(b: BBoxGeo): boolean {
  return (b.north - b.south) > LATO_MASSIMO_VISTA_GRADI
    || (b.east - b.west) > LATO_MASSIMO_VISTA_GRADI;
}

export interface Valutazione {
  /** Id della micro-regione, es. `IT-32-BZ-01-01`. */
  id: string;
  /** Il peggio della giornata: è il numero che si disegna. */
  pericolo: Pericolo;
  /** Mattina e pomeriggio, quando il bollettino li distingue. */
  am: Pericolo | null;
  pm: Pericolo | null;
  /** Sopra e sotto la quota di riferimento del bollettino. */
  alta: Pericolo | null;
  bassa: Pericolo | null;
}

function pericoloValido(v: unknown): Pericolo | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 5) return null;
  return v as Pericolo;
}

/**
 * Da `maxDangerRatings` alle valutazioni per micro-regione.
 *
 * Le chiavi misurate nei file veri sono `IT-32-BZ-01-01` più le varianti `:am`, `:pm`,
 * `:high`, `:low` e le combinazioni `:high:am`, `:low:pm`… Le combinazioni non si
 * mostrano: quattro numeri per zona sono già il limite di quello che si legge in un
 * popup, e il numero che decide è il massimo — che è la chiave senza suffisso.
 *
 * La distinzione di quota **non è un dettaglio**: nei dati del 15/02/2026 su IT-32-BZ, la
 * stessa micro-regione dava 3 sopra il limite del bosco e 1 sotto. Mostrare solo il
 * massimo spaventerebbe chi resta in basso; mostrare solo la media ingannerebbe chi sale.
 */
export function parseRatings(dati: unknown): Map<string, Valutazione> {
  const o = dati as { maxDangerRatings?: unknown } | null;
  const grezzi = o?.maxDangerRatings;
  /*
    **Un array non e' una mappa di valutazioni.** `typeof [] === 'object'`, quindi senza
    il controllo esplicito un `maxDangerRatings: [3, 2, 1]` — cioe' un formato cambiato —
    produceva tre zone con id "0", "1" e "2": spazzatura presentata come bollettino, col
    pannello che dichiarava tre zone valutate. Se la forma non e' quella, e' un errore.
  */
  if (grezzi == null || typeof grezzi !== 'object' || Array.isArray(grezzi)) {
    throw new Error('Bollettino valanghe in un formato non riconosciuto');
  }
  const out = new Map<string, Valutazione>();
  const prendi = (chiave: string): Pericolo | null =>
    pericoloValido((grezzi as Record<string, unknown>)[chiave]);

  for (const chiave of Object.keys(grezzi as Record<string, unknown>)) {
    if (chiave.includes(':')) continue; // le varianti si leggono a partire dalla base
    // Una zona senza id non e' disegnabile ne' spiegabile: non entra.
    if (chiave.trim().length === 0) continue;
    const base = prendi(chiave);
    if (base == null) continue;
    out.set(chiave, {
      id: chiave,
      pericolo: base,
      am: prendi(`${chiave}:am`),
      pm: prendi(`${chiave}:pm`),
      alta: prendi(`${chiave}:high`),
      bassa: prendi(`${chiave}:low`),
    });
  }
  return out;
}

/** Giorno in forma `YYYY-MM-DD`, in UTC: è come sono indicizzati i bollettini. */
export function giornoUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * I giorni da provare, dal più attuale.
 *
 * MISURATO nel CAAML: il file del giorno D dichiara `validTime` dalle 16:00 UTC di D-1
 * alle 16:00 UTC di D. I bollettini per il giorno dopo escono nel pomeriggio, quindi:
 *
 * - **dopo le 16 UTC** il bollettino in corso è quello di **domani**, e quello di oggi è
 *   scaduto: si prova domani per primo;
 * - prima delle 16, quello di oggi è il corrente.
 *
 * In coda c'è sempre ieri: fuori stagione tutto risponde 404 e allora la risposta è
 * "nessun bollettino", che è un'informazione, non un errore.
 */
export function giorniDaProvare(adesso: Date): string[] {
  const oggi = giornoUTC(adesso);
  const domani = giornoUTC(new Date(adesso.getTime() + 86_400_000));
  const ieri = giornoUTC(new Date(adesso.getTime() - 86_400_000));
  return adesso.getUTCHours() >= ORA_SCADENZA_UTC
    ? [domani, oggi, ieri]
    : [oggi, domani, ieri];
}

/** Le regioni EAWS che possono avere qualcosa dentro il rettangolo chiesto. */
export function regioniPerBbox(b: BBoxGeo): string[] {
  return REGIONI_EAWS
    .filter(({ bbox: [w, s, e, n] }) => b.west <= e && b.east >= w && b.south <= n && b.north >= s)
    .map((r) => r.id);
}

/** Il rettangolo di una geometria GeoJSON, o `null` se non ha coordinate leggibili. */
export function bboxDiGeometria(coordinate: unknown): BBoxGeo | null {
  let west = Infinity; let south = Infinity; let east = -Infinity; let north = -Infinity;
  const guarda = (a: unknown): void => {
    if (!Array.isArray(a)) return;
    if (typeof a[0] === 'number' && typeof a[1] === 'number') {
      /*
        Solo coordinate **finite e dentro il mondo**. Con un `Infinity` fra i vertici il
        rettangolo diventava infinito, e un rettangolo infinito si sovrappone a tutto:
        una geometria rotta avrebbe fatto disegnare la sua zona su qualunque vista.
      */
      if (!Number.isFinite(a[0]) || !Number.isFinite(a[1])) return;
      if (Math.abs(a[0]) > 180 || Math.abs(a[1]) > 90) return;
      west = Math.min(west, a[0]); east = Math.max(east, a[0]);
      south = Math.min(south, a[1]); north = Math.max(north, a[1]);
      return;
    }
    a.forEach(guarda);
  };
  guarda(coordinate);
  if (!Number.isFinite(west) || !Number.isFinite(south)) return null;
  return { west, south, east, north };
}

export function rettangoliSiToccano(a: BBoxGeo, b: BBoxGeo): boolean {
  return a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;
}

/**
 * Quanto si può semplificare, in gradi, a un dato zoom.
 *
 * Il criterio è **sotto il pixel**: a zoom z un grado di longitudine sta su
 * `256 * 2^z / 360` pixel, quindi mezzo pixel di tolleranza vale
 * `180 / (256 * 2^z)` gradi. Semplificare così non cambia quello che si vede, e a zoom 9
 * taglia i tre quarti dei vertici.
 *
 * Non si va oltre `0.005` (circa 550 m): confini di zone di pericolo troppo arrotondati
 * sposterebbero il limite fra "marcato" e "debole" di mezzo chilometro, che è più di
 * quanto un errore di disegno abbia diritto di fare.
 */
export function tolleranzaPerZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0.001;
  const mezzoPixel = 180 / (256 * Math.pow(2, Math.max(1, zoom)));
  return Math.min(0.005, Math.max(0.00005, mezzoPixel));
}

/** Un anello semplificato con Douglas-Peucker, e le coordinate arrotondate. */
function semplificaAnello(anello: number[][], tolleranza: number, decimali: number): number[][] | null {
  if (anello.length < 4) return null; // un anello chiuso ha almeno 4 punti
  const distanza = (p: number[], a: number[], b: number[]): number => {
    const dx = b[0] - a[0]; const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const tieni = new Array<boolean>(anello.length).fill(false);
  tieni[0] = true; tieni[anello.length - 1] = true;
  const pila: Array<[number, number]> = [[0, anello.length - 1]];
  while (pila.length > 0) {
    const [i, j] = pila.pop() as [number, number];
    let massima = 0; let scelto = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distanza(anello[k], anello[i], anello[j]);
      if (d > massima) { massima = d; scelto = k; }
    }
    if (massima > tolleranza && scelto > 0) {
      tieni[scelto] = true;
      pila.push([i, scelto], [scelto, j]);
    }
  }
  const f = Math.pow(10, decimali);
  const fuori = anello
    .filter((_, i) => tieni[i])
    .map((p) => [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f]);
  // L'arrotondamento può far collassare punti vicini: un anello di tre punti non è più
  // un poligono, e Leaflet lo disegnerebbe come una linea sottile fuori posto.
  return fuori.length >= 4 ? fuori : null;
}

/**
 * Semplifica un `Polygon` o `MultiPolygon`, buttando gli anelli che collassano.
 *
 * Quattro decimali sono circa **11 metri**: i file veri arrivano con quindici cifre
 * decimali, cioè frazioni di micron, che sono metà del peso del file per zero
 * informazione.
 */
export function semplificaGeometria(
  geometria: { type: string; coordinates: unknown },
  tolleranza: number,
  decimali = 4,
): { type: string; coordinates: unknown } | null {
  const poligono = (p: unknown): number[][][] | null => {
    if (!Array.isArray(p)) return null;
    const anelli = p
      .map((a) => semplificaAnello(a as number[][], tolleranza, decimali))
      .filter((a): a is number[][] => a != null);
    return anelli.length > 0 ? anelli : null;
  };
  if (geometria.type === 'Polygon') {
    const p = poligono(geometria.coordinates);
    return p == null ? null : { type: 'Polygon', coordinates: p };
  }
  if (geometria.type === 'MultiPolygon') {
    if (!Array.isArray(geometria.coordinates)) return null;
    const parti = geometria.coordinates.map(poligono).filter((p): p is number[][][] => p != null);
    return parti.length > 0 ? { type: 'MultiPolygon', coordinates: parti } : null;
  }
  return null; // niente linee o punti: le zone di pericolo sono aree
}

/** Come si scrive un pericolo a schermo: numero e parola, che da sole non bastano. */
export function etichettaPericolo(p: Pericolo): string {
  return p === 0 ? SCALA_EAWS[0].nome : `${p} — ${SCALA_EAWS[p].nome}`;
}

/**
 * La riga che spiega **dove** vale quel numero.
 *
 * Se sopra e sotto la quota di riferimento il pericolo è diverso, dirlo è il contenuto
 * più utile del bollettino per chi deve decidere se salire.
 */
export function dettaglioQuote(v: Valutazione): string | null {
  if (v.alta == null && v.bassa == null) return null;
  if (v.alta != null && v.bassa != null && v.alta !== v.bassa) {
    return `In alto ${etichettaPericolo(v.alta)}, più in basso ${etichettaPericolo(v.bassa)}`;
  }
  return null;
}

/** La riga su mattina e pomeriggio, se il bollettino li distingue davvero. */
export function dettaglioOrario(v: Valutazione): string | null {
  if (v.am == null || v.pm == null || v.am === v.pm) return null;
  return `Mattina ${etichettaPericolo(v.am)}, pomeriggio ${etichettaPericolo(v.pm)}`;
}

/**
 * Un'**impronta** del contenuto disegnato: id e pericolo di ogni zona, in ordine.
 *
 * Serve come `key` del layer, e non è un dettaglio di React: `react-leaflet` passa `data`
 * a Leaflet **solo quando crea** il layer (la sua funzione di aggiornamento tocca
 * soltanto `style`). Se la chiave non cambia quando cambia il contenuto, restano
 * disegnati i poligoni di prima — e lo `style`, che invece si aggiorna, li ricolora coi
 * pericoli delle zone nuove: un livello sbagliato su un'area sbagliata.
 *
 * La prima chiave era `data-numeroZone-primoId`: bastava spostarsi fra due viste con lo
 * stesso numero di zone e lo stesso primo id — cosa normale pannando dentro la stessa
 * regione — per farla coincidere.
 */
export function improntaZone(zone: Array<{ id: string; pericolo: number }>): string {
  // FNV-1a a 32 bit: deterministica, corta, e senza dipendenze.
  let h = 0x811c9dc5;
  for (const z of zone) {
    const pezzo = `${z.id}:${z.pericolo};`;
    for (let i = 0; i < pezzo.length; i++) {
      h ^= pezzo.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return `${zone.length}-${(h >>> 0).toString(36)}`;
}
