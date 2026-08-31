'use client';

import type { PointerEventHandler } from 'react';

interface Props {
  /** I gestori del gesto, da `useSheetDrag().propsManiglia`. */
  gesto: {
    onPointerDown?: PointerEventHandler;
    onPointerMove?: PointerEventHandler;
    onPointerUp?: PointerEventHandler;
    onPointerCancel?: PointerEventHandler;
  };
}

/**
 * La barretta in cima a un foglio che si puo' trascinare via.
 *
 * Esiste per una ragione sola: **un gesto che non si vede non esiste**. Senza
 * affordance il trascinamento sarebbe una funzione scritta per chi ha letto il codice,
 * e chiunque altro continuerebbe a cercare la ✕ — che infatti resta al suo posto.
 *
 * `touch-none` (cioe' `touch-action: none`) e' quello che permette al gesto di partire
 * da qui anche quando il contenuto sotto sta scorrendo: senza, il browser prenderebbe
 * il movimento per se' e manderebbe `pointercancel`.
 *
 * `aria-hidden` perche' per chi non trascina non e' un comando ma una decorazione: il
 * comando accessibile e' il pulsante di chiusura.
 */
export function SheetHandle({ gesto }: Props) {
  return (
    <div
      {...gesto}
      aria-hidden="true"
      className="lg:hidden flex items-center justify-center h-7 -mt-1 mb-0.5 touch-none cursor-grab active:cursor-grabbing"
    >
      <span className="w-9 h-1 rounded-full bg-gray-500" />
    </div>
  );
}
