import {
  ENDPOINT_OVERPASS,
  CHIAVE_PORTA_PREFERITA,
  ErroreOverpass,
  databaseSano,
  interrogaOverpass,
  ordineTentativi,
} from '@/lib/overpass';

/**
 * Il layer dei ripari «andava in errore» e la query era giusta: sbagliata era la PORTA.
 *
 * Su una normale rete domestica italiana il router distribuisce il dominio di ricerca
 * `homenet.telecomitalia.it`, e `overpass-api.de` — l'unico host dell'app con **un solo
 * punto** — viene provato col suffisso: `overpass-api.de.homenet.telecomitalia.it`, che
 * il DNS dell'operatore risolve con un jolly a **127.0.0.1**. La richiesta finisce su se
 * stessi e resta appesa. Misurato con `nslookup` e riprodotto dal browser: l'istanza
 * principale e i suoi ingressi `z.`/`lz4.` non rispondono, `overpass.osm.ch` risponde in
 * 465 ms con 39 ripari veri.
 *
 * Da qui l'elenco di porte, e questi test: che si provi la successiva, che la porta buona
 * si ricordi, e che «occupato» resti distinguibile da «non raggiungibile».
 */

const risposta = (dati: unknown, stato = 200) => ({
  ok: stato >= 200 && stato < 300,
  status: stato,
  json: async () => dati,
});

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('ordine dei tentativi', () => {
  test('senza preferenza si segue l ordine dichiarato', () => {
    expect(ordineTentativi(null)).toEqual([...ENDPOINT_OVERPASS]);
  });

  /**
   * L'istanza principale sta per prima di proposito: e' quella dimensionata per il
   * carico, e mandare tutti sui mirror di comunita' come prima scelta sarebbe scaricare
   * su di loro il traffico di un'app che non li mantiene.
   */
  test('la principale e la prima dell elenco', () => {
    expect(ENDPOINT_OVERPASS[0]).toContain('overpass-api.de');
    expect(ENDPOINT_OVERPASS.length).toBeGreaterThan(1);
  });

  test('la porta preferita passa davanti, le altre restano in ordine', () => {
    const seconda = ENDPOINT_OVERPASS[1];
    expect(ordineTentativi(seconda)).toEqual([
      seconda,
      ...ENDPOINT_OVERPASS.filter((e) => e !== seconda),
    ]);
  });

  /** Una porta salvata mesi fa e poi rimossa dal codice non deve sopravvivere. */
  test('una preferenza che non e piu nell elenco viene ignorata', () => {
    expect(ordineTentativi('https://sparita.example/api/interpreter')).toEqual([...ENDPOINT_OVERPASS]);
  });
});

describe('interrogaOverpass', () => {
  test('se la prima porta non risponde si prova la successiva', async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(risposta({ elements: [{ id: 1 }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const esito = await interrogaOverpass('[out:json];node(1);out;');
    expect(esito.endpoint).toBe(ENDPOINT_OVERPASS[1]);
    expect(esito.dati).toEqual({ elements: [{ id: 1 }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /** Il guadagno vero: l'attesa della porta morta si paga una volta, non a ogni avvio. */
  test('la porta che ha funzionato viene ricordata e provata per prima', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(risposta({ elements: [] })) as unknown as typeof fetch;
    await interrogaOverpass('q');
    expect(localStorage.getItem(CHIAVE_PORTA_PREFERITA)).toBe(ENDPOINT_OVERPASS[1]);

    const secondo = jest.fn().mockResolvedValue(risposta({ elements: [] }));
    global.fetch = secondo as unknown as typeof fetch;
    const esito = await interrogaOverpass('q');
    expect(esito.endpoint).toBe(ENDPOINT_OVERPASS[1]);
    expect(secondo).toHaveBeenCalledTimes(1);
    expect(secondo.mock.calls[0][0]).toBe(ENDPOINT_OVERPASS[1]);
  });

  test('la query viaggia in POST nel corpo, non nell URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue(risposta({ elements: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await interrogaOverpass('[out:json];node(1);out;');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('data=');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('data=' + encodeURIComponent('[out:json];node(1);out;'));
  });

  /**
   * 429 e 504 dicono «c'e' coda», non «non ci sono ripari»: il motivo deve arrivare a
   * chi scrive il messaggio, altrimenti l'utente legge che i rifugi non esistono.
   */
  test('coda su tutte le porte: motivo «occupato»', async () => {
    global.fetch = jest.fn().mockResolvedValue(risposta(null, 504)) as unknown as typeof fetch;
    await expect(interrogaOverpass('q')).rejects.toMatchObject({ motivo: 'occupato' });
  });

  test('nessuna risposta da nessuna porta: motivo «non-raggiungibile»', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    const errore = await interrogaOverpass('q').catch((e) => e);
    expect(errore).toBeInstanceOf(ErroreOverpass);
    expect(errore.motivo).toBe('non-raggiungibile');
  });

  test('una coda e poi un rifiuto: prevale «occupato», perche riprovare ha senso', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(risposta(null, 429))
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await expect(interrogaOverpass('q')).rejects.toMatchObject({ motivo: 'occupato' });
  });

  test('un fallimento non fa ricordare nessuna porta', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('x')) as unknown as typeof fetch;
    await interrogaOverpass('q').catch(() => {});
    expect(localStorage.getItem(CHIAVE_PORTA_PREFERITA)).toBeNull();
  });

  /**
   * L'annullamento di chi chiama (vista cambiata, componente smontato) non e' un guasto
   * del servizio: si esce subito, senza consumare le altre porte.
   */
  test('se chi chiama annulla, non si prova la porta successiva', async () => {
    const ac = new AbortController();
    const fetchMock = jest.fn().mockImplementation(() => {
      ac.abort();
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const errore = await interrogaOverpass('q', { signal: ac.signal }).catch((e) => e);
    expect(errore.name).toBe('AbortError');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('annullato prima di partire: nessuna chiamata', async () => {
    const ac = new AbortController();
    ac.abort();
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(interrogaOverpass('q', { signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /** Storage bloccato (finestra privata, permessi negati): si funziona comunque. */
  test('senza localStorage si prova l ordine canonico e non si esplode', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloccato'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloccato'); });
    global.fetch = jest.fn().mockResolvedValue(risposta({ elements: [] })) as unknown as typeof fetch;
    const esito = await interrogaOverpass('q');
    expect(esito.endpoint).toBe(ENDPOINT_OVERPASS[0]);
  });

  test('ogni porta ha il suo tempo massimo, non uno per tutte', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockImplementation((_url, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')));
      }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const promessa = interrogaOverpass('q', { timeoutMs: 1000 }).catch((e) => e);
    // ogni porta scade dopo 1000 ms: si consumano tutte, una per volta
    for (let i = 0; i < ENDPOINT_OVERPASS.length; i++) {
      await jest.advanceTimersByTimeAsync(1000);
    }
    const errore = await promessa;
    expect(errore).toBeInstanceOf(ErroreOverpass);
    expect(fetchMock).toHaveBeenCalledTimes(ENDPOINT_OVERPASS.length);
    jest.useRealTimers();
  });
});

/**
 * **Un mirror che risponde «va tutto bene, non c'e' niente».**
 *
 * Segnalato il 2026-09-02: il layer dei ripari non mostrava il Bivacco Carlo Fusco, sotto
 * Cima delle Murelle sulla Maiella. Verificato che non era colpa nostra:
 *
 * - il bivacco **c'e'** in OpenStreetMap — una way a 42,1152 / 14,1214, con
 *   `amenity=shelter`, `shelter_type=basic_hut`, «Bivacco Carlo Fusco»;
 * - la query dell'app lo **prende**: eseguita su `overpass-api.de` per la vista attorno
 *   alla cima torna due elementi, e uno e' lui;
 * - il parser lo **capisce**: legge `center` per le way, non solo `lat`/`lon` dei nodi.
 *
 * Il guasto era a monte. Il 2026-08-31 `overpass.osm.ch` funzionava — il commento in
 * `lib/overpass.ts` dice «risponde in 465 ms con 39 ripari veri» — e l'app **ricorda sul
 * dispositivo la porta che ha funzionato**. Nel frattempo quel mirror si e' svuotato:
 * risponde **HTTP 200 con `elements: []`**, per l'Italia e per la Svizzera. Un successo
 * vuoto e' indistinguibile da «qui non ci sono ripari», quindi la preferenza salvata lo
 * metteva per primo e il layer dichiarava, con sicurezza, che non c'era nulla.
 *
 * La differenza e' pero' **leggibile nella risposta**, e questo la rende correggibile:
 *
 * | endpoint | `osm3s.timestamp_osm_base` |
 * |---|---|
 * | `overpass-api.de` | `2026-09-02T09:47:06Z` |
 * | `overpass.osm.ch` | `116840` — non e' una data |
 *
 * Da qui il controllo: una risposta il cui database non dichiara una data plausibile non
 * si accetta, e la sua porta non si ricorda. `osm.ch` **non** viene tolto dall'elenco a
 * mano: cosi' si esclude da se' finche' e' guasto, e rientra quando torna a posto.
 */
describe('la salute del database dietro una porta', () => {
  test('una data attuale va bene', () => {
    expect(databaseSano({ osm3s: { timestamp_osm_base: new Date().toISOString() } })).toBe(true);
  });

  test('il valore misurato sul mirror svuotato viene rifiutato', () => {
    expect(databaseSano({ osm3s: { timestamp_osm_base: '116840' } })).toBe(false);
  });

  test('altre forme che non sono date vengono rifiutate', () => {
    // `'0'` non e' un errore di battitura: JavaScript lo legge come l'anno 2000, quindi
    // supera `Date.parse` e viene fermato dal controllo sul ritardo, non da quello sul
    // formato. Vale la pena che stia qui, perche' e' il caso che passerebbe di soppiatto.
    for (const v of ['ieri', '0', 'NaN', '99999999999999']) {
      expect(databaseSano({ osm3s: { timestamp_osm_base: v } })).toBe(false);
    }
  });

  /**
   * Un database molto indietro non e' vuoto, ma non e' nemmeno affidabile: i mirror sani
   * stanno a minuti dal presente, e un ritardo di mesi vuol dire che non sincronizza.
   */
  test('un database di mesi fa viene rifiutato', () => {
    const vecchio = new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString();
    expect(databaseSano({ osm3s: { timestamp_osm_base: vecchio } })).toBe(false);
  });

  test('un ritardo di poche ore va bene: i mirror sono normalmente indietro', () => {
    const poco = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    expect(databaseSano({ osm3s: { timestamp_osm_base: poco } })).toBe(true);
  });

  test('una data nel futuro viene rifiutata', () => {
    const domani = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    expect(databaseSano({ osm3s: { timestamp_osm_base: domani } })).toBe(false);
  });

  /**
   * **Assente vale «non lo so», e si accetta.** Non tutte le istanze dichiarano il campo,
   * e rifiutarle romperebbe porte funzionanti per colpa di un controllo. Il difetto
   * misurato era «presente e non una data»: e' quello che si respinge, non l'assenza.
   */
  test('un campo assente non fa rifiutare la risposta', () => {
    expect(databaseSano({ elements: [] })).toBe(true);
    expect(databaseSano({ osm3s: {} })).toBe(true);
    expect(databaseSano(null)).toBe(true);
    // Una stringa vuota e' un campo dichiarato e privo di contenuto: vale come assente.
    // Rifiutarla sarebbe respingere un'istanza sana per colpa di un controllo.
    expect(databaseSano({ osm3s: { timestamp_osm_base: '' } })).toBe(true);
  });
});

describe('una porta col database guasto si scavalca', () => {
  const SANA = { osm3s: { timestamp_osm_base: new Date().toISOString() }, elements: [{ id: 1 }] };
  const GUASTA = { osm3s: { timestamp_osm_base: '116840' }, elements: [] };

  const rispondi = (perEndpoint: Record<string, unknown>) =>
    jest.fn((url: string) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(perEndpoint[url] ?? GUASTA),
    })) as unknown as typeof fetch;

  afterEach(() => { try { localStorage.removeItem(CHIAVE_PORTA_PREFERITA); } catch { /* */ } });

  test('si passa alla porta successiva, e i dati arrivano', async () => {
    global.fetch = rispondi({
      [ENDPOINT_OVERPASS[0]]: GUASTA,
      [ENDPOINT_OVERPASS[1]]: SANA,
    });
    const esito = await interrogaOverpass('[out:json];node(1);out;');
    expect(esito.endpoint).toBe(ENDPOINT_OVERPASS[1]);
    expect((esito.dati as { elements: unknown[] }).elements).toHaveLength(1);
  });

  /**
   * **Il cuore del difetto segnalato**: la porta guasta non deve finire in memoria, o la
   * prossima apertura ricomincia da lei e il layer torna a dire «non c'e' niente».
   */
  test('la porta guasta non viene ricordata', async () => {
    global.fetch = rispondi({
      [ENDPOINT_OVERPASS[0]]: GUASTA,
      [ENDPOINT_OVERPASS[1]]: SANA,
    });
    await interrogaOverpass('[out:json];node(1);out;');
    expect(localStorage.getItem(CHIAVE_PORTA_PREFERITA)).toBe(ENDPOINT_OVERPASS[1]);
  });

  /**
   * Una porta ricordata **prima** che si guastasse non deve inchiodare l'app: al primo
   * giro in cui risponde con un database non plausibile si passa oltre, e la memoria si
   * aggiorna. E' lo scenario esatto del 2026-09-02.
   */
  test('una preferenza salvata che nel frattempo si e guastata non inchioda', async () => {
    localStorage.setItem(CHIAVE_PORTA_PREFERITA, ENDPOINT_OVERPASS[1]);
    global.fetch = rispondi({
      [ENDPOINT_OVERPASS[0]]: SANA,
      [ENDPOINT_OVERPASS[1]]: GUASTA,
    });
    const esito = await interrogaOverpass('[out:json];node(1);out;');
    expect(esito.endpoint).toBe(ENDPOINT_OVERPASS[0]);
    expect(localStorage.getItem(CHIAVE_PORTA_PREFERITA)).toBe(ENDPOINT_OVERPASS[0]);
  });

  test('se TUTTE hanno il database guasto si dichiara un guasto, non un vuoto', async () => {
    global.fetch = rispondi({});
    await expect(interrogaOverpass('[out:json];node(1);out;')).rejects.toBeInstanceOf(ErroreOverpass);
  });
});
