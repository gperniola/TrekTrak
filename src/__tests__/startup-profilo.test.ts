import { profiloIniziale } from '@/lib/startup-profilo';

describe('quale profilo all avvio', () => {
  test('il profilo salvato vince su tutto', () => {
    expect(profiloIniziale({ salvato: 'imparo', livello: 'expert' })).toBe('imparo');
    expect(profiloIniziale({ salvato: 'montagna', livello: 'beginner' })).toBe('montagna');
  });

  /** Chi usava l'app prima di questa versione ha solo il livello dichiarato. */
  test('senza profilo salvato lo deduce dal livello dell onboarding', () => {
    expect(profiloIniziale({ salvato: null, livello: 'beginner' })).toBe('imparo');
    expect(profiloIniziale({ salvato: null, livello: 'expert' })).toBe('montagna');
  });

  /**
   * Senza nulla: Montagna. Il default NON nasconde la sicurezza — in Imparo l'avviso di
   * allerta alla posizione non c'e', e sceglierlo per chi non ha ancora risposto
   * significherebbe togliere un avviso a qualcuno che potrebbe essere fuori. Il tutorial
   * chiede subito, quindi il default dura pochi secondi.
   */
  test('senza niente parte da Montagna, che non nasconde gli avvisi', () => {
    expect(profiloIniziale({ salvato: null, livello: null })).toBe('montagna');
  });

  test('valori illeggibili si trattano come assenti', () => {
    expect(profiloIniziale({ salvato: 'boh', livello: 'boh' })).toBe('montagna');
    expect(profiloIniziale({ salvato: '', livello: 'beginner' })).toBe('imparo');
  });
});
