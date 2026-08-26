import {
  buildFeatureInfoUrl, parseFeatureInfoHtml, queryFeatureInfo, FeatureInfoError,
} from '@/lib/wms-featureinfo';

const Q = {
  url: 'https://maps.effis.emergency.copernicus.eu/effis',
  layer: 'effis.nrt.ba.poly',
  time: '2026-01-01/2026-08-26',
  bbox3857: [1825639.65, 4968191.93, 1847903.55, 4997602.86] as const,
  size: { x: 500, y: 635 },
  point: { x: 250.4, y: 317.8 },
};

/** Risposta reale di EFFIS, copiata da una query verificata sul campo. */
const REAL_HTML = `<H2>Burntareas NRT</H2>
<table id="main">
<tr><td>ID</td><td>[external_id]</td></tr>
<tr><td>Start date</td><td>2026-07-06</td></tr>
<tr><td>Last update</td><td>2026-07-06</td></tr>
</table>`;

const NO_RESULTS = `GetFeatureInfo results:

  Search returned no results.`;

describe('buildFeatureInfoUrl', () => {
  // In EPSG:4326 la corrispondenza pixel→latitudine non è lineare (la vista è in
  // Mercatore), quindi il punto interrogato non sarebbe quello toccato.
  test('usa EPSG:3857 e il bbox in metri', () => {
    const u = new URL(buildFeatureInfoUrl(Q));
    expect(u.searchParams.get('SRS')).toBe('EPSG:3857');
    expect(u.searchParams.get('BBOX')).toBe('1825639.65,4968191.93,1847903.55,4997602.86');
  });

  test('arrotonda dimensioni e punto a interi', () => {
    const u = new URL(buildFeatureInfoUrl(Q));
    expect(u.searchParams.get('WIDTH')).toBe('500');
    expect(u.searchParams.get('HEIGHT')).toBe('635');
    expect(u.searchParams.get('X')).toBe('250');
    expect(u.searchParams.get('Y')).toBe('318');
  });

  test('LAYERS e QUERY_LAYERS coincidono, e TIME è quello dei tile', () => {
    const u = new URL(buildFeatureInfoUrl(Q));
    expect(u.searchParams.get('LAYERS')).toBe('effis.nrt.ba.poly');
    expect(u.searchParams.get('QUERY_LAYERS')).toBe('effis.nrt.ba.poly');
    expect(u.searchParams.get('TIME')).toBe('2026-01-01/2026-08-26');
  });

  // MapServer >= 8 rifiuta la richiesta senza STYLES; senza RADIUS servirebbe centrare
  // il poligono al pixel, impraticabile con un dito.
  test('include STYLES vuoto e una tolleranza RADIUS', () => {
    const u = new URL(buildFeatureInfoUrl(Q));
    expect(u.searchParams.get('STYLES')).toBe('');
    expect(Number(u.searchParams.get('RADIUS'))).toBeGreaterThan(0);
  });

  test('chiede text/html, il solo formato che restituisce attributi', () => {
    expect(new URL(buildFeatureInfoUrl(Q)).searchParams.get('INFO_FORMAT')).toBe('text/html');
  });
});

describe('parseFeatureInfoHtml', () => {
  test('estrae titolo tradotto e campi dalla risposta reale', () => {
    const r = parseFeatureInfoHtml(REAL_HTML);
    expect(r).not.toBeNull();
    expect(r!.title).toBe('Area percorsa dal fuoco');
    expect(r!.fields).toEqual([
      { label: 'Inizio incendio', value: '2026-07-06' },
      { label: 'Ultimo aggiornamento', value: '2026-07-06' },
    ]);
  });

  // EFFIS restituisce letteralmente `[external_id]`: è un loro bug, e mostrarlo
  // all'utente sarebbe peggio che omettere il campo.
  test('scarta i segnaposto di template non risolti', () => {
    const r = parseFeatureInfoHtml(REAL_HTML);
    expect(r!.fields.map((f) => f.label)).not.toContain('ID');
  });

  test('nessun risultato → null', () => {
    expect(parseFeatureInfoHtml(NO_RESULTS)).toBeNull();
  });

  test('risposta con soli campi inutilizzabili → null', () => {
    const html = '<H2>Burntareas NRT</H2><table><tr><td>ID</td><td>[external_id]</td></tr></table>';
    expect(parseFeatureInfoHtml(html)).toBeNull();
  });

  // Il corpo è HTML di terze parti: dal parse esce solo testo, così nulla di quel
  // markup può finire in un popup.
  test('il markup nei valori viene ridotto a testo', () => {
    const html = '<H2>X</H2><table><tr><td>Nota</td><td><img src=x onerror=alert(1)>ciao</td></tr></table>';
    const r = parseFeatureInfoHtml(html);
    expect(r!.fields[0].value).toBe('ciao');
    expect(JSON.stringify(r)).not.toContain('onerror');
  });

  test('etichette non previste passano invariate', () => {
    const html = '<H2>X</H2><table><tr><td>Fuel type</td><td>Conifer</td></tr></table>';
    expect(parseFeatureInfoHtml(html)!.fields[0]).toEqual({ label: 'Fuel type', value: 'Conifer' });
  });
});

describe('queryFeatureInfo', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('risposta valida → risultato strutturato', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => REAL_HTML });
    const r = await queryFeatureInfo(Q);
    expect(r!.fields).toHaveLength(2);
  });

  test('nessun risultato → null, non un errore', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => NO_RESULTS });
    await expect(queryFeatureInfo(Q)).resolves.toBeNull();
  });

  test('errore di rete → messaggio in italiano, mai il testo grezzo', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(queryFeatureInfo(Q)).rejects.toThrow(FeatureInfoError);
    await expect(queryFeatureInfo(Q)).rejects.toThrow('Dettagli non disponibili');
  });

  test('HTTP non ok → errore in italiano', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' });
    await expect(queryFeatureInfo(Q)).rejects.toThrow('Dettagli non disponibili');
  });
});
