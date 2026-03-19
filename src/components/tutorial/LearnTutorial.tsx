'use client';

import { useState, useEffect, useRef } from 'react';
import { KEYS } from '@/lib/storage';

interface TutorialStep {
  title: string;
  text: string;
  icon: string;
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
    text: 'In modalità Learn, inserisci tu i valori di distanza, dislivello e azimuth (la direzione rispetto al Nord) per ogni tratta — come faresti con carta e bussola.',
    icon: '✏️',
  },
  {
    title: 'Verifica i calcoli',
    text: 'Premi "Verifica" per confrontare i tuoi valori con quelli calcolati dall\'app. Le icone colorate mostrano se sei preciso (✓), vicino (~) o lontano (✗).',
    icon: '✅',
  },
  {
    title: 'Tocca le icone di validazione',
    text: 'Dopo la verifica, tocca le icone ✓/~/✗ accanto ai campi per vedere il valore esatto calcolato e lo scarto dal tuo.',
    icon: '🔍',
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

    // Focus the dialog
    dialogRef.current?.focus();

    // Focus trap
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

  const handleNext = () => {
    if (step === null) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      markSeen();
      setStep(null);
    }
  };

  const handleClose = () => {
    markSeen();
    setStep(null);
  };

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
        <p className="text-sm text-gray-300 leading-relaxed mb-4">{current.text}</p>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mb-4" aria-hidden="true">
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
                onClick={() => setStep(step - 1)}
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
