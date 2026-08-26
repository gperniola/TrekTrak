import { render, screen, fireEvent } from '@testing-library/react';
import {
  EmergencyPointsLayer, fireColor, firePopupHtml, MAX_RENDERED_POINTS,
} from '@/components/map/emergency/EmergencyPointsLayer';
import type { FirePoint } from '@/lib/firms';
import { __openedPopups, __resetPopups } from './__mocks__/leaflet';

const P = (over: Partial<FirePoint> = {}): FirePoint => ({
  lat: 42.1, lon: 13.4, frp: 12.5, confidence: 'high',
  acquiredAt: '2026-08-25T08:00:00Z', satellite: 'N20', ...over,
});

describe('fireColor', () => {
  const now = new Date('2026-08-25T10:00:00Z');
  test('< 6h → rosso vivo', () => expect(fireColor('2026-08-25T08:00:00Z', now)).toBe('#ef4444'));
  test('> 6h → arancio', () => expect(fireColor('2026-08-25T01:00:00Z', now)).toBe('#f97316'));
});

describe('firePopupHtml', () => {
  test('riporta i dati del focolaio e il disclaimer', () => {
    const html = firePopupHtml(P());
    expect(html).toContain('12.5 MW');
    expect(html).toContain('N20');
    expect(html).toContain('Alta'); // confidenza high
    expect(html).toContain('non è la conferma di un incendio in corso');
  });

  // Il contenuto arriva da un CSV esterno e finisce in innerHTML.
  test('il testo dai dati esterni viene escapato', () => {
    const html = firePopupHtml(P({ satellite: '<img src=x onerror=alert(1)>' }));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('EmergencyPointsLayer', () => {
  beforeEach(() => __resetPopups());
  afterEach(() => jest.useRealTimers());

  // Spec §4.5: renderer canvas. Con l'SVG di default ogni punto è un nodo <path>, e
  // in stagione sono migliaia sul telefono.
  test('i marker usano il renderer canvas', () => {
    render(<EmergencyPointsLayer points={[P(), P({ lat: 43 })]} />);
    const markers = screen.getAllByTestId('circle-marker');
    expect(markers).toHaveLength(2);
    markers.forEach((m) => expect(m).toHaveAttribute('data-renderer', 'canvas'));
  });

  // Prima ogni punto montava subito la sua istanza L.Popup con i relativi listener
  // sulla mappa, rendendo il dispatch degli eventi proporzionale al numero di punti.
  test('nessun popup costruito al mount, uno al click', () => {
    render(<EmergencyPointsLayer points={[P(), P({ lat: 43 })]} />);
    expect(__openedPopups()).toHaveLength(0);
    fireEvent.click(screen.getAllByTestId('circle-marker')[0]);
    const opened = __openedPopups();
    expect(opened).toHaveLength(1);
    expect(opened[0].content).toContain('12.5 MW');
  });

  test('nessun punto → nessun marker', () => {
    render(<EmergencyPointsLayer points={[]} />);
    expect(screen.queryByTestId('circle-marker')).toBeNull();
  });

  test('colore marker per recency', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-25T10:00:00Z'));
    const recente = P({ acquiredAt: '2026-08-25T08:00:00Z' });
    const vecchio = P({ lat: 43, acquiredAt: '2026-08-25T01:00:00Z', satellite: 'N19' });
    render(<EmergencyPointsLayer points={[recente, vecchio]} />);
    const markers = screen.getAllByTestId('circle-marker');
    expect(JSON.parse(markers[0].getAttribute('data-pathoptions') || '{}').color).toBe('#ef4444');
    expect(JSON.parse(markers[0].getAttribute('data-pathoptions') || '{}').fillOpacity).toBe(0.7);
    expect(JSON.parse(markers[1].getAttribute('data-pathoptions') || '{}').color).toBe('#f97316');
  });

  // In stagione la bbox italiana su 3 sensori può dare migliaia di righe: montarle
  // tutte bloccava la mappa per secondi sul telefono.
  test('oltre il tetto disegna solo i focolai più potenti', () => {
    const many = Array.from({ length: MAX_RENDERED_POINTS + 50 }, (_, i) =>
      P({ lat: 40 + i * 0.001, frp: i })
    );
    render(<EmergencyPointsLayer points={many} />);
    const markers = screen.getAllByTestId('circle-marker');
    expect(markers).toHaveLength(MAX_RENDERED_POINTS);
    // il primo disegnato è quello con FRP massimo
    fireEvent.click(markers[0]);
    expect(__openedPopups()[0].content).toContain(`${MAX_RENDERED_POINTS + 49} MW`);
  });

  test('sotto il tetto disegna tutti i punti', () => {
    const few = Array.from({ length: 5 }, (_, i) => P({ lat: 40 + i }));
    render(<EmergencyPointsLayer points={few} />);
    expect(screen.getAllByTestId('circle-marker')).toHaveLength(5);
  });
});
