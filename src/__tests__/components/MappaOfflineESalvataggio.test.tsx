import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import { statoItinerario, wp } from '../fixtures/itinerario';

import { MappaOffline } from '@/components/settings/MappaOffline';
import { SaveRouteModal } from '@/components/panel/SaveRouteModal';

/**
 * **Due file che nessun test nominava, e che dicono numeri prima di agire.**
 *
 * `MappaOffline` e' il pannello che promette *quante* mattonelle scarichera' e *quanto*
 * occuperanno: e' l'unico posto dell'app che fa una previsione su una risorsa altrui, e la
 * v0.11.x ha gia' pagato una volta il conto che divergeva dal lavoro (35 dichiarate, 70
 * scaricate). `SaveRouteModal` e' la porta della libreria condivisa.
 */

const fetchOriginale = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true, status: 200,
    headers: new Headers({ 'content-length': '15000' }),
    blob: () => Promise.resolve(new Blob(['x'])),
  } as unknown as Response)) as unknown as typeof fetch;
  useItineraryStore.setState(statoItinerario({ appMode: 'track' }));
});

afterEach(() => { global.fetch = fetchOriginale; jest.restoreAllMocks(); });

describe('MappaOffline: dice quanto costa prima di scaricare', () => {
  /**
   * **Il motivo va scritto, non lasciato a un pulsante grigio.** E' la lezione della
   * v0.11.8: al tocco i `title` non esistono, quindi un controllo spento senza una frase
   * accanto e' un vicolo cieco.
   */
  test('senza waypoint dice cosa manca, invece di mostrare un pulsante spento', () => {
    useItineraryStore.setState(statoItinerario({ waypoints: [] }));
    render(<MappaOffline />);
    expect(screen.getByText(/Aggiungi almeno un waypoint con coordinate/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Scarica/ })).not.toBeInTheDocument();
  });

  test('con un percorso dice quante mattonelle e su che area', () => {
    useItineraryStore.setState(statoItinerario({ waypoints: [wp(0), wp(1)] }));
    render(<MappaOffline />);
    // 67 mattonelle per due punti a un chilometro: il numero e' quello che verra' chiesto.
    expect(screen.getByText(/^\d+ mattonelle$/)).toBeInTheDocument();
    expect(screen.getByText(/su un’area di/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scarica/ })).toBeEnabled();
  });

  /** Il peso stimato prima, non a scaricamento avviato: e' il numero su cui si decide. */
  test('dice anche quanto occuperanno', () => {
    useItineraryStore.setState(statoItinerario({ waypoints: [wp(0), wp(1)] }));
    render(<MappaOffline />);
    expect(screen.getByText(/Occuperanno circa/)).toBeInTheDocument();
  });

  /**
   * Il tetto per servizio non e' una difesa dal nostro codice: e' un patto con chi ci
   * regala le mappe, e va detto **fin dove** si arriva.
   */
  test('dichiara il limite di zoom e la scadenza', () => {
    useItineraryStore.setState(statoItinerario({ waypoints: [wp(0), wp(1)] }));
    render(<MappaOffline />);
    expect(screen.getByText(/Si scaricano gli zoom da/)).toBeInTheDocument();
    expect(screen.getByText(/scadono dopo trenta giorni/)).toBeInTheDocument();
  });

  /**
   * **Tre stati, non due**: `undefined` è «non lo so ancora», `null` è «non si può
   * sapere». Confonderli faceva comparire «Spazio non interrogabile su questo browser» per
   * oltre un secondo a ogni apertura — un messaggio definitivo per uno stato transitorio.
   */
  test('mentre conta non dice che lo spazio non si puo sapere', () => {
    useItineraryStore.setState(statoItinerario({ waypoints: [wp(0), wp(1)] }));
    render(<MappaOffline />);
    expect(screen.getByText(/Conto le mappe conservate/)).toBeInTheDocument();
    expect(screen.queryByText(/non interrogabile/)).not.toBeInTheDocument();
  });

  test('finito il conto, dice cosa c e conservato', async () => {
    useItineraryStore.setState(statoItinerario({ waypoints: [wp(0), wp(1)] }));
    render(<MappaOffline />);
    await waitFor(() => {
      expect(screen.queryByText(/Conto le mappe conservate/)).not.toBeInTheDocument();
    });
  });

  /** Senza mattonelle conservate non c'e' niente da liberare, quindi nessun pulsante. */
  test('senza niente conservato non compare il pulsante libera', async () => {
    useItineraryStore.setState(statoItinerario({ waypoints: [wp(0), wp(1)] }));
    render(<MappaOffline />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'libera' })).not.toBeInTheDocument();
    });
  });
});

describe('SaveRouteModal', () => {
  const apri = (nomeIniziale = 'Cima delle Murelle') => {
    const salvati: { nome: string; note: string }[] = [];
    let chiuso = false;
    render(
      <SaveRouteModal
        initialName={nomeIniziale}
        onConfirm={(nome, note) => salvati.push({ nome, note })}
        onClose={() => { chiuso = true; }}
      />,
    );
    return { salvati, chiuso: () => chiuso };
  };

  test('parte dal nome dell itinerario', () => {
    apri();
    expect(screen.getByDisplayValue('Cima delle Murelle')).toBeInTheDocument();
  });

  test('salva titolo e note', () => {
    const { salvati } = apri();
    fireEvent.change(screen.getByDisplayValue('Cima delle Murelle'), {
      target: { value: 'Murelle da Fara' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'Ghiaia sull’ultimo tratto' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(salvati).toEqual([{ nome: 'Murelle da Fara', note: 'Ghiaia sull’ultimo tratto' }]);
  });

  /**
   * **Un titolo di soli spazi non e' un titolo.** Nella libreria condivisa un percorso
   * senza nome sarebbe una riga vuota in un elenco che altri leggono: si scrive «Senza
   * nome», che almeno si puo' cercare e rinominare.
   */
  test('un titolo vuoto o di soli spazi diventa Senza nome', () => {
    const { salvati } = apri('');
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(salvati[0].nome).toBe('Senza nome');
  });

  test('gli spazi intorno al titolo si tolgono', () => {
    const { salvati } = apri('  Murelle  ');
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(salvati[0].nome).toBe('Murelle');
  });

  test('Annulla non salva niente', () => {
    const { salvati, chiuso } = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(salvati).toEqual([]);
    expect(chiuso()).toBe(true);
  });

  test('Escape chiude', () => {
    const { chiuso } = apri();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(chiuso()).toBe(true);
  });

  /**
   * I limiti di lunghezza stanno sui campi, non su un controllo che rifiuta dopo: un
   * campo che accetta e poi butta e' il modo di far riscrivere tutto a chi ha finito.
   */
  test('titolo e note hanno un tetto di lunghezza dichiarato al campo', () => {
    apri();
    expect(screen.getAllByRole('textbox')[0]).toHaveAttribute('maxlength', '200');
    expect(screen.getAllByRole('textbox')[1]).toHaveAttribute('maxlength', '2000');
  });
});
