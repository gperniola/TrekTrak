import type { StateCreator } from 'zustand';
import type { ItineraryState } from './tipi';
import { recalculateLeg } from './helpers';

export type SliceTratte = Pick<ItineraryState, 'legs' | 'updateLeg' | 'clearAllValidation'>;

/**
 * Le tratte, per quel poco che si toccano da sole: quasi sempre cambiano come
 * conseguenza di un gesto sui waypoint, e quella parte vive nella slice dei waypoint
 * attraverso `catenaTratte`.
 */
export const creaSliceTratte: StateCreator<ItineraryState, [], [], SliceTratte> = (set, get) => ({
  legs: [],

  updateLeg: (id, data) => {
    set({
      legs: get().legs.map((leg) => {
        if (leg.id !== id) return leg;
        const aggiornata = { ...leg, ...data };
        /*
         * Il giudizio si azzera **campo per campo**, non tutto insieme: chi corregge la
         * sola distanza deve continuare a vedere il verde sull'azimut che aveva
         * indovinato. Non vale quando si sta scrivendo la validazione stessa.
         */
        if (!('validationState' in data) && leg.validationState) {
          const restante = { ...leg.validationState };
          if ('distance' in data) delete restante.distance;
          if ('elevationGain' in data) delete restante.elevationGain;
          if ('elevationLoss' in data) delete restante.elevationLoss;
          if ('azimuth' in data) delete restante.azimuth;
          aggiornata.validationState = Object.keys(restante).length > 0 ? restante : undefined;
        }
        return recalculateLeg(aggiornata, get().settings.pace?.factor ?? 1);
      }),
    });
  },

  clearAllValidation: () => {
    const { waypoints, legs } = get();
    set({
      waypoints: waypoints.map((wp) => ({ ...wp, validationState: undefined })),
      legs: legs.map((leg) => ({ ...leg, validationState: undefined })),
    });
  },
});
