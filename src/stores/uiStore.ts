import { mostra, type Profilo } from '@/lib/profilo';
import { KEYS } from '@/lib/storage';
import { create } from 'zustand';

interface UIState {
  compassActive: boolean;
  rulerActive: boolean;
  quizActive: boolean;
  progressOpen: boolean;
  searchOpen: boolean;
  mainView: 'editor' | 'library';
  mobileTab: 'map' | 'editor' | 'library';
  moreMenuOpen: boolean;
  emergencyPanelOpen: boolean;
  /**
   * Speed-dial degli strumenti sulla mappa. Sta nello store, non nel componente, perche'
   * i pannelli che si aprono dal basso devono escludersi a vicenda: aperti insieme si
   * sovrappongono e le voci finiscono una sotto l'altra.
   */
  toolsFabOpen: boolean;
  /** Pannello "Meteo del percorso" (fase A dei layer meteo). */
  weatherOpen: boolean;
  /**
   * Profilo d'uso: decide quali aree dell'app esistono a schermo.
   *
   * Da non confondere con `appMode` dell'itinerario: quello decide come si compilano i
   * valori (a mano o calcolati), questo cosa si vede. Uno e' dell'itinerario, l'altro
   * dell'utente.
   */
  profilo: Profilo;

  toggleCompass: () => void;
  toggleRuler: () => void;
  toggleQuiz: () => void;
  deactivateCompass: () => void;
  deactivateRuler: () => void;
  deactivateQuiz: () => void;
  openProgress: () => void;
  closeProgress: () => void;
  setSearchOpen: (open: boolean) => void;
  setMainView: (view: 'editor' | 'library') => void;
  setMobileTab: (tab: 'map' | 'editor' | 'library') => void;
  setMoreMenuOpen: (open: boolean) => void;
  setProfilo: (p: Profilo) => void;
  setEmergencyPanelOpen: (open: boolean) => void;
  setToolsFabOpen: (open: boolean) => void;
  setWeatherOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  compassActive: false,
  rulerActive: false,
  quizActive: false,
  progressOpen: false,
  searchOpen: false,
  mainView: 'editor',
  mobileTab: 'map',
  moreMenuOpen: false,
  emergencyPanelOpen: false,
  toolsFabOpen: false,
  weatherOpen: false,
  /*
   * Il default e' Montagna: non nasconde gli avvisi di sicurezza. Viene sovrascritto
   * all'avvio da `profiloIniziale`, e dalla scelta dell'onboarding.
   */
  profilo: 'montagna',
  setProfilo: (p) => {
    /*
     * Chi era in Libreria e passa a Imparo resterebbe su una vista che non esiste piu':
     * lo si riporta alla mappa e all'editor. Non e' una cancellazione — i percorsi
     * salvati restano dove sono, cambia solo dove ci si trova.
     */
    const inLibreria = get().mobileTab === 'library' || get().mainView === 'library';
    if (p === 'imparo' && inLibreria) {
      set({ mobileTab: 'map', mainView: 'editor' });
    }
    /*
     * Gli overlay che il nuovo profilo non prevede si CHIUDONO, non solo smettono di
     * disegnarsi. Non e' rifinitura: `backDepth` in page.tsx conta `quizActive`,
     * `progressOpen`, `weatherOpen` e `emergencyPanelOpen` per sapere quanti passi di
     * cronologia servono al tasto Indietro. Uno stato acceso e invisibile darebbe un
     * passo fantasma, ed e' la classe di difetto che e' costata sei versioni.
     */
    if (!mostra('quiz', p)) set({ quizActive: false });
    if (!mostra('progresso', p)) set({ progressOpen: false });
    if (!mostra('meteo', p)) set({ weatherOpen: false });
    if (!mostra('layerEmergenza', p)) set({ emergencyPanelOpen: false });
    set({ profilo: p });
    // Nessun dato viene cancellato: si scrive solo la preferenza.
    try { localStorage.setItem(KEYS.profilo, p); } catch { /* storage non disponibile */ }
  },

  toggleCompass: () => set((s) => ({
    compassActive: !s.compassActive,
    rulerActive: false,
    quizActive: false,
  })),
  toggleRuler: () => set((s) => ({
    rulerActive: !s.rulerActive,
    compassActive: false,
    quizActive: false,
  })),
  toggleQuiz: () => set((s) => ({
    quizActive: !s.quizActive,
    compassActive: false,
    rulerActive: false,
  })),
  deactivateCompass: () => set({ compassActive: false }),
  deactivateRuler: () => set({ rulerActive: false }),
  deactivateQuiz: () => set({ quizActive: false }),
  openProgress: () => set({ progressOpen: true, quizActive: false }),
  closeProgress: () => set({ progressOpen: false }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setMainView: (view) => set({ mainView: view }),
  // Bottom-nav tab (mobile only). 'map' lascia il pannello chiuso; editor/library
  // sincronizzano anche mainView così la logica esistente (preview, RouteLibrary,
  // LeftPanel) continua a funzionare senza modifiche.
  setMobileTab: (tab) => set(tab === 'map' ? { mobileTab: tab } : { mobileTab: tab, mainView: tab }),
  // I tre pannelli che vengono dal basso si escludono a vicenda: aprirne uno chiude gli
  // altri. Senza questo il menu "Altro" e lo speed-dial degli strumenti si sovrapponevano,
  // con la voce Quiz che finiva sotto il menu.
  setMoreMenuOpen: (open) => set(open
    ? { moreMenuOpen: true, toolsFabOpen: false, emergencyPanelOpen: false }
    : { moreMenuOpen: false }),
  setEmergencyPanelOpen: (open) => set(open
    ? { emergencyPanelOpen: true, moreMenuOpen: false, toolsFabOpen: false }
    : { emergencyPanelOpen: false }),
  setToolsFabOpen: (open) => set(open
    ? { toolsFabOpen: true, moreMenuOpen: false, emergencyPanelOpen: false }
    : { toolsFabOpen: false }),
  // Il pannello meteo copre lo schermo: aprirlo chiude i pannelli dal basso, che
  // resterebbero sotto senza che si possano toccare.
  setWeatherOpen: (open) => set(open
    ? { weatherOpen: true, moreMenuOpen: false, toolsFabOpen: false, emergencyPanelOpen: false }
    : { weatherOpen: false }),
}));
