import { create } from 'zustand';

interface UIState {
  compassActive: boolean;
  rulerActive: boolean;
  quizActive: boolean;
  progressOpen: boolean;
  drawerOpen: boolean;
  searchOpen: boolean;

  toggleCompass: () => void;
  toggleRuler: () => void;
  toggleQuiz: () => void;
  deactivateCompass: () => void;
  deactivateRuler: () => void;
  openProgress: () => void;
  closeProgress: () => void;
  setDrawerOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  compassActive: false,
  rulerActive: false,
  quizActive: false,
  progressOpen: false,
  drawerOpen: false,
  searchOpen: false,

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
  openProgress: () => set({ progressOpen: true, quizActive: false }),
  closeProgress: () => set({ progressOpen: false }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
}));
