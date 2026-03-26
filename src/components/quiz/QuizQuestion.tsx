'use client';

import { useState } from 'react';
import type { QuizQuestion as QuizQuestionType, QuizAnswer, QuestionType } from '@/lib/quiz';
import { calculateQuizScore, azimuthDelta } from '@/lib/quiz';

const TYPE_LABELS: Record<QuestionType, string> = {
  altitude: 'Altitudine',
  distance: 'Distanza',
  azimuth: 'Azimuth',
};

export function QuizQuestionView({ question, questionNumber, totalQuestions, onAnswer }: {
  question: QuizQuestionType;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: QuizAnswer) => void;
}) {
  const [input, setInput] = useState('');
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<QuizAnswer | null>(null);

  const handleSubmit = () => {
    const userValue = parseFloat(input);
    if (isNaN(userValue)) return;
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
      {!answered ? (
        <div className="flex gap-2">
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder={question.unit}
            autoFocus
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!input}
            className="px-4 py-2 bg-purple-500 text-white rounded font-bold text-sm hover:bg-purple-400 disabled:opacity-50"
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
                {result.userValue.toFixed(question.type === 'distance' ? 2 : 0)} {question.unit}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px]">Valore reale</div>
              <div className="text-green-400 font-bold text-sm">
                {result.realValue.toFixed(question.type === 'distance' ? 2 : 0)} {question.unit}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px]">Errore</div>
              <div className="text-amber-400 font-bold text-sm">
                {question.type === 'distance'
                  ? `${result.realValue !== 0 ? ((delta! / result.realValue) * 100).toFixed(0) : '∞'}%`
                  : `${delta!.toFixed(0)} ${question.unit}`}
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
