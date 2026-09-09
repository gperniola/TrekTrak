'use client';

import { cieloDellOra, type Cielo } from '@/lib/cielo';
import { numero, oraItaliana, durataMin } from '@/lib/formato';
import { righeVisibili, type Livello, type RigaPercorso, type PuntoIntermedio, type SoglieModello } from '@/lib/route-weather';
import { Fragment, useEffect, useState } from 'react';
import { AzioniPunto, BottoneAzioniPunto } from '@/components/weather/AzioniPunto';

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

/**
 * Un numero intero con la sua unita', all'italiana.
 *
 * Il trattino era il difetto: `—` significava «manca il dato» qui e «zero» nella colonna
 * dei millimetri, **nella stessa riga**. Chi legge non poteva distinguere un fatto da una
 * lacuna, che e' esattamente la confusione che questo progetto si e' imposto di evitare.
 * Ora l'assenza si dichiara `n/d` come ovunque, e `—` resta solo «non piove».
 *
 * La formattazione passa da `numero`, la casa dei formati: `Math.round` da solo scriveva
 * `1200` dove il resto dell'app scrive `1.200`.
 */
function intero(v: number | undefined, unita = ''): string {
  if (v == null || !Number.isFinite(v)) return 'n/d';
  return `${numero(v, 0)}${unita}`;
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
  /*
   * **L'unita' sta nella cella, non solo nell'intestazione.**
   *
   * L'avevo tolta per far stare la tabella a 360 px, e la segnalazione e' arrivata subito:
   * «vedo 0,2 — sono 0,2 mm o 0,2 cm?». Un numero senza unita' accanto ad altri numeri con
   * unita' non e' compatto, e' ambiguo — e su una quantita' di pioggia l'ambiguita' e' un
   * fattore dieci. I pixel si trovano altrove.
   */
  return `${numero(mm, 1)} mm`;
}

/**
 * **Una riga per punto del percorso: a che ora ci arrivi, e cosa trovi lì a quell'ora.**
 *
 * È la tabella che risponde alla domanda per cui questo pannello esiste. Un'app meteo dice
 * che tempo farà in un posto; questa dice che tempo farà **dove sarai tu**, perché conosce
 * il tuo passo.
 */
export function TabellaPuntiMeteo({ righe, soglie }: { righe: RigaPercorso[]; soglie: SoglieModello }) {
  /*
    Una riga aperta per volta, come nel pannello dei layer: due dettagli aperti insieme
    raddoppierebbero l'altezza della tabella senza servire a niente.
  */
  const [aperta, setAperta] = useState<string | null>(null);

  useEffect(() => {
    if (aperta == null) return;
    const chiudi = (e: KeyboardEvent) => { if (e.key === 'Escape') setAperta(null); };
    document.addEventListener('keydown', chiudi);
    return () => document.removeEventListener('keydown', chiudi);
  }, [aperta]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        {/*
          Gronde strette (4 px): con sette colonne su 360 px ogni pixel di spaziatura è
          uno che manca al contenuto, e la colonna che restava fuori era quella dei
          comandi. Misurato: 332 px di tabella in un contenitore da 326.
        */}
        <caption className="sr-only">Previsione per punto del percorso</caption>
        <thead>
          <tr className="text-gray-400 text-left">
            <th scope="col" className="py-1 pr-1 font-medium">Punto</th>
            <th scope="col" className="py-1 pr-1 font-medium">Arrivo</th>
            <th scope="col" className="py-1 pr-1 font-medium">Cielo</th>
            <th scope="col" className="py-1 pr-1 font-medium">Piogg.</th>
            <th scope="col" className="py-1 pr-1 font-medium">mm</th>
            <th scope="col" className="py-1 pr-1 font-medium">Raffiche</th>
            <th scope="col" className="py-1 font-medium"><span className="sr-only">Azioni</span></th>
          </tr>
        </thead>
        <tbody>
          {righeVisibili(righe).map((r) => {
            const chiaveRiga = r.intermedio != null
              ? `mezzo-${Math.round(r.intermedio.kmDaInizio * 10)}`
              : `${r.waypointIndex}-${r.fase ?? 'x'}`;
            const nome = r.name || 'senza nome';
            const idPannello = `azioni-${chiaveRiga}`;
            const eAperta = aperta === chiaveRiga;
            return (
              <Fragment key={chiaveRiga}>
            <tr className="border-t border-gray-800">
              <td className="py-1.5 pr-1 text-gray-200">
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-1.5 ${PALLINO[chiave(r.classification.level)]}`}
                  aria-hidden
                />
                {r.intermedio != null
                  ? <EtichettaIntermedio intermedio={r.intermedio} />
                  : <>{r.waypointIndex + 1}. {nome}</>}
                <EtichettaSosta fase={r.fase} pausaMin={r.pausaMin} />
              </td>
              <td className="py-1.5 pr-1 text-gray-300 font-mono">
                {r.arrival != null ? oraItaliana(r.arrival) : <span className="text-gray-400 font-sans">n/d</span>}
              </td>
              <td className="py-1.5 pr-1 text-gray-300 whitespace-nowrap">
                <Iconcina cielo={cieloDellOra(r.hour?.weatherCode, r.hour?.precipProb, soglie.arancione)} temp={r.hour?.temp} />
              </td>
              <td className="py-1.5 pr-1 text-gray-300">{intero(r.hour?.precipProb, '%')}</td>
              <td className={`py-1.5 pr-1 whitespace-nowrap ${classeMm(r.hour?.mm)}`}>
                {testoMm(r.hour?.mm)}
              </td>
              <td className="py-1.5 pr-1 text-gray-300 whitespace-nowrap">{intero(r.hour?.gusts, ' km/h')}</td>
              <td className="py-1.5 text-right align-top">
                <BottoneAzioniPunto
                  nome={nome}
                  aperto={eAperta}
                  idPannello={idPannello}
                  onToggle={() => setAperta(eAperta ? null : chiaveRiga)}
                />
              </td>
            </tr>
            {/*
              I motivi su una RIGA INTERA, non dentro la colonna del punto.
              Li' dentro — 52 px su un telefono da 360 — «pioggia 70% · possibili temporali
              forti · raffiche 48 km/h» andava a capo sei volte e la riga diventava alta
              come mezzo schermo. Sono il testo piu' utile della tabella: dicono PERCHE'
              quel punto e' arancione, e meritano la larghezza.
            */}
            {r.classification.reasons.length > 0 && (
              <tr>
                <td
                  colSpan={7}
                  className={`pb-1.5 pl-4 pr-1 text-[10px] leading-tight ${COLORE_MOTIVO[chiave(r.classification.level)]}`}
                >
                  {/* Il nome per chi ascolta: la riga da sola non direbbe di quale punto parla. */}
                  <span className="sr-only">{nome}: </span>
                  {r.classification.reasons.join(' · ')}
                </td>
              </tr>
            )}
            {eAperta && (
              /*
                Il dettaglio sta in una riga SOTTO, non in un riquadro sovrapposto: la
                tabella vive dentro un contenitore che scorre, e li' dentro qualunque cosa
                in posizione assoluta viene ritagliata (misurato: 52 px fuori, sull'ultima
                riga).
              */
              <tr id={idPannello}>
                <td colSpan={7} className="pb-2 pl-4 pr-1 bg-gray-800/40">
                  <AzioniPunto riga={r} soglie={soglie} />
                </td>
              </tr>
            )}
              </Fragment>
            );
          })}
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
function Iconcina({ cielo: c, temp }: { cielo: Cielo | null; temp?: number }) {
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
