import { render, screen, fireEvent } from '@testing-library/react';
import { GLOSSARIO, TERMINI, voce, type Termine } from '@/lib/glossario';
import { TermineGlossario } from '@/components/shared/TermineGlossario';
import { getTermini } from '@/lib/didactic-tips';
import { NumberInput } from '@/components/shared/NumberInput';
import { calculateMunterTime } from '@/lib/calculations';
import { ValidationBadge } from '@/components/validation/ValidationBadge';
import { useUIStore } from '@/stores/uiStore';

/**
 * TASK-16 B. I sette pulsanti ⓘ dei campi mostravano frasi che **usavano** i termini da
 * spiegare: «Dislivello positivo cumulativo (metri di salita)» aiuta chi sa già cos'è un
 * dislivello cumulativo, cioè chi non ha bisogno della spiegazione. Per un'app che
 * esiste per insegnare la cartografia era il posto peggiore dove dare per scontato.
 */

describe('il catalogo dei termini', () => {
  test('ogni voce ha un titolo e una definizione non vuoti', () => {
    for (const t of TERMINI) {
      expect(GLOSSARIO[t].titolo.trim().length).toBeGreaterThan(2);
      expect(GLOSSARIO[t].definizione.trim().length).toBeGreaterThan(20);
    }
  });

  /** Un rimando a un termine che non esiste è un vicolo cieco silenzioso. */
  test('i rimandi «vedi anche» puntano a termini esistenti', () => {
    for (const t of TERMINI) {
      for (const altro of GLOSSARIO[t].vediAnche ?? []) {
        expect(TERMINI).toContain(altro);
      }
    }
  });

  test('nessun termine rimanda a se stesso', () => {
    for (const t of TERMINI) {
      expect(GLOSSARIO[t].vediAnche ?? []).not.toContain(t);
    }
  });

  /**
   * La definizione descrive **quello che l'app fa davvero**: se un giorno si cambiassero
   * le velocità di `calculateMunterTime`, la voce del glossario direbbe il falso a chi la
   * sta usando per imparare. Qui i numeri scritti nel testo vengono riprovati sul codice.
   */
  test('la voce su Munter dice le velocita che l app usa davvero', () => {
    const testo = voce('munter').comeSiUsa ?? '';
    expect(testo).toContain('4 km/h');
    expect(testo).toContain('400 m/h');
    expect(testo).toContain('800 m/h');
    // 4 km in piano, niente dislivello: un'ora esatta
    expect(calculateMunterTime(4, 0, 0)).toBeCloseTo(60, 5);
    // 400 m di salita, niente distanza: un'ora esatta
    expect(calculateMunterTime(0, 400, 0)).toBeCloseTo(60, 5);
    // 800 m di discesa, niente distanza: un'ora esatta
    expect(calculateMunterTime(0, 0, 800)).toBeCloseTo(60, 5);
    // e la combinazione e' «la piu' lunga piu' meta' dell'altra», come dice il testo
    expect(testo).toMatch(/met[àa] dell/i);
    expect(calculateMunterTime(4, 400, 0)).toBeCloseTo(90, 5);
  });

  /** La conversione scritta nella voce deve tornare, altrimenti insegna uno sbaglio. */
  test('la conversione dei gradi decimali torna', () => {
    const testo = voce('gradi-decimali').comeSiUsa ?? '';
    expect(testo).toContain('45,4736');
    const calcolato = 45 + 28 / 60 + 25 / 3600;
    expect(calcolato.toFixed(4).replace('.', ',')).toBe('45,4736');
    // e il valore citato nella definizione e' lo stesso
    expect(voce('gradi-decimali').definizione).toContain('45,4736');
  });

  test('la pendenza non viene confusa con l angolo', () => {
    expect(voce('pendenza').comeSiUsa).toMatch(/100%.*45°/);
  });
});

describe('il pulsante che apre la definizione', () => {
  test('chiuso non mostra niente, aperto mostra titolo e definizione', () => {
    render(<TermineGlossario termine="azimut" />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    const t = screen.getByRole('tooltip');
    expect(t).toHaveTextContent('Azimut');
    expect(t).toHaveTextContent(/senso orario/);
  });

  test('si richiude con Escape', () => {
    render(<TermineGlossario termine="quota" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  /** «Info: Dist» non dice niente: il nome accessibile nomina la cosa spiegata. */
  test('il nome accessibile dice cosa si sta per leggere', () => {
    render(<TermineGlossario termine="dislivello-positivo" />);
    expect(screen.getByRole('button').getAttribute('aria-label'))
      .toBe("Che cos'è: Dislivello positivo (D+)");
  });

  /**
   * Visto solo a schermo: passando l'etichetta del campo i nomi diventavano «Che cos'è:
   * Lat», «Che cos'è: D+», cioe' l'abbreviazione — non piu' informativi del vecchio
   * «Info: Lat» che dovevano sostituire. Il nome dice il TERMINE.
   */
  test('accanto a un campo nomina il termine, non l abbreviazione', () => {
    render(<NumberInput label="Lat" value={45} onChange={() => {}} termine="wgs84" />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe("Che cos'è: WGS84");
  });
});

describe('i campi numerici', () => {
  test('senza termine non c e nessun pulsante di aiuto', () => {
    render(<NumberInput label="Dist" value={1} onChange={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('con un termine il campo apre la definizione giusta', () => {
    render(<NumberInput label="Dist" unit="km" value={1} onChange={() => {}} termine="linea-daria" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Distanza in linea d’aria');
  });
});

describe('i suggerimenti rimandano ai termini che nominano', () => {
  /**
   * Il collegamento e' DICHIARATO, non cercato dentro le frasi: riconoscere una parola in
   * una stringa funziona finche' qualcuno non riscrive la frase, e allora il rimando
   * sparisce senza che nessun test se ne accorga.
   */
  test('ogni campo verificabile offre almeno un termine, e i termini esistono', () => {
    for (const campo of ['altitude', 'distance', 'elevationGain', 'elevationLoss', 'azimuth'] as const) {
      const termini = getTermini(campo);
      expect(termini.length).toBeGreaterThan(0);
      for (const t of termini) expect(TERMINI).toContain(t as Termine);
    }
  });

  test('il suggerimento sull azimut rimanda alla declinazione, che e cio di cui parla', () => {
    expect(getTermini('azimuth')).toContain('declinazione-magnetica');
  });

  test('salita e discesa rimandano agli stessi due termini', () => {
    expect(getTermini('elevationGain')).toEqual(getTermini('elevationLoss'));
  });
});

/**
 * Il pezzo che chiude il giro: chi ha appena sbagliato un valore legge il suggerimento
 * e, se una parola non gli dice niente, la apre lì dentro. La definizione compare
 * **dentro lo stesso riquadro** e non in un popover suo, che si posizionerebbe rispetto
 * al pulsantino e coprirebbe il suggerimento che deve spiegare.
 */
describe('dal suggerimento alla definizione, senza uscire dal riquadro', () => {
  const risultato = {
    status: 'warning' as const,
    userValue: 580,
    realValue: 500,
    delta: 80,
    tolerance: { strict: 50, loose: 100 },
  };

  beforeEach(() => {
    useUIStore.setState({ profilo: 'imparo' });
  });

  test('il popover offre i termini di quel campo', () => {
    render(<ValidationBadge result={risultato} fieldType="altitude" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Curve di livello')).toBeInTheDocument();
    expect(screen.getByText('Quota')).toBeInTheDocument();
  });

  test('toccando un termine la definizione prende il posto del suggerimento', () => {
    render(<ValidationBadge result={risultato} fieldType="altitude" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Curve di livello'));
    expect(screen.getByText(/uniscono i punti di uguale quota/)).toBeInTheDocument();
    expect(screen.queryByText(/curva direttrice/i)).not.toBeInTheDocument();
    // e non e' comparso un secondo riquadro
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('si torna indietro al suggerimento', () => {
    render(<ValidationBadge result={risultato} fieldType="altitude" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Curve di livello'));
    fireEvent.click(screen.getByText(/torna al suggerimento/));
    expect(screen.getByText(/curva di livello/i)).toBeInTheDocument();
  });

  /** Riaprendo si vuole il suggerimento, non la definizione lasciata a meta'. */
  test('richiudendo e riaprendo si riparte dal suggerimento', () => {
    render(<ValidationBadge result={risultato} fieldType="altitude" />);
    const badge = screen.getByRole('button');
    fireEvent.click(badge);
    fireEvent.click(screen.getByText('Curve di livello'));
    fireEvent.click(badge);
    fireEvent.click(badge);
    expect(screen.getByText('Curve di livello')).toBeInTheDocument();
    expect(screen.queryByText(/uniscono i punti di uguale quota/)).not.toBeInTheDocument();
  });
});
