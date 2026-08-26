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
  beforeEach(() => {
    localStorage.clear();
    (confirm as jest.Mock).mockClear().mockResolvedValue(true);
    useUIStore.setState({ emergencyPanelOpen: true });
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: [] } },
    });
  });

  test('chiuso → non renderizza nulla', () => {
    useUIStore.setState({ emergencyPanelOpen: false });
    const { container } = render(<EmergencyLayersPanel />);
    expect(container.firstChild).toBeNull();
  });

  test('mostra i 4 layer con switch spenti', () => {
    render(<EmergencyLayersPanel />);
    expect(screen.getByText('Focolai attivi (24h)')).toBeInTheDocument();
    expect(screen.getByText('Allerte meteo-idro (DPC)')).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(4);
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
});
