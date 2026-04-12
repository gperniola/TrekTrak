import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { AppMode } from '@/lib/types';

// Mock all async dependencies so the component stays in 'loading' phase
jest.mock('@/lib/quiz', () => ({
  generateQuestionSet: jest.fn(() => []),
  generateRandomPoint: jest.fn(() => ({ lat: 45, lon: 10, label: 'P' })),
  pickQuizPoint: jest.fn(() => null),
  saveQuizSession: jest.fn(),
  loadQuizHistory: jest.fn(() => []),
  clearQuizHistory: jest.fn(),
}));

jest.mock('@/lib/overpass-api', () => ({
  fetchHikingPOIs: jest.fn(() => new Promise(() => {})), // never resolves → stays loading
}));

jest.mock('@/lib/elevation-api', () => ({
  fetchElevation: jest.fn(() => new Promise(() => {})),
  fetchElevationProfile: jest.fn(() => new Promise(() => {})),
}));

jest.mock('@/lib/calculations', () => ({
  haversineDistance: jest.fn(() => 1.5),
  forwardAzimuth: jest.fn(() => 90),
}));

import { QuizOverlay } from '@/components/quiz/QuizOverlay';

const BASE_STATE = {
  itineraryId: 'test-id',
  itineraryName: '',
  waypoints: [
    { id: 'wp1', order: 0, name: 'A', lat: 45.0, lon: 10.0, altitude: null, notes: '' },
    { id: 'wp2', order: 1, name: 'B', lat: 45.1, lon: 10.1, altitude: null, notes: '' },
  ],
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
  useItineraryStore.setState(BASE_STATE);
});

describe('QuizOverlay', () => {
  test('renders overlay container (has a .fixed element)', () => {
    const { container } = render(<QuizOverlay onClose={jest.fn()} />);
    // The overlay root has class "fixed"
    const fixed = container.querySelector('.fixed');
    expect(fixed).not.toBeNull();
  });

  test('shows loading state ("Preparo" or "Generazione")', () => {
    render(<QuizOverlay onClose={jest.fn()} />);
    // The component shows "Generazione domande..." while loading
    expect(screen.getByText(/Generazione/i)).toBeInTheDocument();
  });
});
