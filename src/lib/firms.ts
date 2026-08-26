export interface FirePoint {
  lat: number;
  lon: number;
  frp: number;
  confidence: 'low' | 'nominal' | 'high';
  acquiredAt: string;
  satellite: string;
}

const CONFIDENCE_MAP: Record<string, FirePoint['confidence']> = {
  l: 'low', low: 'low', n: 'nominal', nominal: 'nominal', h: 'high', high: 'high',
};

/** Numero da un campo CSV, con il campo vuoto/assente trattato come mancante (non 0). */
function num(raw: string | undefined): number | null {
  const t = (raw ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parser CSV dell'area API FIRMS. Risolve le colonne dal header (l'ordine
 * varia tra sensori); le righe malformate vengono scartate silenziosamente.
 *
 * Ritorna `null` quando il corpo NON è un CSV FIRMS — e questo è il punto: FIRMS
 * risponde `200` con testo semplice quando la MAP_KEY è invalida o la quota è
 * esaurita. Confondere quel caso con "zero incendi" faceva mettere in cache per 15
 * minuti un payload vuoto come successo, col pannello che scriveva "Aggiornato alle
 * HH:MM" e il layer che affermava che in Italia non ci sono focolai.
 *
 * Un header valido con zero righe, invece, è "zero incendi" per davvero: `[]`.
 */
export function parseFirmsCsv(csv: string): FirePoint[] | null {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  const cols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const idx = {
    lat: cols.indexOf('latitude'),
    lon: cols.indexOf('longitude'),
    frp: cols.indexOf('frp'),
    conf: cols.indexOf('confidence'),
    date: cols.indexOf('acq_date'),
    time: cols.indexOf('acq_time'),
    sat: cols.indexOf('satellite'),
  };
  // Header non riconosciuto: non è un CSV FIRMS (messaggio d'errore, pagina HTML…).
  if (idx.lat < 0 || idx.lon < 0 || idx.date < 0 || idx.time < 0) return null;

  const points: FirePoint[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    // `Number('')` vale 0 e supera `Number.isFinite`: senza il controllo sul campo
    // vuoto una risposta troncata o con colonne sfasate produceva focolai fantasma
    // a (0,0), nel Golfo di Guinea.
    const lat = num(f[idx.lat]);
    const lon = num(f[idx.lon]);
    const date = f[idx.date];
    const rawTime = f[idx.time];
    if (lat == null || lon == null) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^\d{1,4}$/.test(rawTime ?? '')) continue;
    const hhmm = rawTime.padStart(4, '0');
    const frp = idx.frp >= 0 ? num(f[idx.frp]) : null;
    points.push({
      lat, lon,
      frp: frp ?? 0,
      confidence: CONFIDENCE_MAP[(f[idx.conf] ?? '').trim().toLowerCase()] ?? 'nominal',
      acquiredAt: `${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`,
      satellite: idx.sat >= 0 ? (f[idx.sat] ?? '').trim() : '',
    });
  }
  return points;
}
