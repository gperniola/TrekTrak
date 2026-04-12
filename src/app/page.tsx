'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { LeftPanel } from '@/components/panel/LeftPanel';
import { MapWrapper } from '@/components/map/MapWrapper';
import { ElevationProfile } from '@/components/map/ElevationProfile';
import { ToleranceSettings } from '@/components/settings/ToleranceSettings';
import { ModeSwitch } from '@/components/panel/ModeSwitch';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { WhatsNew } from '@/components/tutorial/WhatsNew';
import { MapSettings } from '@/components/settings/MapSettings';
import { QuizOverlay } from '@/components/quiz/QuizOverlay';
import { ProgressOverlay } from '@/components/panel/ProgressOverlay';
import { loadSettings } from '@/lib/storage';
import { useItineraryStore } from '@/stores/itineraryStore';
import { decodeItinerary } from '@/lib/share-url';
import { OfflineBanner } from '@/components/shared/OfflineBanner';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMapSettings, setShowMapSettings] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [compassActive, setCompassActive] = useState(false);
  const [rulerActive, setRulerActive] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  useBodyScrollLock(drawerOpen);
  const handleCompassToggle = useCallback(() => {
    setCompassActive((p) => {
      if (!p) { setRulerActive(false); setQuizActive(false); }
      return !p;
    });
  }, []);
  const handleCompassDeactivate = useCallback(() => setCompassActive(false), []);
  const handleRulerToggle = useCallback(() => {
    setRulerActive((p) => {
      if (!p) { setCompassActive(false); setQuizActive(false); }
      return !p;
    });
  }, []);
  const handleRulerDeactivate = useCallback(() => setRulerActive(false), []);
  const handleQuizToggle = useCallback(() => {
    setQuizActive((p) => {
      if (!p) { setCompassActive(false); setRulerActive(false); }
      return !p;
    });
  }, []);

  const handleOpenProgress = useCallback(() => {
    setQuizActive(false);
    setProgressOpen(true);
  }, []);

  // Hydrate settings from localStorage on mount
  useEffect(() => {
    const persisted = loadSettings();
    useItineraryStore.getState().updateSettings(persisted);
  }, []);

  // Load itinerary from URL hash if present
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#data=')) return;
    const decoded = decodeItinerary(hash);
    if (decoded) {
      const store = useItineraryStore.getState();
      const id = Math.random().toString(36).substring(2, 11);
      store.loadItinerary(id, decoded.name, decoded.waypoints, decoded.legs);
    }
    history.replaceState(null, '', window.location.pathname);
  }, []);

  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    const drawerEl = drawerRef.current;
    if (drawerEl) {
      const focusable = drawerEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      first?.focus();

      const trapFocus = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      };
      drawerEl.addEventListener('keydown', trapFocus);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        drawerEl.removeEventListener('keydown', trapFocus);
      };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
      <OfflineBanner />
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <LeftPanel compassActive={compassActive} onCompassToggle={handleCompassToggle} rulerActive={rulerActive} onRulerToggle={handleRulerToggle} quizActive={quizActive} onQuizToggle={handleQuizToggle} onOpenProgress={handleOpenProgress} />
      </div>

      {/* Right Panel: Top Bar (mobile) + Map + Elevation Profile */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden shrink-0 bg-gray-900">
          {/* Row 1: Hamburger | Title | Search */}
          <div className="flex items-center justify-between px-2 py-1">
            <button
              onClick={() => { setSearchOpen(false); setDrawerOpen(true); }}
              className="p-2 text-lg text-gray-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Apri menu"
            >
              ☰
            </button>
            <h1 className="text-base font-bold text-green-400">&#9650; TrekTrak</h1>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSearchOpen((p) => !p)}
                className={`p-2 text-lg hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center ${searchOpen ? 'text-green-400' : 'text-gray-300'}`}
                aria-label={searchOpen ? 'Chiudi ricerca' : 'Cerca località'}
                aria-expanded={searchOpen}
              >
                &#128269;
              </button>
              <button
                onClick={() => setShowMapSettings(true)}
                className="p-2 text-sm text-gray-300 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Impostazioni mappa"
              >
                &#9881;&#xFE0F;
              </button>
            </div>
          </div>
          {/* Row 2: Mode switch (Learn / Track) */}
          <ModeSwitch compassActive={compassActive} onCompassToggle={handleCompassToggle} rulerActive={rulerActive} onRulerToggle={handleRulerToggle} quizActive={quizActive} onQuizToggle={handleQuizToggle} />
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <MapWrapper mobileSearchOpen={searchOpen} compassActive={compassActive} onCompassDeactivate={handleCompassDeactivate} rulerActive={rulerActive} onRulerDeactivate={handleRulerDeactivate} quizActive={quizActive} />

          {/* Settings toggles — desktop only */}
          <div className="hidden lg:flex absolute top-3 left-3 z-[1000] gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className="bg-gray-800/90 px-2 py-1 rounded text-xs text-gray-400 hover:text-white"
              aria-label="Apri impostazioni tolleranze"
            >
            Impostazioni
            </button>
            <button
              onClick={() => setShowMapSettings(true)}
              className="bg-gray-800/90 px-2 py-1 rounded text-xs text-gray-400 hover:text-white"
              aria-label="Impostazioni mappa"
            >
              Mappa &#9881;&#xFE0F;
            </button>
          </div>
        </div>

        {/* Elevation Profile */}
        <div className="h-[100px] lg:h-[120px] bg-gray-900 border-t border-gray-700 shrink-0">
          <ElevationProfile />
        </div>
      </div>

      {/* Mobile drawer — full screen overlay */}
      {drawerOpen && (
        <div ref={drawerRef} className="lg:hidden fixed inset-0 z-[1100] bg-gray-950 flex flex-col" role="dialog" aria-modal="true" aria-label="Menu navigazione">
          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-700">
            <span className="text-sm font-medium text-gray-300 px-2">Menu</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setDrawerOpen(false); setShowMapSettings(true); }}
                className="px-3 py-2 text-xs text-gray-400 hover:text-white min-h-[44px] flex items-center"
              >
                Mappa
              </button>
              <button
                onClick={() => { setDrawerOpen(false); setShowSettings(true); }}
                className="px-3 py-2 text-xs text-gray-400 hover:text-white min-h-[44px] flex items-center"
              >
                Impostazioni
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-gray-400 hover:text-white text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Chiudi menu"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <LeftPanel className="w-full h-full" compassActive={compassActive} onCompassToggle={handleCompassToggle} rulerActive={rulerActive} onRulerToggle={handleRulerToggle} quizActive={quizActive} onQuizToggle={handleQuizToggle} onOpenProgress={handleOpenProgress} />
          </div>
        </div>
      )}

      {/* Settings Modals */}
      {showSettings && <ToleranceSettings onClose={() => setShowSettings(false)} />}
      {showMapSettings && <MapSettings onClose={() => setShowMapSettings(false)} />}

      {quizActive && <QuizOverlay onClose={() => setQuizActive(false)} onOpenProgress={handleOpenProgress} />}

      {progressOpen && <ProgressOverlay onClose={() => setProgressOpen(false)} />}

      {/* First-visit tutorial */}
      <LearnTutorial />

      {/* What's New popup (shown once per version, after tutorial) */}
      <WhatsNew />
    </div>
  );
}
