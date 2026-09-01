'use client';

import { useState } from 'react';
import type { Leg, Waypoint } from '@/lib/types';
import { useItineraryStore } from '@/stores/itineraryStore';
import { azimuthToCardinal } from '@/lib/calculations';
import { formatTime } from '@/lib/format';
import { dislivello, km, metri, numero, percento } from '@/lib/formato';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';

/**
 * Waypoint e tratta successiva, **in modalità Track**: valori letti, non campi.
 *
 * Nasce da una segnalazione precisa: «in modalità "vado in montagna" l'interfaccia
 * editor è ancora molto confusionaria, ad esempio sono presenti un sacco di textbox che
 * ora non servono dato che non dobbiamo inserire i dati a mano». Misurato su un
 * itinerario di quattro waypoint: **25 campi a schermo, 24 di sola lettura**, ciascuno
 * col suo bordo, il suo sfondo e il suo pulsante ⓘ — 24 pulsanti ⓘ in tutto.
 *
 * Il difetto non era «troppi campi» ma una cosa più semplice: **un campo in cui non si
 * può scrivere non è un campo.** Ne aveva l'aspetto, invitava a scriverci, e non
 * rispondeva.
 *
 * La condizione è `appMode === 'track'` e non il profilo d'uso, perché è la modalità che
 * decide chi compila i valori. Così migliora anche chi sta in «Imparo» e passa a Track
 * per guardare i valori veri.
 *
 * Il dettaglio si apre **una riga per volta**, come il pannello dei layer dalla v0.14.0:
 * è la stessa decisione, e vale per la stessa ragione — quello che serve sempre resta a
 * vista, quello che serve a volte si chiede.
 */
export function TrackWaypointRow({
  waypoint,
  leg,
  aperta,
  onApri,
  dragHandleProps,
}: {
  waypoint: Waypoint;
  /** La tratta che PARTE da questo waypoint. L'ultimo waypoint non ne ha. */
  leg?: Leg;
  aperta: boolean;
  onApri: (id: string | null) => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const removeWaypoint = useItineraryStore((s) => s.removeWaypoint);
  const [rinominando, setRinominando] = useState(false);

  const nome = waypoint.name || `Waypoint ${waypoint.order + 1}`;

  /** Un valore che non c'è si dice, non si finge zero (lezione della v0.13.2). */
  const val = (v: number | null | undefined, f: (n: number) => string) => (v == null ? 'n/d' : f(v));

  /**
   * Il segno solo quando c'è qualcosa da segnare: una tratta in piano scriveva «−0 m»,
   * che si legge «meno zero». La regola sta in `formato.ts` perché serve anche alla barra
   * di riepilogo, che faceva lo stesso sbaglio.
   */
  const disl = (v: number | null | undefined, segno: '+' | '−') =>
    v == null ? 'n/d' : dislivello(v, segno);

  const rimuovi = async () => {
    const ok = await appConfirm({
      title: 'Rimuovere il waypoint?',
      message: `"${nome}" verrà rimosso dall'itinerario.`,
      variant: 'error',
      confirmText: 'Rimuovi',
    });
    if (ok) {
      removeWaypoint(waypoint.id);
      toast.success('Waypoint rimosso');
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg transition-colors hover:border-gray-600">
      {/*
        Tre bersagli affiancati e NON annidati: apri, trascina, rimuovi. Annidarli
        dentro un unico pulsante era il difetto corretto nel pannello dei layer.
      */}
      <div className="flex items-stretch">
        <button
          onClick={() => onApri(aperta ? null : waypoint.id)}
          aria-expanded={aperta}
          className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 min-h-[44px] text-left rounded-l-lg hover:bg-white/5"
        >
          <span className="text-green-400 font-bold text-sm tabular-nums shrink-0">{waypoint.order + 1}.</span>
          <span className="text-sm text-gray-100 truncate flex-1">{nome}</span>
          <span className="text-xs text-gray-300 tabular-nums shrink-0">
            {val(waypoint.altitude, (n) => metri(n))}
          </span>
          <span aria-hidden className="text-gray-500 text-[10px] shrink-0">{aperta ? '▲' : '▼'}</span>
        </button>
        <span
          {...dragHandleProps}
          className="cursor-grab text-gray-600 hover:text-gray-400 text-xs px-2 flex items-center min-w-[32px] justify-center"
          title="Trascina per riordinare"
          aria-label={`Trascina per riordinare ${nome}`}
        >
          ☰
        </span>
        <button
          onClick={rimuovi}
          className="text-gray-500 hover:text-red-400 text-xs px-2 min-w-[32px] rounded-r-lg"
          title="Rimuovi"
          aria-label={`Rimuovi ${nome}`}
        >
          ✗
        </button>
      </div>

      {aperta && (
        <div className="px-3 pb-2 space-y-1.5 border-t border-gray-700/60 pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-400 tabular-nums" title="WGS84 — gradi decimali">
              {waypoint.lat == null || waypoint.lon == null
                ? 'coordinate non ancora note'
                : `${numero(Math.abs(waypoint.lat), 4)}° ${waypoint.lat >= 0 ? 'N' : 'S'}`
                  + `  ${numero(Math.abs(waypoint.lon), 4)}° ${waypoint.lon >= 0 ? 'E' : 'O'}`}
            </span>
            <button
              onClick={() => setRinominando((p) => !p)}
              className="text-[11px] text-gray-400 hover:text-gray-200 min-h-[32px] px-1 shrink-0"
              aria-label={`Modifica nome di ${nome}`}
            >
              ✎ rinomina
            </button>
          </div>
          {rinominando && (
            <input
              type="text"
              value={waypoint.name}
              onChange={(e) => updateWaypoint(waypoint.id, { name: e.target.value })}
              onBlur={() => setRinominando(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRinominando(false); }}
              maxLength={100}
              placeholder="Nome waypoint..."
              aria-label={`Nome waypoint ${waypoint.order + 1}`}
              autoFocus
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 focus:outline-none"
            />
          )}
          {leg != null && (leg.slope != null || leg.estimatedTime != null) && (
            <div className="text-[11px] text-gray-400 flex flex-wrap gap-3">
              {leg.slope != null && <span>pendenza {percento(leg.slope)}</span>}
              {leg.estimatedTime != null && <span>{formatTime(leg.estimatedTime)} stimati</span>}
            </div>
          )}
        </div>
      )}

      {/*
        La tratta che parte da qui: una riga sola, sempre a vista. Sono i quattro numeri
        che servono a leggere il percorso, e in Track non c'e' niente da scriverci.
      */}
      {leg != null && (
        <div className="mx-3 mb-2 pl-2 border-l-2 border-green-400/70 text-[11px] text-gray-300 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span aria-hidden className="text-green-400">↓</span>
          <span className="tabular-nums">{val(leg.distance, (n) => km(n, 2))}</span>
          <span aria-hidden className="text-gray-600">·</span>
          <span className="tabular-nums">
            {leg.azimuth == null ? 'n/d' : `${numero(leg.azimuth, 0)}° ${azimuthToCardinal(leg.azimuth)}`}
          </span>
          <span aria-hidden className="text-gray-600">·</span>
          <span className="tabular-nums text-red-300" title="dislivello in salita">
            {disl(leg.elevationGain, '+')}
          </span>
          <span aria-hidden className="text-gray-600">·</span>
          <span className="tabular-nums text-blue-300" title="dislivello in discesa">
            {disl(leg.elevationLoss, '−')}
          </span>
        </div>
      )}
    </div>
  );
}
