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

/**
 * Parser CSV dell'area API FIRMS. Risolve le colonne dal header (l'ordine
 * varia tra sensori); le righe malformate vengono scartate silenziosamente.
 */
export function parseFirmsCsv(csv: string): FirePoint[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
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
  if (idx.lat < 0 || idx.lon < 0 || idx.date < 0 || idx.time < 0) return [];

  const points: FirePoint[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    const lat = Number(f[idx.lat]);
    const lon = Number(f[idx.lon]);
    const date = f[idx.date];
    const rawTime = f[idx.time];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^\d{1,4}$/.test(rawTime ?? '')) continue;
    const hhmm = rawTime.padStart(4, '0');
    const frp = idx.frp >= 0 ? Number(f[idx.frp]) : NaN;
    points.push({
      lat, lon,
      frp: Number.isFinite(frp) ? frp : 0,
      confidence: CONFIDENCE_MAP[(f[idx.conf] ?? '').trim().toLowerCase()] ?? 'nominal',
      acquiredAt: `${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`,
      satellite: idx.sat >= 0 ? (f[idx.sat] ?? '').trim() : '',
    });
  }
  return points;
}
