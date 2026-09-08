import { render, screen, fireEvent } from '@testing-library/react';
import { ComeSiLegge } from '@/components/weather/ComeSiLegge';

/**
 * «Come si legge» ora raccoglie sia i livelli di criticità (prima in un popup a parte)
 * sia la meteorologia: chiuso di default, all'apertura mostra scala, soglie e spiegazioni.
 */
describe('ComeSiLegge', () => {
  test('chiuso di default: c’è solo il pulsante', () => {
    render(<ComeSiLegge />);
    expect(screen.getByRole('button', { name: /come si legge/i })).toBeInTheDocument();
    expect(screen.queryByText('Rischio alto')).not.toBeInTheDocument();
  });

  test('aperto: la scala, le soglie e la meteorologia', () => {
    render(<ComeSiLegge />);
    fireEvent.click(screen.getByRole('button', { name: /come si legge/i }));
    // la scala dei livelli
    expect(screen.getByText('Nessuna criticità')).toBeInTheDocument();
    expect(screen.getAllByText('Rischio alto').length).toBeGreaterThanOrEqual(1);
    // una soglia degli eventi
    expect(screen.getByText(/CAPE ≥ 800 e pioggia ≥ 30%/)).toBeInTheDocument();
    // la meteorologia (regola 30/30)
    expect(screen.getByText(/Regola 30\/30/)).toBeInTheDocument();
  });
});
