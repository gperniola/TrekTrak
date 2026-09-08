import type { StateCreator } from 'zustand';
import type { AppSettings, Leg, LegTrackModeValues, Waypoint } from '../../lib/types';
import { DEFAULT_MAP_DISPLAY, DEFAULT_TOLERANCES } from '../../lib/types';
import type { ItineraryState } from './tipi';
import { recalculateLeg, restoreLegForMode, snapshotLegForMode } from './helpers';

export type SliceModo = Pick<ItineraryState, 'appMode' | 'setAppMode' | 'settings' | 'updateSettings' | 'applicaPasso'>;

/**
 * Il modo dell'itinerario (Learn o Track) e le impostazioni.
 *
 * Stanno insieme perché il cambio di modo legge il passo personale dalle impostazioni per
 * ricalcolare i tempi, ed è l'unico punto in cui le due cose si parlano.
 */
export const creaSliceModo: StateCreator<ItineraryState, [], [], SliceModo> = (set, get) => ({
  appMode: 'track',
  settings: {
    tolerances: { ...DEFAULT_TOLERANCES },
    mapDisplay: { ...DEFAULT_MAP_DISPLAY },
  } as AppSettings,

  /**
   * Scambio **non distruttivo**: i valori del modo che si lascia finiscono nel suo
   * cassetto, quelli del modo in cui si entra si riprendono dal proprio. Chi ha scritto
   * a mano venti valori in Learn e passa a Track per confrontare li ritrova tornando
   * indietro — è la funzione migliore dell'app e vale la complicazione.
   */
  setAppMode: (mode) => {
    const precedente = get().appMode;
    if (mode === precedente) return;
    const { waypoints, legs } = get();
    set({
      appMode: mode,
      waypoints: waypoints.map((wp) => {
        const prossimo: Waypoint = { ...wp, validationState: undefined };
        if (precedente === 'track') prossimo.trackAltitude = wp.altitude;
        else prossimo.learnAltitude = wp.altitude;
        prossimo.altitude = mode === 'track' ? (wp.trackAltitude ?? null) : (wp.learnAltitude ?? null);
        return prossimo;
      }),
      legs: legs.map((leg) => {
        const cassetto = snapshotLegForMode(leg, precedente);
        const prossima: Leg = {
          ...leg,
          ...restoreLegForMode(leg, mode),
          validationState: undefined,
          estimatedTime: undefined,
          slope: undefined,
        };
        if (precedente === 'track') prossima.trackValues = cassetto as LegTrackModeValues;
        else prossima.learnValues = cassetto;
        return recalculateLeg(prossima, get().settings.pace?.factor ?? 1);
      }),
    });
  },

  updateSettings: (settings) => set({ settings }),

  applicaPasso: (factor) => {
    const sicuro = Number.isFinite(factor) && factor > 0 ? factor : 1;
    const settings = { ...get().settings, pace: { factor: sicuro } };
    // Ricalcola i tempi (e le pendenze) di tutte le tratte col passo nuovo. `recalculateLeg`
    // conserva `...leg`, quindi distanze, dislivelli e i giudizi di verifica restano: cambia
    // solo cio' che dal passo dipende. E' un ricalcolo dell'app, non un gesto: fuori dalla storia.
    set({
      settings,
      legs: get().legs.map((l) => recalculateLeg(l, sicuro)),
    });
  },
});
