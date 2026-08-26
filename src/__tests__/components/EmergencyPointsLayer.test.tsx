import { render, screen, fireEvent } from '@testing-library/react';
import {
  EmergencyPointsLayer, fireColor, firePopupHtml, MAX_RENDERED_POINTS,
} from '@/components/map/emergency/EmergencyPointsLayer';
import type { FirePoint } from '@/lib/firms';
import { __openedPopups, __resetPopups } from './__mocks__/leaflet';

// lat/lon dentro i bounds della mappa mockata (44..46, 9..11): fuori, il culling
// sulla vista li scarterebbe e i test non verificherebbero piu' il loro oggetto.
const P = (over: Partial<FirePoint> = {}): FirePoint => ({
  lat: 45, lon: 10, frp: 12.5, confidence: 'high',
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
    render(<EmergencyPointsLayer points={[P(), P({ lat: 45.2 })]} />);
    const markers = screen.getAllByTestId('circle-marker');
    expect(markers).toHaveLength(2);
    markers.forEach((m) => expect(m).toHaveAttribute('data-renderer', 'canvas'));
  });

  // Prima ogni punto montava subito la sua istanza L.Popup con i relativi listener
  // sulla mappa, rendendo il dispatch degli eventi proporzionale al numero di punti.
  test('nessun popup costruito al mount, uno al click', () => {
    render(<EmergencyPointsLayer points={[P(), P({ lat: 45.2 })]} />);
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
    const vecchio = P({ lat: 45.2, acquiredAt: '2026-08-25T01:00:00Z', satellite: 'N19' });
    render(<EmergencyPointsLayer points={[recente, vecchio]} />);
    const markers = screen.getAllByTestId('circle-marker');
    expect(JSON.parse(markers[0].getAttribute('data-pathoptions') || '{}').color).toBe('#ef4444');
    expect(JSON.parse(markers[0].getAttribute('data-pathoptions') || '{}').fillOpacity).toBe(0.7);
    expect(JSON.parse(markers[1].getAttribute('data-pathoptions') || '{}').color).toBe('#f97316');
  });

  // Regressione introdotta dal passaggio al renderer canvas: col canvas il bersaglio
  // DOM e' la tela, non il <path>, quindi `Map._findEventTargets` non trova il layer e
  // aggiunge la MAPPA come bersaglio di fallback. `_fireDOMEvent` fa allora scattare
  // sia il marker sia la mappa (leaflet-src.js:4535-4541), e MapEvents interpreta il
  // click della mappa come "aggiungi waypoint": tap su un focolaio = popup + waypoint
  // spurio. `Path` ha `bubblingMouseEvents: true` per default, `Marker` false — da cui
  // il fatto che i waypoint non avessero mai il problema.
  test('i marker non propagano il click alla mappa (nessun waypoint sul tap del focolaio)', () => {
    render(<EmergencyPointsLayer points={[P(), P({ lat: 45.2 })]} />);
    screen.getAllByTestId('circle-marker').forEach((m) => {
      expect(m).toHaveAttribute('data-bubbling', 'false');
    });
  });

  // Regressione: il tetto ordinava per potenza su TUTTA l'Italia, quindi i focolai
  // della zona guardata sparivano se altrove ce n'erano di piu' potenti. Con 2298
  // punti in Italia e 289 nella vista, ne restavano disegnati 3: per l'utente
  // "i focolai non compaiono piu'". Va scartato cio' che e' fuori schermo, non cio'
  // che e' meno potente.
  describe('culling sulla vista', () => {
    // Il mock della mappa ha bounds lat 44..46, lon 9..11.
    const dentro = (over = {}) => P({ lat: 45, lon: 10, ...over });
    const fuori = (over = {}) => P({ lat: 20, lon: 100, ...over });

    test('i punti fuori dalla vista non vengono disegnati', () => {
      render(<EmergencyPointsLayer points={[dentro(), fuori(), fuori({ lat: 21 })]} />);
      expect(screen.getAllByTestId('circle-marker')).toHaveLength(1);
    });

    test('un punto debole nella vista batte mille potenti fuori dalla vista', () => {
      const lontaniEPotenti = Array.from({ length: 1000 }, (_, i) => fuori({ lat: 20 + i * 0.001, frp: 9999 }));
      render(<EmergencyPointsLayer points={[dentro({ frp: 0.1 }), ...lontaniEPotenti]} />);
      expect(screen.getAllByTestId('circle-marker')).toHaveLength(1);
    });

    test('tutti i punti della vista vengono disegnati, anche a potenza bassa', () => {
      const molti = Array.from({ length: 289 }, (_, i) => dentro({ lat: 44.5 + i * 0.005, frp: 6.4 }));
      render(<EmergencyPointsLayer points={molti} />);
      expect(screen.getAllByTestId('circle-marker')).toHaveLength(289);
    });

    test('oltre il tetto, nella vista, restano i più potenti', () => {
      const troppi = Array.from({ length: MAX_RENDERED_POINTS + 20 }, (_, i) =>
        dentro({ lat: 44.001 + (i % 200) * 0.001, lon: 9.001 + (i % 150) * 0.001, frp: i }));
      render(<EmergencyPointsLayer points={troppi} />);
      const markers = screen.getAllByTestId('circle-marker');
      expect(markers).toHaveLength(MAX_RENDERED_POINTS);
      fireEvent.click(markers[0]);
      expect(__openedPopups()[0].content).toContain(`${MAX_RENDERED_POINTS + 19} MW`);
    });
  });
});
