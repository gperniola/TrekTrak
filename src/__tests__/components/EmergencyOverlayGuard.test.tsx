import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmergencyLayersButton } from '@/components/map/emergency/EmergencyLayersButton';
import { EmergencyLayersPanel } from '@/components/map/emergency/EmergencyLayersPanel';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import {
  __resetDomEvent, __isClickDisabled, __isScrollGuarded, __guardedGestures, __activeListeners,
} from './__mocks__/leaflet';

jest.mock('@/stores/notificationStore', () => ({
  ...jest.requireActual('@/stores/notificationStore'),
  confirm: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({ points: [], fetchedAt: '2026-08-26T07:00:00Z' }),
  fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [] }),
}));

const IDS = ['fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts'] as const;

/**
 * Regressione: pulsante e pannello sono figli DOM di MapContainer. Senza guardia il
 * click risaliva a `.leaflet-container`, Leaflet sparava il `click` della mappa e
 * `MapEvents` aggiungeva un waypoint a ogni tocco sul pannello.
 *
 * L'invariante è duplice, e va verificata in entrambe le direzioni: Leaflet deve
 * scartare il click, ma React deve continuare a riceverlo — fermare la propagazione
 * DOM del click soddisferebbe la prima e romperebbe la seconda, rendendo gli switch
 * inservibili.
 */
describe('guardia di propagazione degli overlay di emergenza', () => {
  beforeEach(() => {
    __resetDomEvent();
    localStorage.clear();
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    IDS.forEach((id) => useEmergencyStore.getState().stopLayer(id));
    useUIStore.setState({ emergencyPanelOpen: false, moreMenuOpen: false });
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: [] } },
    });
  });

  afterEach(() => {
    IDS.forEach((id) => useEmergencyStore.getState().stopLayer(id));
  });

  test('Leaflet scarta il click sul pulsante (nessun waypoint)', () => {
    render(<EmergencyLayersButton />);
    expect(__isClickDisabled(screen.getByRole('button'))).toBe(true);
  });

  test('il pulsante resta cliccabile per React', () => {
    render(<EmergencyLayersButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(useUIStore.getState().emergencyPanelOpen).toBe(true);
  });

  test('Leaflet scarta il click sugli switch del pannello', () => {
    useUIStore.setState({ emergencyPanelOpen: true });
    render(<EmergencyLayersPanel />);
    expect(__isClickDisabled(screen.getAllByRole('switch')[0])).toBe(true);
  });

  test('gli switch restano azionabili', async () => {
    useUIStore.setState({ emergencyPanelOpen: true });
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() =>
      expect(useItineraryStore.getState().settings.mapDisplay.emergencyLayers).toContain('fires-hotspots'));
  });

  test('il pannello ferma wheel e gesti di mappa', () => {
    useUIStore.setState({ emergencyPanelOpen: true });
    render(<EmergencyLayersPanel />);
    const dialog = screen.getByRole('dialog');
    expect(__isScrollGuarded(dialog)).toBe(true);
    expect(__guardedGestures(dialog)).toEqual(expect.arrayContaining(['dblclick', 'touchstart', 'contextmenu']));
  });

  test('il click non viene fermato a livello DOM: mousedown e click restano liberi', () => {
    useUIStore.setState({ emergencyPanelOpen: true });
    render(<EmergencyLayersPanel />);
    expect(__guardedGestures(screen.getByRole('dialog'))).not.toContain('click');
  });

  test('il backdrop mobile chiude il pannello ed è a sua volta guardato', () => {
    useUIStore.setState({ emergencyPanelOpen: true });
    const { container } = render(<EmergencyLayersPanel />);
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(__isClickDisabled(backdrop)).toBe(true);
    fireEvent.click(backdrop);
    expect(useUIStore.getState().emergencyPanelOpen).toBe(false);
  });

  test('aprire il pannello chiude il menu Altro (un solo sheet per volta)', () => {
    useUIStore.setState({ moreMenuOpen: true });
    render(<EmergencyLayersButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(useUIStore.getState().emergencyPanelOpen).toBe(true);
    expect(useUIStore.getState().moreMenuOpen).toBe(false);
  });

  test('alla chiusura del pannello i listener della guardia vengono rimossi', () => {
    useUIStore.setState({ emergencyPanelOpen: true });
    const { rerender } = render(<EmergencyLayersPanel />);
    expect(__activeListeners().length).toBeGreaterThan(0);
    useUIStore.setState({ emergencyPanelOpen: false });
    rerender(<EmergencyLayersPanel />);
    expect(__activeListeners()).toHaveLength(0);
  });
});
