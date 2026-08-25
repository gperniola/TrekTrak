import { parseFirmsCsv } from '@/lib/firms';

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight';

describe('parseFirmsCsv', () => {
  test('parse riga valida (acq_time a 3 cifre → padding)', () => {
    const csv = `${HEADER}\n42.10,13.50,330.1,0.4,0.4,2026-08-25,312,N20,VIIRS,n,2.0NRT,290.0,12.5,D`;
    const pts = parseFirmsCsv(csv);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toEqual({
      lat: 42.10, lon: 13.50, frp: 12.5, confidence: 'nominal',
      acquiredAt: '2026-08-25T03:12:00Z', satellite: 'N20',
    });
  });

  test('mappa confidence l/n/h e valori ignoti → nominal', () => {
    const rows = ['l', 'h', 'x'].map((c, i) =>
      `42.${i},13.0,330,0.4,0.4,2026-08-25,1200,N21,VIIRS,${c},2.0NRT,290,5.0,D`);
    const pts = parseFirmsCsv(`${HEADER}\n${rows.join('\n')}`);
    expect(pts.map((p) => p.confidence)).toEqual(['low', 'high', 'nominal']);
  });

  test('salta righe malformate senza lanciare', () => {
    const csv = `${HEADER}\nnot,a,row\n42.0,13.0,330,0.4,0.4,2026-08-25,1200,N20,VIIRS,n,2.0NRT,290,3.3,D\n`;
    expect(parseFirmsCsv(csv)).toHaveLength(1);
  });

  test('csv vuoto o solo header → []', () => {
    expect(parseFirmsCsv('')).toEqual([]);
    expect(parseFirmsCsv(HEADER)).toEqual([]);
  });

  test('colonne risolte dal header, non per posizione', () => {
    const csv = `frp,latitude,longitude,acq_date,acq_time,satellite,confidence\n7.7,41.9,12.5,2026-08-25,0005,N,h`;
    const pts = parseFirmsCsv(csv);
    expect(pts[0].frp).toBe(7.7);
    expect(pts[0].acquiredAt).toBe('2026-08-25T00:05:00Z');
  });
});
