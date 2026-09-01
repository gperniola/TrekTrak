'use client';

import { useState } from 'react';
import type { QuizQuestion as QuizQuestionType, QuizAnswer, QuestionType } from '@/lib/quiz';
import { calculateQuizScore, azimuthDelta } from '@/lib/quiz';
import { parseDecimale } from '@/components/shared/NumberInput';
import { numero } from '@/lib/formato';

const TYPE_LABELS: Record<QuestionType, string> = {
  altitude: 'Altitudine',
  distance: 'Distanza',
  azimuth: 'Azimuth',
};

// TASK-25: short how-to shown once per question type (gated by localStorage).
const HOW_TO: Record<QuestionType, { title: string; body: string }> = {
  altitude: {
    title: 'Come stimare l\'altitudine',
    body: 'Leggi le curve di livello attorno al punto. L\'equidistanza standard è 25m (carta IGM 1:25.000): conta le curve dal valore noto più vicino. Il punto evidenziato è il viola sulla mappa.',
  },
  distance: {
    title: 'Come stimare la distanza in linea d\'aria',
    body: 'Usa la scala della mappa o stima visiva: 1 km ≈ 4 cm a 1:25.000. La distanza è in linea d\'aria, non lungo il sentiero. I due punti sono viola (A) e arancione (B).',
  },
  azimuth: {
    title: 'Come stimare l\'azimuth',
    body: 'L\'azimuth è la direzione in gradi rispetto al Nord. Orienta mentalmente la mappa al Nord (in alto), poi conta i gradi in senso orario dal Nord verso il target. N=0°, E=90°, S=180°, W=270°.',
  },
};

function getHowToSeenKey(type: QuestionType): string {
  return `trektrak_quiz_howto_${type}`;
}

export function QuizQuestionView({ question, questionNumber, totalQuestions, onAnswer }: {
  question: QuizQuestionType;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: QuizAnswer) => void;
}) {
  const [input, setInput] = useState('');
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<QuizAnswer | null>(null);
  // TASK-25: show how-to mini-guide before first occurrence of each question type
  const [howToOpen, setHowToOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(getHowToSeenKey(question.type)) !== '1';
    } catch {
      return false;
    }
  });
  const dismissHowTo = () => {
    try { localStorage.setItem(getHowToSeenKey(question.type), '1'); } catch { /* ignore */ }
    setHowToOpen(false);
  };

  const handleSubmit = () => {
    /*
     * Stesso parser dei campi dell'editor, CON la regola delle migliaia quando la
     * domanda e' in metri.
     *
     * Senza, chi rispondeva "1.500" a una domanda sull'altitudine otteneva 1,5 e
     * prendeva **zero su una risposta giusta**: bocciato da un separatore. La
     * correzione di ieri copriva i campi dell'editor, non questo — il quiz ha un input
     * suo, ed e' la terza volta che lo stesso difetto ricompare in un secondo posto.
     */
    const userValue = parseDecimale(input, question.unit === 'm');
    if (userValue == null) return;
    const score = calculateQuizScore(userValue, question.realValue, question.type);
    const answer: QuizAnswer = { type: question.type, score, userValue, realValue: question.realValue };
    setResult(answer);
    setAnswered(true);
  };

  const handleNext = () => {
    if (result) onAnswer(result);
  };

  const delta = result
    ? question.type === 'azimuth'
      ? azimuthDelta(result.userValue, result.realValue)
      : Math.abs(result.userValue - result.realValue)
    : null;

  const scoreColor = result
    ? result.score >= 70 ? 'text-green-400' : result.score >= 40 ? 'text-amber-400' : 'text-red-400'
    : '';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Domanda {questionNumber}/{totalQuestions}</span>
        <span className="text-xs font-bold text-purple-400">{TYPE_LABELS[question.type]}</span>
      </div>
      <p className="text-sm text-gray-200">{question.prompt}</p>
      {howToOpen && (
        <div className="bg-purple-900/40 border border-purple-700 rounded p-2 text-[11px] text-gray-200">
          <div className="font-bold text-purple-300 mb-1">💡 {HOW_TO[question.type].title}</div>
          <p className="leading-snug">{HOW_TO[question.type].body}</p>
          <button
            onClick={dismissHowTo}
            className="mt-1.5 text-purple-300 hover:text-white underline text-[10px]"
          >
            Capito, non mostrare più
          </button>
        </div>
      )}
      {!answered ? (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder={question.unit}
            aria-label={`Risposta in ${question.unit}`}
            autoFocus
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none max-lg:min-h-[44px]"
          />
          <button
            onClick={handleSubmit}
            disabled={!input}
            className="px-4 py-2 bg-purple-600 text-su-colore rounded font-bold text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            Conferma
          </button>
        </div>
      ) : result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-gray-500 text-[10px]">Tua risposta</div>
              <div className="text-white font-bold text-sm">
                {numero(result.userValue, question.type === 'distance' ? 2 : 0)} {question.unit}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px]">Valore reale</div>
              <div className="text-green-400 font-bold text-sm">
                {numero(result.realValue, question.type === 'distance' ? 2 : 0)} {question.unit}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px]">Errore</div>
              <div className="text-amber-400 font-bold text-sm">
                {question.type === 'distance'
                  ? `${result.realValue !== 0 ? numero((delta! / result.realValue) * 100) : '∞'}%`
                  : `${numero(delta!)} ${question.unit}`}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={`font-bold text-lg ${scoreColor}`}>{result.score}/100</span>
            <button onClick={handleNext} className="px-4 py-2 bg-gray-700 text-white rounded font-bold text-sm hover:bg-gray-600">
              Prossima &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
