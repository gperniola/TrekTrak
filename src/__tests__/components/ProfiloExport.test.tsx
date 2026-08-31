import { render, screen } from '@testing-library/react';
import { ActionBar } from '@/components/panel/ActionBar';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { Waypoint } from '@/lib/types';

const wp = (i: number): Waypoint => ({
  id: `w${i}`, name: `P${i}`, lat: 46.4 + i / 100, lon: 11.8 + i / 100,
  altitude: 2000 + i * 100, order: i,
});

const conProfilo = (p: 'imparo' | 'montagna') => {
  useUIStore.setState({ profilo: p });
  useItineraryStore.setState({ waypoints: [wp(0), wp(1)], legs: [] });
  render(<ActionBar />);
};

/**
 * Il PDF resta in Imparo perche' serve a portarsi l'esercizio su carta; GPX, JSON e
 * link condiviso sono roba da gita vera.
 */
describe('gli export per profilo', () => {
  test('in Imparo i due PDF restano', () => {
    conProfilo('imparo');
    expect(screen.getByRole('button', { name: /PDF Sintetico/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PDF Roadbook/i })).toBeInTheDocument();
  });

  test('in Imparo GPX, copia link e meteo non ci sono', () => {
    conProfilo('imparo');
    expect(screen.queryByRole('button', { name: /^GPX$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copia link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Meteo$/ })).not.toBeInTheDocument();
  });

  test('in Montagna ci sono tutti', () => {
    conProfilo('montagna');
    expect(screen.getByRole('button', { name: /^GPX$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copia link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Meteo$/ })).toBeInTheDocument();
  });
});
