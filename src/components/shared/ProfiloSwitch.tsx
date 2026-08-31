'use client';

import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { ETICHETTE_PROFILO, type Profilo } from '@/lib/profilo';

/**
 * Cosa cambia passando all'altro profilo, detto in positivo e in negativo.
 *
 * Serve perche' un modo che nasconde funzioni deve dire quali: senza questa riga, chi
 * cambia profilo vede sparire dei pulsanti e non sa perche'.
 */
const SPIEGAZIONE: Record<Profilo, string> = {
  imparo: 'Ora ci sono verifica, quiz e progressi. Layer di emergenza, meteo e libreria sono nascosti: '
    + 'torna a «Vado in montagna» quando esci.',
  montagna: 'Ora ci sono layer di emergenza, meteo e libreria. Verifica, quiz e progressi sono nascosti: '
    + 'torna a «Imparo» per esercitarti.',
};

/**
 * Cambia il profilo d'uso.
 *
 * Sta in vista e dice il profilo per nome, non sepolto nelle impostazioni: **funzioni
 * nascoste sono funzioni non scoperte**, quindi il modo si deve vedere e si deve capire
 * che ne esiste un altro.
 *
 * Nessun dato viene toccato: i layer accesi, l'itinerario e lo storico restano dove
 * sono, e tornando al profilo di prima si ritrova tutto.
 */
export function ProfiloSwitch() {
  const profilo = useUIStore((s) => s.profilo);
  const setProfilo = useUIStore((s) => s.setProfilo);
  const [spiegazione, setSpiegazione] = useState<string | null>(null);

  const cambia = () => {
    const nuovo: Profilo = profilo === 'imparo' ? 'montagna' : 'imparo';
    setProfilo(nuovo);
    setSpiegazione(SPIEGAZIONE[nuovo]);
  };

  return (
    <div>
      <button
        onClick={cambia}
        className="w-full text-left px-3 min-h-[44px] flex items-center gap-2 text-sm text-gray-200 rounded hover:bg-white/5"
      >
        🎛️ Modalità: <strong className="font-semibold">{ETICHETTE_PROFILO[profilo]}</strong>
      </button>
      {spiegazione && (
        <p role="status" className="px-3 py-2 text-[11px] text-amber-300/90 leading-snug">
          {spiegazione}
        </p>
      )}
    </div>
  );
}
