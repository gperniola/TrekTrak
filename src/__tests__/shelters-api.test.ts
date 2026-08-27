import { buildSheltersQuery, parseShelters, fetchShelters, ZOOM_MINIMO_RIPARI, MAX_RISULTATI } from '@/lib/shelters-api';

const bbox = { south: 46.0, west: 11.0, north: 46.5, east: 11.6 };

describe('query Overpass dei ripari', () => {
  const q = buildSheltersQuery(bbox);

  test('chiede rifugi, bivacchi e ricoveri nella bbox', () => {
    expect(q).toContain('alpine_hut');
    expect(q).toContain('wilderness_hut');
    expect(q).toContain('"amenity"="shelter"');
    expect(q).toContain('46.00000,11.00000,46.50000,11.60000');
  });

  // `out center` serve per avere un punto anche dalle way (un rifugio mappato come
  // edificio): senza, quei ripari sparirebbero dalla mappa.
  test('chiede il centro, non solo i nodi', () => {
    expect(q).toContain('nwr[');
    expect(q).toContain('out center');
  });

  test('ha un tetto ai risultati e un timeout', () => {
    expect(q).toMatch(/out center \d+;/);
    expect(q).toContain('timeout:20');
  });

  test('lo zoom minimo è dichiarato', () => {
    expect(ZOOM_MINIMO_RIPARI).toBeGreaterThanOrEqual(10);
  });
});

describe('lettura della risposta', () => {
  test('nodo con nome, tipo e posti letto', () => {
    const r = parseShelters({ elements: [
      { type: 'node', id: 1, lat: 46.4, lon: 11.8, tags: { tourism: 'alpine_hut', name: 'Rifugio Vajolet', capacity: '90', phone: '+39 0462 763292' } },
    ] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'Rifugio Vajolet', tipo: 'rifugio', capacity: 90, phone: '+39 0462 763292' });
  });

  test('una way usa il centro chiesto con out center', () => {
    const r = parseShelters({ elements: [
      { type: 'way', id: 7, center: { lat: 46.41, lon: 11.81 }, tags: { tourism: 'wilderness_hut', name: 'Bivacco' } },
    ] });
    expect(r[0]).toMatchObject({ lat: 46.41, lon: 11.81, tipo: 'bivacco' });
  });

  test.each([
    ['alpine_hut', 'rifugio'], ['wilderness_hut', 'bivacco'],
  ])('tourism=%s → %s', (tag, atteso) => {
    const r = parseShelters({ elements: [{ type: 'node', id: 1, lat: 46, lon: 11, tags: { tourism: tag } }] });
    expect(r[0].tipo).toBe(atteso);
  });

  test('amenity=shelter → ricovero', () => {
    const r = parseShelters({ elements: [{ type: 'node', id: 1, lat: 46, lon: 11, tags: { amenity: 'shelter' } }] });
    expect(r[0].tipo).toBe('ricovero');
  });

  // Senza nome si mostra il tipo: inventare "Rifugio" per un ricovero senza nome
  // sarebbe dire una cosa non vera su un posto dove uno pensa di poter dormire.
  test('senza nome resta null, non un nome inventato', () => {
    const r = parseShelters({ elements: [{ type: 'node', id: 1, lat: 46, lon: 11, tags: { amenity: 'shelter', name: '  ' } }] });
    expect(r[0].name).toBeNull();
  });

  test('elementi senza coordinate o senza tag utili vengono scartati', () => {
    const r = parseShelters({ elements: [
      { type: 'node', id: 1, tags: { tourism: 'alpine_hut' } },              // senza coordinate
      { type: 'node', id: 2, lat: 46, lon: 11, tags: { amenity: 'bench' } }, // non è un riparo
      { type: 'node', id: 3, lat: 46, lon: 11, tags: { tourism: 'alpine_hut' } },
    ] });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('node3');
  });

  test('capienza non numerica → null', () => {
    const r = parseShelters({ elements: [
      { type: 'node', id: 1, lat: 46, lon: 11, tags: { tourism: 'alpine_hut', capacity: 'tante' } },
    ] });
    expect(r[0].capacity).toBeNull();
  });

  test('forma inattesa → errore', () => {
    expect(() => parseShelters({ nope: 1 })).toThrow(/ripari/i);
  });
});

/**
 * L'istanza pubblica di Overpass ha risposto 504 durante la verifica, e il mirror 502:
 * l'indisponibilità è la normalità, non l'eccezione. Il messaggio deve invitare a
 * riprovare, perché "nessun riparo" e "servizio occupato" sono due cose diversissime
 * per chi sta cercando dove ripararsi.
 */
describe('quando Overpass non risponde', () => {
  const vero = global.fetch;
  afterEach(() => { global.fetch = vero; });
  const stato = (status: number) => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: status < 400, status, json: async () => ({ elements: [] }) })) as unknown as typeof global.fetch;
  };

  test.each([[429], [504]])('%i → invita a riprovare', async (s) => {
    stato(s);
    await expect(fetchShelters(bbox)).rejects.toThrow(/riprova/i);
  });

  test('502 → messaggio di indisponibilità', async () => {
    stato(502);
    await expect(fetchShelters(bbox)).rejects.toThrow(/non disponibili/i);
  });

  test('200 con elenco vuoto → nessun riparo, senza errori', async () => {
    stato(200);
    await expect(fetchShelters(bbox)).resolves.toEqual({ shelters: [], troncato: false });
  });
});

/**
 * In una zona densa Overpass taglia la risposta al tetto che gli abbiamo dato: mostrare
 * quell'elenco come completo farebbe credere che i ripari siano quelli, e in montagna
 * "non ci sono ripari" e "non li ho scaricati tutti" portano a decisioni diverse.
 */
describe('elenco troncato', () => {
  const vero = global.fetch;
  afterEach(() => { global.fetch = vero; });

  const conElementi = (n: number) => {
    const elements = Array.from({ length: n }, (_, i) => ({
      type: 'node', id: i, lat: 46 + i / 1e4, lon: 11, tags: { tourism: 'alpine_hut' },
    }));
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true, status: 200, json: async () => ({ elements }),
    })) as unknown as typeof global.fetch;
  };

  test('al tetto viene dichiarato troncato', async () => {
    conElementi(MAX_RISULTATI);
    const r = await fetchShelters(bbox);
    expect(r.troncato).toBe(true);
    expect(r.shelters).toHaveLength(MAX_RISULTATI);
  });

  test('sotto il tetto non lo e\u2019', async () => {
    conElementi(12);
    const r = await fetchShelters(bbox);
    expect(r.troncato).toBe(false);
  });

  // Il confronto va fatto sugli ELEMENTI restituiti, non sui ripari riconosciuti:
  // Overpass taglia prima che noi filtriamo, quindi 200 elementi di cui pochi validi
  // sono comunque una risposta tagliata.
  test('conta gli elementi, non i ripari riconosciuti', async () => {
    const elements = Array.from({ length: MAX_RISULTATI }, (_, i) => ({
      type: 'node', id: i, lat: 46, lon: 11,
      tags: i < 5 ? { tourism: 'alpine_hut' } : { amenity: 'bench' },
    }));
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true, status: 200, json: async () => ({ elements }),
    })) as unknown as typeof global.fetch;
    const r = await fetchShelters(bbox);
    expect(r.shelters).toHaveLength(5);
    expect(r.troncato).toBe(true);
  });
});
