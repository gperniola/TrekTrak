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

  test('le funzionalità avanzate restano accessibili dalla continuazione', () => {
    render(<LearnTutorial />);
    // Avanza fino all'ultimo passo essenziale (0 -> 3)
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText('Avanti'));
    // Sull'ultimo essenziale appare la continuazione opzionale
    fireEvent.click(screen.getByText(/Altre funzionalità/));
    // 9 passi in Imparo: i 4 essenziali piu' strumenti, quiz, impostazioni, profilo e
    // offline. Restano fuori «Pronto per la gita» (layer di emergenza) e «Condividi»
    // (export), che sono di Montagna.
    expect(screen.getByText(/di 9/)).toBeInTheDocument();
  });
});
