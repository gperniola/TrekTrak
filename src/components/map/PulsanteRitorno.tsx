'use client';

import { useRef } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';
import { autoFillAllTrackData } from '@/lib/auto-fill';
import { useMapOverlayGuard } from './useMapOverlayGuard';
import { numero } from '@/lib/formato';

/** Il tetto dei waypoint: lo stesso dello store, dichiarato per il messaggio. */
const MASSIMO_WAYPOINT = 50;

/**
 * **Aggiunge il percorso di ritorno, dove si sta disegnando l'andata.**
 *
 * La maggior parte delle escursioni torna per la stessa strada, e fin qui l'unico modo di
 * dirlo all'app era rimettere a mano ogni punto in ordine inverso — su un percorso di
 * dieci waypoint, nove tocchi di precisione per informazione che l'app ha già. Il
 * pulsante sta accanto al cestino perché è lì che vive la colonna dei gesti sul percorso.
 *
 * **Prima si spiega, poi si fa** (chiesto così): il dialogo dice quanti punti verranno
 * aggiunti e come, e in Imparo avverte che le tratte nuove nascono vuote — i valori li
 * scrive l'utente, come per l'andata, perché è il mestiere di quel profilo.
 *
 * Compare da due waypoint in su: con uno solo non c'è un'andata da specchiare.
 */
export function PulsanteRitorno() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const aggiungiRitorno = useItineraryStore((s) => s.aggiungiRitorno);
  const guard = useMapOverlayGuard<HTMLButtonElement>();
  // Un secondo tocco mentre il dialogo aspetta non deve aprirne un altro.
  const inAttesa = useRef(false);

  if (waypoints.length < 2) return null;

  const handleClick = async () => {
    if (inAttesa.current) return;
    inAttesa.current = true;
    try {
      const { waypoints: attuali, appMode } = useItineraryStore.getState();
      const daAggiungere = attuali.length - 1;

      if (attuali.length + daAggiungere > MASSIMO_WAYPOINT) {
        toast.warning(
          `Il ritorno aggiungerebbe ${numero(daAggiungere)} waypoint e supererebbe il tetto di ${numero(MASSIMO_WAYPOINT)}.`,
        );
        return;
      }

      const ultimo = attuali[attuali.length - 1];
      const ok = await appConfirm({
        title: 'Aggiungere il ritorno?',
        message:
          (daAggiungere === 1
            ? `Aggiunge 1 waypoint: di nuovo la partenza, per tornare da «${ultimo.name || 'ultimo punto'}» per la stessa strada. `
            : `Aggiunge ${numero(daAggiungere)} waypoint: gli stessi dell'andata in ordine inverso, `
              + `da «${ultimo.name || 'ultimo punto'}» fino alla partenza. `)
          + (appMode === 'track'
            ? 'Distanze e dislivelli delle nuove tratte li calcola l’app.'
            : 'Le nuove tratte nascono vuote: distanze, dislivelli e azimut li scrivi tu, come per l’andata.'),
        confirmText: 'Aggiungi il ritorno',
        cancelText: 'Annulla',
      });
      if (!ok) return;

      /*
        Lo stato si rilegge dopo l'attesa: il dialogo puo' restare aperto a lungo, e nel
        frattempo un tocco sulla mappa o un annulla possono aver cambiato il percorso.
        Specchiare la lista catturata al render aggiungerebbe punti di un percorso che
        non c'e' piu'.
      */
      const freschi = useItineraryStore.getState().waypoints;
      if (freschi.length < 2 || freschi.length * 2 - 1 > MASSIMO_WAYPOINT) return;

      aggiungiRitorno();
      // In Pianificazione i valori delle tratte nuove li calcola l'app, come per un tap.
      if (useItineraryStore.getState().appMode === 'track') {
        void autoFillAllTrackData(true);
      }
      toast.success(`Ritorno aggiunto: ${numero(freschi.length - 1)} waypoint sullo stesso percorso`);
    } finally {
      inAttesa.current = false;
    }
  };

  return (
    <button
      ref={guard}
      onClick={handleClick}
      aria-label="Aggiungi il percorso di ritorno"
      title="Aggiungi il ritorno (stessi punti, in ordine inverso)"
      className="absolute bottom-52 right-3 z-[1000] w-10 h-10 max-lg:w-11 max-lg:h-11 rounded-full shadow-lg flex items-center justify-center text-lg
                 bg-gray-800/90 text-sky-300 hover:bg-gray-700 transition-colors
                 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
    >
      ↩️
    </button>
  );
}
