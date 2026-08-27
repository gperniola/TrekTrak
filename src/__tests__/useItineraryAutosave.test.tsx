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
