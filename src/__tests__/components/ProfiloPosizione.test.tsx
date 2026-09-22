import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import { usePositionStore } from '@/stores/positionStore';
import { ElevationProfile } from '@/components/map/ElevationProfile';
import type { Leg } from '@/lib/types';
import { statoItinerario, wp } from '../fixtures/itinerario';

/**
 * **Dove sono, sul profilo.**
 *
 * Quando la posizione nota sta sul tracciato, il profilo altimetrico la segna nel punto
 * corrispondente e ne scrive la distanza dall'inizio. Il resto — cosa vuol dire «sul
 * tracciato», quanto puo' essere vecchia — lo decide `posizioneSulProfilo`, ed e' li'
 * che si prova: qui si verifica che la decisione arrivi a schermo.
 */

// wp(i) sale di un centesimo di grado in lat e lon per passo: la tratta e' obliqua.
const tratta = (id: string, from: string, to: string, distance: number): Leg => ({
  id, fromWaypointId: from, toWaypointId: to, distance, elevationGain: 100, elevationLoss: 0, azimuth: 45,
});

beforeEach(() => {
  useItineraryStore.setState(statoItinerario({
    waypoints: [wp(0), wp(1), wp(2)],
    legs: [tratta('l0', 'w0', 'w1', 1.5), tratta('l1', 'w1', 'w2', 1.5)],
    appMode: 'learn',
  }));
  usePositionStore.setState({ lastKnown: null });
});

describe('la posizione sul profilo altimetrico', () => {
  test('senza posizione nota non c e nessun segno', () => {
    render(<ElevationProfile />);
    expect(screen.queryByTestId('posizione-sul-profilo')).toBeNull();
    expect(screen.queryByText(/sei qui/i)).toBeNull();
  });

  test('con la posizione a meta della prima tratta il segno sta a meta della prima tratta', () => {
    usePositionStore.setState({ lastKnown: { lat: 42.105, lon: 14.105, accuracy: 10, at: Date.now() } });
    render(<ElevationProfile />);
    const segno = screen.getByTestId('posizione-sul-profilo');
    expect(Number(segno.getAttribute('data-x'))).toBeCloseTo(0.75, 2);
    // La quota e' interpolata sulla spezzata: fra 2.000 e 2.100 m, a meta'.
    expect(Number(segno.getAttribute('data-y'))).toBeCloseTo(2050, 0);
    expect(screen.getByText(/sei qui/i)).toHaveTextContent('0,75 km');
  });

  test('in Impara col riferimento reale, il segno segue le distanze reali come la curva', () => {
    // L'utente ha scritto 1,5 km per tratta, la Pianificazione ne aveva misurati 3: la
    // curva si spazia sui 3 (per stare in registro col profilo reale), e il punto a meta'
    // della prima tratta deve stare a 1,5 km — non a 0,75.
    useItineraryStore.setState(statoItinerario({
      waypoints: [wp(0), wp(1), wp(2)],
      legs: [
        { ...tratta('l0', 'w0', 'w1', 1.5), trackValues: { distance: 3, elevationGain: 100, elevationLoss: 0, azimuth: 45 } },
        { ...tratta('l1', 'w1', 'w2', 1.5), trackValues: { distance: 3, elevationGain: 100, elevationLoss: 0, azimuth: 45 } },
      ],
      appMode: 'learn',
    }));
    usePositionStore.setState({ lastKnown: { lat: 42.105, lon: 14.105, accuracy: 10, at: Date.now() } });
    render(<ElevationProfile />);
    const segno = screen.getByTestId('posizione-sul-profilo');
    expect(Number(segno.getAttribute('data-x'))).toBeCloseTo(1.5, 2);
    expect(screen.getByText(/sei qui/i)).toHaveTextContent('1,50 km');
  });

  test('con la posizione lontana dal tracciato non c e nessun segno', () => {
    usePositionStore.setState({ lastKnown: { lat: 42.2, lon: 14.0, accuracy: 10, at: Date.now() } });
    render(<ElevationProfile />);
    expect(screen.queryByTestId('posizione-sul-profilo')).toBeNull();
  });
});
