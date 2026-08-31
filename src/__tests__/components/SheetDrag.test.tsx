import { render, screen, fireEvent, act } from '@testing-library/react';
import { EmergencyLayersPanel } from '@/components/map/emergency/EmergencyLayersPanel';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_LAYERS } from '@/lib/emergency-layers';

/*
 * jsdom non implementa `PointerEvent`: senza questo, gli eventi sintetici arrivano come
 * `Event` generici, `button` e `clientY` sono `undefined` e il gesto non parte mai — il
 * test fallirebbe per l'ambiente, non per il codice.
 *
 * `MouseEvent` porta gia' clientX/clientY/button: basta aggiungere `pointerId`.
 */
class PointerEventFinto extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventFinto;
// jsdom non ha nemmeno la cattura del puntatore; il codice la avvolge in try/catch, ma
// senza questi stub ogni gesto passerebbe dal ramo dell'errore.
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || function () {};
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || function () {};

jest.mock('@/stores/notificationStore', () => ({
  ...jest.requireActual('@/stores/notificationStore'),
  confirm: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({ points: [], fetchedAt: '2026-08-25T10:00:00Z' }),
  fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [] }),
}));

/**
 * Il gesto "trascina in basso per chiudere".
 *
 * Le decisioni sono verificate a parte in `sheet-drag.test.ts`; qui si controlla il
 * cablaggio: che il foglio si muova davvero, che chiuda oltre la soglia, che torni al
 * suo posto sotto, e che la ✕ non sia stata sostituita dal gesto — un trascinamento non
 * e' utilizzabile da tastiera, quindi non puo' essere la sola via d'uscita.
 *
 * Quello che questi test NON provano: il conflitto vero fra gesto e scorrimento a dito.
 * Quello si prova sul telefono, e nessun test lo sostituisce.
 */
describe('trascinare via il foglio', () => {
  const TUTTI = EMERGENCY_LAYERS.map((l) => l.id);

  /** jsdom non ha layout: l'altezza va dichiarata, altrimenti la soglia e' 0. */
  const conAltezza = (el: HTMLElement, px: number) => {
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: px });
  };

  const foglio = () => screen.getByRole('dialog', { name: 'Layer di emergenza' });

  const trascina = (el: HTMLElement, da: number, a: number, passi = 3) => {
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 50, clientY: da });
    for (let i = 1; i <= passi; i++) {
      const y = da + ((a - da) * i) / passi;
      fireEvent.pointerMove(el, { pointerId: 1, clientX: 50, clientY: y });
    }
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 50, clientY: a });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    useUIStore.setState({ emergencyPanelOpen: true });
    const s = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...s, mapDisplay: { ...s.mapDisplay, emergencyLayers: [] } },
    });
    TUTTI.forEach((id) => useEmergencyStore.getState().stopLayer(id));
    // `useSchermoPiccolo` legge matchMedia: su jsdom va dichiarato, e il gesto si arma
    // solo su schermo piccolo.
    window.matchMedia = ((q: string) => ({
      matches: q.includes('max-width: 1023px'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    TUTTI.forEach((id) => useEmergencyStore.getState().stopLayer(id));
    jest.useRealTimers();
  });

  test('il foglio segue il dito', () => {
    render(<EmergencyLayersPanel />);
    const f = foglio();
    conAltezza(f, 400);
    fireEvent.pointerDown(f, { pointerId: 1, button: 0, clientX: 50, clientY: 100 });
    fireEvent.pointerMove(f, { pointerId: 1, clientX: 50, clientY: 160 });
    expect(f.style.transform).toBe('translateY(60px)');
  });

  test('oltre la soglia si chiude', () => {
    render(<EmergencyLayersPanel />);
    const f = foglio();
    conAltezza(f, 400);
    trascina(f, 100, 100 + 200); // 200 su 400 = metà, ben oltre il 35%
    act(() => { jest.advanceTimersByTime(400); });
    expect(useUIStore.getState().emergencyPanelOpen).toBe(false);
  });

  test('sotto la soglia e piano torna al suo posto', () => {
    render(<EmergencyLayersPanel />);
    const f = foglio();
    conAltezza(f, 400);
    fireEvent.pointerDown(f, { pointerId: 1, button: 0, clientX: 50, clientY: 100 });
    fireEvent.pointerMove(f, { pointerId: 1, clientX: 50, clientY: 130 });
    // rilascio lento: nessuna velocita' utile
    act(() => { jest.advanceTimersByTime(1000); });
    fireEvent.pointerUp(f, { pointerId: 1, clientX: 50, clientY: 130 });
    expect(useUIStore.getState().emergencyPanelOpen).toBe(true);
    expect(f.style.transform).toBe('');
  });

  test('verso l alto non chiude', () => {
    render(<EmergencyLayersPanel />);
    const f = foglio();
    conAltezza(f, 400);
    trascina(f, 300, 100);
    act(() => { jest.advanceTimersByTime(400); });
    expect(useUIStore.getState().emergencyPanelOpen).toBe(true);
  });

  test('un gesto orizzontale non chiude', () => {
    render(<EmergencyLayersPanel />);
    const f = foglio();
    conAltezza(f, 400);
    fireEvent.pointerDown(f, { pointerId: 1, button: 0, clientX: 50, clientY: 100 });
    fireEvent.pointerMove(f, { pointerId: 1, clientX: 250, clientY: 130 });
    fireEvent.pointerUp(f, { pointerId: 1, clientX: 250, clientY: 130 });
    act(() => { jest.advanceTimersByTime(400); });
    expect(useUIStore.getState().emergencyPanelOpen).toBe(true);
  });

  /** Se il contenuto e' scorso, il gesto appartiene a chi stava leggendo. */
  test('dal corpo non parte se il contenuto non e in cima', () => {
    render(<EmergencyLayersPanel />);
    const f = foglio();
    conAltezza(f, 400);
    Object.defineProperty(f, 'scrollTop', { configurable: true, value: 120 });
    trascina(f, 100, 300);
    act(() => { jest.advanceTimersByTime(400); });
    expect(useUIStore.getState().emergencyPanelOpen).toBe(true);
  });

  /** Il browser si e' preso il gesto: il foglio torna su senza discutere. */
  test('pointercancel riporta il foglio al suo posto', () => {
    render(<EmergencyLayersPanel />);
    const f = foglio();
    conAltezza(f, 400);
    fireEvent.pointerDown(f, { pointerId: 1, button: 0, clientX: 50, clientY: 100 });
    fireEvent.pointerMove(f, { pointerId: 1, clientX: 50, clientY: 250 });
    expect(f.style.transform).toBe('translateY(150px)');
    fireEvent.pointerCancel(f, { pointerId: 1 });
    expect(f.style.transform).toBe('');
    expect(useUIStore.getState().emergencyPanelOpen).toBe(true);
  });

  test('la maniglia c e, e la ✕ non e stata sostituita dal gesto', () => {
    render(<EmergencyLayersPanel />);
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(useUIStore.getState().emergencyPanelOpen).toBe(false);
  });
});
