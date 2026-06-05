import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RequestAccessForm } from '@/components/auth/RequestAccessForm';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({ requestAccess: (jest.fn(async () => ({ ok: true }))) as never });
});

describe('RequestAccessForm', () => {
  test('email vuota → non chiama requestAccess', () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ requestAccess: spy as never });
    render(<RequestAccessForm />);
    fireEvent.click(screen.getByRole('button', { name: /invia/i }));
    expect(spy).not.toHaveBeenCalled();
  });

  test('email valida → chiama requestAccess e mostra conferma', async () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ requestAccess: spy as never });
    render(<RequestAccessForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.it' } });
    fireEvent.click(screen.getByRole('button', { name: /invia/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('a@b.it'));
    expect(await screen.findByText(/controlla la (tua )?mail/i)).toBeInTheDocument();
  });

  test('errore invito non valido mostrato', async () => {
    useAuthStore.setState({ requestAccess: (jest.fn(async () => ({ ok: false, error: 'invalid_invite' }))) as never });
    render(<RequestAccessForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.it' } });
    fireEvent.click(screen.getByRole('button', { name: /invia/i }));
    expect(await screen.findByText(/invito non valido/i)).toBeInTheDocument();
  });
});
