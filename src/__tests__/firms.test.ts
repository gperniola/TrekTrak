import { parseFirmsCsv } from '@/lib/firms';

/**
 * `parseFirmsCsv` restituisce `null` quando il corpo non è un CSV FIRMS — distinzione
 * che un altro test verifica esplicitamente. Dove invece il CSV è valido, questo
 * wrapper afferma il caso e restringe il tipo, così i test leggono le righe senza
 * asserzioni non nulle sparse.
 */
function parsed(csv: string) {
  const pts = parseFirmsCsv(csv);
  if (pts == null) throw new Error('parseFirmsCsv ha restituito null su un CSV valido');
  return pts;
}

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight';

describe('parseFirmsCsv', () => {
  test('parse riga valida (acq_time a 3 cifre → padding)', () => {
    const csv = `${HEADER}\n42.10,13.50,330.1,0.4,0.4,2026-08-25,312,N20,VIIRS,n,2.0NRT,290.0,12.5,D`;
    const pts = parsed(csv);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toEqual({
      lat: 42.10, lon: 13.50, frp: 12.5, confidence: 'nominal',
      acquiredAt: '2026-08-25T03:12:00Z', satellite: 'N20',
    });
  });

  test('mappa confidence l/n/h e valori ignoti → nominal', () => {
    const rows = ['l', 'h', 'x'].map((c, i) =>
      `42.${i},13.0,330,0.4,0.4,2026-08-25,1200,N21,VIIRS,${c},2.0NRT,290,5.0,D`);
    const pts = parsed(`${HEADER}\n${rows.join('\n')}`);
    expect(pts.map((p) => p.confidence)).toEqual(['low', 'high', 'nominal']);
  });

  test('salta righe malformate senza lanciare', () => {
    const csv = `${HEADER}\nnot,a,row\n42.0,13.0,330,0.4,0.4,2026-08-25,1200,N20,VIIRS,n,2.0NRT,290,3.3,D\n`;
    expect(parseFirmsCsv(csv)).toHaveLength(1);
  });

  test('solo header → [] (zero incendi, dato valido)', () => {
    expect(parseFirmsCsv(HEADER)).toEqual([]);
  });

  // FIRMS risponde 200 con testo semplice quando la MAP_KEY è invalida o la quota è
  // esaurita: distinguere questo caso da "zero incendi" evita di mettere in cache per
  // 15 minuti un layer vuoto spacciato per aggiornato.
  test('corpo che non è un CSV FIRMS → null, non []', () => {
    expect(parseFirmsCsv('')).toBeNull();
    expect(parseFirmsCsv('Invalid MAP_KEY')).toBeNull();
    expect(parseFirmsCsv('<html><body>maintenance</body></html>')).toBeNull();
    expect(parseFirmsCsv('foo,bar,baz\n1,2,3')).toBeNull();
  });

  test('colonne risolte dal header, non per posizione', () => {
    const csv = `frp,latitude,longitude,acq_date,acq_time,satellite,confidence\n7.7,41.9,12.5,2026-08-25,0005,N,h`;
    const pts = parsed(csv);
    expect(pts[0].frp).toBe(7.7);
    expect(pts[0].acquiredAt).toBe('2026-08-25T00:05:00Z');
  });

  // `Number('')` è 0 e passa `Number.isFinite`: una riga con lat/lon vuote (risposta
  // troncata o colonne sfasate) diventava un focolaio fantasma a (0,0).
  test('lat/lon vuote → riga scartata, non un punto a (0,0)', () => {
    const csv = [
      'latitude,longitude,acq_date,acq_time,satellite,confidence,frp',
      ',,2026-08-25,1200,N20,n,3.3',
      '  ,  ,2026-08-25,1200,N20,n,3.3',
    ].join('\n');
    expect(parseFirmsCsv(csv)).toEqual([]);
  });

  test('lat/lon fuori range → riga scartata', () => {
    const csv = [
      'latitude,longitude,acq_date,acq_time,satellite,confidence,frp',
      '91.5,13.0,2026-08-25,1200,N20,n,3.3',
      '42.0,181.2,2026-08-25,1200,N20,n,3.3',
      '-90.1,13.0,2026-08-25,1200,N20,n,3.3',
    ].join('\n');
    expect(parseFirmsCsv(csv)).toEqual([]);
  });

  test('lat/lon ai limiti del range → accettate', () => {
    const csv = [
      'latitude,longitude,acq_date,acq_time,satellite,confidence,frp',
      '90,180,2026-08-25,1200,N20,n,3.3',
      '-90,-180,2026-08-25,1200,N20,n,3.3',
    ].join('\n');
    expect(parseFirmsCsv(csv)).toHaveLength(2);
  });
});
