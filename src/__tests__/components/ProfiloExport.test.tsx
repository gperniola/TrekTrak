import { fireEvent, render, screen } from '@testing-library/react';
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
  test('in Imparo i due PDF restano, dentro la tendina', () => {
    conProfilo('imparo');
    // Dal 2026-09-02 i PDF non sono pulsanti a se': stanno nell'unica tendina «Esporta»,
    // che in Imparo elenca **solo** loro — i formati da gita non servono a un esercizio.
    fireEvent.click(screen.getByRole('button', { name: /Esporta/ }));
    expect(screen.getByRole('menuitem', { name: /PDF sintetico/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PDF roadbook/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /GPX/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /KML/ })).not.toBeInTheDocument();
  });

  test('in Imparo copia link, «quando partire» e mappa offline non ci sono', () => {
    conProfilo('imparo');
    // Dal task-28 i formati stanno dietro «Esporta ▾»: il profilo nasconde la tendina.
    /*
      La tendina «Esporta» ora c'e' anche in Imparo, perche' i PDF stanno dentro: cio' che
      NON deve comparire sono le voci da gita vera.
    */
    expect(screen.queryByRole('button', { name: /Copia link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quando partire/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mappa offline/i })).not.toBeInTheDocument();
  });

  test('in Montagna ci sono tutti', () => {
    conProfilo('montagna');
    expect(screen.getByRole('button', { name: /Esporta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copia link/i })).toBeInTheDocument();
    // «Meteo» si chiamava cosi' e non diceva cosa fa: e' il passo finale del percorso.
    expect(screen.getByRole('button', { name: /Quando partire/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mappa offline/i })).toBeInTheDocument();
  });
});
