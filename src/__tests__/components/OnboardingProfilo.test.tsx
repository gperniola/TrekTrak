import { render, screen, fireEvent } from '@testing-library/react';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';

/**
 * L'onboarding chiedeva gia' "Sto imparando / Sono esperto", ma quella risposta decideva
 * soltanto se le tratte si compilano a mano o da sole: restava a meta' del suo mestiere.
 * Ora decide anche quali AREE dell'app esistono.
 */
describe('la scelta dell onboarding decide il profilo', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ profilo: 'montagna' });
  });

  test('"Sto imparando" imposta profilo Imparo e modalita Learn', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /Sto imparando/ }));
    expect(useUIStore.getState().profilo).toBe('imparo');
    expect(useItineraryStore.getState().appMode).toBe('learn');
  });

  test('"Sono esperto" imposta profilo Montagna e modalita Track', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /Sono esperto/ }));
    expect(useUIStore.getState().profilo).toBe('montagna');
    expect(useItineraryStore.getState().appMode).toBe('track');
  });

  /** La risposta resta anche nella chiave vecchia: la migrazione la legge da li'. */
  test('il livello continua a essere salvato', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /Sto imparando/ }));
    expect(localStorage.getItem('trektrak_user_level')).toBe('beginner');
  });
});
