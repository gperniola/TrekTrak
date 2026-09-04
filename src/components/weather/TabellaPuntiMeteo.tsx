'use client';

import { cielo } from '@/lib/cielo';
import { oraItaliana } from '@/lib/formato';
import type { Livello, RigaPercorso } from '@/lib/route-weather';

/**
 * Colore del testo che dice PERCHE' un punto e' problematico.
 *
 * Il pallino accanto al nome diceva "qui c'e' qualcosa" ma non cosa: chi legge doveva
 * incrociare da solo le tre colonne di numeri (CAPE, raffiche, pioggia) e sapere quali
 * soglie contano. Il motivo lo sapeva gia' `classifyHour`, che lo scrive in italiano
 * ("raffiche 85 km/h: pericolose in cresta"): non arrivava mai a schermo.
 *
 * Vale anche come accessibilita': il pallino e' `aria-hidden`, quindi la gravita' non
 * era leggibile a un lettore di schermo. Ora e' scritta.
 */
const COLORE_MOTIVO: Record<string, string> = {
  '0': 'text-green-300',
  '1': 'text-amber-300',
  '2': 'text-orange-300',
  '3': 'text-red-400',
  null: 'text-gray-400',
};

const PALLINO: Record<string, string> = {
  '0': 'bg-green-500',
  '1': 'bg-amber-400',
  '2': 'bg-orange-400',
  '3': 'bg-red-500',
  null: 'bg-gray-500',
};

function chiave(l: Livello): string { return l == null ? 'null' : String(l); }

function numero(v: number | undefined, unita = ''): string {
  return v == null || !Number.isFinite(v) ? '—' : `${Math.round(v)}${unita}`;
}

/**
 * **Una riga per punto del percorso: a che ora ci arrivi, e cosa trovi lì a quell'ora.**
 *
 * È la tabella che risponde alla domanda per cui questo pannello esiste. Un'app meteo dice
 * che tempo farà in un posto; questa dice che tempo farà **dove sarai tu**, perché conosce
 * il tuo passo.
 */
export function TabellaPuntiMeteo({ righe }: { righe: RigaPercorso[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Previsione per punto del percorso</caption>
        <thead>
          <tr className="text-gray-400 text-left">
            <th scope="col" className="py-1 pr-2 font-medium">Punto</th>
            <th scope="col" className="py-1 pr-2 font-medium">Arrivo</th>
            <th scope="col" className="py-1 pr-2 font-medium">Cielo</th>
            <th scope="col" className="py-1 pr-2 font-medium">CAPE</th>
            <th scope="col" className="py-1 pr-2 font-medium">Raffiche</th>
            <th scope="col" className="py-1 font-medium">Piogg.</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.waypointIndex} className="border-t border-gray-800">
              <td className="py-1.5 pr-2 text-gray-200">
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-1.5 ${PALLINO[chiave(r.classification.level)]}`}
                  aria-hidden
                />
                {r.waypointIndex + 1}. {r.name || 'senza nome'}
                {r.classification.reasons.length > 0 && (
                  <div className={`text-[10px] leading-tight mt-0.5 ${COLORE_MOTIVO[chiave(r.classification.level)]}`}>
                    {r.classification.reasons.join(' · ')}
                  </div>
                )}
              </td>
              <td className="py-1.5 pr-2 text-gray-300 font-mono">
                {r.arrival != null ? oraItaliana(r.arrival) : <span className="text-gray-400 font-sans">n/d</span>}
              </td>
              <td className="py-1.5 pr-2 text-gray-300 whitespace-nowrap">
                <Iconcina codice={r.hour?.weatherCode} temp={r.hour?.temp} />
              </td>
              <td className="py-1.5 pr-2 text-gray-300">{numero(r.hour?.cape)}</td>
              <td className="py-1.5 pr-2 text-gray-300">{numero(r.hour?.gusts, ' km/h')}</td>
              <td className="py-1.5 text-gray-300">{numero(r.hour?.precipProb, '%')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * La cella del cielo: iconcina, e la temperatura di quell'ora.
 *
 * L'icona è **decorativa** (`aria-hidden`) e accanto c'è sempre la parola in `sr-only`:
 * un'emoji letta da un lettore di schermo dà nomi tecnici tipo «sun behind cloud», che
 * non è la previsione. Il pallino della gravità, in questo progetto, è già stato corretto
 * per lo stesso motivo.
 *
 * Un codice che non si conosce si scrive **n/d**, non lo si disegna sereno: è la regola
 * che questo progetto ha pagato più volte.
 */
function Iconcina({ codice, temp }: { codice?: number; temp?: number }) {
  const c = cielo(codice);
  const gradi = temp != null && Number.isFinite(temp) ? Math.round(temp) : null;
  if (c == null && gradi == null) return <span className="text-gray-400">n/d</span>;
  return (
    <>
      {c == null ? <span className="text-gray-400">n/d</span> : (
        <>
          <span aria-hidden className="text-sm">{c.icona}</span>
          <span className="sr-only">{c.testo}</span>
        </>
      )}
      {gradi != null && (
        <>
          <span aria-hidden className="ml-1 tabular-nums">{gradi}°</span>
          <span className="sr-only">, {gradi} gradi</span>
        </>
      )}
    </>
  );
}
