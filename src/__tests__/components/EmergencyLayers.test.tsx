import { render, screen, waitFor } from '@testing-library/react';
import EmergencyLayers from '@/components/map/emergency/EmergencyLayers';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({
    points: [{ lat: 42, lon: 13, frp: 5, confidence: 'high', acquiredAt: '2026-08-25T09:00:00Z', satellite: 'N20' }],
    fetchedAt: '2026-08-25T10:00:00Z',
  }),
  fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [] }),
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
});
