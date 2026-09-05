import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { Waypoint } from '@/lib/types';
import { statoItinerario } from '../fixtures/itinerario';

jest.mock('@/stores/notificationStore', () => ({
  confirm: jest.fn(() => Promise.resolve(true)),
  toast: { info: jest.fn(), warning: jest.fn(), error: jest.fn(), success: jest.fn() },
}));
jest.mock('@/lib/auto-fill', () => ({ autoFillAllTrackData: jest.fn() }));
jest.mock('@/components/map/useMapOverlayGuard', () => ({
  useMapOverlayGuard: () => () => {},
}));

const { confirm, toast } = jest.requireMock('@/stores/notificationStore') as {
  confirm: jest.Mock<(opzioni: unknown) => Promise<boolean>>;
  toast: { warning: jest.Mock<() => void>; success: jest.Mock<() => void> };
};
const { autoFillAllTrackData } = jest.requireMock('@/lib/auto-fill') as {
  autoFillAllTrackData: jest.Mock<(soloMancanti?: boolean) => Promise<void>>;
};

import { PulsanteRitorno } from '@/components/map/PulsanteRitorno';

/**
 * **Il pulsante del ritorno: prima spiega, poi fa.**
 *
 * Chiesto così: «fai prima apparire un popup che spiega cosa sta facendo e chiedi
 * conferma». Quindi i casi che contano sono i due lati del dialogo — confermare aggiunge,
 * annullare non tocca niente — più le condizioni in cui il pulsante non deve esserci.
 */

const wp = (i: number): Waypoint => ({
  id: `w${i}`, name: `P${i}`, lat: 42.1 + i / 100, lon: 14.1 + i / 100,
  altitude: 1000, order: i,
});

const punti = (n: number) => Array.from({ length: n }, (_, i) => wp(i));

beforeEach(() => {
  confirm.mockReset();
  confirm.mockResolvedValue(true);
  toast.warning.mockReset();
  autoFillAllTrackData.mockReset();
  useItineraryStore.setState(statoItinerario({ appMode: 'learn', waypoints: [], legs: [] }));
});

const bottone = () => screen.queryByRole('button', { name: 'Aggiungi il percorso di ritorno' });

describe('quando compare', () => {
  test('senza waypoint non c e', () => {
    render(<PulsanteRitorno />);
    expect(bottone()).not.toBeInTheDocument();
  });

  /** Con un punto solo non c'e' un'andata da specchiare. */
  test('con un solo waypoint non c e', () => {
    useItineraryStore.setState({ waypoints: punti(1) });
    render(<PulsanteRitorno />);
    expect(bottone()).not.toBeInTheDocument();
  });

  test('da due waypoint in su compare', () => {
    useItineraryStore.setState({ waypoints: punti(2) });
    render(<PulsanteRitorno />);
    expect(bottone()).toBeInTheDocument();
  });
});

describe('il dialogo', () => {
  test('confermando, il ritorno viene aggiunto', async () => {
    useItineraryStore.setState({ waypoints: punti(3) });
    render(<PulsanteRitorno />);
    await act(async () => { bottone()!.click(); });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(useItineraryStore.getState().waypoints.map((w) => w.name))
      .toEqual(['P0', 'P1', 'P2', 'P1', 'P0']);
  });

  test('annullando, il percorso resta com era', async () => {
    confirm.mockResolvedValue(false);
    useItineraryStore.setState({ waypoints: punti(3) });
    render(<PulsanteRitorno />);
    await act(async () => { bottone()!.click(); });
    expect(useItineraryStore.getState().waypoints).toHaveLength(3);
  });

  /** Il messaggio dice QUANTI punti e da dove si torna: e' la spiegazione chiesta. */
  test('il messaggio dice quanti punti aggiunge e da dove si torna', async () => {
    useItineraryStore.setState({ waypoints: punti(3) });
    render(<PulsanteRitorno />);
    await act(async () => { bottone()!.click(); });
    const richiesta = confirm.mock.calls[0][0] as { message: string };
    expect(richiesta.message).toContain('2 waypoint');
    expect(richiesta.message).toContain('P2');
  });

  /** In Imparo le tratte nuove nascono vuote, e il dialogo lo dichiara. */
  test('in Imparo avverte che i valori li scrivi tu', async () => {
    useItineraryStore.setState({ waypoints: punti(2), appMode: 'learn' });
    render(<PulsanteRitorno />);
    await act(async () => { bottone()!.click(); });
    const richiesta = confirm.mock.calls[0][0] as { message: string };
    expect(richiesta.message).toContain('li scrivi tu');
  });

  test('in Pianificazione dice che li calcola l app, e li fa calcolare', async () => {
    useItineraryStore.setState({ waypoints: punti(2), appMode: 'track' });
    render(<PulsanteRitorno />);
    await act(async () => { bottone()!.click(); });
    const richiesta = confirm.mock.calls[0][0] as { message: string };
    expect(richiesta.message).toContain('calcola');
    expect(autoFillAllTrackData).toHaveBeenCalledWith(true);
  });

  test('in Imparo NON parte nessun calcolo automatico', async () => {
    useItineraryStore.setState({ waypoints: punti(2), appMode: 'learn' });
    render(<PulsanteRitorno />);
    await act(async () => { bottone()!.click(); });
    expect(autoFillAllTrackData).not.toHaveBeenCalled();
  });
});

describe('le guardie', () => {
  /** Oltre il tetto dei 50 si spiega e non si apre nemmeno il dialogo. */
  test('se supererebbe i 50 waypoint, avvisa senza chiedere conferma', async () => {
    useItineraryStore.setState({ waypoints: punti(26) });
    render(<PulsanteRitorno />);
    await act(async () => { bottone()!.click(); });
    expect(toast.warning).toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(useItineraryStore.getState().waypoints).toHaveLength(26);
  });

  /** Due tocchi rapidi aprono UN solo dialogo: l'attesa e' un `await`. */
  test('un doppio tocco apre un solo dialogo', async () => {
    let sblocca: (v: boolean) => void = () => {};
    confirm.mockImplementation(() => new Promise<boolean>((r) => { sblocca = r; }));
    useItineraryStore.setState({ waypoints: punti(2) });
    render(<PulsanteRitorno />);
    act(() => { bottone()!.click(); });
    act(() => { bottone()!.click(); });
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => { sblocca(true); });
    expect(useItineraryStore.getState().waypoints).toHaveLength(3);
  });

  /**
   * **Lo stato si rilegge dopo l'attesa.** Il dialogo puo' restare aperto a lungo: se nel
   * frattempo i waypoint sono stati cancellati, specchiare la lista catturata al render
   * aggiungerebbe punti di un percorso che non c'e' piu'.
   */
  test('se i punti spariscono mentre il dialogo aspetta, non aggiunge niente', async () => {
    let sblocca: (v: boolean) => void = () => {};
    confirm.mockImplementation(() => new Promise<boolean>((r) => { sblocca = r; }));
    useItineraryStore.setState({ waypoints: punti(3) });
    render(<PulsanteRitorno />);
    act(() => { bottone()!.click(); });
    act(() => { useItineraryStore.setState({ waypoints: [], legs: [] }); });
    await act(async () => { sblocca(true); });
    expect(useItineraryStore.getState().waypoints).toHaveLength(0);
  });
});
