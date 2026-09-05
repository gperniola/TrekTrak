'use client';

import { useState } from 'react';

/**
 * **Come si legge la tabella**: la parte didattica del pannello meteo, a fisarmonica.
 *
 * Chiusa per default. Sono quattro paragrafi che spiegano cosa vuol dire CAPE, perché il
 * pomeriggio è il momento sbagliato, la regola 30/30 e le soglie del vento: leggerli una
 * volta cambia come si guarda la tabella, rileggerli ogni volta la seppellisce.
 */
export function ComeSiLegge() {
  const [aperta, setAperta] = useState(false);
  return (
    <div>
      <button
        onClick={() => setAperta((v) => !v)}
        aria-expanded={aperta}
        className="text-xs text-green-400 hover:text-green-300 min-h-[44px] lg:min-h-0 flex items-center gap-1"
      >
        <span aria-hidden>{aperta ? '▾' : '▸'}</span> Come si legge
      </button>
      {aperta && (
        <div className="mt-1 text-[11px] text-gray-300 bg-gray-800/70 rounded-lg p-3 space-y-2 leading-relaxed">
          <p>
            <strong className="text-gray-100">CAPE</strong> è l’energia disponibile ai moti
            convettivi, in joule per chilogrammo. Dice quanta benzina c’è, non che il temporale
            ci sarà: sotto 300 la giornata è stabile, sopra 800 basta un innesco — una cresta
            scaldata dal sole — perché la cella si formi.
          </p>
          <p>
            In montagna la convezione segue il <strong className="text-gray-100">ciclo
            diurno</strong>: il terreno si scalda, l’aria sale, e il massimo cade nel primo
            pomeriggio. È la ragione della regola più vecchia dell’alpinismo: in vetta presto,
            giù prima delle 14.
          </p>
          <p>
            <strong className="text-gray-100">Regola 30/30</strong>: se fra il lampo e il tuono
            passano meno di 30 secondi, il temporale è entro ~10 km. Si scende dalle creste,
            si evitano alberi isolati e croci di vetta, e si riprende solo 30 minuti dopo
            l’ultimo tuono.
          </p>
          <p>
            Le <strong className="text-gray-100">raffiche</strong> contano quanto la pioggia:
            sopra 50 km/h su terreno esposto si cammina male, sopra 70 non si cammina.
          </p>
        </div>
      )}
    </div>
  );
}
