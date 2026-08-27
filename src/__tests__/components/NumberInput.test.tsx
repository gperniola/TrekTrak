import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberInput } from '@/components/shared/NumberInput';

/** Campo controllato come nell'app: lo store riceve il numero e lo rimanda giù. */
function Campo({ iniziale = null as number | null, min, max }: { iniziale?: number | null; min?: number; max?: number }) {
  const [v, setV] = useState<number | null>(iniziale);
  return (
    <>
      <NumberInput label="Dist" unit="km" value={v} onChange={setV} min={min} max={max} />
      <output data-testid="valore">{v === null ? 'null' : String(v)}</output>
    </>
  );
}

const campo = () => screen.getByLabelText('Dist (km)') as HTMLInputElement;
const valore = () => screen.getByTestId('valore').textContent;

/**
 * In Italia il separatore decimale è la virgola. Con `type="number"` il browser
 * scarta la virgola e il valore del campo diventa stringa vuota: chi scriveva "1,5"
 * vedeva il campo svuotarsi, sull'attività principale dell'app. Misurato prima della
 * correzione: `1,5` → `""`.
 */
describe('NumberInput accetta la virgola decimale', () => {
  test('"1,5" vale 1.5', () => {
    render(<Campo />);
    fireEvent.change(campo(), { target: { value: '1,5' } });
    expect(valore()).toBe('1.5');
  });

  test('"1.5" continua a valere 1.5', () => {
    render(<Campo />);
    fireEvent.change(campo(), { target: { value: '1.5' } });
    expect(valore()).toBe('1.5');
  });

  // Mentre si scrive, "1," non è ancora un numero completo: il campo deve lasciar
  // scrivere senza cancellare quello che si sta digitando.
  test('la virgola appena battuta resta a schermo', () => {
    render(<Campo />);
    fireEvent.change(campo(), { target: { value: '1,' } });
    expect(campo().value).toBe('1,');
    fireEvent.change(campo(), { target: { value: '1,7' } });
    expect(valore()).toBe('1.7');
  });

  test('il segno meno da solo non azzera il campo', () => {
    render(<Campo />);
    fireEvent.change(campo(), { target: { value: '-' } });
    expect(campo().value).toBe('-');
    fireEvent.change(campo(), { target: { value: '-12' } });
    expect(valore()).toBe('-12');
  });

  test('svuotare il campo vale null', () => {
    render(<Campo iniziale={3} />);
    fireEvent.change(campo(), { target: { value: '' } });
    expect(valore()).toBe('null');
  });

  test('caratteri non numerici vengono ignorati, non trasformati in 0', () => {
    render(<Campo iniziale={2} />);
    fireEvent.change(campo(), { target: { value: 'abc' } });
    expect(valore()).toBe('null');
    expect(campo().value).toBe('');
  });

  test('min e max continuano a limitare', () => {
    render(<Campo min={0} max={360} />);
    fireEvent.change(campo(), { target: { value: '400' } });
    expect(valore()).toBe('360');
    fireEvent.change(campo(), { target: { value: '-5' } });
    expect(valore()).toBe('0');
  });

  /**
   * Il campo deve seguire lo store quando il valore arriva da fuori — in modalità
   * Track l'app calcola distanza, dislivelli e azimut da sé.
   */
  test('un valore che arriva dall\'esterno si vede nel campo', () => {
    const { rerender } = render(<NumberInput label="Dist" unit="km" value={null} onChange={() => {}} />);
    expect(campo().value).toBe('');
    rerender(<NumberInput label="Dist" unit="km" value={12.087} onChange={() => {}} />);
    expect(campo().value).toBe('12.087');
  });

  /**
   * Su mobile serve la tastiera numerica CON il tasto della virgola: `inputMode`
   * decimal la ottiene anche su iOS, dove `type=number` mostra una tastiera diversa.
   */
  test('chiede la tastiera decimale al sistema', () => {
    render(<Campo />);
    expect(campo()).toHaveAttribute('inputmode', 'decimal');
  });

  // Il tocco su un campo alto 34px è imprecarso: la regola che il progetto si è dato
  // nella v0.10.0 è 44px sotto il breakpoint lg.
  test('altezza minima da pollice sotto lg', () => {
    render(<Campo />);
    expect(campo().className).toMatch(/max-lg:min-h-\[44px\]/);
  });
});
