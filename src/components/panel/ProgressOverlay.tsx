'use client';

import { useState, useEffect, useRef } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  type TrendDirection,
} from '@/lib/learning-stats';
import { gradi, metri } from '@/lib/formato';

const CATEGORY_LABELS: Record<CategoryField, string> = {
  altitude: 'Altitudine',
  distance: 'Distanza',
  elevationGain: 'D+',
  elevationLoss: 'D-',
  azimuth: 'Azimut',
};

/**
 * Ogni categoria ha la sua unita': senza, "Δ 1417" non dice se sono metri, gradi o
 * chilometri — e sono tre cose diverse. La distanza si scrive in metri perche' e' un
 * ERRORE: "Δ 761 m" si capisce, "Δ 0,8 km" no.
 */
function scartoMedio(cat: CategoryField, valore: number): string {
  if (cat === 'azimuth') return gradi(valore);
  if (cat === 'distance') return metri(Math.round(valore * 1000));
  return metri(Math.round(valore));
}

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

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '—';
  }
}

function formatDateLabel(label: unknown): string {
  return typeof label === 'string' ? formatDate(label) : '—';
}

export function ProgressOverlay({ onClose }: { onClose: () => void }) {
  const [validations, setValidations] = useState<ValidationSession[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryField | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValidations(loadValidationHistory());
    setQuizzes(loadQuizHistory());
  }, []);

  useBodyScrollLock(true);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const summary = computeSummaryCards(validations, quizzes);
  const trend = computeTrendDirection(validations, quizzes);
  const trendData = computeTrendData(validations, quizzes, categoryFilter ?? undefined);
  const catStats = computeCategoryStats(validations);
  const hasData = validations.length + quizzes.length > 0;

  const handleReset = () => {
    clearValidationHistory();
    clearQuizHistory();
    setValidations([]);
    setQuizzes([]);
    setConfirmReset(false);
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
          <div className="text-gray-500 text-sm text-center py-8">
            Inizia a verificare i tuoi itinerari e completare quiz per vedere il tuo progresso qui.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Section 1: Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-500 text-[10px] uppercase">Verifiche</div>
                <div className="text-white font-bold text-lg">{summary.totalVerifications}</div>
                {summary.lastVerifyValidPercent != null && (
                  <div className={`${coloreEsito(summary.lastVerifyValidPercent)} text-[10px]`}>
                    Ultima: {summary.lastVerifyValidPercent}% corretti
                  </div>
                )}
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-500 text-[10px] uppercase">Quiz</div>
                <div className="text-white font-bold text-lg">{summary.totalQuizzes}</div>
                {summary.lastQuizAverage != null && (
                  <div className={`${coloreEsito(summary.lastQuizAverage)} text-[10px]`}>
                    Ultimo: {summary.lastQuizAverage}/100
                  </div>
                )}
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-500 text-[10px] uppercase">Trend</div>
                {trend ? (
                  <div className={`font-bold text-2xl ${TREND_COLORS[trend]}`}>{TREND_ICONS[trend]}</div>
                ) : (
                  <div className="text-gray-600 text-lg">—</div>
                )}
                {!trend && <div className="text-gray-600 text-[10px]">Tendenza da 10 sessioni</div>}
              </div>
            </div>

            {/* Section 2: Trend Chart */}
            {trendData.length > 0 && trendData.length < 3 && (
              <div className="text-gray-500 text-xs text-center py-3">
                Il grafico dell&apos;andamento compare da 3 sessioni; la freccia della tendenza da 10.
              </div>
            )}
            {trendData.length >= 3 && (
              <div>
                <div className="text-xs text-gray-400 font-medium mb-2">Andamento nel tempo</div>
                <ResponsiveContainer width="100%" height={160} minWidth={0}>
                  <LineChart data={trendData}>
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} width={30} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
                      labelFormatter={formatDateLabel}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line type="monotone" dataKey="verifyPercent" name="Verifiche %" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="quizScore" name="Quiz" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-1 mt-2">
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={`px-2 py-1 rounded text-[10px] ${!categoryFilter ? 'bg-green-700 text-su-colore' : 'bg-gray-800 text-gray-400 hover:text-su-colore'}`}
                  >
                    Tutte
                  </button>
                  {(Object.keys(CATEGORY_LABELS) as CategoryField[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                      className={`px-2 py-1 rounded text-[10px] ${categoryFilter === cat ? 'bg-green-700 text-su-colore' : 'bg-gray-800 text-gray-400 hover:text-su-colore'}`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Category Breakdown */}
            <div>
              <div className="text-xs text-gray-400 font-medium mb-2">Dettaglio per categoria</div>
              <div className="flex gap-1 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible text-center">
                {(Object.keys(CATEGORY_LABELS) as CategoryField[]).map((cat) => {
                  const s = catStats[cat];
                  return (
                    <div key={cat} className="bg-gray-800 rounded-lg p-2 min-w-[72px] shrink-0 sm:min-w-0 sm:shrink">
                      <div className="text-gray-500 text-[9px] uppercase font-medium">{CATEGORY_LABELS[cat]}</div>
                      {s.count === 0 ? (
                        <div className="text-gray-600 text-sm mt-1">—</div>
                      ) : (
                        <>
                          <div className="text-white text-xs font-bold mt-1">
                            Δ {scartoMedio(cat, s.avgDelta)}
                          </div>
                          <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5">
                            {s.validPercent > 0 && <div className="bg-green-500" style={{ width: `${s.validPercent}%` }} />}
                            {s.warningPercent > 0 && <div className="bg-yellow-500" style={{ width: `${s.warningPercent}%` }} />}
                            {s.errorPercent > 0 && <div className="bg-red-500" style={{ width: `${s.errorPercent}%` }} />}
                          </div>
                          {s.recentDeltas.length >= 2 && (
                            <div className="flex items-end justify-center gap-px mt-1.5 h-[20px]">
                              {s.recentDeltas.map((d, i) => {
                                const max = Math.max(...s.recentDeltas, 1);
                                const h = Math.max(2, Math.round((d / max) * 20));
                                return <div key={i} className="w-1 bg-blue-400 rounded-sm" style={{ height: `${h}px` }} />;
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reset Button */}
            <div className="border-t border-gray-700 pt-3 text-center">
              {confirmReset ? (
                <div className="space-y-2">
                  <div className="text-sm text-gray-300">Sei sicuro? Questa azione è irreversibile.</div>
                  <div className="flex gap-2 justify-center">
                    <button onClick={handleReset} className="px-4 py-2 bg-red-600 text-su-colore rounded text-xs font-bold hover:bg-red-600">Cancella tutto</button>
                    <button onClick={() => setConfirmReset(false)} className="px-4 py-2 bg-gray-700 text-white rounded text-xs hover:bg-gray-600">Annulla</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmReset(true)} className="text-xs text-gray-500 hover:text-red-400">
                  Cancella storico
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
