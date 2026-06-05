import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserHeader } from '@/components/auth/UserHeader';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({
    member: { id: 'u1', username: 'gio', role: 'admin' },
    signOut: (jest.fn(async () => {})) as never,
    updateUsername: (jest.fn(async () => ({ ok: true }))) as never,
  });
});

describe('UserHeader', () => {
  test('mostra lo username', () => {
    render(<UserHeader />);
    expect(screen.getByText(/gio/)).toBeInTheDocument();
  });

  test('logout chiama signOut', () => {
    const spy = jest.fn(async () => {});
    useAuthStore.setState({ signOut: spy as never });
    render(<UserHeader />);
    fireEvent.click(screen.getByRole('button', { name: /menu utente|gio/i }));
    fireEvent.click(screen.getByRole('button', { name: /esci/i }));
    expect(spy).toHaveBeenCalled();
  });

  test('null member → non renderizza nulla', () => {
    useAuthStore.setState({ member: null });
    const { container } = render(<UserHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  test('cambia username → chiama updateUsername', async () => {
    const spy = jest.fn(async () => ({ ok: true }));
    useAuthStore.setState({ updateUsername: spy as never });
    render(<UserHeader />);
    fireEvent.click(screen.getByRole('button', { name: /menu utente|gio/i }));
    fireEvent.click(screen.getByRole('button', { name: /cambia username/i }));
    fireEvent.change(screen.getByLabelText(/nuovo username/i), { target: { value: 'gigi' } });
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('gigi'));
  });

  test('username_taken in modifica → mostra errore', async () => {
    useAuthStore.setState({ updateUsername: (jest.fn(async () => ({ ok: false, error: 'username_taken' }))) as never });
    render(<UserHeader />);
    fireEvent.click(screen.getByRole('button', { name: /menu utente|gio/i }));
    fireEvent.click(screen.getByRole('button', { name: /cambia username/i }));
    fireEvent.change(screen.getByLabelText(/nuovo username/i), { target: { value: 'gigi' } });
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(await screen.findByText(/già in uso/i)).toBeInTheDocument();
  });
});
