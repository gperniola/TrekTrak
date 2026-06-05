import { describe, expect, test, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DifficultyRating, DIFFICULTY_LABELS } from '@/components/panel/DifficultyRating';

describe('DifficultyRating', () => {
  test('editable: click sul 3° livello chiama onChange(3)', () => {
    const onChange = jest.fn();
    render(<DifficultyRating value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(DIFFICULTY_LABELS[3], 'i') }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  test('readOnly: mostra la label del valore, nessun bottone', () => {
    render(<DifficultyRating value={5} readOnly />);
    expect(screen.getByText(new RegExp(DIFFICULTY_LABELS[5], 'i'))).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('readOnly senza valore: non renderizza nulla', () => {
    const { container } = render(<DifficultyRating value={undefined} readOnly />);
    expect(container).toBeEmptyDOMElement();
  });
});
