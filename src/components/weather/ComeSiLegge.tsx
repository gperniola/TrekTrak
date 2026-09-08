'use client';

import { useState } from 'react';

/**
 * **Come si legge il meteo del percorso**: la parte esplicativa, a fisarmonica, chiusa
 * per default.
 *
 * Raccoglie due cose che prima erano separate: **come l'app assegna la gravità** (la scala
 * dei livelli, le soglie degli eventi, come i punti diventano un verdetto — prima nel
 * popup «Livelli di criticità») e **la meteorologia** che sta dietro (CAPE, ciclo diurno,
 * regola 30/30, vento). Stavano in due posti che si sovrapponevano; qui sono un'unica
 * spiegazione, che si apre quando serve e non ingombra il pannello quando non serve.
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
        <div className="mt-1 space-y-4 bg-gray-800/70 rounded-lg p-3">
          <section className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-gray-200 uppercase tracking-wider">I livelli</h4>
            <ul className="space-y-1.5">
              {LIVELLI.map((l) => (
                <li key={l.nome} className="flex items-start gap-2 text-[11px] text-gray-300">
                  <span aria-hidden className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${l.pallino}`} />
                  <span><strong className="text-gray-100">{l.nome}</strong> — {l.quando}</span>
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
            <h4 className="text-[10px] font-semibold text-gray-200 uppercase tracking-wider">Cosa alza il livello</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th scope="col" className="py-1 pr-2 font-medium">Evento</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Soglia</th>
                    <th scope="col" className="py-1 font-medium">Grado</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTI.map((e) => (
                    <tr key={e.evento} className="border-t border-gray-700/60 align-top">
                      <td className="py-1.5 pr-2 text-gray-200">{e.evento}</td>
                      <td className="py-1.5 pr-2 text-gray-300 tabular-nums whitespace-nowrap">{e.soglia}</td>
                      <td className="py-1.5 text-gray-300">{e.livello}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-gray-200 uppercase tracking-wider">Dal punto al verdetto</h4>
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
              mezzo</strong> (uno ogni ~5 km, finché c’è spazio nel campionamento): entrano sempre nel verdetto
              e nelle fasce, ma compaiono in tabella solo quando lì il meteo è critico. Gli orari vengono dalla
              stima di Munter, col tuo passo, e tengono conto delle soste che imposti sui punti.
            </p>
          </section>

          <section className="space-y-2 text-[11px] text-gray-300 leading-relaxed border-t border-gray-700/60 pt-3">
            <h4 className="text-[10px] font-semibold text-gray-200 uppercase tracking-wider">La meteorologia dietro</h4>
            <p>
              Il <strong className="text-gray-100">CAPE</strong> è l’energia disponibile ai moti convettivi
              (joule per chilogrammo): la benzina, non il fuoco. Da solo — col cielo coperto ma stabile e zero
              pioggia prevista — non fa un temporale, quindi non fa scattare l’avviso; conta come
              <em> aggravante</em> quando la pioggia è già probabile (energia + innesco = celle forti). Lo vedi
              comunque in tabella, come contesto.
            </p>
            <p>
              In montagna la convezione segue il <strong className="text-gray-100">ciclo diurno</strong>: il
              terreno si scalda, l’aria sale, e il massimo cade nel primo pomeriggio. È la ragione della regola
              più vecchia dell’alpinismo: in vetta presto, giù prima delle 14.
            </p>
            <p>
              <strong className="text-gray-100">Regola 30/30</strong>: se fra il lampo e il tuono passano meno
              di 30 secondi, il temporale è entro ~10 km. Si scende dalle creste, si evitano alberi isolati e
              croci di vetta, e si riprende solo 30 minuti dopo l’ultimo tuono.
            </p>
            <p>
              Le <strong className="text-gray-100">raffiche</strong> contano quanto la pioggia: sopra 50 km/h
              su terreno esposto si cammina male, sopra 70 non si cammina.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
