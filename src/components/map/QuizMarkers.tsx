'use client';

import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { QuizPoint } from '@/lib/quiz';

const quizIconA = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#a855f7;border-radius:50%;border:2px solid #fff;font-size:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">?</div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const quizIconB = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#f97316;border-radius:50%;border:2px solid #fff;font-size:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">?</div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function QuizMarkers({ pointA, pointB }: {
  pointA: QuizPoint | null;
  pointB?: QuizPoint | null;
}) {
  return (
    <>
      {pointA && <Marker position={[pointA.lat, pointA.lon]} icon={quizIconA} interactive={false} />}
      {pointB && <Marker position={[pointB.lat, pointB.lon]} icon={quizIconB} interactive={false} />}
    </>
  );
}
