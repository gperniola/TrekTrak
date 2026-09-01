import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { ItineraryState } from '@/stores/itineraryStore';
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

/**
 * Annotato: senza il tipo, `sampleInterval: 50` si allarga a `number` e la fixture
 * non viene confrontata con lo stato reale dello store — è così che campi aggiunti
 * dopo (es. `emergencyLayers`) restavano assenti senza che nulla lo segnalasse.
 */
const BASE_ITINERARY_STATE: Partial<ItineraryState> = {
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
      emergencyLayers: [],
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
    searchOpen: false,
  });
});

/*
 * Profilo Imparo: dalla v0.15 quiz, Verifica, Progresso e l'interruttore Learn/Track
 * sono aree del profilo didattico, e col profilo Montagna non si montano. Questi test
 * parlano di quelle funzioni, quindi vivono nel profilo in cui esistono.
 */
beforeEach(() => {
  useUIStore.setState({ profilo: 'imparo' });
});

describe('ActionBar', () => {
  test('renders export buttons (PDF Sintetico, PDF Roadbook, Esporta)', () => {
    // Export e libreria vivono nel profilo Montagna: qui si parla di quelli.
    useUIStore.setState({ profilo: 'montagna' });
    render(<ActionBar />);
    expect(screen.getByText('PDF Sintetico')).toBeInTheDocument();
    expect(screen.getByText('PDF Roadbook')).toBeInTheDocument();
    // Dal task-28 i formati stanno dietro una tendina: erano destinati a crescere e una
    // fila di pulsanti verdi e' proprio cio' che questo pannello ha smesso di fare.
    // (Cosa c'e' dentro la tendina lo verifica il test sugli export abilitati: a
    // itinerario vuoto il pulsante e' spento e non si apre.)
    expect(screen.getByText('Esporta ▾')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /Progresso/ })).toBeInTheDocument();
  });

  // TASK-41: export non invitano ad azioni inutili quando l'itinerario è vuoto
  test('TASK-41: PDF e la tendina degli export disabilitati con meno di 2 waypoint', () => {
    // Export e libreria vivono nel profilo Montagna: qui si parla di quelli.
    useUIStore.setState({ profilo: 'montagna' });
    useItineraryStore.setState({ ...BASE_ITINERARY_STATE, waypoints: [] });
    render(<ActionBar />);
    expect(screen.getByText('PDF Sintetico').closest('button')).toBeDisabled();
    expect(screen.getByText('PDF Roadbook').closest('button')).toBeDisabled();
    expect(screen.getByText('Esporta ▾').closest('button')).toBeDisabled();
  });

  test('TASK-41: export abilitati con 2+ waypoint con coordinate', () => {
    // Export e libreria vivono nel profilo Montagna: qui si parla di quelli.
    useUIStore.setState({ profilo: 'montagna' });
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
    fireEvent.click(screen.getByText('Esporta ▾'));
    expect(screen.getByRole('menuitem', { name: /GPX/ })).not.toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /KML/ })).not.toBeDisabled();
  });

  // TASK-42: "Progresso" non è più nel gruppo degli export
  test('TASK-42: Progresso è in un gruppo separato dagli export', () => {
    render(<ActionBar />);
    const exportGroup = screen.getByRole('group', { name: /esporta/i });
    const progresso = screen.getByRole('button', { name: /Progresso/ });
    expect(exportGroup).toContainElement(screen.getByText('PDF Sintetico').closest('button'));
    expect(exportGroup).not.toContainElement(progresso);
  });
});
