'use client';

import { gradi, metri } from '@/lib/formato';
import type { CategoryField, CategoryStat } from '@/lib/learning-stats';

export const ETICHETTE_CATEGORIA: Record<CategoryField, string> = {
  altitude: 'Altitudine',
  distance: 'Distanza',
  elevationGain: 'D+',
  elevationLoss: 'D-',
  azimuth: 'Azimut',
};

export const CATEGORIE = Object.keys(ETICHETTE_CATEGORIA) as CategoryField[];

/**
 * Ogni categoria ha la sua unita': senza, "Δ 1417" non dice se sono metri, gradi o
 * chilometri — e sono tre cose diverse. La distanza si scrive in metri perche' e' un
 * ERRORE: "Δ 761 m" si capisce, "Δ 0,8 km" no.
 */
export function scartoMedio(cat: CategoryField, valore: number): string {
  if (cat === 'azimuth') return gradi(valore);
  if (cat === 'distance') return metri(Math.round(valore * 1000));
  return metri(Math.round(valore));
}

/** Quanti scarti recenti disegnano l'istogramma, e quanto è alto in pixel. */
const ALTEZZA_ISTOGRAMMA = 20;

/**
 * **Una categoria del report: lo scarto medio, la barra dei tre esiti, e gli ultimi
 * scarti come istogramma.**
 *
 * Era il punto più annidato di tutta l'app — undici livelli di graffe: la mappa sulle
 * cinque categorie conteneva un ternario, dentro un frammento, dentro tre condizioni,
 * dentro una seconda mappa che calcolava il massimo a ogni giro. Ora è un componente, e
 * il massimo si calcola una volta.
 */
export function SchedaCategoria({ cat, stats }: { cat: CategoryField; stats: CategoryStat }) {
  const massimo = Math.max(...stats.recentDeltas, 1);
  return (
    <div className="bg-gray-800 rounded-lg p-2 min-w-[72px] shrink-0 sm:min-w-0 sm:shrink">
      <div className="text-gray-400 text-[9px] uppercase font-medium">{ETICHETTE_CATEGORIA[cat]}</div>
      {stats.count === 0 ? (
        <div className="text-gray-400 text-sm mt-1">—</div>
      ) : (
        <>
          <div className="text-white text-xs font-bold mt-1">
            Δ {scartoMedio(cat, stats.avgDelta)}
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5">
            {stats.validPercent > 0 && <div className="bg-green-500" style={{ width: `${stats.validPercent}%` }} />}
            {stats.warningPercent > 0 && <div className="bg-yellow-500" style={{ width: `${stats.warningPercent}%` }} />}
            {stats.errorPercent > 0 && <div className="bg-red-500" style={{ width: `${stats.errorPercent}%` }} />}
          </div>
          {stats.recentDeltas.length >= 2 && (
            <div className="flex items-end justify-center gap-px mt-1.5 h-[20px]">
              {stats.recentDeltas.map((d, i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-400 rounded-sm"
                  style={{ height: `${Math.max(2, Math.round((d / massimo) * ALTEZZA_ISTOGRAMMA))}px` }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
