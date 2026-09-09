import { render, screen, fireEvent } from '@testing-library/react';
import { ComeSiLegge } from '@/components/weather/ComeSiLegge';
import { SOGLIE_MODELLO } from '@/lib/route-weather';

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
    // una soglia degli eventi — il numero si LEGGE dalla costante, non si riscrive:
    // era «30%» a mano, ed è rimasto indietro quando le soglie sono diventate per modello.
    expect(
      screen.getByText(new RegExp(`CAPE ≥ 800 e pioggia ≥ ${SOGLIE_MODELLO.ecmwf.arancione}%`)),
    ).toBeInTheDocument();
    // la meteorologia (regola 30/30)
    expect(screen.getByText(/Regola 30\/30/)).toBeInTheDocument();
  });
});

/**
 * **La spiegazione non può divergere dal giudizio.**
 *
 * Alla v0.31.0 le soglie sono diventate per modello e questa schermata è rimasta indietro:
 * diceva «pioggia ≥ 70% → Attenzione» mentre il codice scattava a 32 (ECMWF) o 10 (ICON),
 * e prometteva una colonna CAPE che era stata tolta. È la sola schermata che documenta le
 * regole: se mente, mente sull'unica cosa che spiega. Ora i numeri li **legge** dalle
 * stesse costanti del giudizio, e questi test lo verificano per entrambi i modelli.
 */
describe('le soglie spiegate sono quelle vere', () => {
  const apri = () => fireEvent.click(screen.getByRole('button', { name: /Come si legge/i }));

  test.each([
    ['ecmwf' as const, SOGLIE_MODELLO.ecmwf],
    ['icon' as const, SOGLIE_MODELLO.icon],
  ])('con %s scrive le sue soglie, non quelle di un altro', (modello, soglie) => {
    render(<ComeSiLegge modello={modello} />);
    apri();
    const testo = document.body.textContent ?? '';
    expect(testo).toContain(`≥ ${soglie.arancione}%`);
    expect(testo).toContain(`${soglie.giallo}–${soglie.arancione - 1}%`);
  });

  test('non promette più il CAPE in tabella: quella colonna non esiste', () => {
    render(<ComeSiLegge />);
    apri();
    expect(document.body.textContent).not.toMatch(/vedi\s+comunque in tabella/i);
  });

  test('i codici di precipitazione sono elencati fra gli eventi', () => {
    render(<ComeSiLegge />);
    apri();
    const testo = document.body.textContent ?? '';
    expect(testo).toMatch(/rovesci deboli/i);
    expect(testo).toMatch(/che gela/i);
  });
});
