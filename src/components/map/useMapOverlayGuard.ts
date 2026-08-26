'use client';

import { useCallback, useRef } from 'react';
import L from 'leaflet';

/**
 * Gesti che Leaflet fa partire da questi eventi DOM (zoom da doppio click, drag e
 * tapHold da touch, menu contestuale). Il `click` NON è in lista: vedi sotto.
 */
const GESTURE_EVENTS = ['dblclick', 'touchstart', 'contextmenu'] as const;

/**
 * Guardia per gli overlay React montati DENTRO `MapContainer`.
 *
 * Senza di essa il click su un overlay risale fino a `.leaflet-container`, Leaflet
 * non trova un layer bersaglio e spara l'evento `click` della mappa: `MapEvents` lo
 * interpreta come "aggiungi waypoint" e sporca l'itinerario a ogni tocco. Wheel e
 * drag, allo stesso modo, zoomano e pannano invece di scrollare l'overlay.
 *
 * Il `click` viene neutralizzato col flag `_leaflet_disable_click` e NON con
 * `stopPropagation`. Il motivo è che React 18 ascolta in delega sul container radice,
 * che è un antenato della mappa: fermare la propagazione del click sull'overlay
 * impedirebbe a React di ricevere l'evento, e gli `onClick` dei figli (gli switch del
 * pannello) non scatterebbero più. Leaflet invece scarta i click per conto suo —
 * `Map._handleDOMEvent` chiama `_isClickDisabled`, che risale gli antenati del
 * bersaglio in cerca del flag (`leaflet-src.js:4494-4505`) — quindi il flag basta e
 * lascia il DOM intatto.
 *
 * È una callback ref, non una ref oggetto, perché gli overlay compaiono e
 * scompaiono con un render condizionale (`if (!open) return null`): un `useEffect`
 * con deps `[]` girerebbe al mount, quando l'elemento non esiste ancora, e non
 * verrebbe mai più rieseguito.
 */
export function useMapOverlayGuard<T extends HTMLElement>(): (node: T | null) => void {
  const detach = useRef<(() => void) | null>(null);

  return useCallback((node: T | null) => {
    detach.current?.();
    detach.current = null;
    if (!node) return;

    // Wheel: senza questa, la rotellina sul pannello scrollabile zooma la mappa.
    L.DomEvent.disableScrollPropagation(node);

    // Gesti di mappa: qui stopPropagation va bene, React non usa questi eventi
    // negli overlay di emergenza. `mousedown` resta libero di proposito, perché
    // serve alla delega eventi di React.
    const stop = L.DomEvent.stopPropagation;
    GESTURE_EVENTS.forEach((e) => L.DomEvent.on(node, e, stop));

    (node as unknown as Record<string, boolean>)['_leaflet_disable_click'] = true;

    detach.current = () => {
      GESTURE_EVENTS.forEach((e) => L.DomEvent.off(node, e, stop));
      delete (node as unknown as Record<string, boolean>)['_leaflet_disable_click'];
    };
  }, []);
}
