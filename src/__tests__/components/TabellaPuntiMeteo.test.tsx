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
  waypointIndex: 0, name: 'Punto', lat: 42.2, lon: 14.28, alt: 1000, modelElevation: 1000,
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


describe('TabellaPuntiMeteo e i punti in mezzo', () => {
  const rigaBaseM = (over: Partial<RigaPercorso>): RigaPercorso => ({
    waypointIndex: 0, name: 'Punto', lat: 42.2, lon: 14.28, alt: 1000, modelElevation: 1000,
    arrival: '2026-09-07T10:00:00Z', hour: null,
    classification: { level: 0, reasons: [] },
    ...over,
  });
  const meta = { ibIndex: 1, frazione: 0.5, kmDaInizio: 7.3, traA: 'Rifugio', traB: 'Vetta' };

  test('un intermedio critico si mostra con «in mezzo», i km e «tra A e B»', () => {
    const righe: RigaPercorso[] = [
      rigaBaseM({ waypointIndex: 0, name: 'Rifugio' }),
      rigaBaseM({
        name: 'in mezzo', intermedio: meta,
        classification: { level: 3, reasons: ['temporale previsto'] },
      }),
      rigaBaseM({ waypointIndex: 1, name: 'Vetta' }),
    ];
    render(<TabellaPuntiMeteo righe={righe} />);
    expect(screen.getByText('in mezzo')).toBeInTheDocument();
    expect(screen.getByText(/tra «Rifugio» e «Vetta»/)).toBeInTheDocument();
    expect(screen.getByText(/temporale previsto/)).toBeInTheDocument();
  });

  test('un intermedio tranquillo (livello 0) non compare in tabella', () => {
    const righe: RigaPercorso[] = [
      rigaBaseM({ waypointIndex: 0, name: 'Rifugio' }),
      rigaBaseM({ name: 'in mezzo', intermedio: meta, classification: { level: 0, reasons: [] } }),
      rigaBaseM({ waypointIndex: 1, name: 'Vetta' }),
    ];
    render(<TabellaPuntiMeteo righe={righe} />);
    expect(screen.queryByText('in mezzo')).not.toBeInTheDocument();
    // i due waypoint reali ci sono
    expect(screen.getByText(/Rifugio/)).toBeInTheDocument();
    expect(screen.getByText(/Vetta/)).toBeInTheDocument();
  });
});

/**
 * **I millimetri al posto del CAPE.**
 *
 * Il CAPE è energia in J/kg: a chi cammina non dice niente, e occupava una colonna su un
 * telefono. Sparisce dalla tabella ma **resta nel giudizio** — quando conta, `classifyHour`
 * lo scrive a parole («possibili temporali forti»). Al suo posto i millimetri, che sono la
 * differenza fra una spruzzata e un rovescio che ti ferma.
 */
describe('la colonna dei millimetri', () => {
  const oraCon = (over: Partial<NonNullable<RigaPercorso['hour']>>) => ({
    time: '2026-09-09T15:00:00.000Z', cape: 2500, weatherCode: 3, gusts: 12,
    precipProb: 40, temp: 12, mm: 0, ...over,
  });

  test('il CAPE non si mostra più: è un numero che non dice niente a chi cammina', () => {
    render(<TabellaPuntiMeteo righe={[rigaBase({ hour: oraCon({ cape: 2500 }) })]} />);
    expect(screen.queryByText('CAPE')).not.toBeInTheDocument();
    expect(screen.queryByText('2500')).not.toBeInTheDocument();
  });

  test('i millimetri si scrivono all\'italiana e si colorano per gravità', () => {
    render(<TabellaPuntiMeteo righe={[rigaBase({ hour: oraCon({ mm: 9.7 }) })]} />);
    const cella = screen.getByText('9,7 mm');
    expect(cella).toHaveClass('text-orange-300');
  });

  /** Una cifra decimale sempre, così in colonna i numeri restano allineati. */
  test.each([
    [0.4, '0,4 mm', 'text-gray-300'],
    [2.4, '2,4 mm', 'text-amber-300'],
    [6.9, '6,9 mm', 'text-orange-300'],
    [14, '14,0 mm', 'text-red-400'],
  ])('%s mm → «%s», nel colore della sua gravità', (mm, testo, classe) => {
    render(<TabellaPuntiMeteo righe={[rigaBase({ hour: oraCon({ mm }) })]} />);
    expect(screen.getByText(testo)).toHaveClass(classe);
  });

  /** Zero è un fatto («non piove»), un dato che manca è un'altra cosa. Non si confondono. */
  test('zero millimetri è un trattino, un dato assente è n/d', () => {
    render(<TabellaPuntiMeteo righe={[
      rigaBase({ name: 'asciutto', hour: oraCon({ mm: 0 }) }),
      rigaBase({ waypointIndex: 1, name: 'ignoto', hour: oraCon({ mm: Number.NaN }) }),
    ]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getAllByText('n/d').length).toBeGreaterThanOrEqual(1);
  });
});
