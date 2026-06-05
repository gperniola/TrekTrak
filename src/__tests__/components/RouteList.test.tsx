import { describe, expect, test, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteList } from '@/components/panel/RouteList';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import type { Itinerary } from '@/lib/types';

const mk = (id: string, name: string, sortIndex: number): Itinerary => ({
  id, name, createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [], sortIndex,
  metrics: { distanceKm: 5, elevationGain: 300, elevationLoss: 200, minAltitude: 100,
    maxAltitude: 600, avgSlope: 6, maxSlope: 12, estimatedTimeMin: 120 },
  completions: [],
});

beforeEach(() => {
  useRouteLibraryStore.setState({
    routes: [mk('1', 'Primo', 0), mk('2', 'Secondo', 1)],
    selectedRouteId: null, sortMode: 'manual',
  });
});

describe('RouteList', () => {
  test('renders numbered routes', () => {
    render(<RouteList />);
    expect(screen.getByText('Primo')).toBeInTheDocument();
    expect(screen.getByText('Secondo')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('clicking a route selects it', () => {
    render(<RouteList />);
    fireEvent.click(screen.getByText('Primo'));
    expect(useRouteLibraryStore.getState().selectedRouteId).toBe('1');
  });

  test('re-clicking the selected route deselects it (accordion)', () => {
    useRouteLibraryStore.setState({ selectedRouteId: '1' });
    render(<RouteList />);
    fireEvent.click(screen.getByText('Primo'));
    expect(useRouteLibraryStore.getState().selectedRouteId).toBeNull();
  });

  test('empty state when no routes', () => {
    useRouteLibraryStore.setState({ routes: [] });
    render(<RouteList />);
    expect(screen.getByText(/nessun percorso/i)).toBeInTheDocument();
  });
});
