'use client';

import { useState } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useModaleTastiera } from '@/lib/useModaleTastiera';

/**
 * **Cosa vogliono dire i livelli di criticità, e come vengono calcolati.**
 *
 * Un link ⓘ accanto al verdetto apre un popup con la scala (0-3), gli eventi che alzano
 * il livello con le loro soglie, e come i punti diventano un verdetto solo. È la stessa
 * tabella che serve a leggere il pallino colorato: senza, il colore dice «qui c'è
 * qualcosa» ma non con che metro — e le soglie non si indovinano.
 *
 * Distinto dal «Come si legge» in fondo (che spiega CAPE, ciclo diurno, regola 30/30):
 * quello è meteorologia, questo è come l'app **assegna** la gravità.
 */

/** La scala: pallino (solo colore, niente testo sopra — così il guardiano del tema tace). */
const LIVELLI: { pallino: string; nome: string; quando: string }[] = [
  { pallino: 'bg-green-500', nome: 'Nessuna criticità', quando: 'niente di rilevante agli orari stimati' },
  { pallino: 'bg-amber-400', nome: 'Da tenere d’occhio', quando: 'un segnale leggero (pioggia possibile, raffiche moderate)' },
  { pallino: 'bg-orange-400', nome: 'Attenzione', quando: 'pioggia molto probabile o raffiche forti' },
  { pallino: 'bg-red-500', nome: 'Rischio alto', quando: 'temporale, raffiche pericolose o instabilità con innesco' },
];

/** Gli eventi che alzano il livello, con la soglia e il grado risultante. */
const EVENTI: { evento: string; soglia: string; livello: string }[] = [
  { evento: 'Temporale (anche con grandine)', soglia: 'dichiarato dal modello', livello: 'Rischio alto' },
  { evento: 'Instabilità con innesco', soglia: 'CAPE ≥ 800 e pioggia ≥ 30%', livello: 'Rischio alto' },
  { evento: 'Raffiche pericolose', soglia: '≥ 70 km/h', livello: 'Rischio alto' },
  { evento: 'Pioggia molto probabile', soglia: '≥ 70%', livello: 'Attenzione' },
  { evento: 'Raffiche forti', soglia: '50–69 km/h', livello: 'Attenzione' },
  { evento: 'Pioggia probabile', soglia: '40–69%', livello: 'Da tenere d’occhio' },
  { evento: 'Raffiche', soglia: '30–49 km/h', livello: 'Da tenere d’occhio' },
  { evento: 'Instabilità estrema, senza pioggia', soglia: 'CAPE ≥ 2000', livello: 'Da tenere d’occhio' },
];

export function SpiegazioneCriticita() {
  const [aperto, setAperto] = useState(false);
  const dialogRef = useModaleTastiera<HTMLDivElement>(aperto, () => setAperto(false));
  useBodyScrollLock(aperto);

  return (
    <>
      <button
        onClick={() => setAperto(true)}
        aria-haspopup="dialog"
        className="text-[11px] text-green-400 hover:text-green-300 min-h-[44px] lg:min-h-0 inline-flex items-center gap-1"
      >
        <span aria-hidden className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-current text-[9px] font-bold">i</span>
        Livelli di criticità: cosa sono e come si calcolano
      </button>

      {aperto && (
        <div
          className="fixed inset-0 z-[1400] bg-black/70 flex items-end lg:items-center justify-center"
          onClick={() => setAperto(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Livelli di criticità del meteo del percorso"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full lg:max-w-lg max-h-[85vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-t-2xl lg:rounded-2xl p-4 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-bold text-green-400">Livelli di criticità</h3>
              <button
                onClick={() => setAperto(false)}
                aria-label="Chiudi"
                className="shrink-0 text-gray-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">La scala</h4>
              <ul className="space-y-1.5">
                {LIVELLI.map((l) => (
                  <li key={l.nome} className="flex items-start gap-2 text-xs text-gray-300">
                    <span aria-hidden className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${l.pallino}`} />
                    <span>
                      <strong className="text-gray-100">{l.nome}</strong> — {l.quando}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-400 leading-snug">
                Quando i dati di un’ora mancano si legge <strong className="text-gray-300">n/d</strong>,
                non «sereno». Il livello di un’ora è il <strong className="text-gray-300">più grave</strong>
                {' '}fra gli eventi qui sotto che scattano in quell’ora.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Cosa alza il livello</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 text-left">
                      <th scope="col" className="py-1 pr-2 font-medium">Evento</th>
                      <th scope="col" className="py-1 pr-2 font-medium">Soglia</th>
                      <th scope="col" className="py-1 font-medium">Grado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EVENTI.map((e) => (
                      <tr key={e.evento} className="border-t border-gray-800 align-top">
                        <td className="py-1.5 pr-2 text-gray-200">{e.evento}</td>
                        <td className="py-1.5 pr-2 text-gray-300 tabular-nums whitespace-nowrap">{e.soglia}</td>
                        <td className="py-1.5 text-gray-300">{e.livello}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-400 leading-snug">
                Il <strong className="text-gray-300">CAPE</strong> è energia, non un evento: da solo,
                col cielo stabile e senza pioggia prevista, non alza il livello — conta come aggravante
                quando la pioggia è già probabile. I <strong className="text-gray-300">rovesci</strong>
                {' '}si vedono come icona nella colonna Cielo e pesano tramite la probabilità di pioggia.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Dal punto al verdetto</h4>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Il verdetto in cima prende il livello <strong className="text-gray-100">peggiore</strong> fra
                i punti del percorso agli orari a cui li raggiungi. Le ore instabili della giornata (livello
                Attenzione o più) formano le <strong className="text-gray-100">fasce critiche</strong>: se una
                di queste <strong className="text-gray-100">incrocia il tuo cammino</strong> — sei ancora fuori
                quando si apre — il verdetto la nomina e sale ad Attenzione. Una fascia alle 18 non conta se
                alle 15 sei già rientrato.
              </p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Se due waypoint sono lontani, l’app interroga anche dei punti <strong className="text-gray-300">in
                mezzo</strong> (uno ogni ~5 km, finché c’è spazio nel campionamento): entrano sempre nel
                verdetto e nelle fasce, ma compaiono in tabella solo quando lì il meteo è critico — così il
                tratto centrale viene guardato, non solo gli estremi.
              </p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
