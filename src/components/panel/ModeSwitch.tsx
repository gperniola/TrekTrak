'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import type { AppMode } from '@/lib/types';
import { mostra } from '@/lib/profilo';
/*
  **I nomi a schermo sono «Impara» e «Pianificazione»; nel codice restano `learn` e
  `track`.**

  Rinominati su richiesta il 2026-09-03. Gli identificatori interni non si toccano: sono
  scritti dentro ogni itinerario salvato (`appMode`) e nei campi paralleli
  `learnValues`/`trackValues`, quindi cambiarli vorrebbe dire una migrazione dei dati per
  un'etichetta. Le due cose sono separate di proposito — quello che l'utente legge e il
  nome che il dato porta con se'.
*/


export function ModeSwitch() {
  const appMode = useItineraryStore((s) => s.appMode);
  const setAppMode = useItineraryStore((s) => s.setAppMode);

  const compassActive = useUIStore((s) => s.compassActive);
  const rulerActive = useUIStore((s) => s.rulerActive);
  const quizActive = useUIStore((s) => s.quizActive);
  const toggleCompass = useUIStore((s) => s.toggleCompass);
  const toggleRuler = useUIStore((s) => s.toggleRuler);
  const toggleQuiz = useUIStore((s) => s.toggleQuiz);
  const profilo = useUIStore((s) => s.profilo);
  const deactivateCompass = useUIStore((s) => s.deactivateCompass);
  const deactivateRuler = useUIStore((s) => s.deactivateRuler);
  const deactivateQuiz = useUIStore((s) => s.deactivateQuiz);

  const isTrack = appMode === 'track';
  /*
   * Sotto `lg` questa barra ha due contenuti possibili, e in Montagna nessuno dei due:
   * la toolbar degli strumenti e' `hidden lg:flex` e l'interruttore Learn/Track e' di
   * Imparo. Restava un rettangolo vuoto con padding e `border-b`, cioe' una riga di
   * separazione in mezzo al nulla in cima al pannello Editor. Si nasconde in CSS e non
   * misurando lo schermo in JS: nessun rischio di sfasatura all'idratazione.
   */
  const vuotaSuTelefono = !mostra('switchLearnTrack', profilo);

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
    <div className={`flex items-center px-3 py-2 border-b border-gray-700 gap-1${vuotaSuTelefono ? ' max-lg:hidden' : ''}`}>
      {/* TASK-40: ogni tool ha icona + etichetta testuale (i soli glifi ◎ ↕ ? erano ambigui). */}
      <div role="toolbar" aria-label="Strumenti mappa" className="hidden lg:flex items-center gap-1">
        <button
          onClick={toggleCompass}
          className={`px-2 py-1 rounded-lg transition-all active:scale-95 min-w-[44px] min-h-[40px] flex flex-col items-center justify-center gap-0.5 ${
            compassActive
              ? 'bg-amber-500 text-black shadow-sm shadow-amber-900/40'
              : 'bg-gray-700/80 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          aria-label={compassActive ? 'Disattiva bussola' : 'Attiva bussola'}
          aria-pressed={compassActive}
          title="Bussola"
        >
          <span aria-hidden="true" className="text-sm font-bold leading-none">◎</span>
          <span className="text-[9px] font-semibold leading-none">Bussola</span>
        </button>
        <button
          onClick={toggleRuler}
          className={`px-2 py-1 rounded-lg transition-all active:scale-95 min-w-[44px] min-h-[40px] flex flex-col items-center justify-center gap-0.5 ${
            rulerActive
              ? 'bg-blue-600 text-su-colore shadow-sm shadow-blue-900/40'
              : 'bg-gray-700/80 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          aria-label={rulerActive ? 'Disattiva righello' : 'Attiva righello'}
          aria-pressed={rulerActive}
          title="Righello"
        >
          <span aria-hidden="true" className="text-sm font-bold leading-none">↕</span>
          <span className="text-[9px] font-semibold leading-none">Righello</span>
        </button>
        {/*
          Anche il quiz della toolbar desktop segue il profilo: nasconderlo solo nel FAB
          l'avrebbe lasciato su schermo grande. E' esattamente il difetto che la tabella
          delle aree esiste per evitare — un ingresso nascosto e un altro no.
        */}
        {mostra('quiz', profilo) && <button
          onClick={toggleQuiz}
          className={`px-2 py-1 rounded-lg transition-all active:scale-95 min-w-[44px] min-h-[40px] flex flex-col items-center justify-center gap-0.5 ${
            quizActive
              ? 'bg-purple-600 text-su-colore shadow-sm shadow-purple-900/40'
              : 'bg-gray-700/80 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          aria-label={quizActive ? 'Disattiva quiz' : 'Attiva quiz'}
          aria-pressed={quizActive}
          title="Quiz"
        >
          <span aria-hidden="true" className="text-sm font-bold leading-none">?</span>
          <span className="text-[9px] font-semibold leading-none">Quiz</span>
        </button>}
      </div>
      {/*
        In Montagna i valori li calcola l'app, quindi l'interruttore non serve. I valori
        inseriti a mano NON si perdono: `learnValues` e `trackValues` stanno in parallelo
        dalla v0.7.0, e tornando in Imparo si rivedono.
      */}
      {mostra('switchLearnTrack', profilo) && <div role="tablist" aria-label="Come si compilano i valori dell’itinerario" className="flex items-center gap-1 flex-1 p-0.5 rounded-lg bg-gray-800/60">
        <button
          role="tab"
          aria-selected={!isTrack}
          onClick={() => handleToggle('learn')}
          className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all active:scale-[0.98] max-lg:min-h-[44px] ${
            !isTrack
              ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-sm shadow-purple-900/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Impara
        </button>
        <button
          role="tab"
          aria-selected={isTrack}
          onClick={() => handleToggle('track')}
          className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all active:scale-[0.98] max-lg:min-h-[44px] ${
            isTrack
              ? 'bg-gradient-to-r from-green-400 to-emerald-600 text-black shadow-sm shadow-emerald-900/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Pianificazione
        </button>
      </div>}
    </div>
  );
}
