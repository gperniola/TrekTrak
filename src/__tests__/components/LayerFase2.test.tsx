import { render, screen, act } from '@testing-library/react';
import { EmergencyQuakeLayer } from '@/components/map/emergency/EmergencyQuakeLayer';
import { EmergencyXyzLayer } from '@/components/map/emergency/EmergencyXyzLayer';
import { EmergencyAvalancheLayer } from '@/components/map/emergency/EmergencyAvalancheLayer';
import { stileZona } from '@/components/map/emergency/EmergencyAvalancheLayer';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { getEmergencyLayer } from '@/lib/emergency-layers';
import { SCALA_EAWS } from '@/lib/avalanche';
import type { Quake } from '@/lib/quakes-api';
import type { BollettinoValanghe } from '@/lib/avalanche-api';
import { __setMapZoom, __setMapBounds, __tileHandlers, __resetTileHandlers } from './__mocks__/react-leaflet';

jest.mock('react-leaflet');

const sisma = (over: Partial<Quake> = {}): Quake => ({
  id: 'q1', lat: 42.4, lon: 13.5, depthKm: 9.2, mag: 3.2, magType: 'ML',
  place: 'Monti della Laga', timeISO: new Date(Date.now() - 3600_000).toISOString(), ...over,
});

const zona = (over: Partial<BollettinoValanghe['zones'][0]> = {}) => ({
  id: 'IT-32-BZ-01-01', nome: 'Gruppo Sesvenna settentrionale',
  pericolo: 3 as const, am: null, pm: null, alta: 3 as const, bassa: 1 as const,
  geometria: { type: 'Polygon', coordinates: [[[11.7, 46.3], [11.8, 46.3], [11.8, 46.4], [11.7, 46.3]]] },
  ...over,
});

describe('terremoti sulla mappa', () => {
  test('un cerchio per evento, e il popup dice magnitudo, profondità e quando', () => {
    const { container } = render(<EmergencyQuakeLayer quakes={[sisma(), sisma({ id: 'q2', mag: 4.8 })]} />);
    expect(screen.getAllByTestId('circle-marker')).toHaveLength(2);
    // Il testo si legge dal contenitore: "Magnitudo" e il numero stanno in due elementi
    // diversi, e cercarli come un unico nodo non troverebbe niente.
    expect(container.textContent).toContain('Magnitudo 3,2');
    expect(container.textContent).toContain('Magnitudo 4,8');
    expect(container.textContent).toContain('Profondità 9 km');
    expect(container.textContent).toContain('1 ora fa');
  });

  /**
   * **`bubblingMouseEvents={false}`**: col renderer canvas il bersaglio del click è la
   * tela, e Leaflet aggiunge la mappa come bersaglio di riserva — quindi un tocco apriva
   * il popup **e** creava un waypoint. È il difetto della v0.11.1, finito in produzione:
   * qui è un invariante verificato, non una buona intenzione.
   */
  test('il tocco non arriva alla mappa: nessun waypoint dietro il popup', () => {
    render(<EmergencyQuakeLayer quakes={[sisma()]} />);
    expect(screen.getByTestId('circle-marker').getAttribute('data-bubbling')).toBe('false');
  });

  test('una profondità che manca si dichiara, non diventa zero', () => {
    render(<EmergencyQuakeLayer quakes={[sisma({ depthKm: null })]} />);
    expect(screen.getByText(/profondità non indicata/)).toBeInTheDocument();
    expect(screen.queryByText(/Profondità 0 km/)).not.toBeInTheDocument();
  });

  test('il colore segue la magnitudo', () => {
    render(<EmergencyQuakeLayer quakes={[sisma({ mag: 2 }), sisma({ id: 'q2', mag: 5.4 })]} />);
    const colori = screen.getAllByTestId('circle-marker')
      .map((el) => JSON.parse(el.getAttribute('data-pathoptions') ?? '{}').fillColor);
    expect(new Set(colori).size).toBe(2);
  });
});

describe('copertura nevosa sulla mappa', () => {
  const def = getEmergencyLayer('snow-cover');

  beforeEach(() => {
    __resetTileHandlers();
    useEmergencyStore.setState({
      layers: { ...useEmergencyStore.getState().layers, 'snow-cover': { status: 'loading', error: null, lastFetch: null } },
      xyzGiorno: {},
    });
  });

  test('mostra le mattonelle del giorno più recente, col tetto di zoom dichiarato', () => {
    render(<EmergencyXyzLayer def={def} />);
    const el = screen.getByTestId('tile-layer');
    expect(el.getAttribute('data-maxnativezoom')).toBe('8');
    expect(el.getAttribute('data-url')).toContain(new Date().toISOString().slice(0, 10));
  });

  /**
   * **Il giorno usato va dichiarato.** Un'immagine di ieri presentata come di oggi è la
   * classe di difetto più ripetuta di questo progetto: qui il pannello legge il giorno
   * dallo store, e chi lo scrive è il componente che sa quale ha davvero funzionato.
   */
  test('dichiara allo store di che giorno è l immagine', () => {
    render(<EmergencyXyzLayer def={def} />);
    expect(useEmergencyStore.getState().xyzGiorno['snow-cover'])
      .toBe(new Date().toISOString().slice(0, 10));
    expect(useEmergencyStore.getState().layers['snow-cover'].status).toBe('ready');
  });

  /**
   * Il passaggio del satellite copre una fascia alla volta: nelle prime ore il mosaico
   * globale è incompleto. Senza il ripiego il layer sarebbe vuoto proprio la mattina,
   * quando lo si guarda per decidere se partire.
   */
  /**
   * **Se non c'e' nessun giorno con immagini, si dice.**
   *
   * Prima il componente passava allo store un flag `ultimoTentativo` che lo store
   * **ignorava**: esaurito l'elenco, il layer restava 'ready' su un giorno che non
   * risponde, con la mappa vuota — assenza di dati indistinguibile da "niente neve". E'
   * la stessa classe di difetto di `slim` e del livello utente: valori scritti e riletti
   * da nessuno.
   */
  test('esauriti tutti i giorni, dichiara che immagini non ce ne sono', () => {
    render(<EmergencyXyzLayer def={def} />);
    // Un errore per ogni giorno dell'elenco, piu' uno.
    for (let i = 0; i < 8; i++) {
      act(() => { __tileHandlers()[0]?.tileerror?.(); });
    }
    const runtime = useEmergencyStore.getState().layers['snow-cover'];
    expect(runtime.status).toBe('nodata');
    expect(runtime.error).toMatch(/nessuna immagine/i);
    // E il giorno dichiarato sparisce: non si tiene un'etichetta che non descrive niente.
    expect(useEmergencyStore.getState().xyzGiorno['snow-cover']).toBeUndefined();
  });

  /**
   * Il payload va buttato col layer: e' la regola che lo store dichiara per focolai,
   * radar e ripari, e l'etichetta del giorno e' payload come gli altri. Tenerla
   * significherebbe lasciare in giro una data che non descrive piu' niente.
   */
  test('spegnere il layer butta anche l etichetta del giorno', () => {
    render(<EmergencyXyzLayer def={def} />);
    expect(useEmergencyStore.getState().xyzGiorno['snow-cover']).toBeTruthy();
    act(() => { useEmergencyStore.getState().stopLayer('snow-cover'); });
    expect(useEmergencyStore.getState().xyzGiorno['snow-cover']).toBeUndefined();
  });

  test('se le mattonelle del giorno non ci sono, scende di un giorno', () => {
    render(<EmergencyXyzLayer def={def} />);
    const oggi = new Date().toISOString().slice(0, 10);
    const ieri = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect(screen.getByTestId('tile-layer').getAttribute('data-url')).toContain(oggi);

    // `tileerror` come lo emette Leaflet quando una mattonella non arriva.
    act(() => { __tileHandlers()[0]?.tileerror?.(); });

    expect(screen.getByTestId('tile-layer').getAttribute('data-url')).toContain(ieri);
    // E il giorno dichiarato allo store segue: il pannello deve dire quello vero.
    expect(useEmergencyStore.getState().xyzGiorno['snow-cover']).toBe(ieri);
  });
});

describe('valanghe sulla mappa', () => {
  beforeEach(() => {
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'avalanche-danger': { status: 'loading', error: null, lastFetch: null },
      },
      avalanche: null,
    });
    __setMapZoom(11);
    __setMapBounds({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ bulletinDate: '2026-02-15', zones: [], totalRated: 0 }),
    })) as unknown as typeof global.fetch;
  });

  /**
   * **Sotto la soglia di zoom non si interroga, e lo si dice.** Le micro-regioni
   * diventano schegge illeggibili e la risposta cresce con l'area. Ma tacere non basta:
   * una mappa senza colori si legge come "nessun pericolo", e questo è il layer dove
   * quell'errore costa più caro.
   */
  test('a mappa lontana non chiede niente, e dichiara perché', async () => {
    __setMapZoom(7);
    render(<EmergencyAvalancheLayer bollettino={null} />);
    expect(global.fetch).not.toHaveBeenCalled();
    const runtime = useEmergencyStore.getState().layers['avalanche-danger'];
    expect(runtime.status).toBe('nodata');
    expect(runtime.error).toMatch(/avvicinati/i);
  });

  test('a mappa vicina chiede la vista inquadrata', async () => {
    render(<EmergencyAvalancheLayer bollettino={null} />);
    await act(async () => { await Promise.resolve(); });
    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('/api/avalanche');
    expect(url).toContain('zoom=11');
    // La vista chiesta è un po' più larga di quella inquadrata, così un piccolo
    // spostamento non costringe a richiedere.
    expect(Number(new URL(url, 'http://x').searchParams.get('south'))).toBeLessThan(46.25);
  });

  test('disegna una zona per poligono, col colore della scala', () => {
    render(<EmergencyAvalancheLayer bollettino={{ bulletinDate: '2026-02-15', zones: [zona()], totalRated: 1 }} />);
    const stili = JSON.parse(screen.getByTestId('geojson-layer').getAttribute('data-styles') ?? '[]');
    expect(stili[0].fillColor).toBe(SCALA_EAWS[3].colore);
  });

  test('il popup dice il nome, il pericolo, la differenza di quota e che vale per la zona', () => {
    render(<EmergencyAvalancheLayer bollettino={{ bulletinDate: '2026-02-15', zones: [zona()], totalRated: 1 }} />);
    const popup = screen.getByTestId('geojson-layer').getAttribute('data-popup') ?? '';
    expect(popup).toContain('Gruppo Sesvenna settentrionale');
    expect(popup).toContain('3 — Marcato');
    expect(popup).toContain('più in basso 1 — Debole');
    expect(popup).toContain('15/02/2026');
    expect(popup).toContain('non per il singolo pendio');
  });

  test('senza nome il popup mostra l id, non una riga vuota', () => {
    render(<EmergencyAvalancheLayer bollettino={{ bulletinDate: '2026-02-15', zones: [zona({ nome: null })], totalRated: 1 }} />);
    expect(screen.getByTestId('geojson-layer').getAttribute('data-popup')).toContain('IT-32-BZ-01-01');
  });

  /** Il livello 5 è rosso a tratteggio sul sito ufficiale: qui si distingue col bordo. */
  test('il livello 5 si distingue dal 4 anche se il rosso è lo stesso', () => {
    const s4 = stileZona(4);
    const s5 = stileZona(5);
    expect(s5.fillColor).toBe(s4.fillColor);
    expect(s5.color).not.toBe(s4.color);
    expect(s5.weight).toBeGreaterThan(s4.weight as number);
  });

  test('senza zone non monta nessun layer', () => {
    render(<EmergencyAvalancheLayer bollettino={{ bulletinDate: null, zones: [], totalRated: 0 }} />);
    expect(screen.queryByTestId('geojson-layer')).not.toBeInTheDocument();
  });
});

/**
 * **I poligoni devono cambiare quando cambia la vista.**
 *
 * `react-leaflet` passa `data` a Leaflet solo quando CREA il layer: la sua funzione di
 * aggiornamento tocca soltanto `style`. Quindi tutto dipende dalla `key` — e la prima che
 * ho scritto era `data-numeroZone-primoId`, che fra due viste diverse con lo stesso numero
 * di zone e lo stesso primo id **coincide**. Pannando dentro la stessa regione restavano
 * disegnati i poligoni di prima, ricolorati coi pericoli delle zone nuove: livello
 * sbagliato su area sbagliata, sul layer dove quell'errore costa piu' caro.
 */
describe('le zone valanghe seguono la vista', () => {
  const zonaCon = (id: string, pericolo: 1 | 2 | 3 | 4 | 5, lon: number) => ({
    id, nome: id, pericolo, am: null, pm: null, alta: null, bassa: null,
    geometria: {
      type: 'Polygon',
      coordinates: [[[lon, 46.3], [lon + 0.1, 46.3], [lon + 0.1, 46.4], [lon, 46.3]]],
    },
  });

  test('due viste con lo stesso numero di zone e lo stesso primo id si ridisegnano', () => {
    const prima = {
      bulletinDate: '2026-02-15',
      zones: [zonaCon('IT-32-BZ-01-01', 3, 11.7), zonaCon('IT-32-BZ-02-01', 2, 11.8)],
      totalRated: 2,
    };
    const dopo = {
      bulletinDate: '2026-02-15',
      // Stesso conteggio, stesso primo id: cambia solo la seconda zona.
      zones: [zonaCon('IT-32-BZ-01-01', 3, 11.7), zonaCon('IT-32-BZ-09-09', 4, 12.1)],
      totalRated: 2,
    };
    const { rerender } = render(<EmergencyAvalancheLayer bollettino={prima} />);
    expect(screen.getByTestId('geojson-layer').getAttribute('data-popups')).toContain('IT-32-BZ-02-01');

    rerender(<EmergencyAvalancheLayer bollettino={dopo} />);
    const popups = screen.getByTestId('geojson-layer').getAttribute('data-popups') ?? '';
    expect(popups).toContain('IT-32-BZ-09-09');
    expect(popups).not.toContain('IT-32-BZ-02-01');
  });

  test('lo stesso contenuto non fa ricreare il layer', () => {
    const b = {
      bulletinDate: '2026-02-15',
      zones: [zonaCon('IT-32-BZ-01-01', 3, 11.7)],
      totalRated: 1,
    };
    const { rerender } = render(<EmergencyAvalancheLayer bollettino={b} />);
    const primo = screen.getByTestId('geojson-layer');
    // Stesso contenuto, oggetto nuovo: l'impronta coincide, il nodo resta lo stesso.
    rerender(<EmergencyAvalancheLayer bollettino={{ ...b, zones: [...b.zones] }} />);
    expect(screen.getByTestId('geojson-layer')).toBe(primo);
  });

  test('cambia anche solo il pericolo di una zona, e si ridisegna', () => {
    const uno = { bulletinDate: '2026-02-15', zones: [zonaCon('IT-32-BZ-01-01', 2, 11.7)], totalRated: 1 };
    const due = { bulletinDate: '2026-02-15', zones: [zonaCon('IT-32-BZ-01-01', 4, 11.7)], totalRated: 1 };
    const { rerender } = render(<EmergencyAvalancheLayer bollettino={uno} />);
    const primo = screen.getByTestId('geojson-layer');
    rerender(<EmergencyAvalancheLayer bollettino={due} />);
    expect(screen.getByTestId('geojson-layer')).not.toBe(primo);
  });
});
