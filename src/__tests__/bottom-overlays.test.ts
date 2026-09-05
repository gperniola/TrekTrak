import { useUIStore } from '@/stores/uiStore';
import { nextBackAction } from '@/lib/back-nav';

const base = {
  guidaAperta: false,
  moreMenuOpen: false, mapSettingsOpen: false, settingsOpen: false, progressOpen: false,
  quizActive: false, searchOpen: false, mobileTab: 'map' as const,
  emergencyPanelOpen: false, toolsFabOpen: false, weatherOpen: false,
};

beforeEach(() => {
  useUIStore.setState({ moreMenuOpen: false, emergencyPanelOpen: false, toolsFabOpen: false });
});

/**
 * Tre pannelli si aprono dal bordo inferiore: il menu "Altro", lo speed-dial degli
 * strumenti e il pannello dei layer di emergenza. Si aprivano insieme e si
 * sovrapponevano — con la voce "Quiz" che finiva sotto il menu Altro, quindi
 * intoccabile.
 */
describe('i pannelli dal basso si escludono a vicenda', () => {
  test('aprire "Altro" chiude strumenti ed emergenza', () => {
    useUIStore.getState().setToolsFabOpen(true);
    useUIStore.getState().setEmergencyPanelOpen(true);
    useUIStore.getState().setMoreMenuOpen(true);
    const s = useUIStore.getState();
    expect([s.moreMenuOpen, s.toolsFabOpen, s.emergencyPanelOpen]).toEqual([true, false, false]);
  });

  test('aprire gli strumenti chiude "Altro" ed emergenza', () => {
    useUIStore.getState().setMoreMenuOpen(true);
    useUIStore.getState().setToolsFabOpen(true);
    const s = useUIStore.getState();
    expect([s.moreMenuOpen, s.toolsFabOpen, s.emergencyPanelOpen]).toEqual([false, true, false]);
  });

  test('aprire emergenza chiude gli altri due', () => {
    useUIStore.getState().setToolsFabOpen(true);
    useUIStore.getState().setEmergencyPanelOpen(true);
    const s = useUIStore.getState();
    expect([s.moreMenuOpen, s.toolsFabOpen, s.emergencyPanelOpen]).toEqual([false, false, true]);
  });

  // Chiudere non deve aprire nulla: sarebbe il modo piu' facile di sbagliare questa
  // logica, e si vedrebbe come un pannello che ricompare da solo.
  test('chiuderne uno non apre gli altri', () => {
    useUIStore.getState().setMoreMenuOpen(true);
    useUIStore.getState().setMoreMenuOpen(false);
    const s = useUIStore.getState();
    expect([s.moreMenuOpen, s.toolsFabOpen, s.emergencyPanelOpen]).toEqual([false, false, false]);
  });
});

/**
 * Il tasto Indietro chiude "il livello piu' in alto": lo speed-dial e' un livello come
 * gli altri, quindi deve chiudersi anche lui invece di restare aperto mentre l'app
 * torna alla Mappa o chiede di uscire.
 */
describe('tasto Indietro e speed-dial', () => {
  test('con lo speed-dial aperto lo chiude', () => {
    expect(nextBackAction({ ...base, toolsFabOpen: true })).toBe('closeToolsFab');
  });

  test('sulla mappa senza nulla aperto resta l\'uscita', () => {
    expect(nextBackAction(base)).toBe('exit');
  });

  test('il menu Altro resta il primo della fila', () => {
    expect(nextBackAction({ ...base, moreMenuOpen: true, toolsFabOpen: true })).toBe('closeMore');
  });
});
