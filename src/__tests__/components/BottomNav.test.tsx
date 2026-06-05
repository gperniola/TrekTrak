import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';

// La libreria si aggiorna al passaggio di tab: mock per non toccare la rete.
jest.mock('@/lib/sync', () => ({ fetchRoutes: jest.fn(() => Promise.resolve([])) }));

import { BottomNav } from '@/components/panel/BottomNav';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useUIStore.setState({ mobileTab: 'map', mainView: 'editor' });
});

describe('BottomNav', () => {
  test('mostra le tre schede', () => {
    render(<BottomNav />);
    expect(screen.getByRole('tab', { name: /mappa/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /editor/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });

  test('cliccare una scheda aggiorna mobileTab', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('tab', { name: /editor/i }));
    expect(useUIStore.getState().mobileTab).toBe('editor');
  });

  test('la scheda attiva è segnata aria-selected', () => {
    useUIStore.setState({ mobileTab: 'library', mainView: 'library' });
    render(<BottomNav />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toHaveAttribute('aria-selected', 'true');
  });
});
