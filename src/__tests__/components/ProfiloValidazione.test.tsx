import { render, screen } from '@testing-library/react';
import { ValidationBadge } from '@/components/validation/ValidationBadge';
import { useUIStore } from '@/stores/uiStore';
import type { ValidationResult } from '@/lib/types';

const risultato: ValidationResult = {
  status: 'error', realValue: 3.161, userValue: 2.4, delta: 0.761,
  tolerance: { strict: 0.05, loose: 0.1 },
};

/**
 * In Montagna i valori li calcola l'app: non c'e' nulla da verificare, e i badge
 * sarebbero venti pulsanti che non fanno niente di utile.
 *
 * Una guardia sola nel badge invece di una in ogni scheda: il badge e' l'unico punto da
 * cui la validazione arriva a schermo, e cosi' non se ne dimentica una.
 */
describe('i badge di validazione per profilo', () => {
  test('in Imparo il badge c e', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ValidationBadge result={risultato} fieldType="distance" />);
    expect(screen.getByRole('button', { name: /valore sbagliato/i })).toBeInTheDocument();
  });

  test('in Montagna non c e', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ValidationBadge result={risultato} fieldType="distance" />);
    expect(screen.queryByRole('button', { name: /valore sbagliato/i })).not.toBeInTheDocument();
  });

  /** Anche il suggerimento didattico vive nel popover del badge: sparisce con lui. */
  test('in Montagna non compare nemmeno il suggerimento', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ValidationBadge result={risultato} fieldType="distance" />);
    expect(screen.queryByText(/scala corretta/i)).not.toBeInTheDocument();
  });
});
