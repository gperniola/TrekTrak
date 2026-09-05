'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { buildMeteoUrl } from '@/lib/meteo';
import { sunTimes } from '@/lib/sun';
import { ATTRIBUZIONE_METEO, fetchRouteForecast } from '@/lib/weather-api';
import { cieliPresenti } from '@/lib/cielo';
import { metri, oraItaliana } from '@/lib/formato';
import {
  buildRouteWeather, defaultDeparture, samplePoints,
  type Livello, type RouteWeatherReport,
  formattaFascia,
  scartoQuotaMassimo,
  SCARTO_QUOTA_RILEVANTE,
} from '@/lib/route-weather';
import { SheetHandle } from '@/components/shared/SheetHandle';
import { useSheetDrag } from '@/lib/useSheetDrag';
import { useSchermoPiccolo } from '@/lib/useSchermoPiccolo';
import { useModaleTastiera } from '@/lib/useModaleTastiera';
import { ScegliPartenza } from '@/components/weather/ScegliPartenza';
import { TabellaPuntiMeteo } from '@/components/weather/TabellaPuntiMeteo';
import { ComeSiLegge } from '@/components/weather/ComeSiLegge';

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

/*
  L'orario lo scrive `oraItaliana`, la casa dei formati: questo file aveva la sua copia —
  una costante col fuso piu' una funzioncina — identica a quella di casa. Due copie della
  stessa regola sono due posti in cui dimenticarsi il fuso, ed e' successo tre volte in
  questo progetto.
*/
const ora = oraItaliana;

/**
 * Meteo **del percorso**, non del posto: incrocia i waypoint con gli orari stimati
 * dalla formula di Munter e dice cosa si incontra, e quando.
 *
 * È la domanda a cui un'app meteo non può rispondere, perché non conosce il tuo passo.
 * La regola pratica della montagna — in vetta presto, giù prima del pomeriggio — vive
 * esattamente in questo incrocio.
 *
 * Qui restano il caricamento della previsione, il verdetto e gli avvisi su quello che il
 * dato non dice. La scelta della partenza, la tabella per punto e la parte didattica
 * stanno nei loro file: erano tre pezzi indipendenti in mezzo alla stessa funzione.
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
  const dialogRef = useModaleTastiera<HTMLDivElement>(open, () => setOpen(false));
  /*
   * Trascinamento verso il basso per chiudere, solo su schermo piccolo: su desktop
   * questo e' un modale centrato, non un foglio.
   *
   * Il backdrop qui NON si sbiadisce, a differenza del pannello layer: e' un ANTENATO
   * del foglio (`fixed inset-0` che lo contiene), e l'opacita' su un antenato la
   * eredita anche il figlio — il foglio sbiadirebbe insieme allo sfondo.
   *
   * Questo pannello scorre quasi sempre, quindi dal corpo il gesto parte solo quando
   * si e' in cima; dalla maniglia sempre.
   */
  const piccolo = useSchermoPiccolo();
  const { refFoglio, propsFoglio, propsManiglia } = useSheetDrag({
    onDismiss: () => setOpen(false),
    attivo: piccolo,
  });
  const refSheet = useCallback((n: HTMLDivElement | null) => {
    dialogRef.current = n;
    refFoglio(n);
  }, [refFoglio, dialogRef]);

  useBodyScrollLock(open);

  const punti = useMemo(() => samplePoints(waypoints), [waypoints]);
  /*
    La legenda spiega SOLO le icone che si vedono in questa tabella: ventotto voci
    sarebbero un manuale, e un'iconcina senza la sua parola resta un indovinello (il
    `title` del mouse, al tocco, non esiste).
  */
  const legenda = useMemo(
    () => cieliPresenti((report?.rows ?? []).map((r) => r.hour?.weatherCode)),
    [report],
  );
  /*
    Se il modello ha risposto per una quota diversa da quella del punto, temperatura e
    raffiche sono di un altro posto. Succede quando all'itinerario mancano le quote:
    misurato il 2026-09-02, la maglia di Cima delle Murelle sta 1339 m piu' in basso, che
    fa sei gradi e mezzo di differenza.
  */
  const scartoQuota = useMemo(() => scartoQuotaMassimo(report?.rows ?? []), [report]);

  const carica = useCallback((quando: Date, signal: AbortSignal) => {
    if (punti.length === 0) { setReport(null); setErrore(null); return; }
    setCaricamento(true);
    setErrore(null);
    // Quanti giorni servono: quello della partenza più uno, per i percorsi che
    // sforano la mezzanotte o le partenze di dopodomani.
    const giorni = Math.ceil((quando.getTime() - Date.now()) / 86400000) + 2;
    fetchRouteForecast(punti, giorni, signal)
      .then(({ serie, elevations }) => {
        if (signal.aborted) return;
        setReport(buildRouteWeather({ waypoints, legs, departure: quando, punti, serie, elevations }));
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

  if (!open) return null;

  const primo = waypoints.find((w) => w.lat != null && w.lon != null);
  const sole = primo ? sunTimes(primo.lat as number, primo.lon as number, departure) : null;
  // Solo gli arrivi NOTI: senza i tempi non si puo' dire "arrivi dopo il tramonto".
  const arriviNoti = (report?.rows ?? []).map((r) => r.arrival).filter((a): a is string => a != null);
  const ultimoArrivo = arriviNoti.length > 0 ? arriviNoti[arriviNoti.length - 1] : null;
  const arrivoDopoIlTramonto = ultimoArrivo != null && sole?.sunset != null
    && new Date(ultimoArrivo).getTime() > new Date(sole.sunset).getTime();

  const meteoUrl = buildMeteoUrl(waypoints);

  return (
    <div className="fixed inset-0 z-[1250] bg-black/70 flex items-end lg:items-center justify-center" onClick={() => setOpen(false)}>
      <div
        ref={refSheet}
        {...propsFoglio}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Meteo del percorso"
        onClick={(e) => e.stopPropagation()}
        className="w-full lg:max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-t-2xl lg:rounded-2xl p-4 space-y-3"
      >
        <SheetHandle gesto={propsManiglia} />
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

        <ScegliPartenza partenza={departure} cambia={setDeparture} />

        {punti.length === 0 && (
          <p className="text-sm text-gray-300 bg-gray-800 rounded-lg p-3">
            Aggiungi almeno un waypoint con coordinate: la previsione si calcola sui punti del percorso.
          </p>
        )}

        {caricamento && <p className="text-sm text-gray-400">Sto chiedendo la previsione…</p>}

        {errore && (
          <p role="alert" className="text-sm text-[#fecaca] bg-red-900/40 border border-red-700 rounded-lg p-3">
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
                  {report.windows.map(formattaFascia).join(', ')}
                </span>
                . Sono le ore in cui la previsione è critica <em>da qualche parte</em> sul
                percorso, anche se tu sei altrove.
              </p>
            )}

            <TabellaPuntiMeteo righe={report.rows} />

            {legenda.length > 0 && (
              /*
                Un nome accessibile, perche' senza di esso un lettore di schermo legge
                "sereno coperto temporale" di fila, senza dire che cos'e' quell'elenco —
                le icone accanto sono `aria-hidden`, e per chi non vede resta una filza
                di parole senza appiglio.
              */
              <p
                role="note"
                aria-label="Cosa vogliono dire le icone del cielo"
                className="text-[11px] text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5"
              >
                {legenda.map((c) => (
                  <span key={c.testo}>
                    <span aria-hidden>{c.icona}</span>{' '}{c.testo}
                  </span>
                ))}
              </p>
            )}

            {scartoQuota != null && Math.abs(scartoQuota) > SCARTO_QUOTA_RILEVANTE && (
              <p className="text-[11px] text-amber-300 bg-gray-800 border border-amber-800/60 rounded px-2 py-1.5 leading-snug">
                Manca la quota di qualche punto, quindi il modello ha risposto per la sua
                maglia, {metri(Math.abs(scartoQuota))} più{' '}
                {scartoQuota < 0 ? 'in basso' : 'in alto'} del punto: temperatura e raffiche
                vanno lette con quel margine (circa un grado ogni 150 m). Scrivi le quote
                nell&rsquo;Editor e la previsione arriva alla quota giusta.
              </p>
            )}

            {report.rows.some((r) => r.arrival == null) && (
              <p className="text-[11px] text-amber-300 bg-gray-800 border border-amber-800/60 rounded px-2 py-1.5 leading-snug">
                Gli orari di arrivo non sono stimabili: alle tratte mancano distanza o
                dislivelli. Inseriscili nell&rsquo;Editor, oppure passa a{' '}
                <strong className="font-medium">Pianificazione</strong> e li calcola l&rsquo;app.
              </p>
            )}
            <p className="text-[11px] text-gray-400">
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

        <ComeSiLegge />

        <p className="text-[11px] text-gray-400 leading-snug">
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
