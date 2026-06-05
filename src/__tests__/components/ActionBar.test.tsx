import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import type { AppMode } from '@/lib/types';

// Mock heavy deps that ActionBar imports
jest.mock('@/lib/export-pdf', () => ({ downloadPDF: jest.fn() }));
jest.mock('@/lib/export-gpx', () => ({ downloadGPX: jest.fn() }));
jest.mock('@/lib/routing-api', () => ({ fetchTrailRoute: jest.fn() }));
jest.mock('@/lib/elevation-api', () => ({
  fetchElevation: jest.fn(),
  fetchElevationProfile: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  saveValidationSession: jest.fn(),
  loadValidationHistory: jest.fn(() => []),
}));

import { ActionBar } from '@/components/panel/ActionBar';

const BASE_ITINERARY_STATE = {
  itineraryId: 'test-id',
  itineraryName: 'Test',
  waypoints: [],
  legs: [],
  settings: {
    tolerances: { altitude: 50, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 },
    mapDisplay: {
      coloredPath: false,
      trailRouting: false,
      sampleInterval: 50,
      baseMap: 'osm',
      showHikingTrails: false,
      showCoordinateGrid: false,
    },
  },
  appMode: 'learn' as AppMode,
};

beforeEach(() => {
  useItineraryStore.setState(BASE_ITINERARY_STATE);
  useUIStore.setState({
    compassActive: false,
    rulerActive: false,
    quizActive: false,
    progressOpen: false,
    drawerOpen: false,
    searchOpen: false,
  });
});

describe('ActionBar', () => {
  test('renders export buttons (PDF Sintetico, PDF Roadbook, GPX)', () => {
    render(<ActionBar />);
    expect(screen.getByText('PDF Sintetico')).toBeInTheDocument();
    expect(screen.getByText('PDF Roadbook')).toBeInTheDocument();
    expect(screen.getByText('GPX')).toBeInTheDocument();
  });

  test('shows Verifica button in learn mode', () => {
    useItineraryStore.setState({ ...BASE_ITINERARY_STATE, appMode: 'learn' });
    render(<ActionBar />);
    expect(screen.getByText('Verifica')).toBeInTheDocument();
  });

  test('hides Verifica button in track mode', () => {
    useItineraryStore.setState({ ...BASE_ITINERARY_STATE, appMode: 'track' });
    render(<ActionBar />);
    expect(screen.queryByText('Verifica')).not.toBeInTheDocument();
  });

  test('shows Progresso button', () => {
    render(<ActionBar />);
    expect(screen.getByText(/Progresso/)).toBeInTheDocument();
  });

  // TASK-41: export non invitano ad azioni inutili quando l'itinerario è vuoto
  test('TASK-41: PDF e GPX disabilitati con meno di 2 waypoint', () => {
    useItineraryStore.setState({ ...BASE_ITINERARY_STATE, waypoints: [] });
    render(<ActionBar />);
    expect(screen.getByText('PDF Sintetico').closest('button')).toBeDisabled();
    expect(screen.getByText('PDF Roadbook').closest('button')).toBeDisabled();
    expect(screen.getByText('GPX').closest('button')).toBeDisabled();
  });

  test('TASK-41: export abilitati con 2+ waypoint con coordinate', () => {
    useItineraryStore.setState({
      ...BASE_ITINERARY_STATE,
      waypoints: [
        { id: 'a', name: 'A', lat: 42, lon: 14 },
        { id: 'b', name: 'B', lat: 42.1, lon: 14.1 },
      ] as never,
    });
    render(<ActionBar />);
    expect(screen.getByText('PDF Sintetico').closest('button')).not.toBeDisabled();
    expect(screen.getByText('PDF Roadbook').closest('button')).not.toBeDisabled();
    expect(screen.getByText('GPX').closest('button')).not.toBeDisabled();
  });

  // TASK-42: "Progresso" non è più nel gruppo degli export
  test('TASK-42: Progresso è in un gruppo separato dagli export', () => {
    render(<ActionBar />);
    const exportGroup = screen.getByRole('group', { name: /esporta/i });
    const progresso = screen.getByText(/Progresso/).closest('button');
    expect(exportGroup).toContainElement(screen.getByText('PDF Sintetico').closest('button'));
    expect(exportGroup).not.toContainElement(progresso);
  });
});
