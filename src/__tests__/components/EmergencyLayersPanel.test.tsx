import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EmergencyLayersPanel } from '@/components/map/emergency/EmergencyLayersPanel';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';

jest.mock('@/stores/notificationStore', () => ({
  ...jest.requireActual('@/stores/notificationStore'),
  confirm: jest.fn().mockResolvedValue(true),
}));
import { confirm } from '@/stores/notificationStore';

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({ points: [], fetchedAt: '2026-08-25T10:00:00Z' }),
  fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [] }),
}));

describe('EmergencyLayersPanel', () => {
  const IDS = ['fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts'] as const;

  beforeEach(() => {
    localStorage.clear();
    (confirm as jest.Mock).mockClear().mockResolvedValue(true);
    useUIStore.setState({ emergencyPanelOpen: true });
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: [] } },
    });
    // Il reset dello store di emergenza mancava: lo stato {status:'error'} iniettato da
    // un test sopravviveva a quelli successivi, e in "footer mostra le fonti attive" il
    // successivo startLayer usciva subito (status !== 'idle') senza fetchare — il test
    // passava per il motivo sbagliato, e la suite era ordine-dipendente.
    IDS.forEach((id) => useEmergencyStore.getState().stopLayer(id));
    useEmergencyStore.setState({ fires: null, dpc: null, dpcSelectedDate: null });
  });

  // startLayer arma intervalli reali da 15/30 minuti: senza stop restano appesi a fine run.
  afterEach(() => {
    IDS.forEach((id) => useEmergencyStore.getState().stopLayer(id));
  });

  test('chiuso → non renderizza nulla', () => {
    useUIStore.setState({ emergencyPanelOpen: false });
    const { container } = render(<EmergencyLayersPanel />);
    expect(container.firstChild).toBeNull();
  });

  test('mostra i 7 layer con switch spenti', () => {
    render(<EmergencyLayersPanel />);
    expect(screen.getByText('Focolai attivi (24h)')).toBeInTheDocument();
    expect(screen.getByText('Allerte meteo-idro (DPC)')).toBeInTheDocument();
    expect(screen.getByText(/Radar pioggia/)).toBeInTheDocument();
    expect(screen.getByText(/Rifugi e ricoveri/)).toBeInTheDocument();
    expect(screen.getByText(/Instabilit. osservata/)).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(7);
    screen.getAllByRole('switch').forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'));
  });

  test('prima attivazione: disclaimer, poi settings aggiornati e switch acceso', async () => {
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toContain('fires-hotspots'));
    expect(localStorage.getItem('trektrak_emergency_disclaimer_seen')).toBe('1');
  });

  test('disclaimer rifiutato → layer NON attivato', async () => {
    (confirm as jest.Mock).mockResolvedValue(false);
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toEqual([]);
  });

  test('disclaimer già visto → nessun confirm alla seconda attivazione', async () => {
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[1]);
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toContain('fires-burned'));
    expect(confirm).not.toHaveBeenCalled();
  });

  test('toggle OFF rimuove dai settings', async () => {
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ['fires-fwi'] } },
    });
    render(<EmergencyLayersPanel />);
    const fwiSwitch = screen.getAllByRole('switch')[2];
    expect(fwiSwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(fwiSwitch);
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toEqual([]));
  });

  test('layer in errore mostra il badge', () => {
    useEmergencyStore.setState((s) => ({
      layers: { ...s.layers, 'fires-hotspots': { status: 'error', error: 'FIRMS non raggiungibile', lastFetch: null } },
    }));
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ['fires-hotspots'] } },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.getByText(/FIRMS non raggiungibile/)).toBeInTheDocument();
  });

  test('footer mostra le fonti attive dei layer accesi', async () => {
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toContain('fires-hotspots'));
    expect(screen.getByText(/Fonti:/)).toBeInTheDocument();
    expect(screen.getByText(/NASA FIRMS/)).toBeInTheDocument();
  });

  test('nessun layer attivo → nessuna riga fonti nel footer', () => {
    render(<EmergencyLayersPanel />);
    expect(screen.queryByText(/Fonti:/)).not.toBeInTheDocument();
  });

  test('due layer della stessa fonte → EFFIS citato una volta sola', () => {
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: {
        ...settings,
        mapDisplay: { ...settings.mapDisplay, emergencyLayers: ['fires-burned', 'fires-fwi'] },
      },
    });
    render(<EmergencyLayersPanel />);
    const footer = screen.getByText(/Fonti:/).textContent ?? '';
    expect(footer.match(/Copernicus EFFIS/g)).toHaveLength(1);
  });

  test('toggle concorrente durante disclaimer pendente non perde modifiche (no stale closure)', async () => {
    let resolveConfirm: (value: boolean) => void = () => {};
    (confirm as jest.Mock).mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveConfirm = resolve; })
    );
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[0]); // fires-hotspots: apre il disclaimer, resta pending
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));

    // Simula un altro toggle "concorrente" committato altrove mentre il dialog è aperto
    act(() => {
      const settings = useItineraryStore.getState().settings;
      useItineraryStore.setState({
        settings: {
          ...settings,
          mapDisplay: { ...settings.mapDisplay, emergencyLayers: [...settings.mapDisplay.emergencyLayers, 'fires-burned'] },
        },
      });
    });

    resolveConfirm(true);

    await waitFor(() => {
      const layers = useItineraryStore.getState().settings.mapDisplay.emergencyLayers;
      expect(layers).toContain('fires-hotspots');
      expect(layers).toContain('fires-burned');
    });
  });

  test('doppio tap sullo stesso switch non apre due dialog di disclaimer', async () => {
    let resolveConfirm: (value: boolean) => void = () => {};
    (confirm as jest.Mock).mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveConfirm = resolve; })
    );
    render(<EmergencyLayersPanel />);
    const sw = screen.getAllByRole('switch')[0];
    fireEvent.click(sw);
    fireEvent.click(sw);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    resolveConfirm(true);
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toContain('fires-hotspots'));
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  function setActive(ids: string[]) {
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ids as never } },
    });
  }

  // Spec 6: da offline la riga dice "non disponibile offline". I dati di emergenza
  // sono esclusi dalla cache del service worker di proposito, quindi non c'e' nulla
  // da servire e presentarlo come errore di rete e' fuorviante.
  describe('stato offline', () => {
    const setOnline = (v: boolean) => {
      Object.defineProperty(window.navigator, 'onLine', { value: v, configurable: true });
    };
    afterEach(() => setOnline(true));

    test('offline: riga "non disponibile offline" invece dell errore di rete', () => {
      setOnline(false);
      setActive(['fires-hotspots']);
      useEmergencyStore.setState({
        layers: {
          ...useEmergencyStore.getState().layers,
          'fires-hotspots': { status: 'error', error: 'Rete non disponibile', lastFetch: null },
        },
      });
      render(<EmergencyLayersPanel />);
      expect(screen.getByText(/non disponibile offline/)).toBeInTheDocument();
      expect(screen.queryByText(/Rete non disponibile/)).not.toBeInTheDocument();
    });

    test('online: la riga offline non compare', () => {
      setOnline(true);
      setActive(['fires-hotspots']);
      render(<EmergencyLayersPanel />);
      expect(screen.queryByText(/non disponibile offline/)).not.toBeInTheDocument();
    });
  });

  // Prima questo caso restava "ready" con orario fresco e mappa vuota: assenza di
  // dati indistinguibile da "nessuna allerta".
  test('stato nodata: dice "Nessun dato disponibile", non un errore', () => {
    setActive(['dpc-alerts']);
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'dpc-alerts': { status: 'nodata', error: 'Nessun bollettino per oggi', lastFetch: Date.now() },
      },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.getByText(/Nessun dato disponibile/)).toBeInTheDocument();
  });

  test('risultato parziale: la riga lo dichiara', () => {
    setActive(['fires-hotspots']);
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'fires-hotspots': { status: 'ready', error: null, lastFetch: Date.now(), partial: true },
      },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.getByText(/dati parziali/)).toBeInTheDocument();
  });

  // Prima l'orario era dietro `def.refreshMinutes != null`, quindi i due layer EFFIS
  // non mostravano mai ne' orario ne' avviso di staleness.
  test('anche i layer WMS mostrano l orario di aggiornamento', () => {
    setActive(['fires-fwi']);
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'fires-fwi': { status: 'ready', error: null, lastFetch: Date.now() },
      },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.getByText(/Aggiornato alle/)).toBeInTheDocument();
  });

  // Lo switch e' una copia di ToggleSwitch (settings/MapSettings.tsx) che aveva perso
  // il focus ring: tabulando fra i quattro toggle non si vedeva dove fosse il fuoco.
  test('gli switch hanno un indicatore di focus da tastiera', () => {
    render(<EmergencyLayersPanel />);
    screen.getAllByRole('switch').forEach((sw) => {
      expect(sw.className).toMatch(/focus-visible:ring/);
    });
  });
  // Trovato verificando col bollettino reale del 26/08: giornata calma, 0 zone in
  // allerta su 187. Il layer resta legittimamente "ready", ma la mappa e' vuota e
  // per l'utente e' indistinguibile da un layer rotto. Va detto a parole.
  test('giorno senza zone in allerta: lo dichiara invece di lasciare la mappa muta', () => {
    setActive(['dpc-alerts']);
    useEmergencyStore.setState({
      dpc: {
        bulletinId: '20260825_1415',
        issuedLabel: '25/08 14:15',
        days: [{ date: '2026-08-26', zones: [
          { name: 'Zona calma', idraulico: 0, temporali: 0, idrogeologico: 0, maxLevel: 0,
            feature: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } } },
        ] }],
      } as never,
      dpcSelectedDate: '2026-08-26',
      layers: {
        ...useEmergencyStore.getState().layers,
        'dpc-alerts': { status: 'ready', error: null, lastFetch: Date.now() },
      },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.getByText(/Nessuna zona in allerta/)).toBeInTheDocument();
  });

  test('giorno con zone in allerta: nessun avviso di giornata calma', () => {
    setActive(['dpc-alerts']);
    useEmergencyStore.setState({
      dpc: {
        bulletinId: '20260825_1415',
        issuedLabel: '25/08 14:15',
        days: [{ date: '2026-08-26', zones: [
          { name: 'Zona gialla', idraulico: 1, temporali: 0, idrogeologico: 0, maxLevel: 1,
            feature: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } } },
        ] }],
      } as never,
      dpcSelectedDate: '2026-08-26',
      layers: {
        ...useEmergencyStore.getState().layers,
        'dpc-alerts': { status: 'ready', error: null, lastFetch: Date.now() },
      },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.queryByText(/Nessuna zona in allerta/)).not.toBeInTheDocument();
  });
});

/**
 * Su fonti pubbliche che rispondono 504 di tanto in tanto, il tentativo successivo è la
 * cosa più utile da offrire. Prima l'unico modo era spegnere e riaccendere lo switch —
 * un rimedio che l'utente doveva indovinare.
 */
describe('riprovare un layer in errore', () => {
  test('il pulsante compare solo in errore', () => {
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'fires-hotspots': { status: 'ready', error: null, lastFetch: Date.now() },
      },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.queryByRole('button', { name: /riprova/i })).toBeNull();
  });

  test('in errore riavvia il layer', () => {
    // Il dettaglio (e quindi l'errore) si mostra solo per i layer ACCESI: il pulsante
    // vive li'.
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ['fires-hotspots'] } },
    });
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'fires-hotspots': { status: 'error', error: 'Rete non disponibile', lastFetch: null },
      },
    });
    render(<EmergencyLayersPanel />);
    const riprova = screen.getByRole('button', { name: /riprova/i });
    fireEvent.click(riprova);
    // stopLayer riporta a idle e startLayer riparte: in mezzo lo stato non è più 'error'
    expect(useEmergencyStore.getState().layers['fires-hotspots'].status).not.toBe('error');
  });
});
