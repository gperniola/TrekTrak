import { fetchRadarIndex, tileUrl, OPZIONI_TILE } from '@/lib/radar-api';

const risposta = (body: unknown, ok = true) => {
  global.fetch = jest.fn(() => Promise.resolve({ ok, status: ok ? 200 : 503, json: async () => body })) as unknown as typeof global.fetch;
};

const vero = global.fetch;
afterEach(() => { global.fetch = vero; });

const indiceVero = {
  version: '2.0',
  generated: 1787843122,
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1787835600, path: '/v2/radar/bc01ec85e68f' },
      { time: 1787836200, path: '/v2/radar/aa02fd96f79a' },
    ],
    nowcast: [],
  },
};

describe('indice dei fotogrammi radar', () => {
  test('legge host e fotogrammi, convertendo gli istanti', async () => {
    risposta(indiceVero);
    const i = await fetchRadarIndex();
    expect(i.host).toBe('https://tilecache.rainviewer.com');
    expect(i.frames).toHaveLength(2);
    expect(i.frames[0].timeISO).toBe(new Date(1787835600000).toISOString());
  });

  test('l\'URL dei tile porta i segnaposto di Leaflet', () => {
    const url = tileUrl({ host: 'https://h', frames: [{ timeISO: 'x', path: '/p' }] }, { timeISO: 'x', path: '/p' });
    expect(url).toBe(`https://h/p/256/{z}/{x}/{y}/${OPZIONI_TILE}.png`);
  });

  /**
   * Zero fotogrammi non è "non piove": è un radar che non sta funzionando. Mostrare una
   * mappa vuota che sembra aggiornata è la classe di difetto dominante della campagna
   * della v0.11.0.
   */
  test('nessun fotogramma → errore, non un layer vuoto', async () => {
    risposta({ host: 'https://h', radar: { past: [], nowcast: [] } });
    await expect(fetchRadarIndex()).rejects.toThrow(/fotogramma/i);
  });

  test('fotogrammi malformati vengono scartati', async () => {
    risposta({ host: 'https://h', radar: { past: [{ time: 'ieri', path: '/p' }, { time: 1787835600, path: '/ok' }] } });
    const i = await fetchRadarIndex();
    expect(i.frames).toHaveLength(1);
    expect(i.frames[0].path).toBe('/ok');
  });

  test.each([
    ['host mancante', { radar: { past: [{ time: 1, path: '/p' }] } }],
    ['radar mancante', { host: 'https://h' }],
    ['past non array', { host: 'https://h', radar: { past: {} } }],
  ])('%s → errore in italiano', async (_n, body) => {
    risposta(body);
    await expect(fetchRadarIndex()).rejects.toThrow(/radar/i);
  });

  test('risposta non ok → errore in italiano', async () => {
    risposta({}, false);
    await expect(fetchRadarIndex()).rejects.toThrow(/non raggiungibile/i);
  });
});
