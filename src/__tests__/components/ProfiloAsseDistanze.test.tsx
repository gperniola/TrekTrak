import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import { ElevationProfile } from '@/components/map/ElevationProfile';
import { PreviewElevationProfile } from '@/components/map/PreviewElevationProfile';
import type { Itinerary, Leg } from '@/lib/types';
import { fineAsseX } from '@/lib/profilo-altimetrico';
import { statoItinerario, wp } from '../fixtures/itinerario';

/**
 * **L'asse delle distanze finisce dove finisce il percorso.**
 *
 * Senza un `domain` esplicito, Recharts usa `[0, 'auto']` e allunga l'asse fino alla
 * tacca «tonda» successiva: un percorso di 10 km stava su un asse da 12, e la curva si
 * fermava a cinque sesti della larghezza. Con `[0, 'dataMax']` l'algoritmo delle tacche
 * lavora a estremi fissi (`getTickValuesFixedDomain`) e l'ultimo valore e' la lunghezza
 * vera del percorso.
 */
const DOMINIO_ATTESO = JSON.stringify([0, 'dataMax']);

const tratta = (id: string, from: string, to: string, distance: number): Leg => ({
  id, fromWaypointId: from, toWaypointId: to, distance, elevationGain: 100, elevationLoss: 0, azimuth: 45,
});

function dominioAsseX(): string | null {
  return screen.getByTestId('recharts-x-axis').getAttribute('data-domain');
}

describe('il profilo altimetrico dell editor', () => {
  beforeEach(() => {
    useItineraryStore.setState(statoItinerario({
      waypoints: [wp(0), wp(1), wp(2)],
      legs: [tratta('l0', 'w0', 'w1', 4), tratta('l1', 'w1', 'w2', 6)],
      appMode: 'learn',
    }));
  });

  test('l asse delle distanze si ferma alla lunghezza del percorso, non alla tacca dopo', () => {
    render(<ElevationProfile />);
    expect(dominioAsseX()).toBe(JSON.stringify([0, 10]));
  });

  /*
    La curva chiude alla somma dei profili campionati, i pallini alla somma delle distanze
    delle tratte. Se l'ultimo pallino sta oltre la fine della curva e l'asse si ferma alla
    curva, Recharts lo scarta e l'arrivo sparisce. Segnalato dall'utente il 2026-09-22.
  */
  test('l asse arriva fino all ultimo pallino anche se il profilo campionato chiude prima', () => {
    useItineraryStore.setState(statoItinerario({
      waypoints: [wp(0), wp(1)],
      legs: [{
        ...tratta('l0', 'w0', 'w1', 4),
        elevationProfile: [{ distance: 0, altitude: 2000 }, { distance: 2, altitude: 2050 }, { distance: 3.98, altitude: 2100 }],
      }],
      appMode: 'track',
    }));
    render(<ElevationProfile />);
    expect(dominioAsseX()).toBe(JSON.stringify([0, 4]));
    // e il pallino dell'arrivo c'e', alla sua distanza
    const pallini = screen.getAllByTestId('recharts-reference-dot').map((d) => Number(d.getAttribute('data-x')));
    expect(pallini).toContain(4);
  });
});

describe('dove finisce l asse', () => {
  test('alla fine della curva quando i pallini stanno dentro', () => {
    expect(fineAsseX([{ distance: 0, altitude: 1 }, { distance: 10, altitude: 2 }], [{ distance: 0, altitude: 1 }, { distance: 9.99, altitude: 2 }])).toBe(10);
  });
  test('all ultimo pallino quando sta oltre la curva', () => {
    expect(fineAsseX([{ distance: 0, altitude: 1 }, { distance: 3.98, altitude: 2 }], [{ distance: 0, altitude: 1 }, { distance: 4, altitude: 2 }])).toBe(4);
  });
  test('senza pallini vale la curva, e viceversa', () => {
    expect(fineAsseX([{ distance: 0, altitude: 1 }, { distance: 5, altitude: 2 }], [])).toBe(5);
    expect(fineAsseX([], [{ distance: 7, altitude: 2 }])).toBe(7);
  });
});

describe('il profilo altimetrico dell anteprima in libreria', () => {
  test('l asse delle distanze si ferma alla lunghezza del percorso, non alla tacca dopo', () => {
    const route = {
      id: 'r1', name: 'X', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [
        { ...tratta('l1', 'a', 'b', 10), elevationProfile: [{ distance: 0, altitude: 100 }, { distance: 10, altitude: 200 }] },
      ],
    } as unknown as Itinerary;
    render(<PreviewElevationProfile route={route} />);
    expect(dominioAsseX()).toBe(DOMINIO_ATTESO);
  });
});
