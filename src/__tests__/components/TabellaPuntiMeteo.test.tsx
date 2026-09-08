import { render, screen } from '@testing-library/react';
import { TabellaPuntiMeteo } from '@/components/weather/TabellaPuntiMeteo';
import type { RigaPercorso } from '@/lib/route-weather';

/**
 * **Il rendering delle soste in tabella.**
 *
 * La logica che sdoppia una sosta lunga in arrivo/ripartenza sta in `route-weather` ed è
 * provata lì; qui si guarda che la tabella lo *mostri* — etichette giuste e due righe
 * distinte per lo stesso punto (chiave composita, altrimenti React ne disegna una sola).
 */

const rigaBase = (over: Partial<RigaPercorso>): RigaPercorso => ({
  waypointIndex: 0, name: 'Punto', alt: 1000, modelElevation: 1000,
  arrival: null, hour: null,
  classification: { level: 0, reasons: [] },
  ...over,
});

describe('TabellaPuntiMeteo e le soste', () => {
  test('sosta breve (una riga): annota «⏸ sosta 20 min» sul punto', () => {
    render(<TabellaPuntiMeteo righe={[rigaBase({ name: 'Sella', pausaMin: 20 })]} />);
    // Il testo è spezzato dallo span dell'icona: `getAllByText` non lancia con più nodi.
    expect(
      screen.getAllByText((_t, el) => /sosta 20 min/i.test(el?.textContent ?? '')).length,
    ).toBeGreaterThanOrEqual(1);
    // Nessuna etichetta di fase: «arrivo · sosta» o «ripartenza» sono solo delle soste lunghe.
    // («Arrivo» da solo è l'intestazione di colonna, che c'è sempre.)
    expect(screen.queryByText(/arrivo · sosta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^ripartenza$/i)).not.toBeInTheDocument();
  });

  test('sosta lunga (due righe): arrivo e ripartenza, stesso punto, orari diversi', () => {
    const righe: RigaPercorso[] = [
      rigaBase({
        waypointIndex: 1, name: 'Rifugio', pausaMin: 90, fase: 'arrivo',
        arrival: '2026-09-07T09:30:00Z',
      }),
      rigaBase({
        waypointIndex: 1, name: 'Rifugio', pausaMin: 90, fase: 'ripartenza',
        arrival: '2026-09-07T11:00:00Z',
      }),
    ];
    render(<TabellaPuntiMeteo righe={righe} />);
    // due righe corpo, non una sola (chiave composita: senza, React ne collassa una)
    const corpo = screen.getAllByRole('row').filter((r) => r.querySelector('td'));
    expect(corpo).toHaveLength(2);
    expect(screen.getByText(/arrivo · sosta 1 h 30 min/i)).toBeInTheDocument();
    expect(screen.getByText(/^ripartenza$/i)).toBeInTheDocument();
    // il nome del punto compare due volte (arrivo e ripartenza)
    expect(screen.getAllByText(/Rifugio/).length).toBe(2);
  });

  test('nessuna sosta: nessuna etichetta', () => {
    render(<TabellaPuntiMeteo righe={[rigaBase({ name: 'Cima' })]} />);
    expect(screen.queryByText(/sosta/i)).not.toBeInTheDocument();
  });
});
