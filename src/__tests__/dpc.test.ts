import {
  parseAlertLevel, parseDpcTopology, zonePopupHtml,
  dayOptions, defaultDpcDate, bulletinDates,
} from '@/lib/dpc';

// Mini-topology con 2 zone (quadrati), stessa struttura dei file DPC reali
const TOPO = {
  type: 'Topology',
  objects: {
    zone: {
      type: 'GeometryCollection',
      geometries: [
        {
          type: 'Polygon', arcs: [[0]],
          properties: {
            'Nome zona': 'Abru-A', 'Rappresentata nella mappa': 'si',
            'Per rischio idraulico': 'NESSUNA ALLERTA',
            'Per rischio temporali': "ORDINARIA CRITICITA' / ALLERTA GIALLA",
            'Per rischio idrogeologico': "MODERATA CRITICITA' / ALLERTA ARANCIONE",
          },
        },
        {
          type: 'Polygon', arcs: [[1]],
          properties: {
            'Nome zona': 'Abru-B',
            'Per rischio idraulico': "ELEVATA CRITICITA' / ALLERTA ROSSA",
            'Per rischio temporali': 'NESSUNA ALLERTA',
            'Per rischio idrogeologico': 'NESSUNA ALLERTA',
          },
        },
      ],
    },
  },
  arcs: [
    [[13.0, 42.0], [13.1, 42.0], [13.1, 42.1], [13.0, 42.1], [13.0, 42.0]],
    [[14.0, 42.0], [14.1, 42.0], [14.1, 42.1], [14.0, 42.1], [14.0, 42.0]],
  ],
};

describe('parseAlertLevel', () => {
  test.each([
    ['NESSUNA ALLERTA', 0],
    ["ORDINARIA CRITICITA' / ALLERTA GIALLA", 1],
    ["MODERATA CRITICITA' / ALLERTA ARANCIONE", 2],
    ["ELEVATA CRITICITA' / ALLERTA ROSSA", 3],
    [undefined, 0],
    ['testo ignoto', 0],
  ])('%s → %i', (text, expected) => {
    expect(parseAlertLevel(text)).toBe(expected);
  });
});

describe('parseDpcTopology', () => {
  test('estrae zone con livelli e maxLevel', () => {
    const zones = parseDpcTopology(TOPO);
    expect(zones).toHaveLength(2);
    expect(zones[0]).toMatchObject({ name: 'Abru-A', idraulico: 0, temporali: 1, idrogeologico: 2, maxLevel: 2 });
    expect(zones[1].maxLevel).toBe(3);
    expect(zones[0].feature.geometry.type).toBe('Polygon');
  });

  test('input invalido → []', () => {
    expect(parseDpcTopology(null)).toEqual([]);
    expect(parseDpcTopology({ type: 'Topology', objects: {} })).toEqual([]);
  });
});

describe('zonePopupHtml', () => {
  test('contiene nome, i 3 rischi con label e il giorno', () => {
    const [zone] = parseDpcTopology(TOPO);
    const html = zonePopupHtml(zone, 'Oggi 25/08', 'bollettino del 25/08 14:15');
    expect(html).toContain('Abru-A');
    expect(html).toContain('Idrogeologico');
    expect(html).toContain('Arancione');
    expect(html).toContain('Oggi 25/08');
    expect(html).toContain('bollettino del 25/08 14:15');
  });
});

describe('bulletinDates / dayOptions / defaultDpcDate', () => {
  const now = new Date('2026-08-25T10:00:00');

  test('bollettino di oggi → Oggi/Domani', () => {
    const { today, tomorrow, issuedLabel } = bulletinDates('20260825_1415');
    expect(today).toBe('2026-08-25');
    expect(tomorrow).toBe('2026-08-26');
    expect(issuedLabel).toBe('25/08 14:15');
    const opts = dayOptions([today, tomorrow], now);
    expect(opts).toEqual([
      { date: '2026-08-25', label: 'Oggi 25/08', disabled: false },
      { date: '2026-08-26', label: 'Domani 26/08', disabled: false },
    ]);
    expect(defaultDpcDate([today, tomorrow], now)).toBe('2026-08-25');
  });

  test('bollettino di ieri → Ieri disabilitato, Oggi selezionabile (regola della spec §6)', () => {
    const { today, tomorrow } = bulletinDates('20260824_1500');
    const opts = dayOptions([today, tomorrow], now);
    expect(opts[0]).toEqual({ date: '2026-08-24', label: 'Ieri 24/08', disabled: true });
    expect(opts[1]).toEqual({ date: '2026-08-25', label: 'Oggi 25/08', disabled: false });
    expect(defaultDpcDate([today, tomorrow], now)).toBe('2026-08-25');
  });

  test('nessuna data copre oggi → default null-safe sull\'ultima non passata', () => {
    expect(defaultDpcDate(['2026-08-22', '2026-08-23'], now)).toBeNull();
  });
});
