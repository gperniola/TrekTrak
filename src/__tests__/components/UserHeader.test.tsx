import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
