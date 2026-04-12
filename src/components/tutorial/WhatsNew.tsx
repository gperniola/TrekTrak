'use client';

import { useState, useEffect, useRef } from 'react';
import { KEYS } from '@/lib/storage';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface ReleaseStep {
  title: string;
  text: string;
  icon: string;
  mockup?: React.ReactNode;
}

interface Release {
  version: string;
  date: string;
  steps: ReleaseStep[];
}

function TrailRoutingMockup() {
  return (
    <div className="mt-3 rounded-lg border border-gray-600 overflow-hidden">
      <div className="bg-gray-800 p-2 flex items-center justify-between text-xs">
        <div>
          <div className="text-gray-300 font-medium">Percorso su sentiero</div>
          <div className="text-[9px] text-green-400">Attivo — distanze lungo i sentieri reali</div>
        </div>
        <div className="w-9 h-5 bg-green-600 rounded-full relative">
          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full" />
        </div>
      </div>
      <div className="bg-gray-900 p-2">
        <div className="flex items-center gap-2 text-[9px] text-gray-400">
          <span className="text-green-400">━━━</span> sentiero reale
          <span className="text-gray-500">╌╌╌</span> linea d&apos;aria
        </div>
      </div>
    </div>
  );
}

function ColoredPathMockup() {
  return (
    <div className="mt-3 rounded-lg border border-gray-600 overflow-hidden">
      <div className="bg-gray-800 p-2 flex items-center justify-between text-xs">
        <div>
          <div className="text-gray-300 font-medium">Percorso colorato</div>
          <div className="text-[9px] text-green-400">Attivo — colori per pendenza</div>
        </div>
        <div className="w-9 h-5 bg-green-600 rounded-full relative">
          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full" />
        </div>
      </div>
      <div className="bg-gray-900 p-2 flex items-center gap-1">
        <div className="h-1 flex-1 rounded bg-green-400" />
        <div className="h-1 flex-[0.5] rounded bg-yellow-400" />
        <div className="h-1 flex-[0.7] rounded bg-orange-400" />
        <div className="h-1 flex-[0.3] rounded bg-red-400" />
        <div className="h-1 flex-[0.5] rounded bg-yellow-400" />
        <div className="h-1 flex-1 rounded bg-green-400" />
      </div>
      <div className="bg-gray-900 px-2 pb-2 flex justify-between text-[8px] text-gray-500">
        <span>piano</span>
        <span>moderato</span>
        <span>ripido</span>
        <span>molto ripido</span>
      </div>
    </div>
  );
}

/**
 * Release notes shown once per version with step-by-step visual walkthrough.
 * Add new entries at the TOP of the array.
 */
const RELEASES: Release[] = [
  {
    version: '0.4.0',
    date: '2026-04-11',
    steps: [
      {
        title: 'Suggerimenti didattici',
        text: 'Dopo la verifica, clicca sui badge colorati (✓ ~ ✗) per ricevere consigli personalizzati su come migliorare. Il suggerimento si adatta all\'entità dell\'errore.',
        icon: '💡',
      },
      {
        title: 'Report Progresso',
        text: 'Traccia il tuo miglioramento nel tempo con il nuovo pannello Progresso (📊). Visualizza grafici di andamento, statistiche per categoria, e confronta verifiche e quiz.',
        icon: '📊',
      },
      {
        title: 'Feedback Verifica',
        text: 'Ora vedi subito un riepilogo dei risultati dopo ogni verifica: quanti campi corretti, approssimati, o errati. Il badge appare con un\'animazione per catturare l\'attenzione.',
        icon: '✅',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-03-26',
    steps: [
      {
        title: '4 mappe + sentieri',
        text: 'Scegli tra Thunderforest Outdoors, OpenTopoMap, CyclOSM e OpenStreetMap dalle impostazioni mappa. L\'overlay Waymarked Trails mostra i sentieri escursionistici CAI e GR.',
        icon: '🗺️',
      },
      {
        title: 'Quiz cartografico',
        text: 'Testa le tue competenze! Premi il pulsante "?" per avviare un quiz con 5 domande su altitudine, distanza e azimuth. Punteggio 0-100 con storico delle sessioni.',
        icon: '❓',
      },
      {
        title: 'Righello e griglia',
        text: 'Usa il righello (↕) per misurare distanza, azimuth e dislivello tra due punti qualsiasi. Attiva la griglia coordinate dalle impostazioni per una lettura piu\' facile.',
        icon: '📐',
      },
      {
        title: 'Profilo interattivo',
        text: 'Il profilo altimetrico ora e\' bidirezionale: hover sul grafico mostra il punto sulla mappa e viceversa. Click sul grafico centra la mappa sul punto.',
        icon: '📊',
      },
      {
        title: 'Condividi e meteo',
        text: '"Copia link" genera un URL con l\'itinerario compresso. "Meteo" apre le previsioni Meteoblue per la zona. Posizione GPS con pulsante mirino sulla mappa.',
        icon: '🔗',
      },
      {
        title: 'Offline e PWA',
        text: 'L\'app e\' ora installabile e funziona offline! I tile mappa delle zone visitate vengono salvati automaticamente. Installa dal browser per l\'uso sul campo.',
        icon: '📱',
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-03-20',
    steps: [
      {
        title: 'Percorso su sentiero',
        text: 'Attiva l\'opzione nelle impostazioni mappa (⚙️) per calcolare distanza e dislivelli lungo i sentieri reali invece che in linea d\'aria. Il tracciato segue i sentieri sulla mappa.',
        icon: '🥾',
        mockup: <TrailRoutingMockup />,
      },
      {
        title: 'Percorso colorato',
        text: 'La linea del percorso sulla mappa ora può essere colorata in base alla pendenza: verde (piano), giallo (moderato), arancione (ripido), rosso (molto ripido). Attivalo dalle impostazioni mappa (⚙️).',
        icon: '🌈',
        mockup: <ColoredPathMockup />,
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-03-20',
    steps: [
      {
        title: 'Benvenuto in TrekTrak!',
        text: 'Prima release con profilo altimetrico colorato, menu mobile, tutorial interattivo, validazione cumulativa e molto altro.',
        icon: '🎉',
      },
    ],
  },
];

const CURRENT_VERSION = RELEASES[0].version;

export function WhatsNew() {
  const [step, setStep] = useState<number | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(step !== null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(KEYS.whatsNewVersion);
      if (seen === CURRENT_VERSION) return;
      if (!localStorage.getItem(KEYS.tutorialSeen)) return;
      const rel = RELEASES.find((r) => r.version === CURRENT_VERSION);
      if (!rel) return;
      setRelease(rel);
      setStep(0);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    if (step === null) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
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
      window.removeEventListener('keydown', handleKey);
      dialogEl?.removeEventListener('keydown', trapFocus);
    };
  }, [step]);

  function handleClose() {
    setStep(null);
    try {
      localStorage.setItem(KEYS.whatsNewVersion, CURRENT_VERSION);
    } catch {
      // localStorage unavailable
    }
  }

  function handleNext() {
    if (step === null || !release) return;
    if (step < release.steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  }

  if (step === null || !release) return null;

  const current = release.steps[step];
  const isLast = step === release.steps.length - 1;
  const isSingleStep = release.steps.length === 1;

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/60"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Novità versione ${release.version}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-sm w-full p-5 shadow-2xl outline-none overflow-y-auto max-h-[calc(100vh-2rem)]"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-3xl">{current.icon}</span>
          <div>
            <h2 className="text-base font-bold text-green-400">{current.title}</h2>
            <p className="text-[10px] text-gray-500">Novità v{release.version}</p>
          </div>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed">{current.text}</p>

        {current.mockup}

        {/* Step indicator (only for multi-step releases) */}
        {!isSingleStep && (
          <>
            <div className="flex justify-center gap-1.5 mt-4 mb-4" aria-hidden="true">
              {release.steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === step ? 'bg-green-400' : 'bg-gray-600'}`}
                />
              ))}
            </div>
            <span className="sr-only">Novità {step + 1} di {release.steps.length}</span>
          </>
        )}

        {/* Actions */}
        <div className={`flex items-center ${isSingleStep ? 'mt-4' : ''} ${!isSingleStep ? 'justify-between' : 'justify-center'}`}>
          {!isSingleStep && (
            <button
              onClick={handleClose}
              className="px-3 min-h-[44px] text-xs text-gray-400 hover:text-gray-200"
            >
              Salta
            </button>
          )}
          <div className="flex gap-2">
            {!isSingleStep && step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 min-h-[44px] bg-gray-700 rounded text-xs text-gray-300 hover:bg-gray-600"
              >
                Indietro
              </button>
            )}
            <button
              onClick={isSingleStep ? handleClose : handleNext}
              className="px-4 min-h-[44px] bg-green-600 rounded text-xs text-white font-bold hover:bg-green-500"
            >
              {isLast || isSingleStep ? 'Ho capito!' : 'Avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
