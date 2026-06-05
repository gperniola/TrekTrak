import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';

beforeEach(() => {
  localStorage.clear();
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
    expect(screen.getByText(/di 8/)).toBeInTheDocument();
  });
});
