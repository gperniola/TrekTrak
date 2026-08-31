import { render, screen } from '@testing-library/react';
import { ModeSwitch } from '@/components/panel/ModeSwitch';
import { useUIStore } from '@/stores/uiStore';

describe('l interruttore Learn/Track per profilo', () => {
  /** In Imparo resta: il confronto stimato-vs-reale vive in quel passaggio. */
  test('in Imparo c e', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ModeSwitch />);
    expect(screen.getByRole('tab', { name: 'Learn' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Track' })).toBeInTheDocument();
  });

  test('in Montagna non c e', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ModeSwitch />);
    expect(screen.queryByRole('tab', { name: 'Learn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Track' })).not.toBeInTheDocument();
  });

  /** Gli strumenti restano anche senza l'interruttore: la toolbar non si svuota. */
  test('in Montagna la toolbar conserva bussola e righello', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ModeSwitch />);
    expect(screen.getByRole('button', { name: /Attiva bussola/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attiva righello/ })).toBeInTheDocument();
  });
});
