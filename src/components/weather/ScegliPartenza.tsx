'use client';

import { giornoItaliano, istanteItaliano, oraItalianaDi } from '@/lib/route-weather';

/**
 * **Giorno e ora di partenza.** Senza, «arrivi verso le 14:40» non è calcolabile: tutto
 * il pannello è la previsione incrociata con gli orari di Munter, e Munter parte da un'ora.
 *
 * Si scelgono in **ora italiana**, perché in ora italiana è scritto tutto il resto del
 * pannello: arrivi, fasce critiche, alba e tramonto. Quando il menu usava l'ora del
 * dispositivo, su una macchina fuori dall'Italia si sceglieva «le 5» e la tabella partiva
 * dalle 07:00 — le due metà del pannello parlavano di due fusi diversi.
 */
export function ScegliPartenza(
  { partenza, cambia }: { partenza: Date; cambia: (quando: Date) => void },
) {
  const giorni = [0, 1, 2].map((d) => {
    const giorno = giornoItaliano(new Date(Date.now() + d * 24 * 3600000));
    return {
      d,
      label: d === 0 ? 'oggi' : d === 1 ? 'domani' : 'dopodomani',
      giorno,
      data: istanteItaliano(giorno, 12),
    };
  });
  const giornoPartenza = giornoItaliano(partenza);
  const giornoScelto = giorni.find((g) => g.giorno === giornoPartenza)?.d ?? 0;
  const oraPartenza = oraItalianaDi(partenza);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-400">Partenza</span>
      <select
        value={giornoScelto}
        onChange={(e) => {
          const scelto = giorni.find((g) => g.d === Number(e.target.value)) ?? giorni[0];
          cambia(istanteItaliano(scelto.giorno, oraPartenza));
        }}
        aria-label="Giorno di partenza"
        className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white max-lg:min-h-[44px]"
      >
        {giorni.map((g) => (
          <option key={g.d} value={g.d}>
            {g.label} ({g.data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' })})
          </option>
        ))}
      </select>
      <span className="text-gray-400">alle</span>
      <select
        value={oraPartenza}
        onChange={(e) => cambia(istanteItaliano(giornoPartenza, Number(e.target.value)))}
        aria-label="Ora di partenza"
        className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white max-lg:min-h-[44px]"
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
        ))}
      </select>
    </div>
  );
}
