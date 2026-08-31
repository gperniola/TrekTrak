import { useUIStore } from '@/stores/uiStore';
import { KEYS } from '@/lib/storage';

describe('il profilo nello store', () => {
  beforeEach(() => localStorage.clear());

  test('la chiave di persistenza esiste', () => {
    expect(KEYS.profilo).toBe('trektrak_profilo');
  });

  test('setProfilo cambia lo stato e lo scrive su storage', () => {
    useUIStore.getState().setProfilo('imparo');
    expect(useUIStore.getState().profilo).toBe('imparo');
    expect(localStorage.getItem(KEYS.profilo)).toBe('imparo');
  });

  /**
   * Cambiare profilo e' un gesto che si fara' per curiosita': non deve costare niente.
   * E' la garanzia della v0.11.8 applicata a un interruttore nuovo.
   */
  test('cambiare profilo non cancella le impostazioni ne l itinerario', () => {
    localStorage.setItem(KEYS.settings, '{"tenuto":true}');
    localStorage.setItem('trektrak_current_itinerary', '{"tenuto":true}');
    useUIStore.getState().setProfilo('montagna');
    expect(localStorage.getItem(KEYS.settings)).toBe('{"tenuto":true}');
    expect(localStorage.getItem('trektrak_current_itinerary')).toBe('{"tenuto":true}');
  });

  test('lo storage indisponibile non fa cadere il cambio di profilo', () => {
    const vero = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    try {
      expect(() => useUIStore.getState().setProfilo('imparo')).not.toThrow();
      expect(useUIStore.getState().profilo).toBe('imparo');
    } finally {
      Storage.prototype.setItem = vero;
    }
  });
});
