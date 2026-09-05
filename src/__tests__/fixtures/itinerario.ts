import type { ItineraryState } from '@/stores/itineraryStore';
import type { AppMode, Waypoint } from '@/lib/types';

/**
 * **Lo stato di partenza di un itinerario, per i test.**
 *
 * Quattro file lo ripetevano identico (`ActionBar.test`, `InteractiveMap.test`,
 * `LeftPanel.test`, `OfflineNellEditor.test`), differendo solo per il nome e il modo:
 * quaranta righe copiate che ogni campo nuovo dello store obbliga a toccare in quattro
 * posti, e il posto dimenticato non fallisce — resta silenziosamente con lo stato vuoto.
 *
 * ## Il tipo esplicito è il punto, non un ornamento
 *
 * `Partial<ItineraryState>` sul letterale è ciò che fa confrontare la fixture con lo stato
 * vero dello store: senza, `sampleInterval: 50` si allarga a `number` e un campo aggiunto
 * dopo — è successo con `emergencyLayers` — resta assente senza che nulla lo segnali. Il
 * commento stava in tutti e quattro i file; qui il controllo è **uno**, e vale per tutti.
 */
export function statoItinerario(modifiche: Partial<ItineraryState> = {}): Partial<ItineraryState> {
  return {
    itineraryId: 'test-id',
    itineraryName: 'Test',
    waypoints: [],
    legs: [],
    settings: {
      tolerances: { altitude: 50, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 },
      mapDisplay: {
        coloredPath: false,
        trailRouting: false,
        sampleInterval: 50,
        baseMap: 'osm',
        showHikingTrails: false,
        showCoordinateGrid: false,
        emergencyLayers: [],
      },
    },
    appMode: 'learn' as AppMode,
    ...modifiche,
  };
}

/**
 * Un waypoint di prova sulla Majella, con quota e ordine coerenti: `wp(0)`, `wp(1)`, …
 * salgono di cento metri e di un centesimo di grado a testa, così una tratta fra due ha
 * sempre distanza e dislivello diversi da zero.
 */
export const wp = (i: number): Waypoint => ({
  id: `w${i}`,
  name: `P${i}`,
  lat: 42.1 + i / 100,
  lon: 14.1 + i / 100,
  altitude: 2000 + i * 100,
  order: i,
});

/**
 * **Lo stato dell'interfaccia riportato a riposo.**
 *
 * Nessuno strumento attivo, nessun pannello aperto. Serve fra un test e l'altro perché gli
 * store Zustand sono moduli: quello che un test accende resta accesso per il successivo, e
 * un test che passa solo perché il precedente ha lasciato la bussola attiva è un test che
 * non dice niente.
 */
export function statoUI(modifiche: Record<string, unknown> = {}) {
  return {
    compassActive: false,
    rulerActive: false,
    quizActive: false,
    progressOpen: false,
    searchOpen: false,
    ...modifiche,
  };
}
