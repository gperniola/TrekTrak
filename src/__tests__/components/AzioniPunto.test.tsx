import { render, screen } from '@testing-library/react';
import { AzioniPunto, BottoneAzioniPunto } from '@/components/weather/AzioniPunto';
import { SOGLIE_MODELLO, type RigaPercorso } from '@/lib/route-weather';

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
  const riga = (over: Partial<RigaPercorso> = {}): RigaPercorso => ({
    waypointIndex: 0, name: 'Blockhaus', lat: 42.2, lon: 14.28,
    alt: 2145, modelElevation: 1257, arrival: null,
    hour: { time: 't', cape: 1390, weatherCode: 3, gusts: 32, precipProb: 28, temp: 12, mm: 0.2 },
    classification: { level: 2, reasons: [] },
    ...over,
  });

  test('il link dice cosa fa e per quale punto', () => {
    render(<AzioniPunto riga={riga()} soglie={SOGLIE_MODELLO.ecmwf} />);
    const voce = screen.getByRole('link', { name: /Leggi previsione Meteoblue per «Blockhaus»/i });
    expect(voce).toHaveAttribute('href', 'https://www.meteoblue.com/it/tempo/settimana/42.200N14.280E');
    expect(voce).toHaveAttribute('target', '_blank');
    // `noopener`: senza, la pagina aperta può manipolare quella che l'ha aperta.
    expect(voce.getAttribute('rel')).toContain('noopener');
  });

  /**
   * I numeri tolti dalla tabella non sono nascosti: chi vuole capire **perché** un punto è
   * arancione li trova qui. Il CAPE su tutti, che dalla tabella è sparito perché a colpo
   * d'occhio non dice niente a chi cammina.
   */
  test('mostra i numeri che la tabella non porta: CAPE e quota del modello', () => {
    render(<AzioniPunto riga={riga()} soglie={SOGLIE_MODELLO.ecmwf} />);
    expect(screen.getByText('CAPE')).toBeInTheDocument();
    expect(screen.getByText('1.390 J/kg')).toBeInTheDocument();
    expect(screen.getByText('1.257 m')).toBeInTheDocument();
  });

  test('un dato che manca si dichiara, non si scrive zero', () => {
    render(<AzioniPunto riga={riga({ hour: null, modelElevation: null })} soglie={SOGLIE_MODELLO.ecmwf} />);
    expect(screen.getAllByText('n/d')).toHaveLength(2);
  });

  /** Senza coordinate non c'è pagina da aprire: si dichiara, non si offre un link morto. */
  test('coordinate non valide: lo dice, invece di offrire un collegamento inerte', () => {
    render(<AzioniPunto riga={riga({ lat: Number.NaN })} soglie={SOGLIE_MODELLO.ecmwf} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Coordinate non disponibili/i)).toBeInTheDocument();
  });
});

/**
 * **Perché l'iconcina non è quella del codice, detto nel posto giusto.**
 *
 * L'utente ha chiesto «pioggia 78%… e l'iconcina dice sereno, perché?». La risposta non
 * può stare solo nel manuale: sta nel dettaglio della riga di quel punto.
 */
describe('AzioniPunto spiega il disaccordo fra corsa e probabilità', () => {
  const conCielo = (weatherCode: number, precipProb: number): RigaPercorso => ({
    waypointIndex: 0, name: 'Appia', lat: 40.83, lon: 16.50, alt: 400, modelElevation: 400,
    arrival: null,
    hour: { time: 't', cape: 1850, weatherCode, gusts: 31, precipProb, temp: 24, mm: 0 },
    classification: { level: 3, reasons: [] },
  });

  test('quando l\'iconcina segue la probabilità, dice cosa aveva detto la corsa', () => {
    render(<AzioniPunto riga={conCielo(0, 78)} soglie={SOGLIE_MODELLO.ecmwf} />);
    const testo = document.body.textContent ?? '';
    expect(testo).toMatch(/la corsa del modello dà «sereno»/i);
    expect(testo).toMatch(/78%/);
  });

  test('quando corsa e probabilità concordano, non c\'è niente da spiegare', () => {
    render(<AzioniPunto riga={conCielo(0, 5)} soglie={SOGLIE_MODELLO.ecmwf} />);
    expect(document.body.textContent).not.toMatch(/la corsa del modello/i);
  });
});
