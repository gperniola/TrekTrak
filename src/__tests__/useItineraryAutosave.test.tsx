import { render, act } from '@testing-library/react';
import { useItineraryAutosave } from '@/lib/useItineraryAutosave';
import { useItineraryStore } from '@/stores/itineraryStore';
import { loadCurrent, CURRENT_KEY } from '@/lib/current-itinerary';

function Sonda() {
  useItineraryAutosave();
  return null;
}

beforeEach(() => {
  localStorage.clear();
  useItineraryStore.getState().resetItinerary();
});

/**
 * L'autosalvataggio deve seguire il *lavoro*, non ogni respiro dello store:
 * `profileHover` cambia a ogni movimento del dito sul profilo altimetrico, e
 * sottoscrivere senza filtrare significherebbe scrivere in localStorage decine di
 * volte al secondo.
 */
describe('autosalvataggio agganciato allo store', () => {
  test('aggiungere un waypoint viene salvato dopo l\'attesa', async () => {
    jest.useFakeTimers();
    render(<Sonda />);
    act(() => { useItineraryStore.getState().addWaypointAtPosition(46.4, 11.8); });
    // prima dell'attesa non ha ancora scritto: e' il senso del debounce
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull();
    act(() => { jest.advanceTimersByTime(500); });
    expect(loadCurrent()?.waypoints).toHaveLength(1);
    jest.useRealTimers();
  });

  test('il passaggio di modalità viene salvato', () => {
    jest.useFakeTimers();
    render(<Sonda />);
    act(() => { useItineraryStore.getState().addWaypointAtPosition(46.4, 11.8); });
    act(() => { useItineraryStore.getState().setAppMode('learn'); });
    act(() => { jest.advanceTimersByTime(500); });
    expect(loadCurrent()?.appMode).toBe('learn');
    jest.useRealTimers();
  });

  test('muovere il dito sul profilo NON scrive', () => {
    jest.useFakeTimers();
    render(<Sonda />);
    act(() => { useItineraryStore.getState().addWaypointAtPosition(46.4, 11.8); });
    act(() => { jest.advanceTimersByTime(500); });
    const dopoPrimo = localStorage.getItem(CURRENT_KEY);
    localStorage.removeItem(CURRENT_KEY);
    for (let i = 0; i < 20; i++) {
      act(() => { useItineraryStore.getState().setProfileHover(i / 10, 'chart'); });
    }
    act(() => { jest.advanceTimersByTime(500); });
    expect(dopoPrimo).not.toBeNull();
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull();
    jest.useRealTimers();
  });

  // Su mobile il sistema puo' sospendere la PWA senza preavviso: i 400 ms di attesa
  // sarebbero persi, e con essi l'ultima modifica.
  test('nascondere la pagina salva subito, senza aspettare', () => {
    jest.useFakeTimers();
    render(<Sonda />);
    act(() => { useItineraryStore.getState().addWaypointAtPosition(45.9, 10.9); });
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull();
    const spia = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(loadCurrent()?.waypoints).toHaveLength(1);
    spia.mockRestore();
    jest.useRealTimers();
  });

  test('smontando non resta nessuna sottoscrizione che scrive', () => {
    jest.useFakeTimers();
    const { unmount } = render(<Sonda />);
    unmount();
    act(() => { useItineraryStore.getState().addWaypointAtPosition(46.4, 11.8); });
    act(() => { jest.advanceTimersByTime(500); });
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull();
    jest.useRealTimers();
  });
});

/**
 * **Il lavoro salvato non si cancella da solo.**
 *
 * Trovato il 2026-09-02 mentre provavo altro: l'autosalvataggio salva anche quando la
 * pagina viene nascosta, e salvare uno stato vuoto cancellava la chiave. Bastava aprire
 * l'app in una seconda scheda — che parte sempre vuota, perche' il ripristino avviene
 * dopo — e cambiare scheda, per far sparire il lavoro salvato dalla prima. Al riavvio non
 * tornava niente: e' esattamente il difetto per cui la v0.11.8 esiste.
 */
describe('quando NON si cancella', () => {
  /** Il lavoro salvato da un'altra scheda (o dalla sessione precedente). */
  const lavoroSalvato = () => {
    localStorage.setItem(CURRENT_KEY, JSON.stringify({
      v: 1, itineraryId: 'altra', itineraryName: 'Lavoro di ieri',
      createdAt: '2026-09-01T08:00:00.000Z', appMode: 'track',
      waypoints: [
        { id: 'a', name: 'Uno', order: 0, lat: 46.4, lon: 11.8, altitude: 2000 },
        { id: 'b', name: 'Due', order: 1, lat: 46.5, lon: 11.9, altitude: 2300 },
      ],
      legs: [{ id: 'la', fromWaypointId: 'a', toWaypointId: 'b' }],
    }));
  };

  test('una scheda vuota che viene nascosta non cancella il lavoro salvato', () => {
    lavoroSalvato();
    render(<Sonda />); // store vuoto: e' la seconda scheda appena aperta
    const spia = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    spia.mockRestore();
    expect(loadCurrent()?.itineraryName).toBe('Lavoro di ieri');
  });

  test('nemmeno chiudendo la pagina', () => {
    lavoroSalvato();
    const { unmount } = render(<Sonda />);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    unmount();
    expect(loadCurrent()?.waypoints).toHaveLength(2);
  });

  /**
   * Il gesto, invece, cancella: svuotare l'itinerario (Nuovo, o il cestino sulla mappa)
   * significa che alla prossima apertura non deve ricomparire nulla. E **subito**, senza
   * l'attesa: la cancellazione non ha niente da accorpare, e deve valere anche se si
   * chiude l'app nell'istante dopo.
   */
  test('svuotare l itinerario a mano lo cancella, e subito', () => {
    jest.useFakeTimers();
    render(<Sonda />);
    act(() => { useItineraryStore.getState().addWaypointAtPosition(46.4, 11.8); });
    act(() => { jest.advanceTimersByTime(500); });
    expect(loadCurrent()).not.toBeNull();
    act(() => { useItineraryStore.getState().resetItinerary(); });
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull();
    jest.useRealTimers();
  });
});
