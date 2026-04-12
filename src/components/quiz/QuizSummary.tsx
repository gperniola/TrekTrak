'use client';

import { useState } from 'react';
import type { QuizAnswer, QuestionType } from '@/lib/quiz';
import { loadQuizHistory } from '@/lib/quiz';
import { useUIStore } from '@/stores/uiStore';

const TYPE_LABELS: Record<QuestionType, string> = {
  altitude: 'Altitudine',
  distance: 'Distanza',
  azimuth: 'Azimuth',
};

function averageByType(answers: { type: QuestionType; score: number }[], type: QuestionType): number | null {
  const filtered = answers.filter((a) => a.type === type);
  if (filtered.length === 0) return null;
  return Math.round(filtered.reduce((sum, a) => sum + a.score, 0) / filtered.length);
}

export function QuizSummary({ answers, average, onNewSession, onClose }: {
  answers: QuizAnswer[];
  average: number;
  onNewSession: () => void;
  onClose: () => void;
}) {
  const openProgress = useUIStore((s) => s.openProgress);
  const [showHistory, setShowHistory] = useState(false);
  const scoreColor = average >= 70 ? 'text-green-400' : average >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-gray-500 text-xs mb-1">Punteggio sessione</div>
        <div className={`text-4xl font-bold ${scoreColor}`}>{average}/100</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(['altitude', 'distance', 'azimuth'] as QuestionType[]).map((type) => {
          const avg = averageByType(answers, type);
          return (
            <div key={type} className="text-center bg-gray-800 rounded p-2">
              <div className="text-gray-500 text-[10px]">{TYPE_LABELS[type]}</div>
              <div className={`font-bold text-sm ${avg != null && avg >= 70 ? 'text-green-400' : avg != null && avg >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {avg != null ? `${avg}/100` : '-'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={onNewSession} className="flex-1 py-2 bg-purple-500 text-white rounded font-bold text-xs hover:bg-purple-400">Nuova sessione</button>
        <button onClick={() => setShowHistory((p) => !p)} className="flex-1 py-2 bg-gray-700 text-white rounded font-bold text-xs hover:bg-gray-600">{showHistory ? 'Nascondi storico' : 'Storico'}</button>
        <button onClick={onClose} className="flex-1 py-2 bg-gray-600 text-white rounded font-bold text-xs hover:bg-gray-500">Chiudi</button>
      </div>
      {showHistory && <HistoryView />}
      <button
        onClick={openProgress}
        className="w-full text-blue-400 hover:text-blue-300 text-sm underline text-center mt-2"
      >
        Vedi report completo →
      </button>
    </div>
  );
}

function HistoryView() {
  const history = loadQuizHistory();
  const recent = history.slice(-10).reverse();

  if (recent.length === 0) {
    return <div className="text-gray-500 text-xs text-center py-2">Nessuno storico disponibile</div>;
  }

  const allAnswers = recent.flatMap((s) => s.questions);

  return (
    <div className="space-y-2 border-t border-gray-700 pt-2">
      <div className="text-xs text-gray-400 font-medium">Ultime 10 sessioni — medie</div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div><span className="text-gray-500">Alt:</span> <span className="text-white">{averageByType(allAnswers, 'altitude') ?? '-'}</span></div>
        <div><span className="text-gray-500">Dist:</span> <span className="text-white">{averageByType(allAnswers, 'distance') ?? '-'}</span></div>
        <div><span className="text-gray-500">Az:</span> <span className="text-white">{averageByType(allAnswers, 'azimuth') ?? '-'}</span></div>
      </div>
      <div className="space-y-1 max-h-[120px] overflow-y-auto">
        {recent.map((s, i) => (
          <div key={i} className="flex justify-between text-xs text-gray-400">
            <span>{new Date(s.date).toLocaleDateString('it-IT')}</span>
            <span className="font-bold text-white">{s.average}/100</span>
          </div>
        ))}
      </div>
    </div>
  );
}
