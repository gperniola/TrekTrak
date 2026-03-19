'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'trektrak_tutorial_seen';

interface TutorialStep {
  title: string;
  text: string;
  icon: string;
}

const STEPS: TutorialStep[] = [
  {
    title: 'Benvenuto in TrekTrak!',
    text: 'Impara la cartografia manuale creando itinerari escursionistici. Questa guida ti mostra come usare la modalità Learn.',
    icon: '🗺️',
  },
  {
    title: 'Aggiungi waypoint',
    text: 'Tocca la mappa per posizionare i waypoint del tuo itinerario. Ogni waypoint rappresenta un punto di passaggio.',
    icon: '📍',
  },
  {
    title: 'Inserisci i dati manualmente',
    text: 'In modalità Learn, inserisci tu i valori di distanza, dislivello e azimuth per ogni tratta — come faresti con carta e bussola.',
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

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      setStep(0);
    } catch {
      // localStorage not available
    }
  }, []);

  const handleNext = () => {
    if (step === null) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setStep(null);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage not available
    }
  };

  if (step === null) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-sm w-full p-5 shadow-2xl">
        <div className="text-3xl mb-3">{current.icon}</div>
        <h2 className="text-base font-bold text-green-400 mb-2">{current.title}</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">{current.text}</p>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i === step ? 'bg-green-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleClose}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Salta
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 bg-gray-700 rounded text-xs text-gray-300 hover:bg-gray-600"
              >
                Indietro
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-1.5 bg-green-600 rounded text-xs text-white font-bold hover:bg-green-500"
            >
              {isLast ? 'Inizia!' : 'Avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
