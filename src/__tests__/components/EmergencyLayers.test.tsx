import { render, screen, waitFor } from '@testing-library/react';
import EmergencyLayers from '@/components/map/emergency/EmergencyLayers';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { __paneAtLayerMount, __resetPanes } from './__mocks__/react-leaflet';

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({
    // Dentro i bounds della mappa mockata (44..46, 9..11): il layer focolai scarta i
    // punti fuori dalla vista, quindi un fixture fuori non verrebbe disegnato.
    points: [{ lat: 45, lon: 10, frp: 5, confidence: 'high', acquiredAt: '2026-08-25T09:00:00Z', satellite: 'N20' }],
    fetchedAt: '2026-08-25T10:00:00Z',
  }),
  fetchDpcClient: jest.fn().mockResolvedValue({
    bulletinId: '20260825_1415',
    issuedLabel: '25/08 14:15',
    // La data deve essere quella odierna, altrimenti `defaultDpcDate` non seleziona
    // nulla e il layer zone non viene renderizzato.
    days: [{
      date: new Date().toISOString().slice(0, 10),
      zones: [{
        name: 'Zona test', idraulico: 2, temporali: 0, idrogeologico: 0, maxLevel: 2,
        feature: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[[13, 42], [13.1, 42], [13.1, 42.1], [13, 42]]] },
        },
      }],
    }],
  }),
}));

function setActive(ids: string[]) {
  const settings = useItineraryStore.getState().settings;
  useItineraryStore.setState({
    settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ids as never } },
  });
}

describe('EmergencyLayers', () => {
  beforeEach(() => {
    (['fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts'] as const)
      .forEach((id) => useEmergencyStore.getState().stopLayer(id));
    setActive([]);
    __resetPanes();
  });

  test('nessun layer attivo → nulla sulla mappa', () => {
    render(<EmergencyLayers />);
    expect(screen.queryByTestId('wms-tile-layer')).toBeNull();
    expect(screen.queryByTestId('circle-marker')).toBeNull();
  });

  test('layer wms attivo → WMSTileLayer renderizzato', () => {
    setActive(['fires-fwi']);
    render(<EmergencyLayers />);
    expect(screen.getByTestId('wms-tile-layer')).toBeInTheDocument();
  });

  test('layer points attivo → startLayer al mount e marker dopo il fetch', async () => {
    setActive(['fires-hotspots']);
    render(<EmergencyLayers />);
    await waitFor(() => expect(screen.getByTestId('circle-marker')).toBeInTheDocument());
  });

  // Regressione: al reload con layer persistiti i figli si agganciavano PRIMA che il padre
  // creasse il pane (React esegue gli effetti dei figli prima di quelli del padre), quindi
  // Leaflet faceva getPane('emergency').appendChild → TypeError e la mappa crashava.
  //
  // L'asserzione va in due parti: DEVE esserci un aggancio sul pane 'emergency' (altrimenti
  // la prima versione di questo test passava anche togliendo del tutto la prop `pane`, perche'
  // un nome vuoto veniva considerato "esistente"), e nessuno di quegli agganci deve essere
  // avvenuto a pane mancante.
  function expectPaneReadyAtMount() {
    const emergency = __paneAtLayerMount.filter((r) => r.pane === 'emergency');
    expect(emergency.length).toBeGreaterThan(0);
    expect(emergency.every((r) => r.existed)).toBe(true);
  }

  test('layer wms già attivo al mount → il pane esiste quando il layer si aggancia', async () => {
    setActive(['fires-fwi']);
    render(<EmergencyLayers />);
    await waitFor(() => expect(__paneAtLayerMount.length).toBeGreaterThan(0));
    expectPaneReadyAtMount();
  });

  // La stessa garanzia serve per gli altri due tipi di layer: l'harness copriva solo
  // WMSTileLayer, quindi una regressione su focolai o allerte — che sono proprio i
  // layer persistiti nello scenario del crash — sarebbe passata in CI.
  test('layer points già attivo al mount → il pane esiste quando i marker si agganciano', async () => {
    setActive(['fires-hotspots']);
    render(<EmergencyLayers />);
    await waitFor(() => expect(screen.getByTestId('circle-marker')).toBeInTheDocument());
    expectPaneReadyAtMount();
  });

  test('layer zones già attivo al mount → il pane esiste quando il GeoJSON si aggancia', async () => {
    setActive(['dpc-alerts']);
    render(<EmergencyLayers />);
    await waitFor(() => expect(screen.getByTestId('geojson-layer')).toBeInTheDocument());
    expectPaneReadyAtMount();
  });
});
