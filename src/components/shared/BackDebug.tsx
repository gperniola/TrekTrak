'use client';

import { useEffect, useState } from 'react';
import { getBackLog, isBackDebug } from '@/lib/back-debug';

/** Overlay diagnostico del tasto Indietro (solo con ?debug=back). Temporaneo. */
export function BackDebug() {
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    setOn(isBackDebug());
    const update = () => setLines(getBackLog());
    update();
    window.addEventListener('tt-backlog', update);
    return () => window.removeEventListener('tt-backlog', update);
  }, []);

  if (!on) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[2000] bg-black/85 text-green-300 text-[10px] leading-tight font-mono p-1 max-h-[40vh] overflow-y-auto pointer-events-none">
      <div className="text-yellow-300">back-debug (len = history.length)</div>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
