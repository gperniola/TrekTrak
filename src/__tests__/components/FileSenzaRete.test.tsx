import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import { statoItinerario } from '../fixtures/itinerario';

jest.mock('@/lib/export-pdf', () => ({ downloadPDF: jest.fn() }));
jest.mock('@/lib/export-gpx', () => ({ downloadGPX: jest.fn() }));

import { IncollaCoordinate } from '@/components/shared/IncollaCoordinate';
import { LegCard } from '@/components/panel/LegCard';
import { indicatoreStato } from '@/components/map/emergency/EmergencyLayerRow';
import type { Leg } from '@/lib/types';

/**
 * **I file con logica dentro e senza rete di protezione.**
 *
 * L'analisi del 2026-09-04 ne ha contati ventisei senza un test che li nominasse. La
 * maggioranza sono presentazionali — `BrandMark`, `SheetHandle`, `Toast` — e quelli li
 * copre l'occhio: un test che verifica che un `div` abbia una classe non aggiunge niente.
 * Questi tre invece **decidono**, e ogni decisione e' visibile a chi usa l'app.
 */

beforeEach(() => {
  useItineraryStore.setState(statoItinerario());
});

describe('IncollaCoordinate: si vede dove finira il punto', () => {
  /**
   * E' la ragione per cui questo pannello esiste: una coordinata indovinata male sposta il
   * waypoint in un altro posto **senza dirlo**, quindi il parser rifiuta invece di
   * approssimare, e l'anteprima mostra cosa ha capito prima che si prema qualcosa.
   */
  const apri = () => {
    const ricevute: { lat: number; lon: number }[] = [];
    render(<IncollaCoordinate onCoordinate={(c) => ricevute.push(c)} />);
    fireEvent.click(screen.getByLabelText('Incolla coordinate'));
    return ricevute;
  };

  test('a campo vuoto spiega cosa si puo scrivere', () => {
    apri();
    expect(screen.getByRole('status').textContent).toContain('Gradi decimali');
  });

  test('gradi decimali con la virgola diventano un anteprima', () => {
    apri();
    fireEvent.change(screen.getByLabelText('Coordinate da incollare'), {
      target: { value: '42,4419 13,5595' },
    });
    expect(screen.getByRole('status').textContent).toContain('42,4419');
    expect(screen.getByRole('status').textContent).toContain('13,5595');
  });

  test('gradi primi e secondi pure', () => {
    apri();
    fireEvent.change(screen.getByLabelText('Coordinate da incollare'), {
      target: { value: '42° 26\' 30" N, 13° 33\' 34" E' },
    });
    expect(screen.getByRole('status').textContent).toContain('42,44');
  });

  /** Quello che non si capisce si dice, e il pulsante resta spento. */
  test('un testo che non e una coordinata lo dichiara, e il pulsante resta spento', () => {
    apri();
    fireEvent.change(screen.getByLabelText('Coordinate da incollare'), {
      target: { value: 'dietro il rifugio' },
    });
    expect(screen.getByRole('status').textContent).toContain('Non riconosciuto');
    expect(screen.getByRole('button', { name: 'Posiziona qui' })).toBeDisabled();
  });

  test('premendo Posiziona qui la coordinata arriva a chi l ha chiesta', () => {
    const ricevute = apri();
    fireEvent.change(screen.getByLabelText('Coordinate da incollare'), {
      target: { value: '42,4419 13,5595' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Posiziona qui' }));
    expect(ricevute).toHaveLength(1);
    expect(ricevute[0].lat).toBeCloseTo(42.4419, 4);
    expect(ricevute[0].lon).toBeCloseTo(13.5595, 4);
  });

  test('Invio fa la stessa cosa del pulsante', () => {
    const ricevute = apri();
    const campo = screen.getByLabelText('Coordinate da incollare');
    fireEvent.change(campo, { target: { value: '42,4419 13,5595' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(ricevute).toHaveLength(1);
  });

  /** Invio su un testo illeggibile non deve inventare un punto. */
  test('Invio su un testo illeggibile non fa niente', () => {
    const ricevute = apri();
    const campo = screen.getByLabelText('Coordinate da incollare');
    fireEvent.change(campo, { target: { value: 'boh' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(ricevute).toEqual([]);
  });

  test('dopo aver posizionato, il pannello si chiude', () => {
    apri();
    fireEvent.change(screen.getByLabelText('Coordinate da incollare'), {
      target: { value: '42,4419 13,5595' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Posiziona qui' }));
    expect(screen.queryByLabelText('Coordinate da incollare')).not.toBeInTheDocument();
  });
});

describe('LegCard: in Pianificazione i valori li calcola l app', () => {
  const tratta: Leg = {
    id: 'l1', fromWaypointId: 'a', toWaypointId: 'b',
    distance: 3.2, elevationGain: 450, elevationLoss: 120, azimuth: 275,
    estimatedTime: 90, slope: 14.1,
  };

  /**
   * I quattro campi sono in sola lettura in Pianificazione e scrivibili in Imparo: e' la
   * distinzione su cui e' costruita tutta l'app — in Imparo l'utente calcola a mano e
   * l'app giudica, in Pianificazione calcola l'app.
   */
  /*
    Le etichette per esteso, senza espressioni regolari: `D+` in una regex vuol dire «una
    o piu' D», quindi pescava anche «Dist» e il test moriva su «piu' di un elemento».
  */
  const CAMPI = ['Dist (km)', 'Azim. (°)', 'D+ (m)', 'D- (m)'];

  test('in Imparo i quattro campi si scrivono', () => {
    useItineraryStore.setState(statoItinerario({ appMode: 'learn' }));
    render(<LegCard leg={tratta} />);
    for (const etichetta of CAMPI) {
      expect(screen.getByLabelText(etichetta)).not.toHaveAttribute('readonly');
    }
  });

  test('in Pianificazione sono in sola lettura', () => {
    useItineraryStore.setState(statoItinerario({ appMode: 'track' }));
    render(<LegCard leg={tratta} />);
    for (const etichetta of CAMPI) {
      expect(screen.getByLabelText(etichetta)).toHaveAttribute('readonly');
    }
  });

  test('tempo e pendenza compaiono coi formati italiani', () => {
    render(<LegCard leg={tratta} />);
    expect(screen.getByText(/Pendenza: 14,1%/)).toBeInTheDocument();
    expect(screen.getByText(/Tempo: 1h 30m/)).toBeInTheDocument();
  });

  /**
   * **Difetto: i punti cardinali sono in inglese.**
   *
   * `azimuthToCardinal(275)` risponde `W`, non `O`. In un'app italiana che insegna la
   * cartografia a mano — dove i punti cardinali sono proprio il vocabolario che si sta
   * imparando — la rosa dei venti si legge N, NE, E, SE, S, SO, O, NO: sulla bussola e
   * sulla carta italiana l'ovest e' segnato **O**. Compare in sei posti: la scheda della
   * tratta, la tabella, il righello, la riga di Pianificazione e i due PDF.
   *
   * Marcato `failing`: descrive il comportamento giusto, che arriva nel commit dopo.
   */
  test.failing('la direzione e in italiano', () => {
    render(<LegCard leg={tratta} />);
    expect(screen.getByText(/Dir: O/)).toBeInTheDocument();
  });

  /** Un derivato che non c'e' non si scrive a zero: non si scrive. */
  test('senza tempo, pendenza e azimut non compare nessuna riga derivata', () => {
    render(<LegCard leg={{ ...tratta, estimatedTime: undefined, slope: undefined, azimuth: null }} />);
    expect(screen.queryByText(/Tempo:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pendenza:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dir:/)).not.toBeInTheDocument();
  });
});

/**
 * **Il pallino di stato di un layer di emergenza, e la sua parola.**
 *
 * Otto rami, tutti visibili a chi usa l'app, e nessun test: e' il pallino che dice se
 * quello che si vede sulla mappa e' fresco, vecchio, parziale o rotto. La parola conta
 * quanto il colore, perche' il pallino e' `aria-hidden` e la parola e' l'unica cosa che
 * arriva a un lettore di schermo.
 */
describe('indicatoreStato', () => {
  const pronto = { status: 'ready' };

  test('a layer spento non c e nessun pallino', () => {
    expect(indicatoreStato(false, pronto, true, false)).toBeNull();
  });

  /**
   * **Offline vince su tutto.** I dati di emergenza sono esclusi dalla cache di proposito:
   * senza rete non sono vecchi, non ci sono. Dirlo «errore» farebbe cercare un guasto.
   */
  test('senza rete lo dice, e non parla di errori', () => {
    const i = indicatoreStato(true, { status: 'error' }, false, false);
    expect(i?.parola).toBe('non disponibile offline');
  });

  test('in caricamento pulsa', () => {
    const i = indicatoreStato(true, { status: 'loading' }, true, false);
    expect(i?.parola).toBe('in caricamento');
    expect(i?.classe).toContain('animate-pulse');
  });

  test('un errore e rosso', () => {
    expect(indicatoreStato(true, { status: 'error' }, true, false)).toEqual({
      classe: 'bg-red-500', parola: 'errore',
    });
  });

  /** «Nessun dato» non e' un guasto: la fonte ha risposto e non c'era niente. */
  test('nessun dato e ambra, non rosso', () => {
    const i = indicatoreStato(true, { status: 'nodata' }, true, false);
    expect(i?.parola).toBe('nessun dato');
    expect(i?.classe).toContain('amber');
  });

  test('dati parziali sono ambra', () => {
    const i = indicatoreStato(true, { status: 'ready', partial: true }, true, false);
    expect(i?.parola).toBe('dati parziali');
  });

  test('dati vecchi sono ambra', () => {
    const i = indicatoreStato(true, pronto, true, true);
    expect(i?.parola).toBe('dati non aggiornati');
  });

  test('solo tutto a posto e verde', () => {
    expect(indicatoreStato(true, pronto, true, false)).toEqual({
      classe: 'bg-green-500', parola: 'aggiornato',
    });
  });

  /**
   * **Parziale ha la precedenza su vecchio**: dei due e' quello che dice qualcosa sul
   * CONTENUTO della mappa — manca della roba — mentre «vecchio» parla solo dell'orario.
   */
  test('parziale e vecchio insieme dicono parziale', () => {
    const i = indicatoreStato(true, { status: 'ready', partial: true }, true, true);
    expect(i?.parola).toBe('dati parziali');
  });

  test('un layer acceso ma non ancora partito non ha pallino', () => {
    expect(indicatoreStato(true, { status: 'idle' }, true, false)).toBeNull();
  });
});
