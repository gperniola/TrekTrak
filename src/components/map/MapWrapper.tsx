'use client';

import dynamic from 'next/dynamic';

const InteractiveMap = dynamic(
  () => import('./InteractiveMap').then((m) => ({ default: m.InteractiveMap })),
  { ssr: false, loading: () => <div role="status" aria-live="polite" className="h-full w-full bg-gray-800 flex items-center justify-center text-gray-300">Caricamento mappa...</div> }
);

export function MapWrapper() {
  return <InteractiveMap />;
}
