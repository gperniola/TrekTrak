import { create } from 'zustand';
import type { ItineraryState } from './itinerary/tipi';
import { creaSliceDocumento } from './itinerary/sliceDocumento';
import { creaSliceWaypoints } from './itinerary/sliceWaypoints';
import { creaSliceTratte } from './itinerary/sliceTratte';
import { creaSliceModo } from './itinerary/sliceModo';
import { creaSliceProfilo } from './itinerary/sliceProfilo';

/**
 * Lo store dell'itinerario, composto da slice (task-27).
 *
 * Era un file solo da 386 righe con dentro cinque argomenti diversi. La divisione NON
 * cambia niente per chi lo usa: `useItineraryStore((s) => s.waypoints)` funziona
 * esattamente come prima, perché le slice si fondono in un oggetto solo e ognuna riceve
 * `set`/`get` tipati sull'intero stato.
 *
 * La divisione segue **dove passano davvero i confini**, non l'elenco dei campi:
 *
 * - `sliceDocumento` — identità dell'itinerario e i tre modi di rimpiazzarlo per intero;
 * - `sliceWaypoint` — i punti, e per forza anche la catena delle tratte fra loro;
 * - `sliceTratte` — quel poco che si tocca su una tratta da sola;
 * - `sliceModo` — Learn/Track e le impostazioni, che si parlano solo al cambio di modo;
 * - `sliceProfilo` — il dito sul grafico, che non è un dato dell'itinerario.
 *
 * Waypoint e tratte NON sono divisi, benché il task lo chiedesse: una tratta esiste *fra*
 * due waypoint consecutivi, quindi ogni aggiunta o rimozione è per forza un fatto di
 * entrambi. Tenerli separati avrebbe prodotto due pezzi che si chiamano a vicenda a ogni
 * gesto. Quello che invece si poteva estrarre è la ricostruzione della catena, che era
 * scritta **tre volte** quasi identica: ora è `catenaTratte` in `helpers.ts`.
 */
export const useItineraryStore = create<ItineraryState>()((...a) => ({
  ...creaSliceDocumento(...a),
  ...creaSliceWaypoints(...a),
  ...creaSliceTratte(...a),
  ...creaSliceModo(...a),
  ...creaSliceProfilo(...a),
}));

export type { ItineraryState };
