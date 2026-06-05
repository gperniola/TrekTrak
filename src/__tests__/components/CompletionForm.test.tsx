import { describe, expect, test, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompletionForm } from '@/components/panel/CompletionForm';

describe('CompletionForm', () => {
  test('submit con ore/minuti → minuti totali, senza personName', () => {
    const onSubmit = jest.fn();
    render(<CompletionForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/ore/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/minuti/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 150 }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('personName');
  });

  test('include la difficoltà selezionata', () => {
    const onSubmit = jest.fn();
    render(<CompletionForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /3 — medio/i }));
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 3 }));
  });
});
