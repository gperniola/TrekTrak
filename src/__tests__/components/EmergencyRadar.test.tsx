import { render, screen, fireEvent, act } from '@testing-library/react';
import { EmergencyRadarLayer } from '@/components/map/emergency/EmergencyRadarLayer';
import { useEmergencyStore } from '@/stores/emergencyStore';
import type { RadarIndex } from '@/lib/radar-api';

const indice: RadarIndex = {
  host: 'https://tilecache.test',
  frames: [
    { timeISO: '2026-08-27T15:00:00.000Z', path: '/f1' },
    { timeISO: '2026-08-27T15:10:00.000Z', path: '/f2' },
    { timeISO: '2026-08-27T15:20:00.000Z', path: '/f3' },
  ],
};

beforeEach(() => {
  useEmergencyStore.setState({ radar: indice, radarFrame: -1, radarPlaying: false });
});

const urlTile = () => screen.getByTestId('tile-layer').getAttribute('data-url');

/**
 * Il radar gratuito mostra **il passato**: `nowcast` è vuoto (misurato). Il valore sta
 * nell'animazione — da dove arriva la cella e dove va — e nell'orario, che deve essere
 * sempre leggibile perché nessuno creda di guardare "adesso".
 */
describe('layer radar', () => {
  test('parte dal fotogramma più recente', () => {
    render(<EmergencyRadarLayer radar={indice} />);
    expect(urlTile()).toContain('/f3/');
  });

  test('un indice scelto a mano viene rispettato', () => {
    useEmergencyStore.setState({ radarFrame: 0 });
    render(<EmergencyRadarLayer radar={indice} />);
    expect(urlTile()).toContain('/f1/');
  });

  // Un indice oltre la fine (l'indice si accorcia fra due aggiornamenti) non deve
  // produrre un URL con `undefined` dentro.
  test('un indice fuori scala non rompe l\'URL', () => {
    useEmergencyStore.setState({ radarFrame: 99 });
    render(<EmergencyRadarLayer radar={indice} />);
    expect(urlTile()).toContain('/f3/');
    expect(urlTile()).not.toMatch(/undefined/);
  });

  test('l\'URL porta i segnaposto dei tile e il pane dedicato', () => {
    render(<EmergencyRadarLayer radar={indice} />);
    expect(urlTile()).toMatch(/\{z\}\/\{x\}\/\{y\}/);
    expect(screen.getByTestId('tile-layer').getAttribute('data-pane')).toBe('emergency');
  });

  test('in riproduzione avanza di un fotogramma e riparte da capo', () => {
    jest.useFakeTimers();
    useEmergencyStore.setState({ radarFrame: 1, radarPlaying: true });
    render(<EmergencyRadarLayer radar={indice} />);
    act(() => { jest.advanceTimersByTime(700); });
    expect(useEmergencyStore.getState().radarFrame).toBe(2);
    act(() => { jest.advanceTimersByTime(700); });
    expect(useEmergencyStore.getState().radarFrame).toBe(0);
    jest.useRealTimers();
  });

  test('fermata l\'animazione, il timer non resta acceso', () => {
    jest.useFakeTimers();
    useEmergencyStore.setState({ radarFrame: 0, radarPlaying: true });
    const { unmount } = render(<EmergencyRadarLayer radar={indice} />);
    unmount();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(useEmergencyStore.getState().radarFrame).toBe(0);
    jest.useRealTimers();
  });
});

/**
 * Trascinare lo slider mentre l'animazione scorre rende il controllo inutilizzabile:
 * il fotogramma cambia sotto le dita.
 */
describe('controllo dei fotogrammi', () => {
  test('scegliere un fotogramma ferma l\'animazione', () => {
    useEmergencyStore.setState({ radarPlaying: true });
    useEmergencyStore.getState().setRadarFrame(1);
    expect(useEmergencyStore.getState().radarPlaying).toBe(false);
    expect(useEmergencyStore.getState().radarFrame).toBe(1);
  });

  test('gli indici restano dentro i limiti', () => {
    useEmergencyStore.getState().setRadarFrame(-5);
    expect(useEmergencyStore.getState().radarFrame).toBe(0);
    useEmergencyStore.getState().setRadarFrame(50);
    expect(useEmergencyStore.getState().radarFrame).toBe(2);
  });

  test('senza fotogrammi non si sposta nulla', () => {
    useEmergencyStore.setState({ radar: null, radarFrame: -1 });
    useEmergencyStore.getState().setRadarFrame(2);
    expect(useEmergencyStore.getState().radarFrame).toBe(-1);
  });
});
