import { startupAction } from '@/lib/startup-itinerary';
import type { CurrentItinerary } from '@/lib/current-itinerary';

const salvato = (appMode: 'learn' | 'track' = 'track'): CurrentItinerary => ({
  itineraryId: 'i1', itineraryName: 'Giro', createdAt: '2026-08-27T08:00:00.000Z',
  appMode, waypoints: [{ id: 'w', name: 'W', lat: 46, lon: 11, altitude: null, order: 0 }], legs: [],
});

/**
 * Due difetti confluivano in questa decisione:
 *  - il lavoro in corso non veniva salvato, quindi una ricarica lo cancellava;
 *  - il livello scelto nell'onboarding era scritto e mai riletto, quindi chi diceva
 *    "sto imparando" ripartiva in modalità Track, con l'app che compila tutto.
 *
 * L'ordine di precedenza è il punto: la modalità dell'itinerario salvato vince sul
 * livello dichiarato, perché l'utente potrebbe averla cambiata a mano dopo — e una
 * preferenza di mesi prima non deve sovrascrivere un gesto di ieri.
 */
describe('cosa fare all\'avvio', () => {
  test('c\'è lavoro salvato → si rimette in piedi', () => {
    const a = startupAction(salvato('learn'), 'beginner');
    expect(a).toEqual({ kind: 'restore', saved: salvato('learn') });
  });

  test('la modalità salvata vince sul livello dichiarato', () => {
    // salvato in Track, livello "beginner": non si torna a Learn
    const a = startupAction(salvato('track'), 'beginner');
    expect(a.kind).toBe('restore');
    if (a.kind === 'restore') expect(a.saved.appMode).toBe('track');
  });

  test('niente di salvato + principiante → parte in Learn', () => {
    expect(startupAction(null, 'beginner')).toEqual({ kind: 'appMode', mode: 'learn' });
  });

  test('niente di salvato + esperto → si lascia il default', () => {
    expect(startupAction(null, 'expert')).toEqual({ kind: 'none' });
  });

  test.each([
    ['livello assente', null],
    ['livello sconosciuto', 'campione-del-mondo'],
    ['stringa vuota', ''],
  ])('%s → si lascia il default, non si indovina', (_n, livello) => {
    expect(startupAction(null, livello)).toEqual({ kind: 'none' });
  });
});
