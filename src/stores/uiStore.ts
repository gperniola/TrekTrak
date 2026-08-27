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
  setEmergencyPanelOpen: (open: boolean) => void;
  setToolsFabOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
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
}));
