'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { buildMeteoUrl } from '@/lib/meteo';
import { sunTimes } from '@/lib/sun';
import { ATTRIBUZIONE_METEO, fetchRouteForecast } from '@/lib/weather-api';
import {
  buildRouteWeather, defaultDeparture, samplePoints,
  type Livello, type RouteWeatherReport,
} from '@/lib/route-weather';

/** Colori per livello: gli stessi che l'app usa per i badge di validazione. */
const COLORE: Record<string, string> = {
  '0': 'bg-green-900/40 border-green-700 text-green-200',
  '1': 'bg-amber-900/40 border-amber-700 text-amber-200',
  '2': 'bg-orange-900/50 border-orange-600 text-orange-100',
  '3': 'bg-red-900/60 border-red-600 text-red-100',
  null: 'bg-gray-800 border-gray-600 text-gray-300',
};

const ETICHETTA: Record<string, string> = {
  '0': 'Nessuna criticità',
  '1': 'Da tenere d’occhio',
  '2': 'Attenzione',
  '3': 'Rischio alto',
  null: 'Non disponibile',
};

function chiave(l: Livello): string { return l == null ? 'null' : String(l); }

const ORA_FMT: Intl.DateTimeFormatOptions = {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
};

function ora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('it-IT', ORA_FMT);
}

function numero(v: number | undefined, unita = ''): string {
  return v == null || !Number.isFinite(v) ? '—' : `${Math.round(v)}${unita}`;
}

/**
 * Meteo **del percorso**, non del posto: incrocia i waypoint con gli orari stimati
 * dalla formula di Munter e dice cosa si incontra, e quando.
 *
 * È la domanda a cui un'app meteo non può rispondere, perché non conosce il tuo passo.
 * La regola pratica della montagna — in vetta presto, giù prima del pomeriggio — vive
 * esattamente in questo incrocio.
 */
export function RouteWeatherPanel() {
  const open = useUIStore((s) => s.weatherOpen);
  const setOpen = useUIStore((s) => s.setWeatherOpen);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  const [departure, setDeparture] = useState<Date>(() => defaultDeparture(new Date()));
  const [report, setReport] = useState<RouteWeatherReport | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [didatticaAperta, setDidatticaAperta] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);

  const punti = useMemo(() => samplePoints(waypoints), [waypoints]);

  const carica = useCallback((quando: Date, signal: AbortSignal) => {
    if (punti.length === 0) { setReport(null); setErrore(null); return; }
    setCaricamento(true);
    setErrore(null);
    // Quanti giorni servono: quello della partenza più uno, per i percorsi che
    // sforano la mezzanotte o le partenze di dopodomani.
    const giorni = Math.ceil((quando.getTime() - Date.now()) / 86400000) + 2;
    fetchRouteForecast(punti, giorni, signal)
      .then(({ serie }) => {
        if (signal.aborted) return;
        setReport(buildRouteWeather({ waypoints, legs, departure: quando, punti, serie }));
      })
      .catch((e: unknown) => {
        if (signal.aborted) return;
        setErrore(e instanceof Error ? e.message : 'Previsione non disponibile');
        setReport(null);
      })
      .finally(() => { if (!signal.aborted) setCaricamento(false); });
  }, [punti, waypoints, legs]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    carica(departure, controller.signal);
    return () => controller.abort();
  }, [open, departure, carica]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const primo = waypoints.find((w) => w.lat != null && w.lon != null);
  const sole = primo ? sunTimes(primo.lat as number, primo.lon as number, departure) : null;
  const ultimoArrivo = report?.rows.length
    ? report.rows[report.rows.length - 1].arrival
    : null;
  const arrivoDopoIlTramonto = ultimoArrivo != null && sole?.sunset != null
    && new Date(ultimoArrivo).getTime() > new Date(sole.sunset).getTime();

  const giorni = [0, 1, 2].map((d) => {
    const data = new Date();
    data.setDate(data.getDate() + d);
    return { d, label: d === 0 ? 'oggi' : d === 1 ? 'domani' : 'dopodomani', data };
  });
  const giornoScelto = giorni.find((g) => g.data.toDateString() === departure.toDateString())?.d ?? 0;

  const cambiaGiorno = (d: number) => {
    const nuovo = new Date();
    nuovo.setDate(nuovo.getDate() + d);
    nuovo.setHours(departure.getHours(), 0, 0, 0);
    setDeparture(nuovo);
  };
  const cambiaOra = (h: number) => {
    const nuovo = new Date(departure);
    nuovo.setHours(h, 0, 0, 0);
    setDeparture(nuovo);
  };

  const meteoUrl = buildMeteoUrl(waypoints);

  return (
    <div className="fixed inset-0 z-[1250] bg-black/70 flex items-end lg:items-center justify-center" onClick={() => setOpen(false)}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Meteo del percorso"
        onClick={(e) => e.stopPropagation()}
        className="w-full lg:max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-t-2xl lg:rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-green-400">Meteo del percorso</h2>
            <p className="text-[11px] text-gray-400">
              Previsione incrociata con gli orari stimati dalla formula di Munter.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Chiudi meteo del percorso"
            className="shrink-0 text-gray-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Ora di partenza: senza, "arrivi verso le 14:40" non è calcolabile. */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-400">Partenza</span>
          <select
            value={giornoScelto}
            onChange={(e) => cambiaGiorno(Number(e.target.value))}
            aria-label="Giorno di partenza"
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white max-lg:min-h-[44px]"
          >
            {giorni.map((g) => (
              <option key={g.d} value={g.d}>
                {g.label} ({g.data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })})
              </option>
            ))}
          </select>
          <span className="text-gray-400">alle</span>
          <select
            value={departure.getHours()}
            onChange={(e) => cambiaOra(Number(e.target.value))}
            aria-label="Ora di partenza"
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white max-lg:min-h-[44px]"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>

        {punti.length === 0 && (
          <p className="text-sm text-gray-300 bg-gray-800 rounded-lg p-3">
            Aggiungi almeno un waypoint con coordinate: la previsione si calcola sui punti del percorso.
          </p>
        )}

        {caricamento && <p className="text-sm text-gray-400">Sto chiedendo la previsione…</p>}

        {errore && (
          <p role="alert" className="text-sm text-red-200 bg-red-900/40 border border-red-700 rounded-lg p-3">
            {errore}
          </p>
        )}

        {report && !caricamento && (
          <>
            <div role="status" className={`rounded-lg border p-3 ${COLORE[chiave(report.verdict.level)]}`}>
              <div className="text-[11px] uppercase tracking-wider opacity-80">
                {ETICHETTA[chiave(report.verdict.level)]}
              </div>
              <p className="text-sm mt-0.5 leading-snug">{report.verdict.message}</p>
            </div>

            {report.windows.length > 0 && (
              <p className="text-[11px] text-gray-400">
                Ore instabili nella giornata:{' '}
                <span className="font-mono text-gray-300">
                  {report.windows.map((f) => `${ora(f.fromISO)}-${ora(f.toISO)}`).join(', ')}
                </span>
                . Sono le ore in cui la previsione è critica <em>da qualche parte</em> sul
                percorso, anche se tu sei altrove.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Previsione per punto del percorso</caption>
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th scope="col" className="py-1 pr-2 font-medium">Punto</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Arrivo</th>
                    <th scope="col" className="py-1 pr-2 font-medium">CAPE</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Raffiche</th>
                    <th scope="col" className="py-1 font-medium">Piogg.</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.waypointIndex} className="border-t border-gray-800">
                      <td className="py-1.5 pr-2 text-gray-200">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                          r.classification.level === 3 ? 'bg-red-500'
                            : r.classification.level === 2 ? 'bg-orange-400'
                              : r.classification.level === 1 ? 'bg-amber-400'
                                : r.classification.level === 0 ? 'bg-green-500' : 'bg-gray-500'
                        }`} aria-hidden />
                        {r.waypointIndex + 1}. {r.name || 'senza nome'}
                      </td>
                      <td className="py-1.5 pr-2 text-gray-300 font-mono">{ora(r.arrival)}</td>
                      <td className="py-1.5 pr-2 text-gray-300">{numero(r.hour?.cape)}</td>
                      <td className="py-1.5 pr-2 text-gray-300">{numero(r.hour?.gusts, ' km/h')}</td>
                      <td className="py-1.5 text-gray-300">{numero(r.hour?.precipProb, '%')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-gray-500">
              Previsione campionata su {report.sampled} {report.sampled === 1 ? 'punto' : 'punti'} del
              percorso: i modelli hanno maglie di chilometri, quindi punti vicini danno lo stesso dato.
              Gli orari vengono dalla stima di Munter e <strong className="font-medium text-gray-400">non
              contano le pause</strong>.
            </p>
          </>
        )}

        {sole && (
          <div className={`rounded-lg border p-3 text-xs ${
            arrivoDopoIlTramonto ? 'bg-amber-900/40 border-amber-700 text-amber-100' : 'bg-gray-800 border-gray-700 text-gray-300'
          }`}>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Alba <strong className="font-mono">{ora(sole.sunrise)}</strong></span>
              <span>Tramonto <strong className="font-mono">{ora(sole.sunset)}</strong></span>
              <span>Buio <strong className="font-mono">{ora(sole.civilDusk)}</strong></span>
            </div>
            {arrivoDopoIlTramonto && (
              <p className="mt-1.5 leading-snug">
                L’orario di arrivo stimato è <strong>dopo il tramonto</strong>: servono frontale e
                margine, o una partenza più mattutina.
              </p>
            )}
          </div>
        )}

        <div>
          <button
            onClick={() => setDidatticaAperta((v) => !v)}
            aria-expanded={didatticaAperta}
            className="text-xs text-green-400 hover:text-green-300 min-h-[44px] lg:min-h-0 flex items-center gap-1"
          >
            <span aria-hidden>{didatticaAperta ? '▾' : '▸'}</span> Come si legge
          </button>
          {didatticaAperta && (
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

        <p className="text-[11px] text-gray-500 leading-snug">
          {ATTRIBUZIONE_METEO}. È una <strong className="font-medium text-gray-400">previsione</strong>,
          non una misura: può sbagliare, e non sostituisce i canali ufficiali di allerta. In caso di
          emergenza chiama il 112.
          {meteoUrl && (
            <>
              {' '}
              <a href={meteoUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline">
                Previsione completa su Meteoblue
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
