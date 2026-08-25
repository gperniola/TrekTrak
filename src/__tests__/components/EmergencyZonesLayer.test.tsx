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
  test('disegna solo le zone con allerta (verdi filtrate)', () => {
    render(<EmergencyZonesLayer zones={[zone(0), zone(1), zone(3)]} dayLabel="Oggi 25/08" issuedLabel="25/08 14:15" />);
    const layers = screen.getAllByTestId('geojson-layer');
    expect(layers).toHaveLength(2); // la zona verde non viene disegnata

    // Assert popup binding and pane wiring
    expect(layers[0]).toHaveAttribute('data-pane', 'emergency');
    expect(layers[0]).toHaveAttribute('data-popup', expect.stringContaining('Z1'));
    expect(layers[0]).toHaveAttribute('data-popup', expect.stringContaining('Bollettino del'));

    expect(layers[1]).toHaveAttribute('data-pane', 'emergency');
    expect(layers[1]).toHaveAttribute('data-popup', expect.stringContaining('Z3'));
    expect(layers[1]).toHaveAttribute('data-popup', expect.stringContaining('Bollettino del'));
  });

  test('nessuna zona in allerta → nulla', () => {
    render(<EmergencyZonesLayer zones={[zone(0)]} dayLabel="Oggi" issuedLabel="x" />);
    expect(screen.queryByTestId('geojson-layer')).toBeNull();
  });
});
