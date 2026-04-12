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
});
