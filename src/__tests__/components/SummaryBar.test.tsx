import { render, screen } from '@testing-library/react';
import { SummaryBar } from '@/components/panel/SummaryBar';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { Leg, Waypoint } from '@/lib/types';

/**
 * La barra di riepilogo: i totali sono la somma dei valori NOTI, e «—» quando non ce n'è
 * nessuno — un itinerario in «Impara» prima di compilare le tratte non ha un totale di
 * 0 km / 0h, ha un totale che non si sa (classe «non lo so ≠ zero»). E il tempo è nel
 * formato di casa (`durataMin`: «1 h 30 min», non «1h 30m»).
 */

const wp = (i: number): Waypoint => ({ id: `w${i}`, name: `P${i}`, lat: 46 + i / 100, lon: 11, altitude: 1000, order: i });
const legVuota = (i: number): Leg => ({
  id: `l${i}`, fromWaypointId: `w${i}`, toWaypointId: `w${i + 1}`,
  distance: null, elevationGain: null, elevationLoss: null, azimuth: null,
});
const legPiena = (i: number): Leg => ({
  ...legVuota(i), distance: 4, elevationGain: 300, elevationLoss: 0, estimatedTime: 90, slope: 10,
});

function setStato(waypoints: Waypoint[], legs: Leg[]) {
  useItineraryStore.setState({ waypoints, legs });
}

describe('SummaryBar', () => {
  test('tratte senza dati: i totali sono «—», non 0', () => {
    setStato([wp(0), wp(1)], [legVuota(0)]);
    render(<SummaryBar />);
    // almeno tre trattini (km, tempo, e i dislivelli)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/0h 0m/)).not.toBeInTheDocument();
    expect(screen.queryByText('0,0 km')).not.toBeInTheDocument();
  });

  test('con dati: il tempo è nel formato italiano di casa', () => {
    setStato([wp(0), wp(1)], [legPiena(0)]);
    render(<SummaryBar />);
    expect(screen.getByText(/1 h 30 min/)).toBeInTheDocument();
    expect(screen.queryByText(/1h 30m/)).not.toBeInTheDocument();
  });
});
