import { render, screen } from '@testing-library/react';
import { ActionBar } from '@/components/panel/ActionBar';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { Waypoint } from '@/lib/types';

/** Due waypoint SENZA coordinate: il PDF si puo' fare, il GPX no. */
const senzaCoordinate: Waypoint[] = [
  { id: 'a', name: 'A', lat: null, lon: null, altitude: 1200, order: 0 },
  { id: 'b', name: 'B', lat: null, lon: null, altitude: 1400, order: 1 },
];

/**
 * Secondo giro di review. La nota che spiega perche' i pulsanti sono grigi guardava anche
 * pulsanti che in Imparo non esistono: con due waypoint senza coordinate diceva «servono
 * waypoint con coordinate» mentre le uniche voci visibili — i due PDF — funzionavano
 * benissimo.
 *
 * E' la stessa classe di difetto piu' ripetuta di questo progetto: un messaggio che dice
 * una cosa falsa. Qui in piu' e' un messaggio che parla di funzioni che il profilo ha
 * tolto di mezzo.
 */
describe('review 2: la nota sui pulsanti spenti guarda solo quelli visibili', () => {
  beforeEach(() => {
    useItineraryStore.setState({ waypoints: senzaCoordinate, legs: [] });
  });

  test('in Montagna la nota compare: il GPX c e ed e davvero spento', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ActionBar />);
    expect(screen.getByText(/coordinate/i)).toBeInTheDocument();
  });

  test('in Imparo non compare: i PDF sono visibili e funzionano', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ActionBar />);
    expect(screen.queryByText(/Per il GPX servono/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PDF Sintetico/i })).not.toBeDisabled();
  });

  test('in Imparo con meno di 2 waypoint la nota torna, perche i PDF sono spenti', () => {
    useItineraryStore.setState({ waypoints: [senzaCoordinate[0]], legs: [] });
    useUIStore.setState({ profilo: 'imparo' });
    render(<ActionBar />);
    expect(screen.getByText(/Aggiungi almeno 2 waypoint/i)).toBeInTheDocument();
  });
});
