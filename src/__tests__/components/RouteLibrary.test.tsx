import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';

jest.mock('@/components/panel/RouteList', () => ({ RouteList: () => <div data-testid="route-list" /> }));
jest.mock('@/components/panel/RouteDetailCard', () => ({ RouteDetailCard: () => <div data-testid="route-detail" /> }));
jest.mock('@/components/auth/LibraryAuthGate', () => ({ LibraryAuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { RouteLibrary } from '@/components/panel/RouteLibrary';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useRouteLibraryStore.setState({ selectedRouteId: null });
  useUIStore.setState({ mobileTab: 'library', mainView: 'library' });
});

describe('RouteLibrary (TASK-48 list <-> detail)', () => {
  test('senza selezione mostra la lista e nessun pulsante Indietro', () => {
    render(<RouteLibrary />);
    expect(screen.getByTestId('route-list')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tutti i percorsi/i })).toBeNull();
  });

  test('con selezione mostra il dettaglio e il pulsante Indietro', () => {
    useRouteLibraryStore.setState({ selectedRouteId: 'r1' });
    render(<RouteLibrary />);
    expect(screen.getByTestId('route-detail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tutti i percorsi/i })).toBeInTheDocument();
  });

  test('Indietro deseleziona il percorso', () => {
    useRouteLibraryStore.setState({ selectedRouteId: 'r1' });
    render(<RouteLibrary />);
    fireEvent.click(screen.getByRole('button', { name: /tutti i percorsi/i }));
    expect(useRouteLibraryStore.getState().selectedRouteId).toBeNull();
  });

  test('"Sulla mappa" porta alla scheda Mappa', () => {
    useRouteLibraryStore.setState({ selectedRouteId: 'r1' });
    render(<RouteLibrary />);
    fireEvent.click(screen.getByRole('button', { name: /sulla mappa/i }));
    expect(useUIStore.getState().mobileTab).toBe('map');
  });
});
