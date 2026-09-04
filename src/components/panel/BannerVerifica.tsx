'use client';

import type { RiassuntoVerifica } from '@/lib/useVerifica';

/**
 * L'esito della verifica, subito sopra i pulsanti: quanti campi giusti, quanti da
 * rivedere, quanti sbagliati — e, se c'è un prima con cui confrontarsi, di quanto si è
 * migliorato.
 *
 * Si tocca per chiuderlo prima che sfumi da sé. `role="status"` con `aria-live="polite"`
 * perché è il risultato di un gesto: chi usa un lettore di schermo deve sentirlo senza
 * andarlo a cercare, ma non a interruzione di quello che sta leggendo.
 */
export function BannerVerifica(
  { riassunto, inDissolvenza, chiudi }:
  { riassunto: RiassuntoVerifica; inDissolvenza: boolean; chiudi: () => void },
) {
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={chiudi}
      className={`bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-center cursor-pointer transition-opacity duration-300 ${inDissolvenza ? 'opacity-0' : 'opacity-100'}`}
    >
      Verifica completata:{' '}
      <span className="text-green-400 font-bold">{riassunto.valid} ✓</span>
      {' · '}
      <span className="text-yellow-400 font-bold">{riassunto.warning} ~</span>
      {' · '}
      <span className="text-red-400 font-bold">{riassunto.error} ✗</span>
      {riassunto.improvement != null && (
        <span className={`block mt-1 text-xs font-medium ${riassunto.improvement > 0 ? 'text-green-400' : 'text-amber-400'}`}>
          {riassunto.improvement > 0 ? '📈 ' : '📉 '}
          {riassunto.improvement > 0 ? '+' : ''}{riassunto.improvement}% rispetto alla sessione precedente
        </span>
      )}
    </div>
  );
}
