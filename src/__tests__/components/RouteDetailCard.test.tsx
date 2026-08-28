import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteDetailCard } from '@/components/panel/RouteDetailCard';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import type { Itinerary } from '@/lib/types';

const route: Itinerary = {
  id: '1', name: 'Monte Test', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [],
  notes: 'bella', sortIndex: 0, completions: [],
  metrics: { distanceKm: 8.4, elevationGain: 620, elevationLoss: 600, minAltitude: 800,
    maxAltitude: 1420, avgSlope: 7.4, maxSlope: 18, estimatedTimeMin: 215 },
};

beforeEach(() => {
  useRouteLibraryStore.setState({ routes: [route], selectedRouteId: '1', sortMode: 'manual' });
  useUIStore.setState({ mainView: 'library' });
  useItineraryStore.setState({ waypoints: [] });
  useAuthStore.setState({ member: null });
});

describe('RouteDetailCard', () => {
  test('renders metrics', () => {
    render(<RouteDetailCard />);
    expect(screen.getByText('Monte Test')).toBeInTheDocument();
    // Numeri all'italiana: virgola sui decimali, punto sulle migliaia. Le quote in
    // montagna passano il migliaio, quindi 1420 si scrive 1.420 m.
    expect(screen.getByText(/8,4 km/)).toBeInTheDocument();
    expect(screen.getByText(/620 m/)).toBeInTheDocument();
    expect(screen.getByText(/1\.420 m/)).toBeInTheDocument();
    expect(screen.getByText(/7,4%/)).toBeInTheDocument();
  });

  test("Carica nell'editor switches to editor view", () => {
    jest.spyOn(useItineraryStore.getState(), 'loadItinerary');
    render(<RouteDetailCard />);
    fireEvent.click(screen.getByRole('button', { name: /carica nell'editor/i }));
    expect(useUIStore.getState().mainView).toBe('editor');
  });

  test('mostra il creatore @username', () => {
    useRouteLibraryStore.setState({ routes: [{ ...route, createdByUsername: 'gio' }], selectedRouteId: '1', sortMode: 'manual' });
    render(<RouteDetailCard />);
    expect(screen.getByText(/@gio/)).toBeInTheDocument();
  });

  test('Elimina visibile al proprietario', () => {
    useRouteLibraryStore.setState({ routes: [{ ...route, createdByUsername: 'gio' }], selectedRouteId: '1', sortMode: 'manual' });
    useAuthStore.setState({ member: { id: 'm', username: 'gio', role: 'member' } });
    render(<RouteDetailCard />);
    expect(screen.getByRole('button', { name: /elimina/i })).toBeInTheDocument();
  });

  test('Elimina nascosto a un non-proprietario', () => {
    useRouteLibraryStore.setState({ routes: [{ ...route, createdByUsername: 'gio' }], selectedRouteId: '1', sortMode: 'manual' });
    useAuthStore.setState({ member: { id: 'm2', username: 'anna', role: 'member' } });
    render(<RouteDetailCard />);
    expect(screen.queryByRole('button', { name: /elimina/i })).toBeNull();
  });
});
