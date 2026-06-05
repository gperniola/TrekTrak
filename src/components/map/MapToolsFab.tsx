'use client';

import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';

const TOOLS = [
  { key: 'compass', label: 'Bussola', icon: '🧭', activeBg: 'bg-amber-500' },
  { key: 'ruler', label: 'Righello', icon: '📏', activeBg: 'bg-blue-500' },
  { key: 'quiz', label: 'Quiz', icon: '❓', activeBg: 'bg-purple-500' },
] as const;

/**
 * Speed-dial FAB degli strumenti mappa (bussola/righello/quiz), solo mobile (<lg).
 * Su desktop i tool restano nella toolbar di ModeSwitch. Bottom-left per non
 * collidere col controllo "La mia posizione" (bottom-right di Leaflet).
 */
export function MapToolsFab() {
  const [open, setOpen] = useState(false);
  const compassActive = useUIStore((s) => s.compassActive);
  const rulerActive = useUIStore((s) => s.rulerActive);
  const quizActive = useUIStore((s) => s.quizActive);
  const toggleCompass = useUIStore((s) => s.toggleCompass);
  const toggleRuler = useUIStore((s) => s.toggleRuler);
  const toggleQuiz = useUIStore((s) => s.toggleQuiz);

  const active: Record<string, boolean> = { compass: compassActive, ruler: rulerActive, quiz: quizActive };
  const toggle: Record<string, () => void> = { compass: toggleCompass, ruler: toggleRuler, quiz: toggleQuiz };
  const anyActive = compassActive || rulerActive || quizActive;

  const pick = (key: 'compass' | 'ruler' | 'quiz') => {
    toggle[key]();
    setOpen(false);
  };

  return (
    <div className="lg:hidden absolute left-3 bottom-3 z-[1000] flex flex-col items-start gap-2">
      {open && TOOLS.map((t) => (
        <button
          key={t.key}
          onClick={() => pick(t.key)}
          aria-label={t.label}
          aria-pressed={active[t.key]}
          className="flex items-center gap-2"
        >
          <span className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center text-lg ${active[t.key] ? `${t.activeBg} text-white` : 'bg-gray-800 text-gray-100'}`}>
            <span aria-hidden="true">{t.icon}</span>
          </span>
          <span className="text-xs font-medium text-white bg-black/60 rounded px-2 py-1">{t.label}</span>
        </button>
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Chiudi strumenti' : 'Strumenti mappa'}
        aria-expanded={open}
        aria-pressed={anyActive}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-xl transition-colors ${
          anyActive && !open ? 'bg-amber-500 text-white' : 'bg-green-500 text-black'
        }`}
      >
        <span aria-hidden="true">{open ? '✕' : '🧭'}</span>
      </button>
    </div>
  );
}
