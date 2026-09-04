import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { useModaleTastiera } from '@/lib/useModaleTastiera';

/**
 * **Un modale, da tastiera.**
 *
 * Era in doppia copia — `WhatsNew` e `RouteWeatherPanel` — e **nessuna delle due era
 * provata**: la trappola del fuoco è una di quelle cose che sembrano funzionare perché con
 * il mouse non le si incontra mai. Chi naviga col Tab, invece, ci finisce subito: fuori dal
 * modale, sui comandi coperti dal pannello che ha davanti.
 */

/** Tre pulsanti dentro, uno fuori: il minimo per vedere se il giro si chiude. */
function Modale({ onChiuso }: { onChiuso?: () => void }) {
  const [aperto, setAperto] = useState(true);
  const dialogo = useModaleTastiera<HTMLDivElement>(aperto, () => {
    setAperto(false);
    onChiuso?.();
  });
  if (!aperto) return <div data-testid="stato">chiuso</div>;
  return (
    <div>
      <button data-testid="fuori">fuori</button>
      <div ref={dialogo} tabIndex={-1} role="dialog" data-testid="dialogo">
        <button data-testid="primo">primo</button>
        <button data-testid="mezzo">mezzo</button>
        <button data-testid="ultimo">ultimo</button>
      </div>
    </div>
  );
}

describe('il modale da tastiera', () => {
  test('Escape chiude', () => {
    const { getByTestId } = render(<Modale />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getByTestId('stato').textContent).toBe('chiuso');
  });

  test('un tasto qualunque non chiude', () => {
    const { getByTestId } = render(<Modale />);
    fireEvent.keyDown(window, { key: 'a' });
    expect(getByTestId('dialogo')).toBeInTheDocument();
  });

  /** Il fuoco entra da sé: senza, col Tab si attraversa tutta la pagina dietro. */
  test('all apertura il fuoco va nel dialogo', () => {
    const { getByTestId } = render(<Modale />);
    expect(document.activeElement).toBe(getByTestId('dialogo'));
  });

  test('dall ultimo, Tab torna al primo', () => {
    const { getByTestId } = render(<Modale />);
    getByTestId('ultimo').focus();
    fireEvent.keyDown(getByTestId('dialogo'), { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('primo'));
  });

  /**
   * **Il giro indietro.** È la metà che una terza copia scritta in fretta dimentica: ci si
   * accorge del Tab in avanti e non di Shift+Tab, e chi torna sui suoi passi esce dal
   * modale senza che nessuno se ne accorga mai.
   */
  test('dal primo, Shift+Tab va all ultimo', () => {
    const { getByTestId } = render(<Modale />);
    getByTestId('primo').focus();
    fireEvent.keyDown(getByTestId('dialogo'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('ultimo'));
  });

  /** In mezzo non si intromette: il Tab del browser fa già la cosa giusta. */
  test('in mezzo lascia fare al browser', () => {
    const { getByTestId } = render(<Modale />);
    getByTestId('mezzo').focus();
    const evento = fireEvent.keyDown(getByTestId('dialogo'), { key: 'Tab' });
    expect(evento).toBe(true); // non e' stato chiamato preventDefault
    expect(document.activeElement).toBe(getByTestId('mezzo'));
  });

  /**
   * **La trappola scatta solo sul Tab.** Se scattasse su qualunque tasto, scrivere in un
   * campo di testo all'ultima posizione del modale sposterebbe il cursore al primo
   * pulsante a ogni lettera battuta. (Test nato da una mutazione sopravvissuta: togliendo
   * il controllo su `Tab` restava tutto verde, perche' nessun test premeva un altro tasto
   * *dentro* il dialogo.)
   */
  test('una lettera battuta sull ultimo elemento non sposta il fuoco', () => {
    const { getByTestId } = render(<Modale />);
    getByTestId('ultimo').focus();
    fireEvent.keyDown(getByTestId('dialogo'), { key: 'x' });
    expect(document.activeElement).toBe(getByTestId('ultimo'));
  });

  test('smontando non resta nessun ascoltatore', () => {
    const aggiunti: string[] = [];
    const rimossi: string[] = [];
    const veroAdd = window.addEventListener.bind(window);
    const veroRemove = window.removeEventListener.bind(window);
    jest.spyOn(window, 'addEventListener').mockImplementation((t, l, o) => {
      aggiunti.push(String(t)); return veroAdd(t, l, o);
    });
    jest.spyOn(window, 'removeEventListener').mockImplementation((t, l, o) => {
      rimossi.push(String(t)); return veroRemove(t, l, o);
    });
    const { unmount } = render(<Modale />);
    expect(aggiunti).toContain('keydown');
    unmount();
    expect(rimossi).toContain('keydown');
    jest.restoreAllMocks();
  });

  test('a modale chiuso non ascolta niente', () => {
    function Chiuso() {
      const ref = useModaleTastiera<HTMLDivElement>(false, () => {});
      return <div ref={ref} />;
    }
    const aggiunti: string[] = [];
    const vero = window.addEventListener.bind(window);
    jest.spyOn(window, 'addEventListener').mockImplementation((t, l, o) => {
      aggiunti.push(String(t)); return vero(t, l, o);
    });
    render(<Chiuso />);
    expect(aggiunti).not.toContain('keydown');
    jest.restoreAllMocks();
  });
});
