import { render, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { useChiudiFuori } from '@/lib/useChiudiFuori';

/**
 * L'hook che chiude un menu al tocco fuori o con Esc.
 *
 * Prima erano cinque copie identiche in cinque componenti, tutte corrette: l'hook non
 * corregge un difetto, impedisce il sesto. Quindi i test qui non provano che «funziona» —
 * provano le tre cose che una sesta copia scritta in fretta sbaglierebbe: il tocco, la
 * pulizia degli ascoltatori, e il fatto che dentro non chiude.
 */

function Menu({ onChiuso }: { onChiuso?: () => void }) {
  const [aperto, setAperto] = useState(true);
  const ref = useChiudiFuori<HTMLDivElement>(aperto, () => {
    setAperto(false);
    onChiuso?.();
  });
  return (
    <div>
      <div ref={ref} data-testid="dentro">{aperto ? 'aperto' : 'chiuso'}</div>
      <button data-testid="fuori">altrove</button>
    </div>
  );
}

describe('chiudi al tocco fuori', () => {
  test('un mousedown fuori chiude', () => {
    const { getByTestId } = render(<Menu />);
    fireEvent.mouseDown(getByTestId('fuori'));
    expect(getByTestId('dentro').textContent).toBe('chiuso');
  });

  /**
   * **Il tocco è quello che conta**: sul telefono `mousedown` arriva tardi o non arriva, e
   * il telefono è dove l'app si usa. Era l'evento più facile da dimenticare nella sesta
   * copia.
   */
  test('un touchstart fuori chiude', () => {
    const { getByTestId } = render(<Menu />);
    fireEvent.touchStart(getByTestId('fuori'));
    expect(getByTestId('dentro').textContent).toBe('chiuso');
  });

  test('Escape chiude', () => {
    const { getByTestId } = render(<Menu />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(getByTestId('dentro').textContent).toBe('chiuso');
  });

  test('un tasto qualunque non chiude', () => {
    const { getByTestId } = render(<Menu />);
    fireEvent.keyDown(document, { key: 'a' });
    expect(getByTestId('dentro').textContent).toBe('aperto');
  });

  /** Toccare **dentro** non deve chiudere: è il contenuto del menu. */
  test('un mousedown dentro non chiude', () => {
    const { getByTestId } = render(<Menu />);
    fireEvent.mouseDown(getByTestId('dentro'));
    expect(getByTestId('dentro').textContent).toBe('aperto');
  });

  test('chiuso una volta, non richiama la chiusura a ogni tocco', () => {
    const chiuso = jest.fn();
    const { getByTestId } = render(<Menu onChiuso={chiuso} />);
    fireEvent.mouseDown(getByTestId('fuori'));
    fireEvent.mouseDown(getByTestId('fuori'));
    fireEvent.mouseDown(getByTestId('fuori'));
    expect(chiuso).toHaveBeenCalledTimes(1);
  });

  /**
   * **Nessun ascoltatore residuo**, né dopo la chiusura né dopo lo smontaggio: gli
   * ascoltatori stanno su `document`, quindi uno dimenticato sopravvive al componente e
   * chiama `setState` su qualcosa che non c'è più.
   */
  test('smontando non resta nessun ascoltatore su document', () => {
    const aggiunti: string[] = [];
    const rimossi: string[] = [];
    const veroAdd = document.addEventListener.bind(document);
    const veroRemove = document.removeEventListener.bind(document);
    jest.spyOn(document, 'addEventListener').mockImplementation((t, l, o) => {
      aggiunti.push(String(t)); return veroAdd(t, l, o);
    });
    jest.spyOn(document, 'removeEventListener').mockImplementation((t, l, o) => {
      rimossi.push(String(t)); return veroRemove(t, l, o);
    });

    const { unmount } = render(<Menu />);
    expect(aggiunti.sort()).toEqual(['keydown', 'mousedown', 'touchstart']);
    unmount();
    expect(rimossi.sort()).toEqual(['keydown', 'mousedown', 'touchstart']);

    jest.restoreAllMocks();
  });

  /**
   * Gli ascoltatori si agganciano **una volta per apertura**, non a ogni render: se la
   * funzione di chiusura entrasse nelle dipendenze dell'effetto, un chiamante che passa
   * una lambda in linea — cioè tutti e cinque — li staccherebbe e riattaccherebbe a ogni
   * render. Era il comportamento degli originali, e va conservato.
   */
  test('un render in piu non riattacca gli ascoltatori', () => {
    let aggiunte = 0;
    const vero = document.addEventListener.bind(document);
    jest.spyOn(document, 'addEventListener').mockImplementation((t, l, o) => {
      if (t === 'mousedown') aggiunte += 1;
      return vero(t, l, o);
    });

    function ConContatore() {
      const [n, setN] = useState(0);
      const [aperto] = useState(true);
      const ref = useChiudiFuori<HTMLDivElement>(aperto, () => {});
      return (
        <div ref={ref}>
          <button data-testid="ridisegna" onClick={() => setN(n + 1)}>{n}</button>
        </div>
      );
    }
    const { getByTestId } = render(<ConContatore />);
    expect(aggiunte).toBe(1);
    act(() => { fireEvent.click(getByTestId('ridisegna')); });
    act(() => { fireEvent.click(getByTestId('ridisegna')); });
    expect(aggiunte).toBe(1);

    jest.restoreAllMocks();
  });

  test('a menu chiuso non ascolta niente', () => {
    function Chiuso() {
      const ref = useChiudiFuori<HTMLDivElement>(false, () => {});
      return <div ref={ref} />;
    }
    const aggiunti: string[] = [];
    const vero = document.addEventListener.bind(document);
    jest.spyOn(document, 'addEventListener').mockImplementation((t, l, o) => {
      aggiunti.push(String(t)); return vero(t, l, o);
    });
    render(<Chiuso />);
    expect(aggiunti).toEqual([]);
    jest.restoreAllMocks();
  });
});
