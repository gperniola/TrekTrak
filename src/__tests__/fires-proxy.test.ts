import { fetchFiresUpstream, _resetFiresCacheForTests } from '@/lib/fires-proxy';

/*
 * La rilevazione finta deve stare DENTRO la finestra di 24 ore, altrimenti il proxy la
 * scarta giustamente: da quando il layer dichiara "24h" e le rispetta davvero, una
 * data fissa nel passato renderebbe il test verde o rosso a seconda di quando lo si
 * lancia. Stessa trappola dell'orologio gia' vista nei test del pannello meteo.
 */
function csvRecente(): string {
  const d = new Date(Date.now() - 2 * 3600000); // due ore fa
  const data = d.toISOString().slice(0, 10);
  const ora = String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0');
  return 'latitude,longitude,frp,confidence,acq_date,acq_time,satellite' + String.fromCharCode(10)
    + '42.0,13.0,5.0,n,' + data + ',' + ora + ',N20';
}
const CSV = csvRecente();

describe('fetchFiresUpstream', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    _resetFiresCacheForTests();
    process.env.FIRMS_MAP_KEY = 'testkey';
    jest.useFakeTimers();
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.FIRMS_MAP_KEY;
    jest.useRealTimers();
  });

  test('503 senza FIRMS_MAP_KEY', async () => {
    delete process.env.FIRMS_MAP_KEY;
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(503);
  });

  test('fonde i 3 sensori e risponde 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => CSV });
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.points).toHaveLength(3); // 1 punto × 3 sensori
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain('/api/area/csv/testkey/');
    /*
     * DUE giorni, non uno. `dayRange=1` non vuol dire "ultime 24 ore" ma "dalla
     * mezzanotte UTC di oggi", e il passaggio notturno del satellite sull'Italia sta a
     * cavallo di quella mezzanotte: con un giorno solo sparivano le rilevazioni delle
     * 23:5x UTC, cioe' l'01:5x italiano della notte appena passata. Le 24 ore vere le
     * ritaglia `soloUltime24h`.
     */
    expect(urls[0]).toContain('6.6,35.4,18.6,47.1/2');
  });

  test('successo parziale: un sensore giù non fa fallire', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => CSV })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ok: false, status: 500 });
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.points).toHaveLength(1);
  });

  test('tutti i sensori giù → 502', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(502);
  });

  test('cache: la seconda chiamata entro il TTL non rifà fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => CSV });
    await fetchFiresUpstream();
    await fetchFiresUpstream();
    expect(global.fetch).toHaveBeenCalledTimes(3); // solo il primo giro
    jest.advanceTimersByTime(16 * 60 * 1000);      // oltre il TTL di 15 min
    await fetchFiresUpstream();
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });
  // Se `clearTimeout` scatta agli header invece che a fine body, l'AbortController e'
  // disarmato e `res.text()` resta appeso: questo test non terminerebbe mai.
  test('il timeout copre la lettura del body: un CSV che si blocca a meta viene abortito', async () => {
    global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      return Promise.resolve({
        ok: true,
        text: () => new Promise<string>((_res, rej) => {
          signal.addEventListener('abort', () => rej(new Error('aborted')));
        }),
      });
    });
    const promise = fetchFiresUpstream();
    await jest.advanceTimersByTimeAsync(9000);
    const r = await promise;
    expect(r.status).toBe(502);
  });
  // Il caso peggiore: FIRMS risponde 200 con testo non-CSV (MAP_KEY invalida, quota
  // esaurita). Prima veniva letto come "zero incendi" e messo in cache 15 minuti.
  test('tutti i sensori con corpo non-CSV -> 502, non zero incendi', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => 'Invalid MAP_KEY' });
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(502);
  });

  test('risultato parziale: marcato partial e con TTL breve', async () => {
    const fn = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => CSV })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });
    global.fetch = fn;
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(200);
    if (r.status === 200) {
      expect(r.data.partial).toBe(true);
      expect(r.data.points).toHaveLength(1);
    }
    const callsSoFar = fn.mock.calls.length;
    jest.advanceTimersByTime(3 * 60 * 1000);
    fn.mockResolvedValue({ ok: true, text: async () => CSV });
    await fetchFiresUpstream();
    expect(fn.mock.calls.length).toBeGreaterThan(callsSoFar);
  });

  test('risposta completa: nessun flag partial', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => CSV });
    const r = await fetchFiresUpstream();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.partial).toBeUndefined();
  });
});
