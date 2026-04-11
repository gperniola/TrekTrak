'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QuizQuestionView } from './QuizQuestion';
import { QuizSummary } from './QuizSummary';
import type { QuizQuestion, QuizAnswer, QuestionType, QuizPoint } from '@/lib/quiz';
import { generateRandomPoint, generateQuestionSet, saveQuizSession, pickQuizPoint } from '@/lib/quiz';
import { haversineDistance, forwardAzimuth } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';
import { fetchHikingPOIs } from '@/lib/overpass-api';
import type { HikingPOI } from '@/lib/overpass-api';

type QuizPhase = 'loading' | 'question' | 'summary';

// Map bounds are set by QuizBoundsSync in InteractiveMap
let mapBoundsRef: { north: number; south: number; east: number; west: number } | null = null;
export function setQuizMapBounds(bounds: typeof mapBoundsRef) { mapBoundsRef = bounds; }

// Quiz points are communicated to the map via CustomEvent
function emitQuizPoints(a: QuizPoint | null, b: QuizPoint | null) {
  window.dispatchEvent(new CustomEvent('quiz-points', { detail: { a, b } }));
}

async function buildQuestion(type: QuestionType, pois: HikingPOI[]): Promise<QuizQuestion | null> {
  const bounds = mapBoundsRef;
  if (!bounds) return null;

  const getPoint = (): QuizPoint => pickQuizPoint(bounds, pois) ?? generateRandomPoint(bounds, 0.1);

  if (type === 'altitude') {
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = getPoint();
      const alt = await fetchElevation(p.lat, p.lon);
      if (alt != null) {
        return {
          type: 'altitude',
          pointA: p,
          realValue: Math.round(alt),
          unit: 'm',
          prompt: 'Stima l\'altitudine del punto indicato sulla mappa.',
        };
      }
    }
    return null;
  }

  // distance or azimuth — need two points with min 0.5km distance
  const pointA = getPoint();
  let pointB: QuizPoint;
  let dist: number;
  let attempts = 0;
  do {
    pointB = getPoint();
    dist = haversineDistance(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
    attempts++;
  } while (dist < 0.5 && attempts < 10);

  if (dist < 0.5) return null;

  if (type === 'distance') {
    return {
      type: 'distance',
      pointA,
      pointB,
      realValue: Math.round(dist * 100) / 100,
      unit: 'km',
      prompt: 'Stima la distanza in linea d\'aria tra i due punti.',
    };
  }

  const az = forwardAzimuth(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
  return {
    type: 'azimuth',
    pointA,
    pointB,
    realValue: Math.round(az * 10) / 10,
    unit: '°',
    prompt: 'Stima l\'azimuth (in gradi) dal punto viola al punto arancione.',
  };
}

export function QuizOverlay({ onClose, onOpenProgress }: { onClose: () => void; onOpenProgress?: () => void }) {
  const [phase, setPhase] = useState<QuizPhase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      emitQuizPoints(null, null);
    };
  }, []);

  const startSession = useCallback(async () => {
    setPhase('loading');
    setAnswers([]);
    setCurrentIdx(0);
    emitQuizPoints(null, null);

    const bounds = mapBoundsRef;
    if (!bounds) { onClose(); return; }

    const pois = await fetchHikingPOIs(bounds);
    const types = generateQuestionSet(bounds);
    const built: QuizQuestion[] = [];
    for (const type of types) {
      const q = await buildQuestion(type, pois);
      if (!mountedRef.current) return;
      if (q) built.push(q);
    }

    if (built.length === 0) {
      alert('Impossibile generare domande. Prova a zoomare su un\'area diversa.');
      onClose();
      return;
    }

    setQuestions(built);
    emitQuizPoints(built[0].pointA, built[0].pointB ?? null);
    setPhase('question');
  }, [onClose]);

  useEffect(() => { startSession(); }, [startSession]);

  const handleAnswer = useCallback((answer: QuizAnswer) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    const nextIdx = currentIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentIdx(nextIdx);
      const next = questions[nextIdx];
      emitQuizPoints(next.pointA, next.pointB ?? null);
    } else {
      const average = Math.round(newAnswers.reduce((sum, a) => sum + a.score, 0) / newAnswers.length);
      saveQuizSession({ date: new Date().toISOString(), questions: newAnswers, average });
      emitQuizPoints(null, null);
      setPhase('summary');
    }
  }, [answers, currentIdx, questions]);

  const average = answers.length > 0
    ? Math.round(answers.reduce((sum, a) => sum + a.score, 0) / answers.length)
    : 0;

  return (
    <div className="fixed bottom-[100px] lg:bottom-[120px] left-1/2 -translate-x-1/2 z-[1200] bg-gray-900/95 border border-gray-700 rounded-xl w-[calc(100%-1rem)] max-w-sm p-4 shadow-2xl">
      {phase === 'loading' && (
        <div className="text-center text-gray-400 text-sm py-4">Generazione domande...</div>
      )}
      {phase === 'question' && questions[currentIdx] && (
        <QuizQuestionView
          key={currentIdx}
          question={questions[currentIdx]}
          questionNumber={currentIdx + 1}
          totalQuestions={questions.length}
          onAnswer={handleAnswer}
        />
      )}
      {phase === 'summary' && (
        <QuizSummary
          answers={answers}
          average={average}
          onNewSession={startSession}
          onClose={onClose}
          onOpenProgress={onOpenProgress}
        />
      )}
    </div>
  );
}
