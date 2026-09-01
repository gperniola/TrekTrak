import type { Leg, Waypoint, AppMode, LegModeValues, LegTrackModeValues } from '../../lib/types';
import { calculateMunterTime, calculateSlope } from '../../lib/calculations';

/**
 * Le funzioni pure dello store: nessuna tocca lo stato, tutte prendono dati e tornano
 * dati. Sono la parte che si verifica senza montare niente.
 */

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function createEmptyLeg(fromId: string, toId: string): Leg {
  return {
    id: generateId(),
    fromWaypointId: fromId,
    toWaypointId: toId,
    distance: null,
    elevationGain: null,
    elevationLoss: null,
    azimuth: null,
  };
}

export function recalculateLeg(leg: Leg, paceFactor: number = 1): Leg {
  const { distance, elevationGain, elevationLoss } = leg;
  if (distance != null && elevationGain != null && elevationLoss != null) {
    return {
      ...leg,
      estimatedTime: calculateMunterTime(distance, elevationGain, elevationLoss, paceFactor),
      slope: calculateSlope(distance, elevationGain, elevationLoss),
    };
  }
  return { ...leg, estimatedTime: undefined, slope: undefined };
}

/**
 * Ricostruisce la catena di tratte fra waypoint consecutivi, **conservando i dati delle
 * tratte i cui estremi non sono cambiati**.
 *
 * Questo pezzo era scritto **tre volte**, quasi identico: alla rimozione di un waypoint,
 * al riordino e al caricamento di un itinerario. Le tre copie differivano solo per un
 * dettaglio — il caricamento ricalcola tempi e pendenze, le altre due no — ed è
 * esattamente il modo in cui tre copie diventano tre comportamenti diversi senza che
 * nessuno se ne accorga.
 *
 * La validazione viene sempre azzerata: se i waypoint si sono spostati, un giudizio dato
 * su valori precedenti direbbe una cosa non più vera.
 */
export function catenaTratte(
  waypoints: Waypoint[],
  legs: Leg[],
  opzioni?: { ricalcolaCon?: number },
): Leg[] {
  const nuove: Leg[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const esistente = legs.find(
      (l) => l.fromWaypointId === waypoints[i].id && l.toWaypointId === waypoints[i + 1].id,
    );
    if (!esistente) {
      nuove.push(createEmptyLeg(waypoints[i].id, waypoints[i + 1].id));
      continue;
    }
    const { validationState, ...pulita } = esistente;
    void validationState;
    nuove.push(
      opzioni?.ricalcolaCon != null
        ? recalculateLeg(pulita as Leg, opzioni.ricalcolaCon)
        : ({ ...pulita, validationState: undefined } as Leg),
    );
  }
  return nuove;
}

// --- Scambio non distruttivo fra Learn e Track (TASK-15) ------------------------------
// Ogni tratta porta due cassetti — `trackValues` e `learnValues` — piu' i campi "attivi"
// che rispecchiano il cassetto corrente. Cambiando modo, i campi attivi finiscono nel
// cassetto del modo VECCHIO e vengono ripresi da quello del modo nuovo. Chi disegna
// continua a leggere `leg.distance` senza sapere niente di tutto questo.

export function snapshotLegForMode(leg: Leg, mode: AppMode): LegModeValues | LegTrackModeValues {
  const base: LegModeValues = {
    distance: leg.distance,
    elevationGain: leg.elevationGain,
    elevationLoss: leg.elevationLoss,
    azimuth: leg.azimuth,
  };
  if (mode === 'track') {
    const trackSnap: LegTrackModeValues = { ...base };
    if (leg.routeGeometry !== undefined) trackSnap.routeGeometry = leg.routeGeometry;
    if (leg.elevationProfile !== undefined) trackSnap.elevationProfile = leg.elevationProfile;
    return trackSnap;
  }
  return base;
}

export function restoreLegForMode(leg: Leg, mode: AppMode): Partial<Leg> {
  if (mode === 'track') {
    const tv = leg.trackValues;
    return {
      distance: tv?.distance ?? null,
      elevationGain: tv?.elevationGain ?? null,
      elevationLoss: tv?.elevationLoss ?? null,
      azimuth: tv?.azimuth ?? null,
      routeGeometry: tv?.routeGeometry,
      elevationProfile: tv?.elevationProfile,
    };
  }
  const lv = leg.learnValues;
  return {
    distance: lv?.distance ?? null,
    elevationGain: lv?.elevationGain ?? null,
    elevationLoss: lv?.elevationLoss ?? null,
    azimuth: lv?.azimuth ?? null,
    routeGeometry: undefined,
    elevationProfile: undefined,
  };
}
