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
// Trascinerebbe `lib/dpc` (e con esso topojson-client) più emergencyStore nel First
// Load di `/`: è un controllo d'avvio, non serve al primo paint.
const DpcPositionWarning = dynamic(() => import('@/components/shared/DpcPositionWarning').then((m) => ({ default: m.DpcPositionWarning })), { ssr: false });
import { loadSettings, KEYS } from '@/lib/storage';
import { loadCurrent } from '@/lib/current-itinerary';
import { useItineraryAutosave } from '@/lib/useItineraryAutosave';
import { startupAction } from '@/lib/startup-itinerary';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useAuthStore } from '@/stores/authStore';
import { decodeItinerary } from '@/lib/share-url';
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
import { nextBackAction } from '@/lib/back-nav';
import { confirm as appConfirm } from '@/stores/notificationStore';

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
  const moreMenuOpen = useUIStore((s) => s.moreMenuOpen);
  const setMoreMenuOpen = useUIStore((s) => s.setMoreMenuOpen);
  const emergencyPanelOpen = useUIStore((s) => s.emergencyPanelOpen);
  const setEmergencyPanelOpen = useUIStore((s) => s.setEmergencyPanelOpen);
  const toolsFabOpen = useUIStore((s) => s.toolsFabOpen);
  const setToolsFabOpen = useUIStore((s) => s.setToolsFabOpen);
  const weatherOpen = useUIStore((s) => s.weatherOpen);
  const setWeatherOpen = useUIStore((s) => s.setWeatherOpen);

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

  // Rimette in piedi l'itinerario su cui si stava lavorando. Deve stare PRIMA
  // dell'import da hash: se arriva un link condiviso, quello ha l'ultima parola.
  useEffect(() => {
    let livello: string | null = null;
    try { livello = localStorage.getItem(KEYS.userLevel); } catch { /* storage bloccato */ }
    const azione = startupAction(loadCurrent(), livello);
    if (azione.kind === 'restore') useItineraryStore.getState().hydrateCurrent(azione.saved);
    else if (azione.kind === 'appMode') useItineraryStore.getState().setAppMode(azione.mode);
  }, []);

  // Tiene su disco l'itinerario in lavorazione, a ogni modifica.
  useItineraryAutosave();

  // Load itinerary from URL hash if present
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#data=')) return;
    const decoded = decodeItinerary(hash);
    // Preserviamo lo stato del router di Next (history.state) mentre ripuliamo l'hash:
    // passare null lo azzererebbe e farebbe ricaricare la pagina al primo popstate.
    const pulisciHash = () => history.replaceState(window.history.state, '', window.location.pathname);
    if (!decoded) { pulisciHash(); return; }

    void (async () => {
      const store = useItineraryStore.getState();
      // Da quando il lavoro in corso sopravvive alla chiusura, aprire un link
      // condiviso può cancellare giorni di lavoro: si chiede, come già fa l'import
      // da file JSON.
      if (store.waypoints.length > 0) {
        const ok = await appConfirm({
          title: 'Aprire l’itinerario condiviso?',
          message: 'L’itinerario su cui stai lavorando verrà sostituito.',
          confirmText: 'Apri condiviso',
        });
        if (!ok) { pulisciHash(); return; }
      }
      const id = Math.random().toString(36).substring(2, 11);
      store.loadItinerary(id, decoded.name, decoded.waypoints, decoded.legs);
      pulisciHash();
    })();
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

  // Tasto Indietro (mobile): chiude prima eventuali overlay/menu, poi torna alla Mappa
  // da un'altra scheda, infine chiede conferma d'uscita dalla Mappa. Implementato con la
  // History API spingendo una entry per ogni livello aperto AL MOMENTO della navigazione
  // (vedi l'effetto di sync più sotto), così il tasto Indietro consuma entry reali del
  // browser. backRef.current() chiude UN livello secondo la priorità di nextBackAction
  // (lib/back-nav); è riassegnato a ogni render per leggere lo stato fresco.
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    const action = nextBackAction({
      moreMenuOpen,
      mapSettingsOpen: showMapSettings,
      settingsOpen: showSettings,
      progressOpen,
      quizActive,
      searchOpen,
      mobileTab,
      emergencyPanelOpen,
      toolsFabOpen,
      weatherOpen,
    });
    switch (action) {
      case 'closeMore': setMoreMenuOpen(false); return true;
      case 'closeToolsFab': setToolsFabOpen(false); return true;
      case 'closeWeather': setWeatherOpen(false); return true;
      case 'closeEmergencyPanel': setEmergencyPanelOpen(false); return true;
      case 'closeMapSettings': setShowMapSettings(false); return true;
      case 'closeSettings': setShowSettings(false); return true;
      case 'closeProgress': closeProgress(); return true;
      case 'closeQuiz': deactivateQuiz(); return true;
      case 'closeSearch': setSearchOpen(false); return true;
      case 'toMap': setMobileTab('map'); return true;
      default: return false; // 'exit'
    }
  };
  // Profondità "annullabile col tasto Indietro": quanti livelli sono aperti sopra la
  // Mappa. Deve combaciare col numero di passi che nextBackAction impiega a tornare alla
  // base: ogni overlay/menu = +1, e trovarsi su una scheda diversa dalla Mappa = +1.
  const backDepth =
    (moreMenuOpen ? 1 : 0) +
    (toolsFabOpen ? 1 : 0) +
    (weatherOpen ? 1 : 0) +
    (emergencyPanelOpen ? 1 : 0) +
    (showMapSettings ? 1 : 0) +
    (showSettings ? 1 : 0) +
    (progressOpen ? 1 : 0) +
    (quizActive ? 1 : 0) +
    (searchOpen ? 1 : 0) +
    (mobileTab !== 'map' ? 1 : 0);

  const exitingRef = useRef(false);
  const pushedDepth = useRef(0); // # di entry "di livello" spinte in cronologia sopra la guardia base
  const skipPop = useRef(0);     // popstate auto-inflitti (da history.go) da ignorare

  // Mount (mobile): guardia base + gestione popstate. CHIAVE: non ri-pushiamo MAI dentro
  // popstate per navigare (sul mobile pushState dentro popstate è inaffidabile → era la
  // causa del bug). Le entry "di livello" sono spinte AL MOMENTO della navigazione
  // dall'effetto di sync qui sotto (dove pushState è affidabile); qui popstate si limita a
  // CHIUDERE un livello leggendo lo stato. La guardia base serve solo alla conferma d'uscita.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1023px)').matches) return;
    // IMPORTANTE: preserviamo lo stato interno del router di Next (App Router lo tiene in
    // history.state). Sovrascriverlo con un oggetto nostro fa sì che, al popstate, il router
    // non riesca a riconciliare la rotta e forzi un HARD RELOAD (mappa+posizione si
    // "refreshano"). Spreadando lo stato esistente, Next vede la stessa rotta e non ricarica.
    // La logica del back usa i ref pushedDepth/skipPop, non legge history.state.
    const pushGuard = () => {
      // Idempotente: se la guardia è già in cima NON ne accumuliamo un'altra. Senza questo,
      // più chiamate (React StrictMode in dev, o un eventuale remount) impilano più guardie e
      // l'uscita non funziona più (un solo history.back() non basta a superarle tutte).
      if (window.history.state && (window.history.state as { ttGuard?: boolean }).ttGuard) return;
      window.history.pushState({ ...window.history.state, ttGuard: true }, '');
    };
    pushGuard(); // guardia base (per la conferma d'uscita)
    const onPop = () => {
      if (skipPop.current > 0) { skipPop.current--; return; } // popstate auto-inflitto (da history.go)
      if (exitingRef.current) return;
      if (pushedDepth.current > 0) {
        // Una entry di livello è stata consumata dal tasto Indietro → chiudi UN livello.
        // Decrementiamo PRIMA, così l'effetto di sync (reagendo al calo di backDepth) vede
        // cronologia e UI già allineate e non tocca la history (niente doppia rimozione).
        pushedDepth.current--;
        backRef.current();
        return;
      }
      // Guardia base consumata → conferma uscita dalla Mappa
      void appConfirm({
        title: 'Uscire da TrekTrak?',
        message: 'Vuoi lasciare la pagina? Le modifiche non salvate andranno perse.',
        confirmText: 'Esci',
        variant: 'error',
      }).then((ok) => {
        if (!ok) { pushGuard(); return; } // resta nell'app → ripristina la guardia base
        exitingRef.current = true;
        window.removeEventListener('popstate', onPop);
        window.history.back(); // esci dall'app
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync cronologia ↔ profondità UI. Gira FUORI da popstate (a ogni cambio di backDepth),
  // dove pushState è affidabile: spinge una entry per ogni livello aperto in più, e rimuove
  // le entry in eccesso (history.go) quando un livello viene chiuso programmaticamente
  // (es. tap su ✕, selezione percorso). I popstate generati da history.go sono marcati
  // come "auto-inflitti" (skipPop) e ignorati dall'handler.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1023px)').matches) return;
    if (backDepth > pushedDepth.current) {
      const n = backDepth - pushedDepth.current;
      // Spread di history.state: preserva lo stato del router di Next (vedi nota sopra)
      // così il popstate non innesca un hard reload.
      for (let i = 0; i < n; i++) window.history.pushState({ ...window.history.state, ttDepth: pushedDepth.current + i + 1 }, '');
      pushedDepth.current = backDepth;
    } else if (backDepth < pushedDepth.current) {
      const diff = pushedDepth.current - backDepth;
      pushedDepth.current = backDepth;
      skipPop.current += diff;
      window.history.go(-diff);
    }
  }, [backDepth]);

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
                  : <div className="h-full flex items-center justify-center text-xs text-gray-500 px-3 text-center">Seleziona un percorso per vederne il profilo.</div>)
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
