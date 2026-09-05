import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useTastoIndietro } from '@/lib/useTastoIndietro';

/**
 * **Il tasto Indietro del telefono.**
 *
 * È la macchina che è costata sei rilasci (v0.10.3 → v0.10.10) e che, per tutta quella
 * saga, non ha avuto **nessun test**: viveva dentro `app/page.tsx`, un file che non si
 * monta in isolamento, e ogni tentativo di correzione si verificava a mano su un telefono.
 * Portata in `lib/useTastoIndietro`, si può finalmente interrogare.
 *
 * Quello che si prova qui è la parte che non stava nella logica pura di `lib/back-nav`: il
 * rapporto fra la cronologia del browser e la profondità dell'interfaccia. È lì che stavano
 * tutti e tre i difetti della saga.
 */

function Pagina() {
  const [impostazioni, setImpostazioni] = useState(false);
  useTastoIndietro({
    mapSettingsOpen: false,
    settingsOpen: impostazioni,
    chiudiMapSettings: () => {},
    chiudiSettings: () => setImpostazioni(false),
  });
  return (
    <button data-testid="apri" onClick={() => setImpostazioni(true)}>
      {impostazioni ? 'aperte' : 'chiuse'}
    </button>
  );
}

function schermoPiccolo(piccolo: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: piccolo,
    media: q,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const pop = () => act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });

let spingi: jest.SpyInstance;
let vai: jest.SpyInstance;

beforeEach(() => {
  schermoPiccolo(true);
  useUIStore.setState({
    mobileTab: 'map', searchOpen: false, quizActive: false, progressOpen: false,
    moreMenuOpen: false, emergencyPanelOpen: false, toolsFabOpen: false, weatherOpen: false,
  });
  history.replaceState(null, '', '/');
  spingi = jest.spyOn(window.history, 'pushState');
  // `history.go` non è implementato in jsdom: si osserva la chiamata, che è quello che conta.
  vai = jest.spyOn(window.history, 'go').mockImplementation(() => {});
});

afterEach(() => { jest.restoreAllMocks(); });

describe('la guardia base', () => {
  test('al montaggio spinge una entry di guardia', () => {
    render(<Pagina />);
    expect(spingi).toHaveBeenCalledTimes(1);
    expect((window.history.state as { ttGuard?: boolean }).ttGuard).toBe(true);
  });

  /**
   * **La guardia è idempotente.** Senza il controllo su `ttGuard`, un rimontaggio (o
   * `StrictMode` in sviluppo) impila una seconda guardia, e un solo `history.back()` non
   * basta più a superarle: **l'uscita dall'app smette di funzionare**. È il difetto della
   * v0.10.10.
   */
  test('rimontando non accumula una seconda guardia', () => {
    const primo = render(<Pagina />);
    primo.unmount();
    render(<Pagina />);
    expect(spingi).toHaveBeenCalledTimes(1);
  });

  /** Su desktop il tasto Indietro è quello del browser: non si tocca niente. */
  test('su schermo grande non spinge niente', () => {
    schermoPiccolo(false);
    render(<Pagina />);
    expect(spingi).not.toHaveBeenCalled();
  });
});

describe('cronologia e profondita si tengono allineate', () => {
  test('aprire un livello spinge una entry', () => {
    const { getByTestId } = render(<Pagina />);
    expect(spingi).toHaveBeenCalledTimes(1); // la guardia
    act(() => { getByTestId('apri').click(); });
    expect(spingi).toHaveBeenCalledTimes(2);
    expect((window.history.state as { ttDepth?: number }).ttDepth).toBe(1);
  });

  test('due livelli aperti sono due entry', () => {
    render(<Pagina />);
    act(() => { useUIStore.getState().setMoreMenuOpen(true); });
    act(() => { useUIStore.getState().setSearchOpen(true); });
    expect(spingi).toHaveBeenCalledTimes(3); // guardia + due livelli
  });

  /**
   * Chiudere un livello **col ✕** (non col tasto Indietro) lascerebbe una entry orfana in
   * cronologia: la si rimuove con `history.go`, e il `popstate` che ne deriva è
   * auto-inflitto, quindi va ignorato — altrimenti chiuderebbe un secondo livello.
   */
  test('chiudere un livello con un gesto rimuove la sua entry', () => {
    render(<Pagina />);
    act(() => { useUIStore.getState().setMoreMenuOpen(true); });
    act(() => { useUIStore.getState().setMoreMenuOpen(false); });
    expect(vai).toHaveBeenCalledWith(-1);
  });

  test('e il popstate che ne deriva non chiude niente altro', () => {
    render(<Pagina />);
    act(() => { useUIStore.getState().setMoreMenuOpen(true); });
    act(() => { useUIStore.getState().setSearchOpen(true); });
    act(() => { useUIStore.getState().setMoreMenuOpen(false); }); // ✕ sul menu
    pop(); // il popstate auto-inflitto da history.go
    expect(useUIStore.getState().searchOpen).toBe(true);
  });
});

describe('il tasto Indietro chiude un livello per volta', () => {
  test('con un livello aperto, lo chiude', () => {
    render(<Pagina />);
    act(() => { useUIStore.getState().setSearchOpen(true); });
    pop();
    expect(useUIStore.getState().searchOpen).toBe(false);
  });

  /** La priorità è quella di `nextBackAction`: prima gli overlay, poi la scheda. */
  test('con due livelli, ne chiude uno alla volta', () => {
    render(<Pagina />);
    act(() => { useUIStore.getState().setMobileTab('editor'); });
    act(() => { useUIStore.getState().setSearchOpen(true); });
    pop();
    expect(useUIStore.getState().searchOpen).toBe(false);
    expect(useUIStore.getState().mobileTab).toBe('editor');
    pop();
    expect(useUIStore.getState().mobileTab).toBe('map');
  });

  test('chiude anche un modale locale della pagina', () => {
    const { getByTestId } = render(<Pagina />);
    act(() => { getByTestId('apri').click(); });
    expect(getByTestId('apri').textContent).toBe('aperte');
    pop();
    expect(getByTestId('apri').textContent).toBe('chiuse');
  });

  test('smontando non resta l ascoltatore', () => {
    const { unmount } = render(<Pagina />);
    act(() => { useUIStore.getState().setSearchOpen(true); });
    unmount();
    pop();
    // Nessuno ha chiuso niente: l'ascoltatore era stato staccato.
    expect(useUIStore.getState().searchOpen).toBe(true);
  });
});
