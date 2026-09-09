import { render, screen } from '@testing-library/react';
import { AzioniPunto, BottoneAzioniPunto } from '@/components/weather/AzioniPunto';

/**
 * **Le azioni di un punto del meteo.**
 *
 * Era una tendina in posizione assoluta. Misurato il 2026-09-09: dentro il contenitore
 * della tabella (`overflow-x: auto`, che forza anche `overflow-y`) il menu dell'ultima
 * riga sbordava di 52 px e veniva ritagliato. Ora è un blocco rivelato in una riga sotto —
 * niente da ritagliare — e l'ARIA dichiara quel che è davvero: un `aria-expanded`, non un
 * `role="menu"` senza gestione del fuoco.
 */
describe('BottoneAzioniPunto', () => {
  test('dice di che punto è: al tocco non esiste nessun title da leggere', () => {
    render(<BottoneAzioniPunto nome="Blockhaus" aperto={false} idPannello="p1" onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /Blockhaus/ })).toBeInTheDocument();
  });

  test('dichiara se il dettaglio è aperto, e quale blocco comanda', () => {
    const { rerender } = render(
      <BottoneAzioniPunto nome="Blockhaus" aperto={false} idPannello="p1" onToggle={() => {}} />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button')).toHaveAttribute('aria-controls', 'p1');
    rerender(<BottoneAzioniPunto nome="Blockhaus" aperto idPannello="p1" onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('AzioniPunto', () => {
  test('offre Meteoblue per QUEL punto', () => {
    render(<AzioniPunto lat={42.2} lon={14.28} nome="Blockhaus" />);
    const voce = screen.getByRole('link', { name: /Meteoblue/i });
    expect(voce).toHaveAttribute('href', 'https://www.meteoblue.com/it/tempo/settimana/42.200N14.280E');
    expect(voce).toHaveAttribute('target', '_blank');
    // `noopener`: senza, la pagina aperta può manipolare quella che l'ha aperta.
    expect(voce.getAttribute('rel')).toContain('noopener');
  });

  /** Senza coordinate non c'è pagina da aprire: si dichiara, non si offre un link morto. */
  test('coordinate non valide: lo dice, invece di offrire un collegamento inerte', () => {
    render(<AzioniPunto lat={Number.NaN} lon={14.28} nome="Ignoto" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/coordinate non disponibili/i)).toBeInTheDocument();
  });
});
