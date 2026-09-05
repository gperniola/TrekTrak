'use client';

import { useState, useEffect } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { loadValidationHistory, clearValidationHistory } from '@/lib/storage';
import { loadQuizHistory, clearQuizHistory } from '@/lib/quiz';
import type { QuizSession } from '@/lib/quiz';
import type { ValidationSession } from '@/lib/types';
import {
  computeSummaryCards,
  computeTrendDirection,
  computeTrendData,
  computeCategoryStats,
  type CategoryField,
  type SummaryCards,
  type TrendDirection,
} from '@/lib/learning-stats';
import { useModaleTastiera } from '@/lib/useModaleTastiera';
import { AndamentoProgresso } from './AndamentoProgresso';
import { CATEGORIE, SchedaCategoria } from './SchedaCategoria';

/**
 * Un punteggio basso non si dipinge di verde con la spunta. Prima "Ultima: 6% ✓" era
 * verde comunque: in un'app che insegna, dire "bravo" a chi ha sbagliato il 94% dei
 * valori e' il contrario del suo mestiere.
 */
function coloreEsito(percentuale: number): string {
  if (percentuale >= 80) return 'text-green-400';
  if (percentuale >= 50) return 'text-amber-400';
  return 'text-red-400';
}

const TREND_ICONS: Record<TrendDirection, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_COLORS: Record<TrendDirection, string> = {
  up: 'text-green-400',
  down: 'text-red-400',
  stable: 'text-gray-400',
};

/** Le tre schede in cima: quante verifiche, quanti quiz, e da che parte si sta andando. */
function SchedeRiassunto(
  { riassunto, tendenza }: { riassunto: SummaryCards; tendenza: TrendDirection | null },
) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div className="bg-gray-800 rounded-lg p-3 text-center">
        <div className="text-gray-400 text-[10px] uppercase">Verifiche</div>
        <div className="text-white font-bold text-lg">{riassunto.totalVerifications}</div>
        {riassunto.lastVerifyValidPercent != null && (
          <div className={`${coloreEsito(riassunto.lastVerifyValidPercent)} text-[10px]`}>
            Ultima: {riassunto.lastVerifyValidPercent}% corretti
          </div>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-3 text-center">
        <div className="text-gray-400 text-[10px] uppercase">Quiz</div>
        <div className="text-white font-bold text-lg">{riassunto.totalQuizzes}</div>
        {riassunto.lastQuizAverage != null && (
          <div className={`${coloreEsito(riassunto.lastQuizAverage)} text-[10px]`}>
            Ultimo: {riassunto.lastQuizAverage}/100
          </div>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-3 text-center">
        <div className="text-gray-400 text-[10px] uppercase">Trend</div>
        {tendenza ? (
          <div className={`font-bold text-2xl ${TREND_COLORS[tendenza]}`}>{TREND_ICONS[tendenza]}</div>
        ) : (
          <div className="text-gray-400 text-lg">—</div>
        )}
        {!tendenza && <div className="text-gray-400 text-[10px]">Tendenza da 10 sessioni</div>}
      </div>
    </div>
  );
}

/** La cancellazione dello storico, con la conferma in loco. */
function CancellaStorico({ cancella }: { cancella: () => void }) {
  const [conferma, setConferma] = useState(false);
  return (
    <div className="border-t border-gray-700 pt-3 text-center">
      {conferma ? (
        <div className="space-y-2">
          <div className="text-sm text-gray-300">Sei sicuro? Questa azione è irreversibile.</div>
          <div className="flex gap-2 justify-center">
            <button onClick={cancella} className="px-4 py-2 bg-red-600 text-su-colore rounded text-xs font-bold hover:bg-red-600">Cancella tutto</button>
            <button onClick={() => setConferma(false)} className="px-4 py-2 bg-gray-700 text-white rounded text-xs hover:bg-gray-600">Annulla</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConferma(true)} className="text-xs text-gray-400 hover:text-red-400">
          Cancella storico
        </button>
      )}
    </div>
  );
}

/**
 * **Il report del progresso: come si sta andando, non solo com'è andata l'ultima volta.**
 *
 * Tre sezioni — il riassunto, l'andamento nel tempo, il dettaglio per categoria — più la
 * cancellazione dello storico. Ognuna sta nel suo componente: erano tutte dentro questa
 * funzione, e il dettaglio per categoria era il punto più annidato dell'app.
 */
export function ProgressOverlay({ onClose }: { onClose: () => void }) {
  const [validations, setValidations] = useState<ValidationSession[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryField | null>(null);
  const dialogRef = useModaleTastiera<HTMLDivElement>(true, onClose);

  useEffect(() => {
    setValidations(loadValidationHistory());
    setQuizzes(loadQuizHistory());
  }, []);

  useBodyScrollLock(true);

  const summary = computeSummaryCards(validations, quizzes);
  const trend = computeTrendDirection(validations, quizzes);
  const trendData = computeTrendData(validations, quizzes, categoryFilter ?? undefined);
  const catStats = computeCategoryStats(validations);
  const hasData = validations.length + quizzes.length > 0;

  const cancella = () => {
    clearValidationHistory();
    clearQuizHistory();
    setValidations([]);
    setQuizzes([]);
  };

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Report Progresso"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full p-5 shadow-2xl outline-none overflow-y-auto max-h-[calc(100vh-2rem)]"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-green-400">📊 Progresso</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Chiudi">✕</button>
        </div>

        {!hasData ? (
          <div className="text-gray-400 text-sm text-center py-8">
            Inizia a verificare i tuoi itinerari e completare quiz per vedere il tuo progresso qui.
          </div>
        ) : (
          <div className="space-y-5">
            <SchedeRiassunto riassunto={summary} tendenza={trend} />

            <AndamentoProgresso
              punti={trendData}
              filtro={categoryFilter}
              cambiaFiltro={setCategoryFilter}
            />

            <div>
              <div className="text-xs text-gray-400 font-medium mb-2">Dettaglio per categoria</div>
              <div className="flex gap-1 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible text-center">
                {CATEGORIE.map((cat) => (
                  <SchedaCategoria key={cat} cat={cat} stats={catStats[cat]} />
                ))}
              </div>
            </div>

            <CancellaStorico cancella={cancella} />
          </div>
        )}
      </div>
    </div>
  );
}
