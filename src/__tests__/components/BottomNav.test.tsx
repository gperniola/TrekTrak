import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';

// La libreria si aggiorna al passaggio di tab: mock per non toccare la rete.
jest.mock('@/lib/sync', () => ({ fetchRoutes: jest.fn(() => Promise.resolve([])) }));

import { BottomNav } from '@/components/panel/BottomNav';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useUIStore.setState({ mobileTab: 'map', mainView: 'editor', moreMenuOpen: false });
});

describe('BottomNav', () => {
  test('mostra le quattro voci', () => {
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: /mappa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /libreria/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^altro$/i })).toBeInTheDocument();
  });

  test('cliccare una scheda aggiorna mobileTab', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: /editor/i }));
    expect(useUIStore.getState().mobileTab).toBe('editor');
  });

  test('la scheda attiva ha aria-current=page', () => {
    useUIStore.setState({ mobileTab: 'library', mainView: 'library' });
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: /libreria/i })).toHaveAttribute('aria-current', 'page');
  });

  test('Altro apre il menu', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: /^altro$/i }));
    expect(useUIStore.getState().moreMenuOpen).toBe(true);
  });

  test('cliccare una scheda chiude il menu Altro', () => {
    useUIStore.setState({ moreMenuOpen: true });
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: /editor/i }));
    expect(useUIStore.getState().moreMenuOpen).toBe(false);
  });
});
