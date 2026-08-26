import { fetchFiresClient, fetchDpcClient } from '@/lib/emergency-api';

const TOPO = { // stessa mini-topology del Task 4, 1 zona basta
  type: 'Topology',
  objects: { zone: { type: 'GeometryCollection', geometries: [{
    type: 'Polygon', arcs: [[0]],
    properties: { 'Nome zona': 'Z1', 'Per rischio idraulico': 'NESSUNA ALLERTA',
      'Per rischio temporali': 'NESSUNA ALLERTA', 'Per rischio idrogeologico': "ORDINARIA CRITICITA' / ALLERTA GIALLA" },
  }] } },
  arcs: [[[13.0, 42.0], [13.1, 42.0], [13.1, 42.1], [13.0, 42.1], [13.0, 42.0]]],
};

describe('fetchFiresClient', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('ritorna il payload del proxy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ points: [], fetchedAt: '2026-08-25T10:00:00Z' }),
    });
    const r = await fetchFiresClient();
    expect(r.fetchedAt).toBe('2026-08-25T10:00:00Z');
    // Il secondo argomento porta il signal dell'AbortController (timeout client).
    expect(global.fetch).toHaveBeenCalledWith('/api/fires', expect.objectContaining({ signal: expect.anything() }));
  });

  test('errore HTTP → throw con messaggio', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'no key' }) });
    await expect(fetchFiresClient()).rejects.toThrow();
  });

  test('fetch di rete fallita → messaggio in italiano, non il TypeError del browser', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchFiresClient()).rejects.toThrow('Rete non disponibile');
  });
});

describe('fetchDpcClient', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const INFO = {
    bulletinId: '20260825_1415',
    topojsonToday: 'https://raw.example/today.json',
    topojsonTomorrow: 'https://raw.example/tomorrow.json',
  };

  test('discovery + 2 topojson → DpcData con 2 giorni', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO });
    const data = await fetchDpcClient();
    expect(data.bulletinId).toBe('20260825_1415');
    expect(data.issuedLabel).toBe('25/08 14:15');
    expect(data.days.map((d) => d.date)).toEqual(['2026-08-25', '2026-08-26']);
    expect(data.days[0].zones).toHaveLength(1);
  });

  test('un topojson fallito → resta il giorno buono', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO })
      .mockRejectedValueOnce(new Error('404'));
    const data = await fetchDpcClient();
    expect(data.days).toHaveLength(1);
    expect(data.days[0].date).toBe('2026-08-25');
  });

  test('entrambi falliti → throw', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockRejectedValue(new Error('down'));
    await expect(fetchDpcClient()).rejects.toThrow();
  });

  test('fetch di rete fallita (discovery) → messaggio in italiano, non il TypeError del browser', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchDpcClient()).rejects.toThrow('Rete non disponibile');
  });

  test('discovery non-ok con messaggio del proxy → propagato invece del generico', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'xyz' }) });
    await expect(fetchDpcClient()).rejects.toThrow('xyz');
  });
});
