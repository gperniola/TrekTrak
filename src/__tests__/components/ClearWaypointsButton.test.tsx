import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClearWaypointsButton } from '@/components/map/ClearWaypointsButton';
import { useItineraryStore } from '@/stores/itineraryStore';
import { __resetDomEvent, __isClickDisabled } from './__mocks__/leaflet';

jest.mock('@/stores/notificationStore', () => ({
  ...jest.requireActual('@/stores/notificationStore'),
  choose: jest.fn(),
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
import { choose, toast } from '@/stores/notificationStore';

function seedWaypoints(n: number) {
  const store = useItineraryStore.getState();
  store.resetItinerary();
  for (let i = 0; i < n; i++) {
    useItineraryStore.getState().addWaypointAtPosition(45 + i * 0.01, 10 + i * 0.01);
  }
}

const names = () => useItineraryStore.getState().waypoints.map((w) => w.name);

describe('ClearWaypointsButton', () => {
  beforeEach(() => {
    __resetDomEvent();
    (choose as jest.Mock).mockReset();
    (toast.success as jest.Mock).mockClear();
    useItineraryStore.getState().resetItinerary();
  });

  // Un comando di cancellazione sempre presente ma inerte è solo rumore, in una
  // colonna già affollata sul telefono.
  test('senza waypoint il pulsante non compare', () => {
    render(<ClearWaypointsButton />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('con waypoint compare, col conteggio nel nome accessibile', () => {
    seedWaypoints(3);
    render(<ClearWaypointsButton />);
    expect(screen.getByRole('button', { name: /Cancella waypoint, 3 sulla mappa/ })).toBeInTheDocument();
  });

  // È dentro MapContainer: senza guardia il click diventerebbe un waypoint in più,
  // che su un pulsante di cancellazione è particolarmente assurdo.
  test('il click non arriva alla mappa', () => {
    seedWaypoints(2);
    render(<ClearWaypointsButton />);
    expect(__isClickDisabled(screen.getByRole('button'))).toBe(true);
  });

  test('scelta "tutti" → svuota i waypoint ma tiene l\'itinerario', async () => {
    seedWaypoints(3);
    useItineraryStore.setState({ itineraryName: 'Giro del Gran Sasso' });
    (choose as jest.Mock).mockResolvedValue('primary');
    render(<ClearWaypointsButton />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(useItineraryStore.getState().waypoints).toHaveLength(0));
    expect(useItineraryStore.getState().legs).toHaveLength(0);
    // resetItinerary butterebbe anche il nome: qui deve restare.
    expect(useItineraryStore.getState().itineraryName).toBe('Giro del Gran Sasso');
    expect(toast.success).toHaveBeenCalledWith('3 waypoint cancellati');
  });

  test('scelta "solo l\'ultimo" → togle solo il più recente', async () => {
    seedWaypoints(3);
    const prima = names();
    (choose as jest.Mock).mockResolvedValue('secondary');
    render(<ClearWaypointsButton />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(useItineraryStore.getState().waypoints).toHaveLength(2));
    expect(names()).toEqual(prima.slice(0, 2));
  });

  test('annulla → non tocca nulla', async () => {
    seedWaypoints(3);
    (choose as jest.Mock).mockResolvedValue(null);
    render(<ClearWaypointsButton />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(choose).toHaveBeenCalled());
    expect(useItineraryStore.getState().waypoints).toHaveLength(3);
    expect(toast.success).not.toHaveBeenCalled();
  });

  // Con un solo waypoint "tutti" e "l'ultimo" sono la stessa cosa: offrirle entrambe
  // sarebbe una scelta finta.
  test('un solo waypoint → nessuna terza opzione', async () => {
    seedWaypoints(1);
    (choose as jest.Mock).mockResolvedValue('primary');
    render(<ClearWaypointsButton />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(choose).toHaveBeenCalled());
    expect((choose as jest.Mock).mock.calls[0][0].secondaryText).toBeUndefined();
  });

  test('variante distruttiva: il dialog non mette il fuoco sull\'azione irreversibile', async () => {
    seedWaypoints(2);
    (choose as jest.Mock).mockResolvedValue(null);
    render(<ClearWaypointsButton />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(choose).toHaveBeenCalled());
    expect((choose as jest.Mock).mock.calls[0][0].variant).toBe('error');
  });

  // Fra l'apertura del dialog e la risposta l'itinerario può cambiare altrove.
  test('se i waypoint sparcono mentre il dialog è aperto, non lancia', async () => {
    seedWaypoints(2);
    let risolvi: (v: unknown) => void = () => {};
    (choose as jest.Mock).mockImplementation(() => new Promise((r) => { risolvi = r; }));
    render(<ClearWaypointsButton />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(choose).toHaveBeenCalled());
    useItineraryStore.getState().clearWaypoints();
    risolvi('secondary');
    await waitFor(() => expect(useItineraryStore.getState().waypoints).toHaveLength(0));
    expect(toast.success).not.toHaveBeenCalled();
  });

  test('doppio tap non apre due dialog', async () => {
    seedWaypoints(2);
    (choose as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<ClearWaypointsButton />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(choose).toHaveBeenCalledTimes(1));
  });
});
