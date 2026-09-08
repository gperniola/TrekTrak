import { render, screen, fireEvent } from '@testing-library/react';
import { SpiegazioneCriticita } from '@/components/weather/SpiegazioneCriticita';

/**
 * Il popup che spiega i livelli di criticità del meteo del percorso: chiuso di default,
 * si apre dal link ⓘ e mostra la scala, gli eventi con le soglie e il verdetto.
 */
describe('SpiegazioneCriticita', () => {
  test('di default il popup è chiuso, c’è solo il link', () => {
    render(<SpiegazioneCriticita />);
    expect(screen.getByRole('button', { name: /livelli di criticità/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('il link apre il popup con la scala e le soglie', () => {
    render(<SpiegazioneCriticita />);
    fireEvent.click(screen.getByRole('button', { name: /livelli di criticità/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // La scala ("Rischio alto" ricorre anche nella colonna Grado degli eventi)
    expect(screen.getAllByText('Rischio alto').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Nessuna criticità')).toBeInTheDocument();
    // Una soglia numerica (raffiche pericolose)
    expect(screen.getByText(/≥ 70 km\/h/)).toBeInTheDocument();
    // La regola del CAPE (energia, non evento)
    expect(screen.getByText(/CAPE ≥ 800 e pioggia ≥ 30%/)).toBeInTheDocument();
  });

  test('la ✕ chiude il popup', () => {
    render(<SpiegazioneCriticita />);
    fireEvent.click(screen.getByRole('button', { name: /livelli di criticità/i }));
    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
