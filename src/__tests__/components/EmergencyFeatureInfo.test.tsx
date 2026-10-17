import { render, waitFor } from '@testing-library/react';
import { EmergencyFeatureInfo } from '@/components/map/emergency/EmergencyFeatureInfo';
import { getEmergencyLayer } from '@/lib/emergency-layers';
import { __fireMapEvent, __resetMapEvents } from './__mocks__/react-leaflet';
import { __openedPopups, __resetPopups } from './__mocks__/leaflet';

const REAL_HTML = `<H2>Burntareas NRT</H2>
<table id="main">
<tr><td>ID</td><td>[external_id]</td></tr>
<tr><td>Start date</td><td>2026-07-06</td></tr>
</table>`;

const burned = getEmergencyLayer('fires-burned');
const fwi = getEmergencyLayer('fires-fwi');
const latlng = { lat: 40.79, lng: 16.47 };

/** Ultimo contenuto impostato sul popup: il componente lo aggiorna in due tempi. */
function lastPopupContent(): string {
  const popups = __openedPopups();
  return popups.length > 0 ? popups[popups.length - 1].content : '';
}

describe('EmergencyFeatureInfo', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    __resetMapEvents();
    __resetPopups();
  });
  afterEach(() => { global.fetch = realFetch; });

  test('pressione lunga con layer interrogabile → popup coi dati', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => REAL_HTML });
    render(<EmergencyFeatureInfo defs={[burned]} />);
    __fireMapEvent('contextmenu', { latlng });
    await waitFor(() => expect(lastPopupContent()).toContain('2026-07-06'));
    expect(lastPopupContent()).toContain('Area percorsa dal fuoco');
    expect(lastPopupContent()).toContain('Inizio incendio');
  });

  // Feedback immediato: la richiesta può prendere qualche secondo in montagna.
  test('il popup si apre subito con un avviso di attesa', () => {
    global.fetch = jest.fn(() => new Promise(() => {}));
    render(<EmergencyFeatureInfo defs={[burned]} />);
    __fireMapEvent('contextmenu', { latlng });
    expect(__openedPopups()).toHaveLength(1);
    expect(lastPopupContent()).toContain('Interrogazione');
  });

  // "Qui non c'è nulla" è un'informazione, non un guasto.
  test('nessun risultato → lo dice, senza parlare di errore', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, text: async () => 'GetFeatureInfo results:\n\n  Search returned no results.',
    });
    render(<EmergencyFeatureInfo defs={[burned]} />);
    __fireMapEvent('contextmenu', { latlng });
    await waitFor(() => expect(lastPopupContent()).toContain('Nessun dato di emergenza'));
    expect(lastPopupContent()).not.toContain('Dettagli non disponibili');
  });

  test('errore di rete → messaggio in italiano', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    render(<EmergencyFeatureInfo defs={[burned]} />);
    __fireMapEvent('contextmenu', { latlng });
    await waitFor(() => expect(lastPopupContent()).toContain('Dettagli non disponibili'));
  });

  // Il FWI non è interrogabile: EFFIS risponde LayerNotDefined su QUERY_LAYERS.
  // Interrogarlo comunque produrrebbe solo un errore inutile.
  test('layer non interrogabile → nessuna richiesta e nessun popup', () => {
    global.fetch = jest.fn();
    render(<EmergencyFeatureInfo defs={[fwi]} />);
    __fireMapEvent('contextmenu', { latlng });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(__openedPopups()).toHaveLength(0);
  });

  test('interroga in EPSG:3857 col TIME del layer', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => REAL_HTML });
    render(<EmergencyFeatureInfo defs={[burned]} />);
    __fireMapEvent('contextmenu', { latlng });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]));
    expect(url.searchParams.get('SRS')).toBe('EPSG:3857');
    expect(url.searchParams.get('QUERY_LAYERS')).toBe('effis.nrt.ba.poly');
    expect(url.searchParams.get('TIME')).toMatch(/^\d{4}-01-01\/\d{4}-\d{2}-\d{2}$/);
  });

  // I valori arrivano da un servizio esterno e finiscono in innerHTML.
  test('i valori di terze parti vengono escapati', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<H2>X</H2><table><tr><td>Nota</td><td>a &lt;b&gt; "c"</td></tr></table>',
    });
    render(<EmergencyFeatureInfo defs={[burned]} />);
    __fireMapEvent('contextmenu', { latlng });
    await waitFor(() => expect(lastPopupContent()).toContain('Nota'));
    expect(lastPopupContent()).toContain('&lt;b&gt;');
    expect(lastPopupContent()).toContain('&quot;c&quot;');
  });

  describe('neve', () => {
    const visto = { stato: 'neve', ndsi: 45, giorno: '2026-10-15', sensore: 'terra' } as const;
    const frase = 'Neve (indice 45) · vista il 15 ottobre da MODIS Terra';
    const neveCon = (punto: jest.Mock) => ({ punto, mattonella: jest.fn(), dimensioneCache: () => 0 }) as never;

    test('col solo layer neve, la pressione lunga dice cosa ha visto il satellite', async () => {
      global.fetch = jest.fn();
      render(<EmergencyFeatureInfo defs={[]} neve={neveCon(jest.fn().mockResolvedValue(visto))} />);
      __fireMapEvent('contextmenu', { latlng });
      await waitFor(() => expect(lastPopupContent()).toContain(frase));
      expect(global.fetch).not.toHaveBeenCalled();
      expect(lastPopupContent()).not.toContain('Nessun dato di emergenza');
    });

    test('neve e WMS insieme: un popup solo', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => REAL_HTML });
      render(<EmergencyFeatureInfo defs={[burned]} neve={neveCon(jest.fn().mockResolvedValue(visto))} />);
      __fireMapEvent('contextmenu', { latlng });
      await waitFor(() => expect(lastPopupContent()).toContain('2026-07-06'));
      expect(__openedPopups()).toHaveLength(1);
      expect(lastPopupContent()).toContain(frase);
      expect(lastPopupContent().indexOf(frase)).toBeLessThan(lastPopupContent().indexOf('2026-07-06'));
    });

    test('neve che fallisce non spegne il WMS', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => REAL_HTML });
      render(<EmergencyFeatureInfo defs={[burned]} neve={neveCon(jest.fn().mockRejectedValue(new Error('x')))} />);
      __fireMapEvent('contextmenu', { latlng });
      await waitFor(() => expect(lastPopupContent()).toContain('2026-07-06'));
      expect(lastPopupContent()).toContain('Neve: dettagli non disponibili');
    });

    test('una pressione lunga vecchia non riscrive il popup di quella nuova', async () => {
      global.fetch = jest.fn();
      let vecchia!: (v: unknown) => void;
      const punto = jest.fn()
        .mockImplementationOnce(() => new Promise((r) => { vecchia = r; }))
        .mockResolvedValueOnce({ stato: 'senza', giorno: '2026-10-14', sensore: 'aqua' });
      render(<EmergencyFeatureInfo defs={[]} neve={neveCon(punto)} />);
      __fireMapEvent('contextmenu', { latlng });
      __fireMapEvent('contextmenu', { latlng });
      await waitFor(() => expect(lastPopupContent()).toContain('Senza neve'));
      vecchia(visto);
      await new Promise((r) => setTimeout(r, 0));
      expect(lastPopupContent()).toContain('Senza neve');
      // Il popup vecchio e' un oggetto a parte: si guardano tutti, non solo l'ultimo.
      expect(__openedPopups().map((x) => x.content).join('')).not.toContain(frase);
    });
  });
});
