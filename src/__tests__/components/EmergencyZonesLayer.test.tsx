import { render, screen } from '@testing-library/react';
import { EmergencyZonesLayer, zoneStyle } from '@/components/map/emergency/EmergencyZonesLayer';
import type { DpcZone } from '@/lib/dpc';

const zone = (maxLevel: 0 | 1 | 2 | 3): DpcZone => ({
  name: `Z${maxLevel}`, idraulico: maxLevel, temporali: 0, idrogeologico: 0, maxLevel,
  feature: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[13, 42], [13.1, 42], [13.1, 42.1], [13, 42]]] } },
});

describe('zoneStyle', () => {
  test('colore per livello', () => {
    expect(zoneStyle(1).color).toBe('#eab308');
    expect(zoneStyle(3).fillColor).toBe('#dc2626');
  });
});

describe('EmergencyZonesLayer', () => {
  // Un solo layer Leaflet per tutte le zone, non uno per zona: in una giornata
  // arancione erano decine di layer separati, distrutti e ricreati a ogni refresh e a
  // ogni tap sul selettore giorni.
  test('un solo layer con una feature per zona in allerta (verdi filtrate)', () => {
    render(<EmergencyZonesLayer zones={[zone(0), zone(1), zone(3)]} dayLabel="Oggi 25/08" issuedLabel="25/08 14:15" />);
    const layers = screen.getAllByTestId('geojson-layer');
    expect(layers).toHaveLength(1);
    expect(layers[0]).toHaveAttribute('data-features', '2');
    expect(layers[0]).toHaveAttribute('data-pane', 'emergency');
  });

  test('ogni zona ha il suo popup, con nome e bollettino', () => {
    render(<EmergencyZonesLayer zones={[zone(0), zone(1), zone(3)]} dayLabel="Oggi 25/08" issuedLabel="25/08 14:15" />);
    const popups = JSON.parse(
      screen.getByTestId('geojson-layer').getAttribute('data-popups') ?? '[]'
    ) as string[];
    expect(popups).toHaveLength(2);
    expect(popups[0]).toContain('Z1');
    expect(popups[1]).toContain('Z3');
    popups.forEach((p) => expect(p).toContain('Bollettino del'));
  });

  // Con una sola collection lo stile deve restare per-feature, altrimenti tutte le
  // zone finirebbero dello stesso colore.
  test('lo stile segue il livello della singola zona', () => {
    render(<EmergencyZonesLayer zones={[zone(1), zone(3)]} dayLabel="Oggi" issuedLabel="x" />);
    const styles = JSON.parse(
      screen.getByTestId('geojson-layer').getAttribute('data-styles') ?? '[]'
    ) as Array<{ color: string }>;
    expect(styles.map((s) => s.color)).toEqual(['#eab308', '#dc2626']);
  });

  test('nessuna zona in allerta → nulla', () => {
    render(<EmergencyZonesLayer zones={[zone(0)]} dayLabel="Oggi" issuedLabel="x" />);
    expect(screen.queryByTestId('geojson-layer')).toBeNull();
  });
});
