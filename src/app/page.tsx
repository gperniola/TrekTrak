'use client';

import { useState } from 'react';
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
// Trascinerebbe `lib/dpc` (e con esso topojson-client) più emergencyStore nel First
// Load di `/`: è un controllo d'avvio, non serve al primo paint.
const DpcPositionWarning = dynamic(() => import('@/components/shared/DpcPositionWarning').then((m) => ({ default: m.DpcPositionWarning })), { ssr: false });
import { useItineraryAutosave } from '@/lib/useItineraryAutosave';
import {
  useAvvioAuth,
  useImpostazioniSalvate,
  useItinerarioDaLink,
  useOnboardingMobile,
  useProfiloDiAvvio,
  useRipristinoItinerario,
} from '@/lib/useAvvio';
import { useTastoIndietro } from '@/lib/useTastoIndietro';
import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useAuthStore } from '@/stores/authStore';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { UpdateBanner } from '@/components/shared/UpdateBanner';
import { ToastContainer } from '@/components/shared/Toast';
import { ConfirmModalContainer } from '@/components/shared/ConfirmModal';
import { InviteModal } from '@/components/auth/InviteModal';
import { BrandMark } from '@/components/shared/BrandMark';
import { MapToolsFab } from '@/components/map/MapToolsFab';
import { MoreMenu } from '@/components/panel/MoreMenu';
// Il pannello trascina il client Open-Meteo e i calcoli: si carica quando lo si apre.
const RouteWeatherPanel = dynamic(() => import('@/components/weather/RouteWeatherPanel').then((m) => ({ default: m.RouteWeatherPanel })), { ssr: false });
import { useTema } from '@/lib/useTema';

export default function Home() {
  // L'aspetto va applicato sempre, non solo quando il pannello e' aperto (task-35).
  useTema();
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

  /*
    Gli effetti d'avvio e il tasto Indietro stanno in `lib/useAvvio` e
    `lib/useTastoIndietro`: erano centosettanta righe in mezzo al JSX, e nessuna si poteva
    provare senza montare tutta la pagina.
  */
  useAvvioAuth();
  useImpostazioniSalvate();
  useProfiloDiAvvio(inInviteFlow);
  useRipristinoItinerario();
  // Tiene su disco l'itinerario in lavorazione, a ogni modifica.
  useItineraryAutosave();
  useItinerarioDaLink();
  useOnboardingMobile();
  useTastoIndietro({
    mapSettingsOpen: showMapSettings,
    settingsOpen: showSettings,
    chiudiMapSettings: () => setShowMapSettings(false),
    chiudiSettings: () => setShowSettings(false),
  });


  return (
    <main className="h-dvh flex flex-col lg:flex-row overflow-hidden">
      <OfflineBanner />
      <UpdateBanner />
      {/* Allerta DPC nella zona dove ci si trova. In flusso come gli altri due banner:
          non copre nulla, e in particolare non la bottom navigation. Il gate è
          `justInvited` e non `inInviteFlow`: quest'ultimo resta vero per sempre a
          chiunque sia arrivato da un invito e sia disconnesso, perché
          `trektrak_invited` non viene mai rimosso — avrebbe spento la funzione per la
          quasi totalità degli utenti. */}
      {!justInvited && <DpcPositionWarning />}
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

        {/* Map + Elevation wrapper — relative so the mobile panel sheet can cover both
            (map + elevation strip) and be fully scrollable on its own. */}
        <div className="relative flex-1 flex flex-col min-h-0">
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
          </div>

          {/* Elevation Profile — in library mode mostra il profilo del percorso selezionato */}
          <div className="h-[100px] lg:h-[120px] bg-gray-900 border-t border-gray-700 shrink-0">
            {mainView === 'library'
              ? (previewRoute
                  ? <PreviewElevationProfile route={previewRoute} />
                  : <div className="h-full flex items-center justify-center text-xs text-gray-400 px-3 text-center">Seleziona un percorso per vederne il profilo.</div>)
              : <ElevationProfile />}
          </div>

          {/* Mobile panel sheet — covers map + elevation; the sheet itself scrolls so the
              whole Editor/Libreria panel is reachable (inner scroll is desktop-only). */}
          {mobileTab !== 'map' && (
            <div className="lg:hidden absolute inset-0 z-[1100] bg-gray-950 overflow-y-auto overscroll-contain">
              <LeftPanel className="w-full" showSwitch={false} viewOverride={mobileTab === 'library' ? 'library' : 'editor'} />
            </div>
          )}
        </div>

        {/* Bottom navigation — mobile only, always visible */}
        <BottomNav />
      </div>

      {/* Settings Modals */}
      {showSettings && <ToleranceSettings onClose={() => setShowSettings(false)} />}
      {showMapSettings && <MapSettings onClose={() => setShowMapSettings(false)} />}
      <MoreMenu />

      {quizActive && <QuizOverlay onClose={deactivateQuiz} />}

      {progressOpen && <ProgressOverlay onClose={closeProgress} />}

      {/* First-visit tutorial — soppresso durante il flusso di invito (il popup di accesso ha la precedenza) */}
      {!inInviteFlow && <LearnTutorial />}

      {/* What's New popup (shown once per version, after tutorial) */}
      {!inInviteFlow && <WhatsNew />}


      {/* Invite welcome popup — solo all'apertura del link di invito, se non autenticato */}
      {!authLoading && justInvited && !authSession && <InviteModal />}

      {/* Global notification UI */}
      <RouteWeatherPanel />
      <ToastContainer />
      <ConfirmModalContainer />
    </main>
  );
}
