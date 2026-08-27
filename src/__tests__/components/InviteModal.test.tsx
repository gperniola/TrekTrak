import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { InviteModal } from '@/components/auth/InviteModal';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useAuthStore.setState({
    dismissInvite: (jest.fn()) as never,
    requestAccess: (jest.fn(async () => ({ ok: true }))) as never,
    // Il modale si apre perche' si e' arrivati da un link di invito: il token c'e'.
    // Senza, al suo posto compare la spiegazione "si entra su invito".
    inviteToken: 'tok-di-prova',
  });
});

describe('InviteModal', () => {
  test('mostra il form di accesso (email)', () => {
    render(<InviteModal />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('click su Chiudi chiama dismissInvite', () => {
    const spy = jest.fn();
    useAuthStore.setState({ dismissInvite: spy as never });
    render(<InviteModal />);
    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }));
    expect(spy).toHaveBeenCalled();
  });

  test('click sul backdrop chiama dismissInvite', () => {
    const spy = jest.fn();
    useAuthStore.setState({ dismissInvite: spy as never });
    render(<InviteModal />);
    // il backdrop è il dialog role parent: clicco l'overlay esterno
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(spy).toHaveBeenCalled();
  });
});
