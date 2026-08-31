import { render, screen } from '@testing-library/react';
import { EmergencyLayersButton } from '@/components/map/emergency/EmergencyLayersButton';
import { EmergencyLayersPanel } from '@/components/map/emergency/EmergencyLayersPanel';
import { useUIStore } from '@/stores/uiStore';

jest.mock('@/stores/notificationStore', () => ({
  ...jest.requireActual('@/stores/notificationStore'),
  confirm: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({ points: [], fetchedAt: '2026-08-25T10:00:00Z' }),
  fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '1', issuedLabel: '25/08 14:15', days: [] }),
}));

/**
 * In Imparo si sta a casa su una carta: i layer di emergenza non si montano affatto,
 * cosi' non partono nemmeno le loro chiamate di rete.
 */
describe('in Imparo la mappa non offre i layer di emergenza', () => {
  test('in Montagna il pulsante c e', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<EmergencyLayersButton />);
    expect(screen.getByRole('button', { name: /Layer di emergenza/ })).toBeInTheDocument();
  });

  test('in Imparo il pulsante non e nel DOM', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<EmergencyLayersButton />);
    expect(screen.queryByRole('button', { name: /Layer di emergenza/ })).not.toBeInTheDocument();
  });

  /** Anche il pannello: chi arriva con il pannello gia' aperto non deve trovarselo. */
  test('in Imparo il pannello non si apre nemmeno se lo stato dice aperto', () => {
    useUIStore.setState({ profilo: 'imparo', emergencyPanelOpen: true });
    render(<EmergencyLayersPanel />);
    expect(screen.queryByRole('dialog', { name: 'Layer di emergenza' })).not.toBeInTheDocument();
  });

  test('in Montagna il pannello aperto si vede', () => {
    useUIStore.setState({ profilo: 'montagna', emergencyPanelOpen: true });
    render(<EmergencyLayersPanel />);
    expect(screen.getByRole('dialog', { name: 'Layer di emergenza' })).toBeInTheDocument();
  });
});
