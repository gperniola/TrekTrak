import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { ItineraryState } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
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
import { statoItinerario, statoUI } from '../fixtures/itinerario';

/*
  Questi test documentano la libreria ACCESA: l'interruttore temporaneo (vedi
  `lib/funzioni-spente.ts`) si alza qui, cosi' quando la funzione tornera' non ci sara'
  niente da riscrivere. Lo stato SPENTO ha i suoi test in `libreria-spenta.test.tsx`.
*/
import * as funzioniSpente from '@/lib/funzioni-spente';
beforeEach(() => {
  jest.replaceProperty(funzioniSpente, 'LIBRERIA_DISPONIBILE', true);
});
afterEach(() => {
  jest.restoreAllMocks();
});



beforeEach(() => {
  useItineraryStore.setState(statoItinerario({ itineraryName: '' }));
  useUIStore.setState(statoUI({ mainView: 'editor' }));
});

/*
 * Profilo Imparo: dalla v0.15 quiz, Verifica, Progresso e l'interruttore Learn/Track
 * sono aree del profilo didattico, e col profilo Montagna non si montano. Questi test
 * parlano di quelle funzioni, quindi vivono nel profilo in cui esistono.
 */
beforeEach(() => {
  useUIStore.setState({ profilo: 'imparo' });
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

  test('showSwitch=false nasconde lo switch Editor/Libreria in-pannello', () => {
    render(<LeftPanel showSwitch={false} />);
    expect(screen.queryByRole('tab', { name: /libreria/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /^editor$/i })).toBeNull();
  });

  test('viewOverride="library" mostra la libreria indipendentemente da mainView', () => {
    // Export e libreria vivono nel profilo Montagna: qui si parla di quelli.
    useUIStore.setState({ profilo: 'montagna' });
    useUIStore.setState({ mainView: 'editor' });
    useAuthStore.setState({ loading: true, session: null, member: null });
    render(<LeftPanel showSwitch={false} viewOverride="library" />);
    // LibraryAuthGate in stato loading mostra "Caricamento…"
    expect(screen.getByText(/Caricamento/i)).toBeInTheDocument();
    // Editor content must NOT be present
    expect(screen.queryByText('WAYPOINT')).toBeNull();
  });
});
