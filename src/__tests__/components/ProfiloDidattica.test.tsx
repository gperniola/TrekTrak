import { render, screen } from '@testing-library/react';
import { ActionBar } from '@/components/panel/ActionBar';
import { MapToolsFab } from '@/components/map/MapToolsFab';
import { ModeSwitch } from '@/components/panel/ModeSwitch';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { Waypoint } from '@/lib/types';

const wp = (i: number): Waypoint => ({
  id: `w${i}`, name: `P${i}`, lat: 46.4 + i / 100, lon: 11.8 + i / 100,
  altitude: 2000 + i * 100, order: i,
});

describe('le funzioni didattiche per profilo', () => {
  beforeEach(() => {
    useItineraryStore.setState({ waypoints: [wp(0), wp(1)], legs: [], appMode: 'learn' });
  });

  test('in Montagna Verifica e Progresso non ci sono', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ActionBar />);
    expect(screen.queryByRole('button', { name: /^Verifica$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Progresso/ })).not.toBeInTheDocument();
  });

  test('in Imparo ci sono', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ActionBar />);
    expect(screen.getByRole('button', { name: /^Verifica$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Progresso/ })).toBeInTheDocument();
  });

  /*
   * Le etichette qui sono quelle del FAB su telefono ("Quiz"); la toolbar su desktop usa
   * "Attiva quiz" ed e' un altro componente, guardato anche lui — nasconderlo in un
   * posto solo l'avrebbe lasciato visibile nell'altro.
   *
   * Bussola e righello restano: sono strumenti didattici prima che da campo.
   */
  test('il quiz sparisce dagli strumenti in Montagna, bussola e righello restano', () => {
    useUIStore.setState({ profilo: 'montagna', toolsFabOpen: true });
    render(<MapToolsFab />);
    expect(screen.queryByRole('button', { name: /^Quiz$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Bussola$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Righello$/ })).toBeInTheDocument();
  });

  test('in Imparo il quiz c e', () => {
    useUIStore.setState({ profilo: 'imparo', toolsFabOpen: true });
    render(<MapToolsFab />);
    expect(screen.getByRole('button', { name: /^Quiz$/ })).toBeInTheDocument();
  });

  /**
   * Il quiz ha DUE ingressi: il FAB su telefono e la toolbar su schermo grande.
   * Nasconderne uno solo e' il difetto che la tabella delle aree esiste per evitare, e
   * qui l'ho fatto davvero: me ne sono accorto perche' il test cercava le etichette
   * della toolbar credendo fossero quelle del FAB.
   */
  test('anche la toolbar su schermo grande nasconde il quiz in Montagna', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ModeSwitch />);
    expect(screen.queryByRole('button', { name: /Attiva quiz/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attiva bussola/ })).toBeInTheDocument();
  });

  test('in Imparo la toolbar mostra il quiz', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ModeSwitch />);
    expect(screen.getByRole('button', { name: /Attiva quiz/ })).toBeInTheDocument();
  });
});
