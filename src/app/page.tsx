'use client';

import { useState, useEffect, useRef } from 'react';
import { LeftPanel } from '@/components/panel/LeftPanel';
import { MapWrapper } from '@/components/map/MapWrapper';
import { ElevationProfile } from '@/components/map/ElevationProfile';
import { PreviewElevationProfile } from '@/components/map/PreviewElevationProfile';
import { ToleranceSettings } from '@/components/settings/ToleranceSettings';
import { BottomNav } from '@/components/panel/BottomNav';
import dynamic from 'next/dynamic';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { WhatsNew } from '@/components/tutorial/WhatsNew';
import { MapSettings } from '@/components/settings/MapSettings';
import { QuizOverlay } from '@/components/quiz/QuizOverlay';
// TASK-4: ProgressOverlay imports Recharts (~150kB). Lazy-load to keep
// first-paint bundle small — it's only mounted when the user opens the panel.
const ProgressOverlay = dynamic(() => import('@/components/panel/ProgressOverlay').then((m) => ({ default: m.ProgressOverlay })), { ssr: false });
import { loadSettings } from '@/lib/storage';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useAuthStore } from '@/stores/authStore';
import { decodeItinerary } from '@/lib/share-url';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { ToastContainer } from '@/components/shared/Toast';
import { ConfirmModalContainer } from '@/components/shared/ConfirmModal';
import { InviteModal } from '@/components/auth/InviteModal';
import { BrandMark } from '@/components/shared/BrandMark';
import { MapToolsFab } from '@/components/map/MapToolsFab';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMapSettings, setShowMapSettings] = useState(false);

  const mainView = useUIStore((s) => s.mainView);
  const mobileTab = useUIStore((s) => s.mobileTab);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const quizActive = useUIStore((s) => s.quizActive);
  const progressOpen = useUIStore((s) => s.progressOpen);
  const setMobileTab = useUIStore((s) => s.setMobileTab);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const deactivateQuiz = useUIStore((s) => s.deactivateQuiz);
  const closeProgress = useUIStore((s) => s.closeProgress);

  const selectedRouteId = useRouteLibraryStore((s) => s.selectedRouteId);
  const previewRoute = useRouteLibraryStore((s) => s.routes.find((r) => r.id === s.selectedRouteId));
  const clearRouteSelection = useRouteLibraryStore((s) => s.select);

  const justInvited = useAuthStore((s) => s.justInvited);
  const authSession = useAuthStore((s) => s.session);
  const authLoading = useAuthStore((s) => s.loading);
  const invited = useAuthStore((s) => s.invited);
  const isMember = useAuthStore((s) => s.member != null);
  // Durante il flusso di invito (invitato ma non ancora membro) il popup di
  // registrazione/accesso ha la precedenza: sopprimiamo l'onboarding di prima
  // visita (tutorial + What's New) per non sovrapporlo.
  const inInviteFlow = invited && !isMember;

  // Initialize auth store once on mount (session, invite, member).
  useEffect(() => { void useAuthStore.getState().init(); }, []);

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

  // Primo accesso da mobile: appena l'utente è autenticato ma non ha ancora uno username
  // (sessione presente, nessuna riga member), seleziona la tab Libreria — così la prima cosa
  // che vede è la scelta dello username, invece di restare sulla mappa.
  // Scatta una sola volta (ref guard) e solo sotto il breakpoint lg (desktop ha il pannello fisso).
  const onboardingShown = useRef(false);
  useEffect(() => {
    if (onboardingShown.current || authLoading) return;
    if (authSession && !isMember) {
      onboardingShown.current = true;
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        useUIStore.getState().setMobileTab('library');
      }
    }
  }, [authLoading, authSession, isMember]);

  return (
    <main className="h-dvh flex flex-col lg:flex-row overflow-hidden">
      <OfflineBanner />
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <LeftPanel />
      </div>

      {/* Right Panel: Top Bar (mobile) + Map + Elevation Profile */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden shrink-0 bg-gray-900">
          {/* Slim top row: Title | Search | Settings */}
          <div className="flex items-center justify-between px-2 py-1">
            <h1><BrandMark size="sm" /></h1>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSearchOpen(!searchOpen)}
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
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <MapWrapper />
          <MapToolsFab />

          {/* Mobile-only preview banner: shown when browsing the library and a route is selected */}
          {mainView === 'library' && previewRoute && (
            <div className="lg:hidden absolute top-2 left-2 right-2 z-[1000] bg-gray-900/95 border border-gray-700 rounded px-3 py-2 flex items-center justify-between text-xs">
              <span className="truncate text-gray-200">Anteprima: {previewRoute.name || 'Senza nome'}</span>
              <div className="flex gap-2 shrink-0 ml-2">
                <button onClick={() => setMobileTab('library')} className="text-green-400 min-h-[44px] flex items-center">Apri libreria</button>
                <button onClick={() => clearRouteSelection(null)} className="text-gray-400 min-h-[44px] flex items-center">Chiudi</button>
              </div>
            </div>
          )}

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

          {/* Mobile panel sheet — covers the map when on Editor/Libreria tabs */}
          {mobileTab !== 'map' && (
            <div className="lg:hidden absolute inset-0 z-[1100] bg-gray-950 flex flex-col">
              <LeftPanel className="w-full h-full" showSwitch={false} viewOverride={mobileTab === 'library' ? 'library' : 'editor'} />
            </div>
          )}
        </div>

        {/* Elevation Profile — in library mode mostra il profilo del percorso selezionato */}
        <div className="h-[100px] lg:h-[120px] bg-gray-900 border-t border-gray-700 shrink-0">
          {mainView === 'library'
            ? (previewRoute
                ? <PreviewElevationProfile route={previewRoute} />
                : <div className="h-full flex items-center justify-center text-xs text-gray-500 px-3 text-center">Seleziona un percorso per vederne il profilo.</div>)
            : <ElevationProfile />}
        </div>

        {/* Bottom navigation — mobile only, always visible */}
        <BottomNav />
      </div>

      {/* Settings Modals */}
      {showSettings && <ToleranceSettings onClose={() => setShowSettings(false)} />}
      {showMapSettings && <MapSettings onClose={() => setShowMapSettings(false)} />}

      {quizActive && <QuizOverlay onClose={deactivateQuiz} />}

      {progressOpen && <ProgressOverlay onClose={closeProgress} />}

      {/* First-visit tutorial — soppresso durante il flusso di invito (il popup di accesso ha la precedenza) */}
      {!inInviteFlow && <LearnTutorial />}

      {/* What's New popup (shown once per version, after tutorial) */}
      {!inInviteFlow && <WhatsNew />}

      {/* Invite welcome popup — solo all'apertura del link di invito, se non autenticato */}
      {!authLoading && justInvited && !authSession && <InviteModal />}

      {/* Global notification UI */}
      <ToastContainer />
      <ConfirmModalContainer />
    </main>
  );
}
