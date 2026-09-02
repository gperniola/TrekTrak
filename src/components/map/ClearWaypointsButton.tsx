'use client';

import { useRef } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { choose, toast } from '@/stores/notificationStore';
import { liberaTessereDelPercorso } from '@/lib/useTessereOffline';
import { useMapOverlayGuard } from './useMapOverlayGuard';

/**
 * Cancella i waypoint dalla mappa, dove li si è messi.
 *
 * Tre scelte e non due: "tutti" e "l'ultimo" sono azioni diverse e nessuna è il
 * naturale contrario dell'altra, quindi un sì/no non basta. "L'ultimo" copre il caso
 * frequente del tocco sbagliato, e nel frattempo fa da annulla-a-un-passo finché non
 * esiste una vera cronologia (TASK-19).
 *
 * Il pulsante non compare senza waypoint: un comando di cancellazione sempre presente
 * ma inerte è solo rumore in una colonna già affollata sul telefono.
 */
export function ClearWaypointsButton() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const clearWaypoints = useItineraryStore((s) => s.clearWaypoints);
  const removeWaypoint = useItineraryStore((s) => s.removeWaypoint);
  const guard = useMapOverlayGuard<HTMLButtonElement>();
  // Un secondo tap mentre il dialog è aperto non deve aprirne un altro.
  const pendingRef = useRef(false);

  if (waypoints.length === 0) return null;

  const handleClick = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      const n = waypoints.length;
      const scelta = await choose({
        title: 'Cancellare i waypoint?',
        /*
          Cancellare tutto vuol dire abbandonare il percorso, e con lui vanno anche le
          mattonelle scaricate per quel percorso. Si dice **qui**: l'alternativa e'
          scoprirlo in quota, cioe' nel momento peggiore possibile.
        */
        message: (n === 1
          ? 'C\'è un solo waypoint sulla mappa.'
          : `Ci sono ${n} waypoint sulla mappa. Puoi cancellarli tutti, oppure solo l'ultimo che hai aggiunto.`)
          + ' Cancellando tutto si liberano anche le mappe scaricate per questo percorso.',
        variant: 'error',
        confirmText: n === 1 ? 'Cancella' : 'Cancella tutti',
        secondaryText: n === 1 ? undefined : 'Solo l\'ultimo',
        cancelText: 'Annulla',
      });
      if (scelta == null) return;

      // Lo stato va riletto qui: fra l'apertura del dialog e la risposta l'itinerario
      // può essere cambiato altrove (un tap sulla mappa, un'importazione).
      const attuali = useItineraryStore.getState().waypoints;
      if (attuali.length === 0) return;

      if (scelta === 'primary') {
        clearWaypoints();
        /*
          Via i waypoint, via anche le mattonelle: erano state scaricate per QUEL
          percorso, e senza di lui occupano spazio per niente — che su un telefono e'
          circa cinque megabyte di quota per mattonella. Cancellare **l'ultimo** invece
          non le tocca: il percorso c'e' ancora.
        */
        void liberaTessereDelPercorso();
        toast.success(attuali.length === 1 ? 'Waypoint cancellato' : `${attuali.length} waypoint cancellati`);
        return;
      }
      const ultimo = attuali[attuali.length - 1];
      removeWaypoint(ultimo.id);
      toast.success(`Cancellato: ${ultimo.name || 'ultimo waypoint'}`);
    } finally {
      pendingRef.current = false;
    }
  };

  return (
    <button
      ref={guard}
      onClick={handleClick}
      aria-label={`Cancella waypoint, ${waypoints.length} sulla mappa`}
      title="Cancella waypoint"
      className="absolute bottom-40 right-3 z-[1000] w-10 h-10 max-lg:w-11 max-lg:h-11 rounded-full shadow-lg flex items-center justify-center text-lg
                 bg-gray-800/90 text-red-400 hover:bg-gray-700 transition-colors
                 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
    >
      🗑️
      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-su-colore text-[10px] font-bold flex items-center justify-center">
        {waypoints.length}
      </span>
    </button>
  );
}
