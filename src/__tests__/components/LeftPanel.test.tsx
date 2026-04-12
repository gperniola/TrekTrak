import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import type { AppMode } from '@/lib/types';

// Mock sub-components to isolate LeftPanel structure
jest.mock('@/components/panel/ItineraryHeader', () => ({
  ItineraryHeader: () => <div data-testid="itinerary-header" />,
}));
jest.mock('@/components/panel/WaypointList', () => ({
  WaypointList: () => <div data-testid="waypoint-list" />,
}));
jest.mock('@/components/panel/ItineraryTable', () => ({
  ItineraryTable: () => <div data-testid="itinerary-table" />,
}));
jest.mock('@/components/panel/SummaryBar', () => ({
  SummaryBar: () => <div data-testid="summary-bar" />,
}));
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
  saveItinerary: jest.fn(),
  isStorageNearLimit: jest.fn(() => false),
  loadItineraries: jest.fn(() => []),
  deleteItinerary: jest.fn(),
}));
jest.mock('@/lib/export-json', () => ({
  exportItineraryJSON: jest.fn(),
  importItineraryJSON: jest.fn(),
}));

import { LeftPanel } from '@/components/panel/LeftPanel';

const BASE_ITINERARY_STATE = {
  itineraryId: 'test-id',
  itineraryName: '',
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

describe('LeftPanel + ModeSwitch', () => {
  test('renders Edit and Tabella tab buttons', () => {
    render(<LeftPanel />);
    expect(screen.getByRole('tab', { name: /Modifica/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tabella/i })).toBeInTheDocument();
  });

  test('renders tool buttons for Bussola, Righello, and Quiz', () => {
    render(<LeftPanel />);
    expect(screen.getByTitle('Bussola')).toBeInTheDocument();
    expect(screen.getByTitle('Righello')).toBeInTheDocument();
    expect(screen.getByTitle('Quiz')).toBeInTheDocument();
  });

  test('compass toggle updates uiStore compassActive', () => {
    render(<LeftPanel />);
    const compassBtn = screen.getByTitle('Bussola');
    expect(useUIStore.getState().compassActive).toBe(false);
    fireEvent.click(compassBtn);
    expect(useUIStore.getState().compassActive).toBe(true);
  });

  test('tool mutual exclusion: compass on → ruler on → compass off', () => {
    render(<LeftPanel />);
    const compassBtn = screen.getByTitle('Bussola');
    const rulerBtn = screen.getByTitle('Righello');

    fireEvent.click(compassBtn);
    expect(useUIStore.getState().compassActive).toBe(true);
    expect(useUIStore.getState().rulerActive).toBe(false);

    fireEvent.click(rulerBtn);
    expect(useUIStore.getState().rulerActive).toBe(true);
    expect(useUIStore.getState().compassActive).toBe(false);
  });
});
