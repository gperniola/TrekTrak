import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  localStorage.clear();
  // I passi seguono il profilo d'uso (review 3 della v0.15.0): questi due casi guardano
  // la meccanica della continuazione opzionale, quindi il profilo va fissato.
  useUIStore.setState({ profilo: 'imparo' });
});

describe('LearnTutorial (TASK-43)', () => {
  test('al primo avvio mostra 4 passi essenziali', () => {
    render(<LearnTutorial />);
    expect(screen.getByText(/Passo 1 di 4/)).toBeInTheDocument();
  });

  /**
   * **Il benvenuto dice il ciclo dell'app**: tocca la mappa, completa nell'Editor, guarda
   * il meteo. E' la prima frase letta in assoluto, e deve rispondere a «cosa ci faccio,
   * qui?» prima di ogni altra cosa (chiesto dall'utente il 2026-09-05).
   */
  test('il benvenuto spiega il ciclo: tocca, completa, meteo', () => {
    render(<LearnTutorial />);
    const testo = screen.getByRole('dialog').textContent ?? '';
    expect(testo).toContain('toccando la mappa');
    expect(testo).toContain('Editor');
    expect(testo).toContain('meteo');
  });

  /**
   * L'animazione dei primi passi e' **decorativa** (`aria-hidden`): la spiegazione vera
   * e' il testo, e per un lettore di schermo un SVG muto in mezzo al benvenuto sarebbe
   * solo rumore. La regola e' la stessa dei pallini di stato e delle iconcine del cielo.
   */
  test('l animazione del benvenuto c e, ed e decorativa', () => {
    const { container } = render(<LearnTutorial />);
    const animazione = container.querySelector('.ppp-linea');
    expect(animazione).not.toBeNull();
    expect(animazione!.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  /** L'animazione appartiene al benvenuto: al passo dopo non c'e' piu'. */
  test('al secondo passo l animazione non c e', () => {
    const { container } = render(<LearnTutorial />);
    fireEvent.click(screen.getByText('Avanti'));
    expect(container.querySelector('.ppp-linea')).toBeNull();
  });

  test('le funzionalità avanzate restano accessibili dalla continuazione', () => {
    render(<LearnTutorial />);
    // Avanza fino all'ultimo passo essenziale (0 -> 3)
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText('Avanti'));
    // Sull'ultimo essenziale appare la continuazione opzionale
    fireEvent.click(screen.getByText(/Altre funzionalità/));
    // 10 passi in Imparo: i 4 essenziali piu' la carta della palestra (che mostra lo
    // stato anche qui), strumenti, quiz, impostazioni, profilo e offline. Restano fuori
    // «Pronto per la gita» (layer di emergenza) e «Condividi» (export), di Montagna.
    expect(screen.getByText(/di 10/)).toBeInTheDocument();
  });
});
