import type { Leg, ValidationSession, ValidationSessionResult, Waypoint } from '@/lib/types';
import { useItineraryStore } from '@/stores/itineraryStore';
import {
  haversineDistance,
  forwardAzimuth,
  interpolatePoints,
  cumulativeElevation,
  sampleInterval,
} from '@/lib/calculations';
import { fetchElevation, fetchElevationProfile } from '@/lib/elevation-api';
import { validateValue, validateAzimuth, percentageTolerance } from '@/lib/validation';
import { fetchTrailRoute } from '@/lib/routing-api';

/**
 * **La verifica dell'itinerario: confrontare quello che l'utente ha scritto con la
 * realta' del terreno.**
 *
 * E' il cuore del profilo Imparo — si disegna il percorso, si calcolano a mano distanze,
 * azimut e dislivelli, e poi si chiede all'app se i conti tornano. Stava dentro
 * `ActionBar`, che e' un pannello di pulsanti: duecento righe di orchestrazione di rete e
 * di regole didattiche in un componente di presentazione, dove non si potevano provare
 * senza montare mezza interfaccia.
 *
 * ## Come funziona, in due fasi
 *
 * 1. **le tratte** — azimut sempre in linea d'aria; distanza e dislivelli dal servizio dei
 *    sentieri se l'utente l'ha acceso, altrimenti distanza in linea d'aria e dislivelli
 *    campionando il modello digitale del terreno;
 * 2. **le quote dei waypoint** — quasi tutte sono gia' nella cache riempita dagli estremi
 *    dei profili della fase 1; solo un waypoint orfano, che non appartiene a nessuna
 *    tratta, costa una chiamata in piu'.
 *
 * Dove l'utente **ha scritto** un valore, la verifica lo giudica; dove **non** l'ha
 * scritto, lo compila. E' la stessa funzione che insegna e che aiuta.
 *
 * ## `annullata()`
 *
 * La verifica dura secondi e fa molte chiamate. Chi la lancia passa una funzione che dice
 * se il risultato non serve piu' — perche' il componente e' stato smontato, o perche' e'
 * partita una verifica nuova. Ogni giro dei cicli la interroga e si ferma: senza, i
 * risultati di una verifica abbandonata continuerebbero a scriversi nello store sopra
 * quelli di quella nuova.
 */
export interface OpzioniVerifica {
  /** `true` quando il risultato non serve piu': smontaggio, o verifica piu' recente. */
  annullata: () => boolean;
  updateLeg: (id: string, data: Partial<Leg>, opzioni?: { calcolata?: boolean }) => void;
  updateWaypoint: (id: string, data: Partial<Waypoint>, opzioni?: { calcolata?: boolean }) => void;
}

/**
 * Esegue le due fasi, scrivendo giudizi e valori mancanti nello store.
 *
 * Restituisce `false` in `servizioQuote` se il servizio altimetrico ha fatto cilecca almeno
 * una volta: distanza e azimut restano validati, quota e dislivelli no, e chi chiama deve
 * dirlo — un giudizio mancante presentato come «tutto a posto» e' peggio di nessun
 * giudizio.
 */
export async function verificaItinerario(
  { annullata, updateLeg, updateWaypoint }: OpzioniVerifica,
): Promise<{ servizioQuote: boolean }> {
  let servizioQuote = true;

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
    if (annullata()) break;
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
    if (annullata()) break;

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
      if (annullata()) break;

      const firstAlt = profileElevations[0];
      const lastAlt = profileElevations[profileElevations.length - 1];
      if (firstAlt != null) elevationCache.set(`${from.lat},${from.lon}`, firstAlt);
      if (lastAlt != null) elevationCache.set(`${to.lat},${to.lon}`, lastAlt);

      const { gain: realGain, loss: realLoss } = cumulativeElevation(profileElevations);
      if (realGain == null || realLoss == null) {
        servizioQuote = false;
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
    if (annullata()) break;
    if (wp.lat == null || wp.lon == null) continue;
    const realAlt = await getCachedElevation(wp.lat, wp.lon);
    if (realAlt == null) {
      servizioQuote = false;
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

  return { servizioQuote };
}

/** Gli esiti di una verifica, nella forma che il diario dei progressi conserva. */
export interface EsitiVerifica {
  esiti: ValidationSessionResult[];
  validi: number;
  avvisi: number;
  errori: number;
}

/**
 * Raccoglie i giudizi scritti nello store in un elenco piatto, con i tre conteggi.
 *
 * Funzione **pura**: prende waypoint e tratte, non tocca niente. Salta gli `unverified`,
 * cioe' i campi che l'utente non ha compilato — un campo vuoto non e' un errore, e
 * contarlo come tale falserebbe la percentuale su cui si misura il miglioramento.
 */
export function raccogliEsiti(waypoints: Waypoint[], legs: Leg[]): EsitiVerifica {
  const sessionResults: ValidationSessionResult[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const wp of waypoints) {
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
  for (const leg of legs) {
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

  return { esiti: sessionResults, validi: validCount, avvisi: warningCount, errori: errorCount };
}

/**
 * **Di quanto e' migliorato, in punti percentuali, rispetto alla sessione precedente.**
 *
 * `undefined` quando non c'e' un prima con cui confrontarsi, o quando lo scarto e' sotto i
 * cinque punti: fra il 71% e il 73% non e' successo niente, e un'app che festeggia due
 * punti di rumore smette di essere creduta quando il miglioramento e' vero.
 */
export function miglioramento(
  validi: number,
  totale: number,
  storico: ValidationSession[],
): number | undefined {
  if (totale === 0 || storico.length === 0) return undefined;
  const percentuale = Math.round((validi / totale) * 100);
  const ultima = storico[storico.length - 1];
  const validiPrima = ultima.results.filter((x) => x.status === 'valid').length;
  const percentualePrima = ultima.results.length > 0
    ? Math.round((validiPrima / ultima.results.length) * 100)
    : 0;
  const scarto = percentuale - percentualePrima;
  return Math.abs(scarto) >= 5 ? scarto : undefined;
}
