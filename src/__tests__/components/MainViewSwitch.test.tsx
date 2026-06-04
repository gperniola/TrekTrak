import { describe, expect, test, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MainViewSwitch } from '@/components/panel/MainViewSwitch';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  useUIStore.setState({ mainView: 'editor' });
  useAuthStore.setState({ invited: false, member: null });
});

describe('MainViewSwitch gating', () => {
  test('tab Libreria assente per anonimo non invitato', () => {
    render(<MainViewSwitch />);
    expect(screen.queryByRole('tab', { name: /libreria/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /editor/i })).toBeInTheDocument();
  });

  test('tab Libreria presente se invitato', () => {
    useAuthStore.setState({ invited: true, member: null });
    render(<MainViewSwitch />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });

  test('tab Libreria presente se membro', () => {
    useAuthStore.setState({ invited: false, member: { id: 'u', username: 'g', role: 'member' } });
    render(<MainViewSwitch />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });
});
