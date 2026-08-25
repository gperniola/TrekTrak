import { render, screen } from '@testing-library/react';
import { EmergencyPointsLayer, fireColor } from '@/components/map/emergency/EmergencyPointsLayer';
import type { FirePoint } from '@/lib/firms';

const P = (over: Partial<FirePoint> = {}): FirePoint => ({
  lat: 42.1, lon: 13.4, frp: 12.5, confidence: 'high',
  acquiredAt: '2026-08-25T08:00:00Z', satellite: 'N20', ...over,
});

describe('fireColor', () => {
  const now = new Date('2026-08-25T10:00:00Z');
  test('< 6h → rosso vivo', () => expect(fireColor('2026-08-25T08:00:00Z', now)).toBe('#ef4444'));
  test('> 6h → arancio', () => expect(fireColor('2026-08-25T01:00:00Z', now)).toBe('#f97316'));
});

describe('EmergencyPointsLayer', () => {
  test('un CircleMarker per punto, con popup dettagli', () => {
    render(<EmergencyPointsLayer points={[P(), P({ lat: 43 })]} />);
    expect(screen.getAllByTestId('circle-marker')).toHaveLength(2);
    expect(screen.getAllByText(/12\.5 MW/)).toHaveLength(2);
    expect(screen.getAllByText(/N20/)).toHaveLength(2);
    expect(screen.getAllByText(/Alta/)).toHaveLength(2); // confidenza high → "Alta"
  });

  test('nessun punto → nessun marker', () => {
    render(<EmergencyPointsLayer points={[]} />);
    expect(screen.queryByTestId('circle-marker')).toBeNull();
  });
});
