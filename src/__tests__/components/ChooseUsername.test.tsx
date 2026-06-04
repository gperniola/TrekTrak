import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChooseUsername } from '@/components/auth/ChooseUsername';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({ claimUsername: (jest.fn(async () => ({ ok: true }))) as never });
});

describe('ChooseUsername', () => {
  test('username < 3 caratteri → non invia', () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ claimUsername: spy as never });
    render(<ChooseUsername />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    expect(spy).not.toHaveBeenCalled();
  });

  test('username valido → chiama claimUsername', async () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ claimUsername: spy as never });
    render(<ChooseUsername />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'gio' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('gio'));
  });

  test('errore username_taken mostrato', async () => {
    useAuthStore.setState({ claimUsername: (jest.fn(async () => ({ ok: false, error: 'username_taken' }))) as never });
    render(<ChooseUsername />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'gio' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    expect(await screen.findByText(/già in uso/i)).toBeInTheDocument();
  });
});
