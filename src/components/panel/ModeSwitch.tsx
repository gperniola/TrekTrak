'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import type { AppMode } from '@/lib/types';

export function ModeSwitch() {
  const appMode = useItineraryStore((s) => s.appMode);
  const setAppMode = useItineraryStore((s) => s.setAppMode);

  const compassActive = useUIStore((s) => s.compassActive);
  const rulerActive = useUIStore((s) => s.rulerActive);
  const quizActive = useUIStore((s) => s.quizActive);
  const toggleCompass = useUIStore((s) => s.toggleCompass);
  const toggleRuler = useUIStore((s) => s.toggleRuler);
  const toggleQuiz = useUIStore((s) => s.toggleQuiz);
  const deactivateCompass = useUIStore((s) => s.deactivateCompass);
  const deactivateRuler = useUIStore((s) => s.deactivateRuler);
  const deactivateQuiz = useUIStore((s) => s.deactivateQuiz);

  const isTrack = appMode === 'track';

  const handleToggle = (mode: AppMode) => {
    // Clicking Learn or Track deactivates compass, ruler, and quiz
    if (compassActive) deactivateCompass();
    if (rulerActive) deactivateRuler();
    if (quizActive) deactivateQuiz();
    if (mode === appMode) return;
    // TASK-15: switch is now non-destructive. Per-mode values are preserved in
    // trackValues/learnValues slots and restored on switch. No confirm needed.
    setAppMode(mode);
  };

  return (
    <div className="flex items-center px-3 py-2 border-b border-gray-700 gap-1">
      <div role="toolbar" aria-label="Strumenti mappa" className="flex items-center gap-1">
        <button
          onClick={toggleCompass}
          className={`px-2 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 min-w-[36px] min-h-[36px] flex items-center justify-center ${
            compassActive
              ? 'bg-amber-500 text-white shadow-sm shadow-amber-900/40'
              : 'bg-gray-700/80 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          aria-label={compassActive ? 'Disattiva bussola' : 'Attiva bussola'}
          aria-pressed={compassActive}
          title="Bussola"
        >
          ◎
        </button>
        <button
          onClick={toggleRuler}
          className={`px-2 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 min-w-[36px] min-h-[36px] flex items-center justify-center ${
            rulerActive
              ? 'bg-blue-500 text-white shadow-sm shadow-blue-900/40'
              : 'bg-gray-700/80 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          aria-label={rulerActive ? 'Disattiva righello' : 'Attiva righello'}
          aria-pressed={rulerActive}
          title="Righello"
        >
          ↕
        </button>
        <button
          onClick={toggleQuiz}
          className={`px-2 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 min-w-[36px] min-h-[36px] flex items-center justify-center ${
            quizActive
              ? 'bg-purple-500 text-white shadow-sm shadow-purple-900/40'
              : 'bg-gray-700/80 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          aria-label={quizActive ? 'Disattiva quiz' : 'Attiva quiz'}
          aria-pressed={quizActive}
          title="Quiz"
        >
          ?
        </button>
      </div>
      <div role="tablist" aria-label="Modalità app" className="flex items-center gap-1 flex-1 p-0.5 rounded-lg bg-gray-800/60">
        <button
          role="tab"
          aria-selected={!isTrack}
          onClick={() => handleToggle('learn')}
          className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all active:scale-[0.98] ${
            !isTrack
              ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-sm shadow-purple-900/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Learn
        </button>
        <button
          role="tab"
          aria-selected={isTrack}
          onClick={() => handleToggle('track')}
          className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all active:scale-[0.98] ${
            isTrack
              ? 'bg-gradient-to-r from-green-400 to-emerald-600 text-gray-950 shadow-sm shadow-emerald-900/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Track
        </button>
      </div>
    </div>
  );
}
