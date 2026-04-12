'use client';

import { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useUIStore } from '@/stores/uiStore';
import { setQuizMapBounds } from '@/components/quiz/QuizOverlay';
import { QuizMarkers } from './QuizMarkers';
import type { QuizPoint } from '@/lib/quiz';

export function QuizBoundsSync() {
  const quizActive = useUIStore((s) => s.quizActive);
  const map = useMap();
  const [quizPoints, setQuizPoints] = useState<{ a: QuizPoint | null; b: QuizPoint | null }>({ a: null, b: null });

  useEffect(() => {
    if (!quizActive) {
      setQuizMapBounds(null);
      setQuizPoints({ a: null, b: null });
      return;
    }
    const updateBounds = () => {
      const b = map.getBounds();
      setQuizMapBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    };
    updateBounds();
    map.on('moveend', updateBounds);

    const handlePoints = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setQuizPoints(detail);
    };
    window.addEventListener('quiz-points', handlePoints);

    return () => {
      map.off('moveend', updateBounds);
      window.removeEventListener('quiz-points', handlePoints);
      setQuizMapBounds(null);
    };
  }, [quizActive, map]);

  if (!quizActive) return null;
  return <QuizMarkers pointA={quizPoints.a} pointB={quizPoints.b} />;
}
