'use client';

import { useState, useEffect, useRef } from 'react';
import { KEYS } from '@/lib/storage';

interface TutorialStep {
  title: string;
  text: string;
  icon: string;
  mockup?: React.ReactNode;
}

function MenuMockup({ highlight }: { highlight?: 'fields' | 'verify' | 'badges' }) {
  return (
    <div className="mt-3 bg-gray-800 rounded-lg border border-gray-600 p-2 text-xs">
      <div className="flex gap-1 mb-2">
        <span className="flex-1 py-1 text-center bg-purple-600 rounded-l text-white font-bold">Learn</span>
        <span className="flex-1 py-1 text-center bg-gray-700 rounded-r text-gray-400">Track</span>
      </div>
      <div className="bg-gray-900 rounded p-2 mb-1">
        <div className="text-green-400 font-bold mb-1">1. Partenza</div>
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-gray-800 rounded px-1 py-0.5 text-gray-500">Lat</div>
          <div className="bg-gray-800 rounded px-1 py-0.5 text-gray-500">Lon</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'badges' ? 'text-white' : 'text-gray-500'}`}>
            Alt {highlight === 'badges' && <span className="inline-block w-3 h-3 rounded-full bg-green-600 text-[8px] text-center leading-3 ml-0.5">✓</span>}
          </div>
        </div>
      </div>
      <div className={`bg-gray-900 rounded p-2 mb-1 border-l-2 border-green-400 ${highlight === 'fields' ? 'ring-1 ring-green-400/50' : ''}`}>
        <div className="grid grid-cols-4 gap-1">
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-500'}`}>
            Dist {highlight === 'badges' && <span className="inline-block w-3 h-3 rounded-full bg-yellow-600 text-[8px] text-center leading-3 ml-0.5">~</span>}
          </div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-500'}`}>D+</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-500'}`}>D-</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-500'}`}>
            Azim. {highlight === 'badges' && <span className="inline-block w-3 h-3 rounded-full bg-red-600 text-[8px] text-center leading-3 ml-0.5">✗</span>}
          </div>
        </div>
      </div>
      {highlight === 'verify' && (
        <div className="flex justify-end mt-1">
          <span className="bg-green-600 text-white px-2 py-0.5 rounded font-bold animate-pulse">Verifica</span>
        </div>
      )}
    </div>
  );
}

const STEPS: TutorialStep[] = [
  {
    title: 'Benvenuto in TrekTrak!',
    text: 'Impara la cartografia manuale creando itinerari escursionistici. Questa guida ti mostra come usare la modalità Learn. Puoi anche esplorare la modalità Track, che calcola automaticamente i valori per te.',
    icon: '🗺️',
  },
  {
    title: 'Aggiungi waypoint',
    text: 'Clicca o tocca la mappa per posizionare i waypoint del tuo itinerario. Ogni waypoint rappresenta un punto di passaggio.',
    icon: '📍',
  },
  {
    title: 'Inserisci i dati manualmente',
    text: 'Apri il menu (☰) per vedere waypoint e tratte. In modalità Learn, inserisci tu i valori di distanza in linea d\'aria, dislivello e azimuth (la direzione rispetto al Nord).',
    icon: '✏️',
    mockup: <MenuMockup highlight="fields" />,
  },
  {
    title: 'Verifica i calcoli',
    text: 'In fondo al menu trovi il pulsante "Verifica": premilo per confrontare i tuoi valori con quelli calcolati dall\'app. Le distanze sono calcolate in linea d\'aria tra i waypoint.',
    icon: '✅',
    mockup: <MenuMockup highlight="verify" />,
  },
  {
    title: 'Tocca le icone di validazione',
    text: 'Dopo la verifica, appaiono icone colorate accanto ai campi: ✓ preciso, ~ vicino, ✗ lontano. Toccale per vedere il valore esatto.',
    icon: '🔍',
    mockup: <MenuMockup highlight="badges" />,
  },
  {
    title: 'Profilo altimetrico',
    text: 'Il grafico in basso mostra il profilo di elevazione colorato per pendenza: verde (piano), giallo (moderato), arancione (ripido), rosso (molto ripido).',
    icon: '📊',
  },
];

export function LearnTutorial() {
  const [step, setStep] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Check localStorage on mount
  useEffect(() => {
    try {
      if (localStorage.getItem(KEYS.tutorialSeen)) return;
    } catch {
      // localStorage unavailable — show tutorial anyway
    }
    setStep(0);
  }, []);

  // Escape key, focus trap, body scroll lock
  useEffect(() => {
    if (step === null) return;

    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        markSeen();
        setStep(null);
      }
    };
    window.addEventListener('keydown', handleKey);

    dialogRef.current?.focus();

    const dialogEl = dialogRef.current;
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogEl) return;
      const focusable = dialogEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    dialogEl?.addEventListener('keydown', trapFocus);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
      dialogEl?.removeEventListener('keydown', trapFocus);
    };
  }, [step]);

  function markSeen() {
    try {
      localStorage.setItem(KEYS.tutorialSeen, '1');
    } catch {
      // localStorage unavailable
    }
  }

  function changeStep(newStep: number | null) {
    if (newStep === null || newStep < 0 || newStep >= STEPS.length) {
      markSeen();
      setStep(null);
    } else {
      setStep(newStep);
    }
  }

  const handleNext = () => {
    if (step === null) return;
    changeStep(step < STEPS.length - 1 ? step + 1 : null);
  };

  const handleClose = () => changeStep(null);

  if (step === null) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/60"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial modalità Learn"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-sm w-full p-5 shadow-2xl outline-none overflow-y-auto max-h-[calc(100vh-2rem)]"
      >
        <div className="text-3xl mb-3">{current.icon}</div>
        <h2 className="text-base font-bold text-green-400 mb-2">{current.title}</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{current.text}</p>

        {current.mockup}

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mt-4 mb-4" aria-hidden="true">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i === step ? 'bg-green-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>
        <span className="sr-only">Passo {step + 1} di {STEPS.length}</span>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-3 min-h-[44px] text-xs text-gray-400 hover:text-gray-200"
          >
            Salta
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => changeStep(step - 1)}
                className="px-3 min-h-[44px] bg-gray-700 rounded text-xs text-gray-300 hover:bg-gray-600"
              >
                Indietro
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 min-h-[44px] bg-green-600 rounded text-xs text-white font-bold hover:bg-green-500"
            >
              {isLast ? 'Inizia!' : 'Avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
