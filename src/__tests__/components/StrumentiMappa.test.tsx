import { render, screen, act } from '@testing-library/react';
import { CompassOverlay } from '@/components/map/CompassTool';
import { PosizioneUtente } from '@/components/map/PosizioneUtente';
import { AnelliDistanza } from '@/components/map/AnelliDistanza';
import { usePositionStore } from '@/stores/positionStore';
import { __setMapBounds } from './__mocks__/react-leaflet';

jest.mock('react-leaflet');
jest.mock('@/lib/elevation-api', () => ({ fetchElevation: jest.fn().mockResolvedValue(1500) }));

/** GPS finto: la bussola consuma solo `watchPosition`. */
function fingiIlGps(lat = 46.45, lon = 11.85) {
  const attivi = new Set<number>();
  let prossimo = 1;
  const originale = { ...navigator.geolocation };
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      ...originale,
      watchPosition: (ok: PositionCallback) => {
        const id = prossimo++;
        attivi.add(id);
        setTimeout(() => ok({
          coords: { latitude: lat, longitude: lon, accuracy: 12, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: Date.now(),
        } as GeolocationPosition), 0);
        return id;
      },
      clearWatch: (id: number) => { attivi.delete(id); },
    },
  });
  return attivi;
}

beforeEach(() => {
  usePositionStore.setState({ lastKnown: null });
  __setMapBounds({ south: 46.40, west: 11.78, north: 46.50, east: 11.92 });
});

/**
 * **Quando spengo la bussola, i suoi punti devono sparire.**
 *
 * Segnalato il 2026-09-03: «quando disattivo la bussola mi rimangono i due punti sulla
 * mappa». Era vero, e la causa stava nella forma del codice: i due marker erano creati
 * *imperativamente* (`L.marker(...).addTo(map)`) dentro un hook che gira a ogni render —
 * anche quando lo strumento è spento, perché gli hook stanno **prima** dell'uscita
 * anticipata. Misurato nel browser: le due croci erano attaccate alla mappa già prima di
 * accendere la bussola, e spegnendola non venivano rimosse ma **spostate a (0,0)**.
 *
 * Ora i marker si dichiarano nel render, come nel righello: escono di scena col
 * componente, senza che nessuno debba ricordarsi di rimuoverli.
 */
describe('la bussola', () => {
  test('spenta non disegna niente sulla mappa', () => {
    fingiIlGps();
    render(<CompassOverlay active={false} onDeactivate={() => {}} />);
    expect(screen.queryByText('Punto mirato')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(screen.queryAllByTestId('polyline')).toHaveLength(0);
    expect(screen.queryAllByTestId('circle')).toHaveLength(0);
  });

  test('accesa disegna il mirino, la linea e gli anelli', async () => {
    fingiIlGps();
    render(<CompassOverlay active onDeactivate={() => {}} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    /*
      Il mirino, riconosciuto dal suo nome accessibile. Prima qui c'era «almeno un
      marker», e il controllo per mutazione ha mostrato che era vacuo: togliendo il
      mirino i test restavano verdi, perche' contavano le tre etichette degli anelli.
    */
    expect(screen.getByText('Punto mirato')).toBeInTheDocument();
    // La linea, due volte: alone bianco e tratteggiata sopra.
    expect(screen.getAllByTestId('polyline')).toHaveLength(2);
    // Tre anelli, ognuno disegnato due volte (alone + tratto).
    expect(screen.getAllByTestId('circle')).toHaveLength(6);
  });

  /**
   * Il difetto segnalato, provato dove viveva: si accende, si spegne, e sulla mappa non
   * deve restare niente della bussola.
   */
  test('spegnendola, mirino linea e anelli se ne vanno', async () => {
    fingiIlGps();
    const { rerender } = render(<CompassOverlay active onDeactivate={() => {}} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(screen.getAllByTestId('polyline').length).toBeGreaterThan(0);

    rerender(<CompassOverlay active={false} onDeactivate={() => {}} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    expect(screen.queryAllByTestId('polyline')).toHaveLength(0);
    expect(screen.queryAllByTestId('circle')).toHaveLength(0);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(screen.queryByText('Punto mirato')).not.toBeInTheDocument();
  });

  /**
   * La posizione ottenuta dalla bussola finisce nello store, quindi il punto «dove sono»
   * resta anche dopo aver spento lo strumento: è la posizione dell'utente, non un
   * dettaglio della bussola.
   */
  test('pubblica la posizione nello store, e li resta', async () => {
    fingiIlGps(46.4480, 11.8460);
    const { rerender } = render(<CompassOverlay active onDeactivate={() => {}} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(usePositionStore.getState().lastKnown).toMatchObject({ lat: 46.4480, lon: 11.8460 });

    rerender(<CompassOverlay active={false} onDeactivate={() => {}} />);
    expect(usePositionStore.getState().lastKnown).not.toBeNull();
  });
});

/**
 * **Il punto «dove sono».**
 *
 * Chiesto il 2026-09-03: «pensavo che quando tappiamo per trovare la nostra posizione il
 * nostro punto appaia già in mappa». Non appariva: lo store esisteva dalla v0.11.5 e lo
 * alimentavano già l'avvio e il tasto, ma nessuno lo disegnava.
 */
describe('il punto della propria posizione', () => {
  test('senza posizione nota non disegna niente', () => {
    render(<PosizioneUtente />);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(screen.queryAllByTestId('circle')).toHaveLength(0);
  });

  test('appena una posizione e nota, il punto compare', () => {
    act(() => {
      usePositionStore.getState().setLastKnown({ lat: 46.45, lon: 11.85, accuracy: 15 });
    });
    render(<PosizioneUtente />);
    expect(screen.getByText('La tua posizione')).toBeInTheDocument();
    // E il cerchio dell'incertezza, che dice quanto e' precisa.
    expect(screen.getAllByTestId('circle')).toHaveLength(1);
    expect(screen.getByTestId('circle').getAttribute('data-radius')).toBe('15');
  });

  /**
   * Un fix da rete cellulare può dichiarare chilometri di incertezza: un cerchio così
   * copre mezza mappa e non dice niente, mentre il punto continua a dire «più o meno
   * qui». Meglio il punto solo che un cerchio che sembra un'area di interesse.
   */
  test('con un incertezza enorme resta il punto, senza cerchio', () => {
    act(() => {
      usePositionStore.getState().setLastKnown({ lat: 46.45, lon: 11.85, accuracy: 9000 });
    });
    render(<PosizioneUtente />);
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.queryAllByTestId('circle')).toHaveLength(0);
  });

  test('senza incertezza dichiarata, il punto si disegna comunque', () => {
    act(() => {
      usePositionStore.getState().setLastKnown({ lat: 46.45, lon: 11.85, accuracy: null });
    });
    render(<PosizioneUtente />);
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.queryAllByTestId('circle')).toHaveLength(0);
  });

  test('il punto non e cliccabile ne raggiungibile con la tastiera', () => {
    act(() => {
      usePositionStore.getState().setLastKnown({ lat: 46.45, lon: 11.85, accuracy: 15 });
    });
    render(<PosizioneUtente />);
    const m = screen.getByTestId('marker');
    // `interactive` da solo NON basta: Leaflet mette role=button e tabIndex=0 per
    // default, lezione della v0.11.6.
    expect(m.getAttribute('data-keyboard')).toBe('false');
    expect(m.getAttribute('data-interactive')).toBe('false');
  });
});

describe('gli anelli sulla mappa', () => {
  test('tre anelli, ognuno con alone ed etichetta leggibile', () => {
    render(<AnelliDistanza lat={46.45} lon={11.85} />);
    // Sei cerchi: tre anelli, ognuno tracciato due volte per essere leggibile.
    expect(screen.getAllByTestId('circle')).toHaveLength(6);
    /*
      E le etichette dicono distanze tonde, all'italiana.

      La vista di prova misura circa 10,8 km per 11,1 km, quindi il raggio che ci sta e'
      5,4 km: il passo piu' grande che tiene tre anelli e' **1 km** (3 km entrano, 6 no).
      La prima stesura di questo test si aspettava 2 km — un mio errore di aritmetica, non
      del codice, e vale ricordarlo: qui il numero atteso va calcolato, non intuito.
    */
    const raggi = screen.getAllByTestId('circle')
      .map((c) => Number(c.getAttribute('data-radius')));
    expect(Array.from(new Set(raggi)).sort((a, b) => a - b)).toEqual([1000, 2000, 3000]);
    expect(screen.getByText('1 km')).toBeInTheDocument();
    expect(screen.getByText('2 km')).toBeInTheDocument();
    expect(screen.getByText('3 km')).toBeInTheDocument();
  });

  /**
   * In una vista minuscola nessun anello della scala ci sta: non se ne disegna nessuno,
   * invece di disegnarne uno che esce dallo schermo.
   */
  test('in una vista minuscola non disegna niente', () => {
    __setMapBounds({ south: 46.4500, west: 11.8500, north: 46.4501, east: 11.8501 });
    render(<AnelliDistanza lat={46.45} lon={11.85} />);
    expect(screen.queryAllByTestId('circle')).toHaveLength(0);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
  });
});
