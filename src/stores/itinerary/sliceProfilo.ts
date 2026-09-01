import type { StateCreator } from 'zustand';
import type { ItineraryState } from './tipi';

export type SliceProfilo = Pick<
  ItineraryState,
  'profileHover' | 'setProfileHover' | 'clearProfileHover' | 'profileFlyTo' | 'setProfileFlyTo' | 'clearProfileFlyTo'
>;

/**
 * Il dito sul profilo altimetrico: dove sta e dove deve volare la mappa.
 *
 * È l'unica parte dello store che non riguarda i dati dell'itinerario ma un gesto in
 * corso, e cambia decine di volte al secondo mentre si scorre il grafico. Per questo
 * l'autosalvataggio la ignora esplicitamente: sottoscriverla senza filtrare vorrebbe
 * dire scrivere su disco a ogni movimento.
 */
export const creaSliceProfilo: StateCreator<ItineraryState, [], [], SliceProfilo> = (set) => ({
  profileHover: null,
  profileFlyTo: null,

  // Una distanza negativa o non finita non e' un punto del percorso: si ignora invece di
  // far volare la mappa in un posto che non esiste.
  setProfileHover: (distance, source) => {
    if (!Number.isFinite(distance) || distance < 0) return;
    set({ profileHover: { distance, source } });
  },
  clearProfileHover: () => set({ profileHover: null }),

  setProfileFlyTo: (distance) => {
    if (!Number.isFinite(distance) || distance < 0) return;
    set({ profileFlyTo: distance });
  },
  clearProfileFlyTo: () => set({ profileFlyTo: null }),
});
