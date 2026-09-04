import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { rigaApertaDopo } from '@/lib/riga-aperta';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { KEYS } from '@/lib/storage';
import { installaLocalStorage } from '../fixtures/finto-localstorage';
import { statoItinerario } from '../fixtures/itinerario';

jest.mock('@/stores/notificationStore', () => ({
  confirm: jest.fn(() => Promise.resolve(true)),
  toast: { info: jest.fn(), warning: jest.fn(), error: jest.fn(), success: jest.fn() },
}));
/*
  La guardia degli overlay parla con Leaflet (`L.DomEvent`) e restituisce una **callback
  ref**, non un oggetto: un finto che ritorna `{ current: null }` fa cadere il pannello con
  «backdropGuard is not a function». Qui non serve, quindi e' una funzione che non fa
  niente.
*/
jest.mock('@/components/map/useMapOverlayGuard', () => ({
  useMapOverlayGuard: () => () => {},
}));

import { EmergencyLayersPanel } from '@/components/map/emergency/EmergencyLayersPanel';
import { useUIStore } from '@/stores/uiStore';

/**
 * **La legenda segue l'interruttore.**
 *
 * Segnalato il 2026-09-04: «quando nel layer delle emergenze attivo un layer, fai aprire
 * in automatico anche la tendina della legenda; quando la disattivo, se è aperta falla
 * chiudere in automatico».
 *
 * Dalla v0.14.0 il dettaglio di un layer — descrizione, legenda, comandi — si apre a
 * fisarmonica, una riga per volta, e fin qui solo toccando la riga. Ma i colori sulla mappa
 * non si spiegano da soli: quattro classi di recenza per le aree bruciate, cinque di
 * pericolo per il FWI, e per l'instabilità satellitare una scala che va **al contrario**
 * del CAPE. Il momento in cui la legenda serve è esattamente quello in cui il layer
 * compare, e accenderlo senza vederla obbligava a un secondo tocco per capire cosa si sta
 * guardando.
 */

const deposito = installaLocalStorage();

beforeEach(() => {
  deposito.clear();
  // Disclaimer gia' accettato: qui si prova la fisarmonica, non il dialogo.
  deposito.setItem(KEYS.emergencyDisclaimer, '1');
  jest.spyOn(useEmergencyStore.getState(), 'startLayer').mockImplementation(() => {});
  jest.spyOn(useEmergencyStore.getState(), 'stopLayer').mockImplementation(() => {});
  useItineraryStore.setState(statoItinerario({ appMode: 'track' }));
  useUIStore.setState({ profilo: 'montagna', emergencyPanelOpen: true });
});

describe('rigaApertaDopo', () => {
  test('accendendo, si apre il suo dettaglio', () => {
    expect(rigaApertaDopo(null, 'rain-radar', true)).toBe('rain-radar');
  });

  /** La riga aperta e' una sola: accendendone un altro, il precedente si chiude. */
  test('accendendo, il dettaglio di un altro layer si chiude', () => {
    expect(rigaApertaDopo('dpc-alerts', 'rain-radar', true)).toBe('rain-radar');
  });

  test('spegnendo, il suo dettaglio si chiude', () => {
    expect(rigaApertaDopo('rain-radar', 'rain-radar', false)).toBeNull();
  });

  /** Spegnere un layer non deve chiudere il dettaglio che si stava leggendo di un altro. */
  test('spegnendo, il dettaglio di un altro layer resta dov era', () => {
    expect(rigaApertaDopo('dpc-alerts', 'rain-radar', false)).toBe('dpc-alerts');
  });

  test('spegnendo a dettagli tutti chiusi non apre niente', () => {
    expect(rigaApertaDopo(null, 'rain-radar', false)).toBeNull();
  });
});

/** Il dettaglio di un layer si riconosce dalla riga che ne spiega il gesto o la fonte. */
const dettaglioAperto = () => document.querySelectorAll('[id^="dettaglio-"]').length;
const idApertо = () => document.querySelector('[id^="dettaglio-"]')?.getAttribute('id') ?? null;

describe('a schermo', () => {
  const interruttore = (nome: string) => screen.getByRole('switch', { name: nome });

  test('all apertura del pannello nessun dettaglio e aperto', () => {
    render(<EmergencyLayersPanel />);
    expect(dettaglioAperto()).toBe(0);
  });

  test('accendendo un layer, il suo dettaglio si apre da se', async () => {
    render(<EmergencyLayersPanel />);
    await act(async () => { fireEvent.click(interruttore('Radar pioggia (ultime 2 h)')); });
    expect(idApertо()).toBe('dettaglio-rain-radar');
  });

  test('e spegnendolo si richiude', async () => {
    render(<EmergencyLayersPanel />);
    await act(async () => { fireEvent.click(interruttore('Radar pioggia (ultime 2 h)')); });
    expect(dettaglioAperto()).toBe(1);
    await act(async () => { fireEvent.click(interruttore('Radar pioggia (ultime 2 h)')); });
    expect(dettaglioAperto()).toBe(0);
  });

  test('accendendo un secondo layer, resta aperto solo il suo', async () => {
    render(<EmergencyLayersPanel />);
    await act(async () => { fireEvent.click(interruttore('Radar pioggia (ultime 2 h)')); });
    await act(async () => { fireEvent.click(interruttore('Allerte meteo-idro (DPC)')); });
    expect(dettaglioAperto()).toBe(1);
    expect(idApertо()).toBe('dettaglio-dpc-alerts');
  });

  /**
   * Spegnere un layer non tocca il dettaglio che si stava leggendo di un altro: e' il caso
   * che una correzione fatta a occhio sbaglierebbe, chiudendo tutto.
   */
  test('spegnendo un layer, il dettaglio di un altro resta aperto', async () => {
    render(<EmergencyLayersPanel />);
    await act(async () => { fireEvent.click(interruttore('Radar pioggia (ultime 2 h)')); });
    await act(async () => { fireEvent.click(interruttore('Allerte meteo-idro (DPC)')); });
    // Ora e' aperto il DPC; spengo il radar, che non e' quello aperto.
    await act(async () => { fireEvent.click(interruttore('Radar pioggia (ultime 2 h)')); });
    expect(idApertо()).toBe('dettaglio-dpc-alerts');
  });

  /**
   * **Il tocco sul nome continua a funzionare come prima.** L'apertura automatica si
   * aggiunge al gesto, non lo sostituisce.
   */
  test('toccare il nome apre e chiude come prima', () => {
    render(<EmergencyLayersPanel />);
    const nome = screen.getByRole('button', { name: /Radar pioggia/ });
    fireEvent.click(nome);
    expect(idApertо()).toBe('dettaglio-rain-radar');
    fireEvent.click(nome);
    expect(dettaglioAperto()).toBe(0);
  });

  /**
   * **Rimontando il pannello con dei layer già accesi, non si apre niente.**
   *
   * Si reagisce al *cambio* di stato, non allo stato: senza il confronto col valore
   * precedente, riaprendo il pannello tre righe proverebbero ad aprirsi e vincerebbe
   * l'ultima dell'elenco — che non e' quella che l'utente stava guardando.
   */
  test('riaprendo il pannello con layer accesi, nessun dettaglio si apre', () => {
    useItineraryStore.setState(statoItinerario({
      appMode: 'track',
      settings: {
        ...useItineraryStore.getState().settings,
        mapDisplay: {
          ...useItineraryStore.getState().settings.mapDisplay,
          emergencyLayers: ['rain-radar', 'dpc-alerts'],
        },
      },
    }));
    render(<EmergencyLayersPanel />);
    expect(dettaglioAperto()).toBe(0);
  });
});
