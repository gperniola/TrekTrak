'use client';

import { useState, useRef, useEffect } from 'react';
import type { Itinerary, Leg } from '@/lib/types';
import { useItineraryStore } from '@/stores/itineraryStore';
// Note: lib/export-pdf imports jspdf (~100kB). Loaded lazily on first export to keep first-paint bundle small.
import { REGISTRO, downloadAs } from '@/lib/exporters/registro';

/** Il JSON sta nell'intestazione, accanto al pulsante che lo riapre. */
const FORMATI = REGISTRO.filter((e) => e.id !== 'json');

/**
 * I due PDF, come voci della stessa tendina degli altri formati.
 *
 * Non stanno nel registry perché non seguono la sua forma: il registry produce un file da
 * un itinerario in memoria, i PDF passano da `html2canvas` sulla mappa disegnata a schermo
 * e da un caricamento pigro di jsPDF. Metterli lì avrebbe voluto dire piegare
 * l'interfaccia del registry per un caso che non le assomiglia; elencarli qui costa due
 * righe e dice la verità.
 */
const PDF_VOCI = [
  {
    id: 'summary' as const,
    etichetta: 'PDF sintetico',
    descrizione: 'Una pagina: mappa, profilo e tabella',
  },
  {
    id: 'roadbook' as const,
    etichetta: 'PDF roadbook',
    descrizione: 'Una riga per tratta, da seguire camminando',
  },
];
import { calculateDifficulty, haversineDistance, forwardAzimuth, interpolatePoints, cumulativeElevation, sampleInterval } from '@/lib/calculations';
import { fetchElevation, fetchElevationProfile } from '@/lib/elevation-api';
import { validateValue, validateAzimuth, percentageTolerance } from '@/lib/validation';
import { fetchTrailRoute } from '@/lib/routing-api';
import { buildMeteoUrl } from '@/lib/meteo';
import { encodeItinerary } from '@/lib/share-url';
import { saveValidationSession, loadValidationHistory } from '@/lib/storage';
import { loadQuizHistory } from '@/lib/quiz';
import type { ValidationSessionResult } from '@/lib/types';
import { useUIStore } from '@/stores/uiStore';
import { toast } from '@/stores/notificationStore';
import { mostra } from '@/lib/profilo';
import { useTessereOffline } from '@/lib/useTessereOffline';
import { numero } from '@/lib/formato';


export function ActionBar() {
  const openProgress = useUIStore((s) => s.openProgress);
  const profilo = useUIStore((s) => s.profilo);
  const datiVisibili = mostra('exportDati', profilo);
  const setWeatherOpen = useUIStore((s) => s.setWeatherOpen);
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const updateLeg = useItineraryStore((s) => s.updateLeg);
  const appMode = useItineraryStore((s) => s.appMode);
  const [verifying, setVerifying] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [formatiAperti, setFormatiAperti] = useState(false);
  const offline = useTessereOffline();
  const refFormati = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!formatiAperti) return;
    const fuori = (e: MouseEvent | TouchEvent) => {
      if (refFormati.current && !refFormati.current.contains(e.target as Node)) setFormatiAperti(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFormatiAperti(false); };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('touchstart', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('touchstart', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [formatiAperti]);
  const verifyingRef = useRef(false);
  const mountedRef = useRef(true);
  const verifyGenerationRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Il contatore va incrementato sul riferimento VIVO: copiarlo in una variabile
      // dentro l'effetto, come suggerisce la regola, annullerebbe l'invalidazione
      // dei risultati async ancora in volo — che è tutto il senso del contatore.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      verifyGenerationRef.current++;
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);
  const [verifyBanner, setVerifyBanner] = useState<{ valid: number; warning: number; error: number; improvement?: number } | null>(null);
  const [bannerFading, setBannerFading] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalDistance = legs.reduce((sum, l) => sum + (l.distance ?? 0), 0);
  const totalGain = legs.reduce((sum, l) => sum + (l.elevationGain ?? 0), 0);
  const totalLoss = legs.reduce((sum, l) => sum + (l.elevationLoss ?? 0), 0);
  const totalTime = legs.reduce((sum, l) => sum + (l.estimatedTime ?? 0), 0);
  const maxSlope = Math.max(0, ...legs.map((l) => l.slope ?? 0));

  // TASK-41: gli export non devono invitare ad azioni inutili quando non c'è nulla da esportare.
  const validCoordWaypoints = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  const canExportPdf = waypoints.length >= 2;
  const canExportGpx = validCoordWaypoints.length >= 2;

  const handlePDF = async (format: 'summary' | 'roadbook') => {
    if (waypoints.length < 2) {
      toast.warning('Aggiungi almeno 2 waypoint');
      return;
    }
    // PDF is useful even without coordinates, so only check waypoint count.
    // Lazy-load the PDF module (it pulls jspdf, ~100kB) only on the first export click.
    const { downloadPDF } = await import('@/lib/export-pdf');
    downloadPDF({
      name: itineraryName,
      waypoints,
      legs,
      totalDistance,
      totalElevGain: totalGain,
      totalElevLoss: totalLoss,
      totalTime,
      difficulty: calculateDifficulty(maxSlope),
    }, format);
  };

  /** L'itinerario nella forma che il registry si aspetta. */
  const itinerarioCorrente = () => ({ name: itineraryName, waypoints, legs } as Itinerary);

  const handleVerify = async () => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    const generation = ++verifyGenerationRef.current;
    const isStale = () => !mountedRef.current || verifyGenerationRef.current !== generation;
    try {
      let apiAvailable = true;

      // Clear all previous validation state in one batch
      useItineraryStore.getState().clearAllValidation();

      // Read tolerances from fresh store state (not stale closure)
      const tol = useItineraryStore.getState().settings.tolerances;

      // Cache elevation lookups to avoid duplicate API calls
      const elevationCache = new Map<string, number | null>();
      const getCachedElevation = async (lat: number, lon: number): Promise<number | null> => {
        const key = `${lat},${lon}`;
        if (elevationCache.has(key)) return elevationCache.get(key) ?? null;
        const result = await fetchElevation(lat, lon);
        elevationCache.set(key, result);
        return result;
      };

      const currentState = useItineraryStore.getState();
      const currentWaypoints = currentState.waypoints;
      const currentLegs = currentState.legs;
      const useTrailRouting = currentState.settings.mapDisplay.trailRouting;

      // --- Phase 1: Validate legs (distance, azimuth, D+/D-) ---
      for (const leg of currentLegs) {
        if (isStale()) break;
        const from = currentWaypoints.find((w) => w.id === leg.fromWaypointId);
        const to = currentWaypoints.find((w) => w.id === leg.toWaypointId);
        if (from?.lat == null || from?.lon == null || to?.lat == null || to?.lon == null) continue;

        const validationUpdates: Partial<NonNullable<typeof leg.validationState>> = {};
        const fieldUpdates: Partial<Leg> = {};

        // Azimuth (always straight-line, regardless of routing mode)
        const realAz = forwardAzimuth(from.lat, from.lon, to.lat, to.lon);
        if (leg.azimuth != null) {
          validationUpdates.azimuth = validateAzimuth(leg.azimuth, realAz, {
            strict: tol.azimuth,
            loose: tol.azimuth * 2,
          });
        } else {
          fieldUpdates.azimuth = Math.round(realAz * 10) / 10;
        }

        // Try ORS trail routing if enabled
        const trailRoute = useTrailRouting
          ? await fetchTrailRoute(from.lat, from.lon, to.lat, to.lon)
          : null;
        if (isStale()) break;

        if (trailRoute) {
          // --- Trail routing: use ORS distance, D+/D-, and elevations ---
          const realDist = trailRoute.distanceKm;
          if (leg.distance != null) {
            const distTol = realDist > 0
              ? percentageTolerance(realDist, tol.distance)
              : { strict: tol.distance / 100, loose: (tol.distance / 100) * 2 };
            validationUpdates.distance = validateValue(leg.distance, realDist, distTol);
          } else {
            fieldUpdates.distance = Math.round(realDist * 1000) / 1000;
          }

          const realGain = Math.round(trailRoute.ascent);
          const realLoss = Math.round(trailRoute.descent);
          if (leg.elevationGain != null) {
            const elevGainTol = realGain > 0
              ? percentageTolerance(realGain, tol.elevationDelta)
              : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
            validationUpdates.elevationGain = validateValue(leg.elevationGain, realGain, elevGainTol);
          } else {
            fieldUpdates.elevationGain = realGain;
          }
          if (leg.elevationLoss != null) {
            const elevLossTol = realLoss > 0
              ? percentageTolerance(realLoss, tol.elevationDelta)
              : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
            validationUpdates.elevationLoss = validateValue(leg.elevationLoss, realLoss, elevLossTol);
          } else {
            fieldUpdates.elevationLoss = realLoss;
          }

          // Cache endpoint altitudes from ORS
          if (trailRoute.fromElevation != null) elevationCache.set(`${from.lat},${from.lon}`, trailRoute.fromElevation);
          if (trailRoute.toElevation != null) elevationCache.set(`${to.lat},${to.lon}`, trailRoute.toElevation);
        } else {
          // --- Classic: straight-line distance + DEM elevation sampling ---
          const realDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
          if (leg.distance != null) {
            const distTol = realDist > 0
              ? percentageTolerance(realDist, tol.distance)
              : { strict: tol.distance / 100, loose: (tol.distance / 100) * 2 };
            validationUpdates.distance = validateValue(leg.distance, realDist, distTol);
          } else {
            fieldUpdates.distance = Math.round(realDist * 1000) / 1000;
          }

          const distM = realDist * 1000;
          const userInterval = useItineraryStore.getState().settings.mapDisplay.sampleInterval;
          const numPoints = Math.max(2, Math.ceil(distM / sampleInterval(distM, userInterval)));
          const profilePoints = interpolatePoints(from.lat, from.lon, to.lat, to.lon, numPoints);
          const profileElevations = await fetchElevationProfile(profilePoints);
          if (isStale()) break;

          const firstAlt = profileElevations[0];
          const lastAlt = profileElevations[profileElevations.length - 1];
          if (firstAlt != null) elevationCache.set(`${from.lat},${from.lon}`, firstAlt);
          if (lastAlt != null) elevationCache.set(`${to.lat},${to.lon}`, lastAlt);

          const { gain: realGain, loss: realLoss } = cumulativeElevation(profileElevations);
          if (realGain == null || realLoss == null) {
            apiAvailable = false;
          } else {
            if (leg.elevationGain != null) {
              const elevGainTol = realGain > 0
                ? percentageTolerance(realGain, tol.elevationDelta)
                : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
              validationUpdates.elevationGain = validateValue(leg.elevationGain, realGain, elevGainTol);
            } else {
              fieldUpdates.elevationGain = realGain;
            }
            if (leg.elevationLoss != null) {
              const elevLossTol = realLoss > 0
                ? percentageTolerance(realLoss, tol.elevationDelta)
                : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
              validationUpdates.elevationLoss = validateValue(leg.elevationLoss, realLoss, elevLossTol);
            } else {
              fieldUpdates.elevationLoss = realLoss;
            }
          }
        }

        const legUpdate: Partial<Leg> = { ...fieldUpdates };
        if (Object.keys(validationUpdates).length > 0) {
          legUpdate.validationState = validationUpdates;
        }
        if (Object.keys(legUpdate).length > 0) {
          // La verifica LEGGE i dati e scrive un giudizio: non e' un gesto da annullare.
          updateLeg(leg.id, legUpdate, { calcolata: true });
        }
      }

      // --- Phase 2: Validate waypoint altitudes ---
      // Most waypoints already have their elevation cached from profile endpoints above.
      // Only orphan waypoints (not connected to any leg) will trigger a new API call.
      for (const wp of currentWaypoints) {
        if (isStale()) break;
        if (wp.lat == null || wp.lon == null) continue;
        const realAlt = await getCachedElevation(wp.lat, wp.lon);
        if (realAlt == null) {
          apiAvailable = false;
          continue;
        }
        if (wp.altitude != null) {
          updateWaypoint(wp.id, {
            validationState: { altitude: validateValue(wp.altitude, realAlt, {
              strict: tol.altitude,
              loose: tol.altitude * 2,
            }) },
          }, { calcolata: true });
        } else {
          // Quota mancante compilata dalla verifica: e' un dato che arriva dal servizio.
          updateWaypoint(wp.id, { altitude: Math.round(realAlt) }, { calcolata: true });
        }
      }

      if (!apiAvailable && mountedRef.current) {
        toast.warning(
          'Servizio altimetrico non disponibile: distanza e azimuth validati, altitudine e D+/D- saltati.',
          6000,
        );
      }

      // --- Collect results and save validation session ---
      if (mountedRef.current && !isStale()) {
        const finalState = useItineraryStore.getState();
        const sessionResults: ValidationSessionResult[] = [];
        let validCount = 0;
        let warningCount = 0;
        let errorCount = 0;

        for (const wp of finalState.waypoints) {
          const altV = wp.validationState?.altitude;
          if (altV && altV.status !== 'unverified') {
            sessionResults.push({
              field: 'altitude',
              status: altV.status,
              delta: altV.delta ?? 0,
              tolerance: altV.tolerance,
            });
            if (altV.status === 'valid') validCount++;
            else if (altV.status === 'warning') warningCount++;
            else errorCount++;
          }
        }
        for (const leg of finalState.legs) {
          const fields = [
            { key: 'distance' as const, v: leg.validationState?.distance },
            { key: 'elevationGain' as const, v: leg.validationState?.elevationGain },
            { key: 'elevationLoss' as const, v: leg.validationState?.elevationLoss },
            { key: 'azimuth' as const, v: leg.validationState?.azimuth },
          ];
          for (const { key, v } of fields) {
            if (v && v.status !== 'unverified') {
              sessionResults.push({
                field: key,
                status: v.status,
                delta: v.delta ?? 0,
                tolerance: v.tolerance,
              });
              if (v.status === 'valid') validCount++;
              else if (v.status === 'warning') warningCount++;
              else errorCount++;
            }
          }
        }

        if (sessionResults.length > 0) {
          // TASK-20: positive reinforcement — compute improvement vs previous session
          const total = sessionResults.length;
          const validPercent = Math.round((validCount / total) * 100);
          const prevHistory = loadValidationHistory();
          let improvement: number | undefined;
          if (prevHistory.length > 0) {
            const last = prevHistory[prevHistory.length - 1];
            const lastValid = last.results.filter((r) => r.status === 'valid').length;
            const lastPercent = last.results.length > 0 ? Math.round((lastValid / last.results.length) * 100) : 0;
            const diff = validPercent - lastPercent;
            if (Math.abs(diff) >= 5) improvement = diff;
          }
          saveValidationSession({
            date: new Date().toISOString(),
            itineraryName: finalState.itineraryName,
            results: sessionResults,
          });
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          setBannerFading(false);
          setVerifyBanner({ valid: validCount, warning: warningCount, error: errorCount, improvement });
          bannerTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setBannerFading(true);
            bannerTimerRef.current = setTimeout(() => {
              if (mountedRef.current) { setVerifyBanner(null); setBannerFading(false); }
            }, 300);
          }, 3700);
        }
      }
    } finally {
      verifyingRef.current = false;
      if (mountedRef.current) setVerifying(false);
    }
  };

  const handleShareLink = () => {
    const hash = encodeItinerary(itineraryName, waypoints, legs);
    if (!hash) {
      toast.warning('Itinerario troppo grande per la condivisione via link. Usa Export JSON.');
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      toast.success('Link copiato negli appunti');
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      toast.error('Impossibile copiare il link. Riprova manualmente.');
    });
  };

  return (
    <div className="border-t border-gray-700 p-3 space-y-2">
      {verifyBanner && (
        <div
          role="status"
          aria-live="polite"
          onClick={() => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current); setVerifyBanner(null); setBannerFading(false); }}
          className={`bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-center cursor-pointer transition-opacity duration-300 ${bannerFading ? 'opacity-0' : 'opacity-100'}`}
        >
          Verifica completata:{' '}
          <span className="text-green-400 font-bold">{verifyBanner.valid} ✓</span>
          {' · '}
          <span className="text-yellow-400 font-bold">{verifyBanner.warning} ~</span>
          {' · '}
          <span className="text-red-400 font-bold">{verifyBanner.error} ✗</span>
          {verifyBanner.improvement != null && (
            <span className={`block mt-1 text-xs font-medium ${verifyBanner.improvement > 0 ? 'text-green-400' : 'text-amber-400'}`}>
              {verifyBanner.improvement > 0 ? '📈 ' : '📉 '}
              {verifyBanner.improvement > 0 ? '+' : ''}{verifyBanner.improvement}% rispetto alla sessione precedente
            </span>
          )}
        </div>
      )}
      {/* Export e condivisione del percorso. TASK-41: disabilitati quando non c'è nulla da esportare. */}
      {/*
        Il motivo del grigio va SCRITTO, non messo in un `title`: su un telefono il
        tooltip non esiste, quindi l'utente vedeva quattro pulsanti spenti e nessuna
        spiegazione. `aria-describedby` lo lega ai pulsanti per chi usa uno screen reader.
      */}
      {/*
        La nota guarda solo i pulsanti VISIBILI in questo profilo. In Imparo il GPX non
        c'e', quindi con due waypoint senza coordinate diceva «servono waypoint con
        coordinate» mentre le uniche voci a schermo — i due PDF — funzionavano: un
        messaggio che parla di funzioni che il profilo ha tolto di mezzo.
      */}
      {(!canExportPdf || (datiVisibili && !canExportGpx)) && (
        <p id="motivo-export" className="text-[11px] text-amber-300 bg-gray-800 border border-amber-800/60 rounded px-2 py-1.5">
          {waypoints.length < 2
            ? 'Aggiungi almeno 2 waypoint per esportare o condividere.'
            : 'Per il GPX servono almeno 2 waypoint con coordinate.'}
        </p>
      )}
      {/*
        **«Quando partire» sta fuori dal gruppo degli export, e in evidenza.**

        Non è un export ed è il passo finale del percorso: il pannello incrocia i waypoint
        con gli orari di Munter e dice a che ora sei in ogni punto e che tempo trovi lì a
        quell'ora, col verdetto sulla fascia critica. È l'unica cosa che questa app sa dire
        e un sito meteo no. Chiamarlo «Meteo» lo faceva passare per un widget fra cinque
        pastiglie uguali, e la funzione che decide *se e quando andare* non è una pastiglia.
      */}
      {mostra('meteo', profilo) && buildMeteoUrl(waypoints) != null && (
        <button
          onClick={() => setWeatherOpen(true)}
          className="w-full text-left px-3 py-2.5 bg-cyan-600 text-black rounded-lg shadow-sm transition-all active:scale-[0.99] hover:bg-cyan-500 max-lg:min-h-[44px]"
        >
          <span className="block text-sm font-bold">🕐 Quando partire</span>
          <span className="block text-[11px] leading-snug opacity-90">
            Orari lungo il percorso e meteo a quell&rsquo;ora
          </span>
        </button>
      )}
      <div role="group" aria-label="Esporta e condividi" className="flex flex-wrap gap-2">
        {/*
          GPX, link condiviso e meteo sono roba da gita vera: in Imparo non compaiono.
          I due PDF sopra restano, perche' servono a portarsi l'esercizio su carta.
        */}
        {/*
          Una tendina invece di un pulsante per formato: i formati sono destinati a
          crescere (il registry esiste per quello) e una fila di pulsanti verdi era gia'
          la cosa che questo pannello ha smesso di fare nella v0.14.0. Ogni voce dice a
          cosa serve e, se e' spenta, perche'.
        */}
        {/*
          **Un solo «Esporta», i due PDF dentro.**

          Erano due pulsanti verdi a tutta larghezza accanto a una tendina che gia'
          esisteva per gli altri formati: tre controlli per la stessa idea, e i due piu'
          grossi per i due formati che si usano meno spesso. Ora ogni cosa che esce
          dall'app sta in un posto, con scritto sotto a cosa serve.

          La tendina compare in **entrambi** i profili: in Imparo elenca solo i PDF —
          servono a portarsi l'esercizio su carta — e non i formati da gita.
        */}
        <div className="relative flex-1" ref={refFormati}>
          <button
            onClick={() => setFormatiAperti((p) => !p)}
            aria-expanded={formatiAperti}
            aria-haspopup="menu"
            disabled={!canExportPdf}
            aria-describedby={!canExportPdf ? 'motivo-export' : undefined}
            className="w-full py-2 bg-blue-500 text-black rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
          >
            Esporta ▾
          </button>
          {formatiAperti && (
            /*
              `left-0`, non `right-0`: la tendina si ancora al SUO pulsante, che ora e' il
              primo della fila. Con `right-0` — giusto finche' stava a destra di due PDF a
              tutta larghezza — il menu si estendeva a sinistra oltre il bordo del pannello
              e le voci risultavano tagliate a meta'. Nessun test l'ha visto: si vede solo
              aprendola.
            */
            <div role="menu" className="absolute left-0 bottom-full mb-1 z-[1300] w-60 max-w-[calc(100vw-2rem)] bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-1">
              {PDF_VOCI.map((v) => (
                <button
                  key={v.id}
                  role="menuitem"
                  disabled={!canExportPdf}
                  onClick={() => { handlePDF(v.id); setFormatiAperti(false); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="block text-xs font-bold text-gray-100">{v.etichetta}</span>
                  <span className="block text-[10px] text-gray-400 leading-snug">
                    {canExportPdf ? v.descrizione : 'Servono almeno 2 waypoint'}
                  </span>
                </button>
              ))}
              {datiVisibili && <div className="my-1 border-t border-gray-700" />}
              {datiVisibili && FORMATI.map((f) => {
                  const motivo = f.impedimento(itinerarioCorrente());
                  return (
                    <button
                      key={f.id}
                      role="menuitem"
                      disabled={motivo != null}
                      onClick={() => { downloadAs(f, itinerarioCorrente()); setFormatiAperti(false); }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="block text-xs font-bold text-gray-100">{f.etichetta}</span>
                      <span className="block text-[10px] text-gray-400 leading-snug">
                        {motivo ?? f.descrizione}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
        {/*
          **Le mattonelle del percorso appena fatto, da qui.**

          La sezione in Impostazioni mappa resta — e' il posto dove si vede quanto spazio
          occupano e si liberano — ma chiedere di scaricare la mappa *di questo percorso*
          e' un gesto che appartiene al percorso, non alle impostazioni: chi finisce di
          disegnarlo e' qui, non in un pannello due tocchi piu' in la'.

          Il conto arriva dallo stesso modulo che poi scarica: il numero che si legge e'
          esattamente quello che verra' chiesto.
        */}
        {mostra('meteo', profilo) && (
          <button
            onClick={() => { void offline.scarica(); }}
            disabled={offline.daScaricare.length === 0 || offline.inCorso}
            aria-describedby={offline.daScaricare.length === 0 ? 'motivo-export' : undefined}
            title={offline.daScaricare.length > 0
              ? `${numero(offline.daScaricare.length)} mattonelle di ${offline.nomeMappa}`
              : undefined}
            className="flex-1 py-2 bg-gray-200 text-gray-900 rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
          >
            {offline.inCorso
              ? `↓ ${numero(offline.avanzamento?.fatte ?? 0)}/${numero(offline.avanzamento?.totali ?? 0)}`
              : '📥 Mappa offline'}
          </button>
        )}
        {datiVisibili && (
          <button
            onClick={handleShareLink}
            disabled={waypoints.length < 2}
            aria-describedby={waypoints.length < 2 ? 'motivo-export' : undefined}
            className="flex-1 py-2 bg-amber-500 text-black rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
          >
            {linkCopied ? 'Copiato!' : 'Copia link'}
          </button>
        )}
      </div>
      {/* Attività didattiche (verifica + progresso). TASK-42: separate dagli export. */}
      {/*
        Verifica e Progresso sono entrambe aree di Imparo: in Montagna il gruppo era
        SEMPRE vuoto. Un `div` vuoto dentro `space-y-2` si porta comunque il suo margine,
        e per chi usa uno screen reader era un gruppo annunciato col suo nome e senza
        niente dentro. Se non c'e' contenuto non c'e' contenitore.
      */}
      {mostra('progresso', profilo) && <div role="group" aria-label="Attività" className="flex flex-wrap gap-2">
        {appMode === 'learn' && mostra('validazione', profilo) && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex-1 py-2 bg-purple-500 text-black rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
          >
            {verifying ? 'Verificando...' : 'Verifica'}
          </button>
        )}
        {mostra('progresso', profilo) && (() => {
          // TASK-20: disable Progresso until there is at least one verify or quiz session
          const hasHistory = loadValidationHistory().length > 0 || loadQuizHistory().length > 0;
          return (
            <button
              onClick={openProgress}
              disabled={!hasHistory}
              aria-describedby={hasHistory ? undefined : 'motivo-progresso'}
              className="flex-1 py-2 bg-indigo-500 text-black rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
            >
              📊 Progresso
            </button>
          );
        })()}
      </div>}
      {mostra('progresso', profilo) && loadValidationHistory().length === 0 && loadQuizHistory().length === 0 && (
        <p id="motivo-progresso" className="text-[11px] text-gray-400">
          Il Progresso si sblocca dopo la prima verifica o il primo quiz.
        </p>
      )}
      {/*
        Il promemoria delle mattonelle, in fondo e in piccolo.

        Compare solo quando c'e' qualcosa da scaricare e non lo si sta gia' facendo: un
        suggerimento che sta li' sempre diventa arredamento e non lo legge piu' nessuno.
        Dice **quante** sono, perche' «scarica le mappe» senza un numero non aiuta a
        decidere se sia il momento — e in quota si arriva senza aver deciso.
      */}
      {mostra('meteo', profilo) && offline.daScaricare.length > 0 && !offline.inCorso && (
        <p className="text-[10px] text-gray-400 leading-snug">
          Prima di partire: <strong className="font-medium">📥 Mappa offline</strong> conserva
          le {numero(offline.daScaricare.length)} mattonelle di questo percorso sul telefono,
          per vederlo dove non c&rsquo;è segnale.
        </p>
      )}
    </div>
  );
}
