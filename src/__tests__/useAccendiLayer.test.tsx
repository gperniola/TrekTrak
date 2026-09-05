import { render, act } from '@testing-library/react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { KEYS } from '@/lib/storage';
import { useAccendiLayer } from '@/lib/useAccendiLayer';
import { installaLocalStorage } from './fixtures/finto-localstorage';

jest.mock('@/stores/notificationStore', () => ({
  confirm: jest.fn(() => Promise.resolve(true)),
  toast: { info: jest.fn(), warning: jest.fn(), error: jest.fn(), success: jest.fn() },
}));

const { confirm } = jest.requireMock('@/stores/notificationStore') as {
  confirm: jest.Mock<Promise<boolean>, [unknown]>;
};

/**
 * **Accendere un layer di emergenza.**
 *
 * Trentacinque righe che stavano dentro `EmergencyLayerRow` senza nessun test, e che
 * contengono due guardie non ovvie: l'anti-rientranza sul disclaimer e la rilettura dello
 * stato fresco **dopo** l'attesa. Sono la ragione per cui valeva la pena portarle fuori:
 * dentro il componente non si potevano interrogare senza montare il pannello e simulare
 * un dialogo.
 */

const deposito = installaLocalStorage();

function Interruttore() {
  const accendi = useAccendiLayer('fires-hotspots');
  return <button data-testid="i" onClick={() => { void accendi(); }}>interruttore</button>;
}

const accesi = () => useItineraryStore.getState().settings.mapDisplay.emergencyLayers;

beforeEach(() => {
  deposito.clear();
  confirm.mockReset();
  confirm.mockResolvedValue(true);
  jest.spyOn(useEmergencyStore.getState(), 'startLayer').mockImplementation(() => {});
  jest.spyOn(useEmergencyStore.getState(), 'stopLayer').mockImplementation(() => {});
  useItineraryStore.setState({
    settings: {
      tolerances: { altitude: 50, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 },
      mapDisplay: {
        coloredPath: false, trailRouting: false, sampleInterval: 50, baseMap: 'osm',
        showHikingTrails: false, showCoordinateGrid: false, emergencyLayers: [],
      },
    },
  });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('il disclaimer', () => {
  test('la prima volta si chiede, e accettandolo il layer si accende', async () => {
    const { getByTestId } = render(<Interruttore />);
    await act(async () => { getByTestId('i').click(); });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(accesi()).toEqual(['fires-hotspots']);
  });

  test('rifiutandolo il layer NON si accende', async () => {
    confirm.mockResolvedValue(false);
    const { getByTestId } = render(<Interruttore />);
    await act(async () => { getByTestId('i').click(); });
    expect(accesi()).toEqual([]);
  });

  /** Vale per tutti i layer: e' una dichiarazione sui dati, non su un layer in particolare. */
  test('accettato una volta, non si chiede piu', async () => {
    deposito.setItem(KEYS.emergencyDisclaimer, '1');
    const { getByTestId } = render(<Interruttore />);
    await act(async () => { getByTestId('i').click(); });
    expect(confirm).not.toHaveBeenCalled();
    expect(accesi()).toEqual(['fires-hotspots']);
  });

  test('rifiutandolo non si segna come visto', async () => {
    confirm.mockResolvedValue(false);
    const { getByTestId } = render(<Interruttore />);
    await act(async () => { getByTestId('i').click(); });
    expect(deposito.getItem(KEYS.emergencyDisclaimer)).toBeNull();
  });

  /** Spegnere non e' un gesto che ha bisogno di avvertimenti. */
  test('spegnendo non si chiede niente', async () => {
    deposito.setItem(KEYS.emergencyDisclaimer, '1');
    useItineraryStore.setState({
      settings: {
        ...useItineraryStore.getState().settings,
        mapDisplay: {
          ...useItineraryStore.getState().settings.mapDisplay,
          emergencyLayers: ['fires-hotspots'],
        },
      },
    });
    const { getByTestId } = render(<Interruttore />);
    await act(async () => { getByTestId('i').click(); });
    expect(confirm).not.toHaveBeenCalled();
    expect(accesi()).toEqual([]);
  });
});

describe('le due guardie', () => {
  /**
   * **Anti-rientranza.** Mostrare il disclaimer e' un `await`: un secondo tocco mentre si
   * aspetta la risposta aprirebbe un secondo dialogo sullo stesso layer.
   */
  test('due tocchi rapidi aprono UN solo dialogo', async () => {
    let sblocca: (v: boolean) => void = () => {};
    confirm.mockImplementation(() => new Promise<boolean>((r) => { sblocca = r; }));
    const { getByTestId } = render(<Interruttore />);
    act(() => { getByTestId('i').click(); });
    act(() => { getByTestId('i').click(); });
    act(() => { getByTestId('i').click(); });
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => { sblocca(true); });
    expect(accesi()).toEqual(['fires-hotspots']);
  });

  /**
   * **Lo stato si rilegge fresco dopo l'attesa.** Il disclaimer puo' restare aperto
   * secondi, e in quel tempo un altro interruttore puo' aver acceso un layer: scrivere la
   * lista catturata al render vorrebbe dire spegnerlo.
   */
  test('un layer acceso da un altro interruttore durante l attesa non si perde', async () => {
    let sblocca: (v: boolean) => void = () => {};
    confirm.mockImplementation(() => new Promise<boolean>((r) => { sblocca = r; }));
    const { getByTestId } = render(<Interruttore />);
    act(() => { getByTestId('i').click(); });

    // Mentre il dialogo e' aperto, qualcun altro accende le allerte DPC.
    act(() => {
      const s = useItineraryStore.getState().settings;
      useItineraryStore.getState().updateSettings({
        ...s,
        mapDisplay: { ...s.mapDisplay, emergencyLayers: ['dpc-alerts'] },
      });
    });

    await act(async () => { sblocca(true); });
    expect(accesi()).toEqual(['dpc-alerts', 'fires-hotspots']);
  });

  /** E se nell'attesa e' stato acceso proprio questo, non lo si aggiunge due volte. */
  test('lo stesso layer acceso durante l attesa non si duplica', async () => {
    let sblocca: (v: boolean) => void = () => {};
    confirm.mockImplementation(() => new Promise<boolean>((r) => { sblocca = r; }));
    const { getByTestId } = render(<Interruttore />);
    act(() => { getByTestId('i').click(); });
    act(() => {
      const s = useItineraryStore.getState().settings;
      useItineraryStore.getState().updateSettings({
        ...s,
        mapDisplay: { ...s.mapDisplay, emergencyLayers: ['fires-hotspots'] },
      });
    });
    await act(async () => { sblocca(true); });
    expect(accesi()).toEqual(['fires-hotspots']);
  });
});

describe('lo storage bloccato non ferma niente', () => {
  /**
   * In navigazione privata (o con i dati del sito bloccati) `localStorage` **lancia**. Il
   * disclaimer si richiedera' ogni volta, ma il layer deve accendersi: la memoria di una
   * dichiarazione letta non e' una condizione per usare l'app.
   */
  test('se lo storage lancia, il layer si accende comunque', async () => {
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => { throw new Error('bloccato'); },
        setItem: () => { throw new Error('bloccato'); },
        removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
      },
    });
    const { getByTestId } = render(<Interruttore />);
    await act(async () => { getByTestId('i').click(); });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(accesi()).toEqual(['fires-hotspots']);
    installaLocalStorage();
  });
});
