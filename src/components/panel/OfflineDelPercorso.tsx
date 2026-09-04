'use client';

import { useTessereOffline } from '@/lib/useTessereOffline';
import { numero } from '@/lib/formato';

/**
 * **Le mattonelle del percorso appena fatto, da qui.**
 *
 * La sezione in Impostazioni mappa resta — è il posto dove si vede quanto spazio occupano
 * e si liberano — ma chiedere di scaricare la mappa *di questo percorso* è un gesto che
 * appartiene al percorso, non alle impostazioni: chi finisce di disegnarlo è qui, non in
 * un pannello due tocchi più in là.
 *
 * Il conto arriva dallo stesso modulo che poi scarica: il numero che si legge è esattamente
 * quello che verrà chiesto. Le due parti — il pulsante e il promemoria in fondo — chiamano
 * entrambe `useTessereOffline`, e va bene: il piano è calcolato una volta sola dallo store
 * dell'itinerario e lo stato dello scaricamento vive **fuori** dai componenti, appunto
 * perché due copie della stessa verità divergono.
 */
export function PulsanteOffline() {
  const offline = useTessereOffline();
  return (
    <button
      onClick={() => { void offline.scarica(); }}
      disabled={offline.daScaricare.length === 0 || offline.inCorso}
      aria-describedby={offline.daScaricare.length === 0 ? 'motivo-export' : undefined}
      title={offline.daScaricare.length > 0
        ? `${numero(offline.daScaricare.length)} mattonelle di ${offline.nomeMappa}`
        : undefined}
      className="flex-1 py-2 bg-gray-200 text-gray-900 rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
    >
      {offline.inCorso
        ? `↓ ${numero(offline.avanzamento?.fatte ?? 0)}/${numero(offline.avanzamento?.totali ?? 0)}`
        : '📥 Mappa offline'}
    </button>
  );
}

/**
 * Il promemoria delle mattonelle, in fondo e in piccolo.
 *
 * Compare solo quando c'è qualcosa da scaricare e non lo si sta già facendo: un
 * suggerimento che sta lì sempre diventa arredamento e non lo legge più nessuno. Dice
 * **quante** sono, perché «scarica le mappe» senza un numero non aiuta a decidere se sia
 * il momento — e in quota si arriva senza aver deciso.
 */
export function PromemoriaOffline() {
  const offline = useTessereOffline();
  if (offline.daScaricare.length === 0 || offline.inCorso) return null;
  return (
    <p className="text-[10px] text-gray-400 leading-snug">
      Prima di partire: <strong className="font-medium">📥 Mappa offline</strong> conserva
      le {numero(offline.daScaricare.length)} mattonelle di questo percorso sul telefono,
      per vederlo dove non c&rsquo;è segnale.
    </p>
  );
}
