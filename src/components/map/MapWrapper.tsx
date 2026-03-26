'use client';

import dynamic from 'next/dynamic';

const InteractiveMap = dynamic(
  () => import('./InteractiveMap').then((m) => ({ default: m.InteractiveMap })),
  { ssr: false, loading: () => <div className="h-full w-full bg-gray-800 flex items-center justify-center text-gray-500">Caricamento mappa...</div> }
);

export function MapWrapper({ mobileSearchOpen, compassActive, onCompassDeactivate, rulerActive, onRulerDeactivate, quizActive }: {
  mobileSearchOpen?: boolean;
  compassActive?: boolean;
  onCompassDeactivate?: () => void;
  rulerActive?: boolean;
  onRulerDeactivate?: () => void;
  quizActive?: boolean;
}) {
  return <InteractiveMap mobileSearchOpen={mobileSearchOpen} compassActive={compassActive} onCompassDeactivate={onCompassDeactivate} rulerActive={rulerActive} onRulerDeactivate={onRulerDeactivate} quizActive={quizActive} />;
}
