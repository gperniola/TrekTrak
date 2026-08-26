import { render, screen, fireEvent } from '@testing-library/react';
import { EmergencyLayersButton } from '@/components/map/emergency/EmergencyLayersButton';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';

function setActive(ids: string[]) {
  const settings = useItineraryStore.getState().settings;
  useItineraryStore.setState({
    settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ids as never } },
  });
}

describe('EmergencyLayersButton', () => {
  beforeEach(() => {
    useUIStore.setState({ emergencyPanelOpen: false });
    setActive([]);
  });

  test('nessun layer attivo → nessun badge e nome accessibile semplice', () => {
    render(<EmergencyLayersButton />);
    const btn = screen.getByRole('button', { name: 'Layer di emergenza' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn.textContent).toBe('⚠️');
  });

  // Il badge col numero di layer attivi è solo visivo: senza il conteggio nel nome
  // accessibile chi usa uno screen reader non sa quanti layer sono accesi.
  test('layer attivi → conteggio nel badge e nel nome accessibile', () => {
    setActive(['fires-hotspots', 'dpc-alerts']);
    render(<EmergencyLayersButton />);
    expect(screen.getByRole('button', { name: 'Layer di emergenza, 2 attivi' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('click → apre il pannello', () => {
    render(<EmergencyLayersButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(useUIStore.getState().emergencyPanelOpen).toBe(true);
  });
});
