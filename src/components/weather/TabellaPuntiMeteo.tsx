'use client';

import { cielo } from '@/lib/cielo';
import { numero, oraItaliana, durataMin } from '@/lib/formato';
import { righeVisibili, type Livello, type RigaPercorso, type PuntoIntermedio } from '@/lib/route-weather';

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

function intero(v: number | undefined, unita = ''): string {
  return v == null || !Number.isFinite(v) ? '—' : `${Math.round(v)}${unita}`;
}

/**
 * Il colore dei millimetri: la scala convenzionale dell'intensita' oraria (debole sotto
 * 1, moderata fino a 4, forte fino a 10, nubifragio oltre), coi colori che l'app usa gia'
 * per la gravita'.
 *
 * NON entra nel giudizio: le soglie misurate sono di probabilita', e una soglia in mm
 * inventata qui sarebbe il difetto che quella misura ha appena tolto. Serve all'occhio,
 * per distinguere una spruzzata da un rovescio che ti ferma.
 */
function classeMm(mm: number | undefined): string {
  if (mm == null || !Number.isFinite(mm) || mm < 1) return 'text-gray-300';
  if (mm < 4) return 'text-amber-300';
  if (mm < 10) return 'text-orange-300';
  return 'text-red-400';
}

/**
 * Zero e' un fatto («non piove»), un dato che manca e' un'altra cosa: si scrivono
 * diversi. Confonderli e' la direzione di errore che questo progetto ha gia' pagato.
 */
function testoMm(mm: number | undefined): string {
  if (mm == null || !Number.isFinite(mm)) return 'n/d';
  if (mm === 0) return '—';
  return `${numero(mm, 1)} mm`;
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
            <th scope="col" className="py-1 pr-2 font-medium">mm</th>
            <th scope="col" className="py-1 pr-2 font-medium">Raffiche</th>
            <th scope="col" className="py-1 font-medium">Piogg.</th>
          </tr>
        </thead>
        <tbody>
          {righeVisibili(righe).map((r) => (
            <tr
              key={r.intermedio != null
                ? `mezzo-${Math.round(r.intermedio.kmDaInizio * 10)}`
                : `${r.waypointIndex}-${r.fase ?? 'x'}`}
              className="border-t border-gray-800"
            >
              <td className="py-1.5 pr-2 text-gray-200">
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-1.5 ${PALLINO[chiave(r.classification.level)]}`}
                  aria-hidden
                />
                {r.intermedio != null
                  ? <EtichettaIntermedio intermedio={r.intermedio} />
                  : <>{r.waypointIndex + 1}. {r.name || 'senza nome'}</>}
                <EtichettaSosta fase={r.fase} pausaMin={r.pausaMin} />
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
              <td className={`py-1.5 pr-2 whitespace-nowrap ${classeMm(r.hour?.mm)}`}>
                {testoMm(r.hour?.mm)}
              </td>
              <td className="py-1.5 pr-2 text-gray-300">{intero(r.hour?.gusts, ' km/h')}</td>
              <td className="py-1.5 text-gray-300">{intero(r.hour?.precipProb, '%')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * L'etichetta di un punto **inserito automaticamente** fra due waypoint distanti.
 *
 * Compare solo quando quel punto è critico (la tabella filtra con `righeVisibili`): dice
 * che non è un waypoint dell'utente ma un controllo «in mezzo», fra quali waypoint cade —
 * così si capisce dov'è senza cercarlo sulla mappa. Quale dei due (se più d'uno sullo
 * stesso tratto) lo distinguono l'orario di arrivo e il motivo, accanto.
 *
 * NON si scrive «≈ km N»: la distanza qui sarebbe in linea d'aria, mentre tutto il resto
 * dell'app conta i km lungo la traccia reale — un numero che non combacia con gli altri
 * è peggio di nessun numero (la lezione della v0.13.3).
 */
function EtichettaIntermedio({ intermedio }: { intermedio: PuntoIntermedio }) {
  return (
    <>
      <span className="text-amber-200 font-medium">in mezzo</span>
      <span className="block text-[10px] leading-tight text-gray-400">
        tra «{intermedio.traA}» e «{intermedio.traB}»
      </span>
    </>
  );
}

/**
 * Dice, sotto il nome del punto, che qui c'è una **sosta** e in che fase è questa riga.
 *
 * Con sosta lunga il punto compare due volte — «arrivo» e «ripartenza» — e senza
 * un'etichetta le due righe sarebbero identiche al primo sguardo, con orari diversi e
 * nessuna spiegazione. Con sosta breve c'è una riga sola: si annota solo la durata.
 */
function EtichettaSosta({ fase, pausaMin }: { fase?: 'arrivo' | 'ripartenza'; pausaMin?: number }) {
  const min = pausaMin ?? 0;
  if (min <= 0) return null;
  if (fase == null) {
    return (
      <span className="ml-1.5 text-[10px] text-amber-300 whitespace-nowrap">
        <span aria-hidden>⏸</span> sosta {durataMin(min)}
      </span>
    );
  }
  return (
    <span
      className={`ml-1.5 text-[10px] px-1 rounded whitespace-nowrap ${
        fase === 'arrivo' ? 'bg-amber-900/50 text-amber-200' : 'bg-sky-900/50 text-sky-200'
      }`}
    >
      {fase === 'arrivo' ? `arrivo · sosta ${durataMin(min)}` : 'ripartenza'}
    </span>
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
