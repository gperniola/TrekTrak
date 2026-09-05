import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';

jest.mock('@/lib/export-pdf', () => ({ downloadPDF: jest.fn() }));
jest.mock('@/lib/export-gpx', () => ({ downloadGPX: jest.fn() }));
jest.mock('@/lib/routing-api', () => ({ fetchTrailRoute: jest.fn() }));
jest.mock('@/lib/elevation-api', () => ({
  fetchElevation: jest.fn(),
  fetchElevationProfile: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  saveValidationSession: jest.fn(),
  loadValidationHistory: jest.fn(() => []),
}));

import { ActionBar } from '@/components/panel/ActionBar';
import { useTessereOffline } from '@/lib/useTessereOffline';
import { statoItinerario, wp } from '../fixtures/itinerario';

/**
 * **Le mattonelle si scaricano dall'editor, e solo quando lo si chiede.**
 *
 * Segnalato il 2026-09-02: «non scaricare mai automaticamente i tile della mappa offline;
 * oltre che nelle opzioni come ora, metti anche un tasto nel menu editor in modo che
 * scarichi i tile del percorso appena fatto».
 *
 * Le due richieste sono legate: mettere il gesto dove si finisce di disegnare il percorso
 * ha senso proprio perché il gesto resta **dell'utente**. Le mattonelle arrivano da servizi
 * che ce le regalano, e un'app che le prende di sua iniziativa spende la banda e la
 * cortesia di qualcun altro senza che nessuno lo abbia chiesto.
 */


const fetchOriginale = global.fetch;

/** Quante richieste di mattonelle sono partite: e' il numero al centro di tutto. */
let richiesteTessere: string[] = [];

beforeEach(() => {
  richiesteTessere = [];
  global.fetch = jest.fn((url: unknown) => {
    const u = String(url);
    if (/tile/.test(u)) richiesteTessere.push(u);
    return Promise.resolve({ ok: true, status: 0, type: 'opaque' });
  }) as unknown as typeof fetch;
  useItineraryStore.setState(statoItinerario({ appMode: 'track' }));
  useUIStore.setState({ profilo: 'montagna' });
});

afterEach(() => { global.fetch = fetchOriginale; });

describe('il pulsante della mappa offline nell editor', () => {
  test('c e, e dice quante mattonelle prendera', () => {
    useItineraryStore.setState({ ...statoItinerario({ appMode: 'track' }), waypoints: [wp(0), wp(1)] });
    render(<ActionBar />);
    const b = screen.getByRole('button', { name: /Mappa offline/i });
    expect(b).not.toBeDisabled();
    // Il numero nel `title` viene dallo stesso elenco che poi si scarica.
    expect(b.getAttribute('title')).toMatch(/\d+ mattonelle/);
  });

  test('senza waypoint e spento: non c e un area da cui ricavare le mattonelle', () => {
    render(<ActionBar />);
    expect(screen.getByRole('button', { name: /Mappa offline/i })).toBeDisabled();
  });

  /**
   * **Il cuore della richiesta.** Montare l'editor con un percorso pronto non deve far
   * partire nulla: nessun effetto, nessun timer, nessuna soglia «tanto sono poche».
   */
  test('montare l editor NON scarica niente da se', async () => {
    useItineraryStore.setState({ ...statoItinerario({ appMode: 'track' }), waypoints: [wp(0), wp(1), wp(2)] });
    render(<ActionBar />);
    // Si concede tempo a qualunque effetto di scattare, poi si conta.
    await waitFor(() => expect(screen.getByRole('button', { name: /Mappa offline/i })).toBeInTheDocument());
    expect(richiesteTessere).toHaveLength(0);
  });

  test('premendolo, le mattonelle del percorso vengono chieste', async () => {
    useItineraryStore.setState({ ...statoItinerario({ appMode: 'track' }), waypoints: [wp(0), wp(1)] });
    render(<ActionBar />);
    fireEvent.click(screen.getByRole('button', { name: /Mappa offline/i }));
    await waitFor(() => expect(richiesteTessere.length).toBeGreaterThan(0), { timeout: 5000 });
    // Sono le mattonelle della mappa base scelta, non di un'altra.
    expect(richiesteTessere.every((u) => /tile\.openstreetmap\.org/.test(u))).toBe(true);
  });

  /**
   * Il promemoria esiste perché il gesto è manuale: se non si ricorda, in quota si arriva
   * senza mappa. Ma **solo quando c'è qualcosa da scaricare** — un suggerimento sempre
   * presente diventa arredamento e nessuno lo legge più.
   */
  test('il promemoria compare quando c e un percorso', () => {
    useItineraryStore.setState({ ...statoItinerario({ appMode: 'track' }), waypoints: [wp(0), wp(1)] });
    render(<ActionBar />);
    expect(screen.getByText(/Prima di partire/i)).toBeInTheDocument();
  });

  test('e non compare a itinerario vuoto', () => {
    render(<ActionBar />);
    expect(screen.queryByText(/Prima di partire/i)).not.toBeInTheDocument();
  });

  /** In Imparo non si va in montagna: il pulsante e il promemoria non c'entrano. */
  test('in Imparo non compare', () => {
    useUIStore.setState({ profilo: 'imparo' });
    useItineraryStore.setState({ ...statoItinerario({ appMode: 'track' }), waypoints: [wp(0), wp(1)] });
    render(<ActionBar />);
    expect(screen.queryByRole('button', { name: /Mappa offline/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Prima di partire/i)).not.toBeInTheDocument();
  });
});

/**
 * **Lo scaricamento è uno, e lo vedono tutti e due i pannelli.**
 *
 * `useTessereOffline` calcola in un posto solo — è la correzione che ha evitato che il
 * numero mostrato divergesse da quello scaricato — ma lo **stato** era per istanza: un
 * `useState` per componente. Con l'editor e le impostazioni mappa montati insieme (aprire
 * il dialogo non smonta l'editor) si otteneva:
 *
 * - il pannello mostrava «Scarica per l'uso senza rete» mentre l'editor stava scaricando;
 * - premendolo partiva un **secondo** scaricamento in parallelo, cioè il doppio del
 *   traffico su servizi gratuiti — la cosa che tutto questo codice dichiara di volere
 *   evitare;
 * - «libera» restava attivo, quindi si poteva svuotare la cache a metà di uno
 *   scaricamento in corso.
 *
 * È la stessa lezione di prima, applicata allo stato invece che al calcolo: due copie
 * della stessa verità divergono.
 */
describe('lo scaricamento e uno solo, condiviso', () => {
  /** Due componenti che usano il hook, montati insieme come nell'app. */
  function DuePannelli() {
    const a = useTessereOffline();
    const b = useTessereOffline();
    return (
      <div>
        <button onClick={() => { void a.scarica(); }}>avvia da A</button>
        <span data-testid="stato-a">{a.inCorso ? 'in corso' : 'fermo'}</span>
        <span data-testid="stato-b">{b.inCorso ? 'in corso' : 'fermo'}</span>
      </div>
    );
  }

  test('avviandolo da un pannello, anche l altro lo sa', async () => {
    useItineraryStore.setState({ ...statoItinerario({ appMode: 'track' }), waypoints: [wp(0), wp(1)] });
    // Una risposta che non si risolve subito: cosi' si osserva lo stato "in corso".
    /*
      Un contenitore e non una variabile: TypeScript non sa che la callback gira, quindi
      restringerebbe la variabile a `null` e la chiamata finale non compilerebbe.
    */
    const rilascia: { fn?: () => void } = {};
    global.fetch = jest.fn(() => new Promise((res) => {
      rilascia.fn = () => res({ ok: true, status: 200, type: 'cors' } as unknown as Response);
    })) as unknown as typeof fetch;

    render(<DuePannelli />);
    fireEvent.click(screen.getByText('avvia da A'));

    await waitFor(() => expect(screen.getByTestId('stato-a').textContent).toBe('in corso'));
    expect(screen.getByTestId('stato-b').textContent).toBe('in corso');
    rilascia.fn?.();
  });
});
