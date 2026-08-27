import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Feature } from 'geojson';
import { DpcPositionWarning } from '@/components/shared/DpcPositionWarning';
import { usePositionStore } from '@/stores/positionStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { toYmd } from '@/lib/dpc';

jest.mock('@/lib/emergency-api', () => ({
  fetchDpcTodayZones: jest.fn(),
  fetchFiresClient: jest.fn(),
  fetchDpcClient: jest.fn(),
}));
import { fetchDpcTodayZones } from '@/lib/emergency-api';

const quadrato = (lon: number, lat: number, d = 0.5): Feature => ({
  type: 'Feature', properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]],
  },
});

const zonaGialla = {
  name: 'Collina bolognese', idraulico: 1, temporali: 0, idrogeologico: 0, maxLevel: 1,
  feature: quadrato(11.34, 44.49),
} as const;
const zonaTranquilla = {
  name: 'Arno-Firenze', idraulico: 0, temporali: 0, idrogeologico: 0, maxLevel: 0,
  feature: quadrato(11.25, 43.77),
} as const;

const BOLOGNA = { lat: 44.49, lon: 11.34, accuracy: 20 };
const OGGI = () => toYmd(new Date());

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value: v, configurable: true });
}

function setLayerAttivo(attivo: boolean) {
  const settings = useItineraryStore.getState().settings;
  useItineraryStore.setState({
    settings: {
      ...settings,
      mapDisplay: { ...settings.mapDisplay, emergencyLayers: (attivo ? ['dpc-alerts'] : []) as never },
    },
  });
}

describe('DpcPositionWarning', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setOnline(true);
    setLayerAttivo(false);
    usePositionStore.setState({ lastKnown: null });
    useEmergencyStore.setState({ dpc: null });
    (fetchDpcTodayZones as jest.Mock).mockReset().mockResolvedValue({
      kind: 'zones', date: OGGI(), bulletinId: '20260826_1422', zones: [zonaTranquilla, zonaGialla],
    });
  });

  const avviso = () => screen.queryByRole('alert');

  test('posizione in zona in allerta → banner con zona e rischio col suo livello', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    render(<DpcPositionWarning />);
    await waitFor(() => expect(avviso()).toBeInTheDocument());
    expect(avviso()!.textContent).toContain('Allerta gialla');
    expect(avviso()!.textContent).toContain('Collina bolognese');
    expect(avviso()!.textContent).toContain('idraulico gialla');
    // Spec §5: il 112 e il richiamo ai canali ufficiali non vanno persi.
    expect(avviso()!.textContent).toContain('112');
    expect(avviso()!.textContent).toContain('Dipartimento Protezione Civile');
  });

  test('nessuna allerta dove si trova → nessun banner', async () => {
    usePositionStore.setState({ lastKnown: { lat: 43.77, lon: 11.25, accuracy: 20, at: Date.now() } });
    render(<DpcPositionWarning />);
    await waitFor(() => expect(fetchDpcTodayZones).toHaveBeenCalled());
    expect(avviso()).toBeNull();
  });

  /**
   * La garanzia centrale, ora strutturale invece che affidata a un controllo sui
   * permessi: il componente non ha alcun accesso alla geolocalizzazione, quindi non
   * esiste percorso in cui possa far comparire un prompt. Senza posizione pubblicata,
   * tace e non tocca nemmeno la rete.
   */
  test('nessuna posizione nota → tace e non chiede nulla, né rete né GPS', async () => {
    const getCurrentPosition = jest.fn();
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
    render(<DpcPositionWarning />);
    await new Promise((r) => setTimeout(r, 50));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchDpcTodayZones).not.toHaveBeenCalled();
    expect(avviso()).toBeNull();
  });

  // Offline i dati di emergenza sono esclusi dalla cache per scelta: non c'è nulla da
  // consultare, e avviare la catena spenderebbe soltanto batteria.
  test('offline → non avvia nulla', async () => {
    setOnline(false);
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    render(<DpcPositionWarning />);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchDpcTodayZones).not.toHaveBeenCalled();
    expect(avviso()).toBeNull();
  });

  /**
   * Il difetto peggiore della prima versione: `parseDpcTopology` torna `[]` su ogni
   * fallimento morbido, e un array vuoto veniva letto come "nessuna allerta" E marcato
   * come già annunciato, rendendo definitivo un falso "tutto a posto".
   */
  test('geometrie illeggibili (zone vuote) → non conclude "nessuna allerta" e riproverà', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    (fetchDpcTodayZones as jest.Mock).mockResolvedValue({
      kind: 'zones', date: OGGI(), bulletinId: '20260826_1422', zones: [],
    });
    const { unmount } = render(<DpcPositionWarning />);
    await waitFor(() => expect(fetchDpcTodayZones).toHaveBeenCalled());
    expect(avviso()).toBeNull();
    expect(sessionStorage.getItem('tt_dpc_pos_20260826_1422')).toBeNull();

    // secondo tentativo: ora le geometrie arrivano, e l'avviso deve comparire
    unmount();
    (fetchDpcTodayZones as jest.Mock).mockResolvedValue({
      kind: 'zones', date: OGGI(), bulletinId: '20260826_1422', zones: [zonaGialla],
    });
    render(<DpcPositionWarning />);
    await waitFor(() => expect(avviso()).toBeInTheDocument());
  });

  // Con la chiave legata al bollettino, un'emissione nuova nel pomeriggio viene
  // annunciata anche in una sessione aperta al mattino.
  test('bollettino nuovo nella stessa sessione → riavvisa', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    const { unmount } = render(<DpcPositionWarning />);
    await waitFor(() => expect(avviso()).toBeInTheDocument());
    unmount();

    (fetchDpcTodayZones as jest.Mock).mockResolvedValue({
      kind: 'zones', date: OGGI(), bulletinId: '20260826_1800', zones: [zonaGialla],
    });
    render(<DpcPositionWarning />);
    await waitFor(() => expect(avviso()).toBeInTheDocument());
  });

  test('stesso bollettino nella stessa sessione → non riavvisa', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    const { unmount } = render(<DpcPositionWarning />);
    await waitFor(() => expect(avviso()).toBeInTheDocument());
    unmount();
    render(<DpcPositionWarning />);
    await new Promise((r) => setTimeout(r, 50));
    expect(avviso()).toBeNull();
  });

  test('bollettino già nello store → non scarica', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    useEmergencyStore.setState({
      dpc: {
        bulletinId: '20260826_1422', issuedLabel: '26/08 14:22',
        days: [{ date: OGGI(), zones: [zonaGialla] }],
      } as never,
    });
    render(<DpcPositionWarning />);
    await waitFor(() => expect(avviso()).toBeInTheDocument());
    expect(fetchDpcTodayZones).not.toHaveBeenCalled();
  });

  // Col layer attivo il bollettino sta arrivando: si aspetta che compaia nello store
  // invece di scaricare gli stessi ~400 KB una seconda volta.
  test('layer attivo senza dati ancora → aspetta lo store, non scarica', async () => {
    setLayerAttivo(true);
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    render(<DpcPositionWarning />);
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchDpcTodayZones).not.toHaveBeenCalled();
    useEmergencyStore.setState({
      dpc: {
        bulletinId: '20260826_1422', issuedLabel: '26/08 14:22',
        days: [{ date: OGGI(), zones: [zonaGialla] }],
      } as never,
    });
    await waitFor(() => expect(avviso()).toBeInTheDocument());
    expect(fetchDpcTodayZones).not.toHaveBeenCalled();
  });

  test('errore di rete → nessun errore messo davanti all\'utente', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    (fetchDpcTodayZones as jest.Mock).mockRejectedValue(new Error('Rete non disponibile'));
    render(<DpcPositionWarning />);
    await waitFor(() => expect(fetchDpcTodayZones).toHaveBeenCalled());
    expect(avviso()).toBeNull();
  });

  test('si può chiudere, e il pulsante ha un target da pollice', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    render(<DpcPositionWarning />);
    await waitFor(() => expect(avviso()).toBeInTheDocument());
    const chiudi = screen.getByRole('button', { name: /Chiudi avviso/ });
    expect(chiudi.className).toMatch(/min-h-\[44px\]/);
    fireEvent.click(chiudi);
    expect(avviso()).toBeNull();
  });

  test('allerta arancione → banner in variante grave', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    (fetchDpcTodayZones as jest.Mock).mockResolvedValue({
      kind: 'zones', date: OGGI(), bulletinId: '20260826_1422',
      zones: [{ ...zonaGialla, idrogeologico: 2, maxLevel: 2 }],
    });
    render(<DpcPositionWarning />);
    await waitFor(() => expect(avviso()).toBeInTheDocument());
    expect(avviso()!.className).toContain('bg-red-700');
    expect(avviso()!.textContent).toContain('Allerta arancione');
  });

  // Lo smontaggio deve interrompere la catena: senza, download e parse continuano per
  // un componente morto.
  test('smontaggio durante il download → interrompe con un segnale di abort', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    (fetchDpcTodayZones as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<DpcPositionWarning />);
    await waitFor(() => expect(fetchDpcTodayZones).toHaveBeenCalled());
    const signal = (fetchDpcTodayZones as jest.Mock).mock.calls[0][0] as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
  /**
   * Il manifest (~2,4 KB) dice se in tutta Italia ci sono allerte: nei giorni
   * tranquilli — la maggioranza — le geometrie (~400 KB) non vengono scaricate affatto
   * e il controllo si conclude lì.
   */
  test('manifest dice "nessuna allerta" → nessun banner, geometrie mai scaricate', async () => {
    usePositionStore.setState({ lastKnown: { ...BOLOGNA, at: Date.now() } });
    (fetchDpcTodayZones as jest.Mock).mockResolvedValue({
      kind: 'no-alerts', date: OGGI(), bulletinId: '20260826_1422',
    });
    render(<DpcPositionWarning />);
    await waitFor(() => expect(fetchDpcTodayZones).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 40));
    expect(avviso()).toBeNull();
  });
});
