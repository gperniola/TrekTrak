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
  afterEach(() => {
    jest.useRealTimers();
  });

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

  test('colore marker e Rilevata: riflettono recency', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-25T10:00:00Z'));

    const recentPoint = P({ acquiredAt: '2026-08-25T08:00:00Z', satellite: 'N20' });
    const oldPoint = P({ lat: 43, acquiredAt: '2026-08-25T01:00:00Z', satellite: 'N19' });
    render(<EmergencyPointsLayer points={[recentPoint, oldPoint]} />);

    const markers = screen.getAllByTestId('circle-marker');
    expect(markers).toHaveLength(2);

    // Check recent marker (< 6h) has red color
    const recentMarkerOptions = JSON.parse(markers[0].getAttribute('data-pathoptions') || '{}');
    expect(recentMarkerOptions.color).toBe('#ef4444');
    expect(recentMarkerOptions.fillOpacity).toBe(0.7);

    // Check old marker (> 6h) has orange color
    const oldMarkerOptions = JSON.parse(markers[1].getAttribute('data-pathoptions') || '{}');
    expect(oldMarkerOptions.color).toBe('#f97316');

    // Check popup contains "Rilevata:" text
    expect(screen.getAllByText(/Rilevata:/)).toHaveLength(2);
  });
});
