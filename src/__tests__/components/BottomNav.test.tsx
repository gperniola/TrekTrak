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
  /**
   * `text-gray-500` su `bg-gray-900` misura 3,67 di contrasto: sotto la soglia AA di
   * 4,5 per testo normale, e queste etichette sono a 11px. Era una delle due voci che
   * separavano l'app dal target Lighthouse di 97 (TASK-53).
   */
  test('le voci inattive hanno contrasto sufficiente', () => {
    render(<BottomNav />);
    const inattive = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') == null);
    expect(inattive.length).toBeGreaterThan(0);
    inattive.forEach((b) => {
      expect(b.className).not.toMatch(/text-gray-500/);
      expect(b.className).toMatch(/text-gray-400/);
    });
  });
});
