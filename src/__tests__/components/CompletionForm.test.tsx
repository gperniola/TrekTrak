import { describe, expect, test, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompletionForm } from '@/components/panel/CompletionForm';

describe('CompletionForm', () => {
  test('requires a person name', () => {
    const onSubmit = jest.fn();
    render(<CompletionForm knownPeople={[]} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('submits with hours+minutes converted to total minutes', () => {
    const onSubmit = jest.fn();
    render(<CompletionForm knownPeople={[]} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/chi/i), { target: { value: 'Gio' } });
    fireEvent.change(screen.getByLabelText(/ore/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/minuti/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ personName: 'Gio', durationMinutes: 150 }));
  });
});
