import type { AppMode, Leg, Waypoint } from '@/lib/types';

/** Un punto del profilo: distanza progressiva in km, quota in metri. */
export interface PuntoProfilo {
  distance: number;
  altitude: number;
}

/** Un waypoint sul profilo, col suo nome: sono i pallini sopra la curva. */
export interface PallinoWaypoint extends PuntoProfilo {
  name: string;
}

export interface Profili {
  /** Il profilo dell'utente: quello che ha scritto lui, o quello calcolato in Pianificazione. */
  profileData: PuntoProfilo[];
  waypointDots: PallinoWaypoint[];
  /** Il profilo **reale** da una sessione di Pianificazione precedente, se c'e'. */
  realProfileData: PuntoProfilo[];
}

/**
 * **I dati del profilo altimetrico, calcolati dai waypoint e dalle tratte.**
 *
 * Centocinque righe che stavano dentro un `useMemo` di `ElevationProfile`, il componente
 * piu' intricato dell'app e **l'unico grosso senza nessun test**. Sono calcolo puro: non
 * toccano il DOM, non leggono lo store, non disegnano niente. Qui si possono interrogare.
 *
 * ## Le tre cose che restituisce
 *
 * 1. **`profileData`** — la curva. Se una tratta porta il suo profilo campionato dal
 *    modello del terreno, si usa quello; altrimenti si ripiega sulle sole quote ai
 *    waypoint, che disegna una spezzata e non le salite intermedie (in Imparo il pannello
 *    lo dichiara: «stimato»).
 * 2. **`waypointDots`** — i pallini, con la distanza cumulata.
 * 3. **`realProfileData`** — in Imparo, il profilo vero di una sessione di Pianificazione
 *    precedente, da sovrapporre alla stima dell'utente. E' la funzione didattica della
 *    v0.7.0: si vede a occhio quanto la propria spezzata somigli al terreno.
 *
 * ## Il dettaglio che rende la sovrapposizione leggibile
 *
 * Quando si sovrappongono stima e realta', **i due profili devono condividere l'asse
 * delle distanze**, altrimenti il confronto non dice niente. Percio' quando esiste una
 * distanza reale (`trackValues.distance`) si spaziano con quella le quote dell'utente, e
 * non con la distanza che l'utente ha scritto: se lui stima 3 km su una tratta di 5, le
 * due curve andrebbero fuori registro e sembrerebbe sbagliata la quota.
 */
export function costruisciProfilo(
  waypoints: Waypoint[],
  legs: Leg[],
  appMode: AppMode,
): Profili {
  let data: { distance: number; altitude: number }[] = [];
  let globalDist = 0;

  // TASK-29 / R2 review fix: when overlaying real-vs-estimated in Learn mode,
  // both profiles must share the same X-axis to be didactically meaningful.
  // If trackValues.distance is available per leg, use those for spacing the
  // user's waypoint altitudes; otherwise fall back to the user's own distance.
  const hasRealReference = appMode === 'learn' && legs.some((l) => l.trackValues?.distance != null);
  const spacingFor = (leg: Leg): number | null => {
    if (hasRealReference) {
      const td = leg.trackValues?.distance;
      if (td != null) return td;
    }
    return leg.distance;
  };

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.elevationProfile && leg.elevationProfile.length >= 2) {
      for (let j = 0; j < leg.elevationProfile.length; j++) {
        // Skip first point of subsequent legs (same as last point of previous)
        if (i > 0 && j === 0) continue;
        const p = leg.elevationProfile[j];
        data.push({
          distance: parseFloat((globalDist + p.distance).toFixed(4)),
          altitude: p.altitude,
        });
      }
      // Use the profile's own last distance for continuity (may differ slightly from leg.distance)
      const profileEnd = leg.elevationProfile[leg.elevationProfile.length - 1].distance;
      globalDist += profileEnd;
    } else {
      // Fallback: use waypoint altitudes only, spaced by the chosen distance source
      const spacing = spacingFor(leg);
      if (spacing == null) continue;
      const fromWp = waypoints.find((w) => w.id === leg.fromWaypointId);
      const toWp = waypoints.find((w) => w.id === leg.toWaypointId);
      if (i === 0 && fromWp?.altitude != null) {
        data.push({ distance: parseFloat(globalDist.toFixed(4)), altitude: fromWp.altitude });
      }
      globalDist += spacing;
      if (toWp?.altitude != null) {
        data.push({ distance: parseFloat(globalDist.toFixed(4)), altitude: toWp.altitude });
      }
    }
  }

  // Build waypoint positions with cumulative distance (used for fallback + dots).
  // Use the same spacing source as the profile (real distance when overlaying).
  const dots: { distance: number; altitude: number; name: string }[] = [];
  let wpCumulDist = 0;
  waypoints.forEach((wp, i) => {
    if (i > 0) {
      const prevWp = waypoints[i - 1];
      const leg = legs.find(
        (l) => l.fromWaypointId === prevWp.id && l.toWaypointId === wp.id
      );
      if (leg) {
        const spacing = spacingFor(leg);
        if (spacing != null) wpCumulDist += spacing;
      }
    }
    if (wp.altitude != null) {
      dots.push({
        distance: parseFloat(wpCumulDist.toFixed(4)),
        altitude: wp.altitude,
        name: wp.name || `WP${i + 1}`,
      });
    }
  });

  /*
    Se nessuna tratta porta un profilo, si ripiega sulle sole quote ai waypoint.
    Ma **due punti allo stesso chilometro non sono un profilo**: succede quando le
    distanze non sono ancora state scritte, cioe' nello stato normale di Imparo appena
    si compilano le quote. Il ripiego li metteva tutti a 0 km, il componente li contava
    (sono due) e disegnava un grafico con l'asse orizzontale da zero a zero: una riga
    verticale sotto la scritta «Profilo altimetrico», invece della frase che dice che
    mancano le distanze. Meglio non disegnare niente e dirlo.
  */
  if (data.length < 2) {
    const soloQuote = dots.map(({ name, ...rest }) => rest);
    const distinte = new Set(soloQuote.map((d) => d.distance));
    data = distinte.size >= 2 ? soloQuote : [];
  }

  // TASK-29: build the "real" profile from trackValues.elevationProfile when
  // available — used to overlay reality on top of the user's "flat" estimate
  // in Learn mode after a previous Track session.
  let realData: { distance: number; altitude: number }[] = [];
  if (appMode === 'learn') {
    let realCum = 0;
    let anyReal = false;
    /*
      Il primo punto di una tratta si salta perche' e' l'ultimo della precedente — ma solo
      se la precedente ne ha davvero messo uno. Quando la tratta prima non ha valori di
      Pianificazione, quel punto NON esiste, e saltarlo lo perde: la curva reale
      cominciava a mezza salita, e se cosi' le restavano meno di due punti spariva del
      tutto senza dirlo. Colpiva proprio la funzione didattica «stimato vs reale».
    */
    let laPrecedenteHaChiuso = false;
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const realProfile = leg.trackValues?.elevationProfile;
      if (realProfile && realProfile.length >= 2) {
        anyReal = true;
        for (let j = 0; j < realProfile.length; j++) {
          if (j === 0 && laPrecedenteHaChiuso) continue;
          const p = realProfile[j];
          realData.push({
            distance: parseFloat((realCum + p.distance).toFixed(4)),
            altitude: p.altitude,
          });
        }
        realCum += realProfile[realProfile.length - 1].distance;
        laPrecedenteHaChiuso = true;
      } else if (leg.distance != null) {
        // Nessun profilo reale per questa tratta: la distanza cumulata avanza comunque,
        // cosi' il tratto reale successivo resta allineato con la curva dell'utente.
        realCum += leg.trackValues?.distance ?? leg.distance;
        laPrecedenteHaChiuso = false;
      } else {
        laPrecedenteHaChiuso = false;
      }
    }
    if (!anyReal) realData = [];
  }
  return { profileData: data, waypointDots: dots, realProfileData: realData };
}

/**
 * Unisce il profilo dell'utente e quello reale in un solo elenco, indicizzato per
 * distanza: Recharts disegna due aree solo se leggono lo stesso insieme di dati.
 *
 * I buchi vanno bene (`connectNulls`): una tratta puo' avere il profilo reale e la
 * successiva no.
 */
export function uniscoProfili(
  profileData: PuntoProfilo[],
  realProfileData: PuntoProfilo[],
): { distance: number; altitude?: number; realAltitude?: number }[] {
  const hasReal = realProfileData.length >= 2;
  if (!hasReal) return profileData.map((p) => ({ distance: p.distance, altitude: p.altitude, realAltitude: undefined as number | undefined }));
  const byDist = new Map<number, { distance: number; altitude?: number; realAltitude?: number }>();
  for (const p of profileData) {
    byDist.set(p.distance, { distance: p.distance, altitude: p.altitude });
  }
  for (const p of realProfileData) {
    const existing = byDist.get(p.distance);
    if (existing) existing.realAltitude = p.altitude;
    else byDist.set(p.distance, { distance: p.distance, realAltitude: p.altitude });
  }
  return Array.from(byDist.values()).sort((a, b) => a.distance - b.distance);
}

/**
 * **Il dominio verticale del grafico**, con un margine che tiene la curva espressiva.
 *
 * Il margine e' adattivo perche' un profilo che sale di trenta metri e uno che sale di
 * duemila hanno bisogno di due margini diversi: col 10% fisso il primo diventa una riga
 * piatta in mezzo al riquadro, e con cinque metri fissi il secondo tocca i bordi.
 *
 * - meno di 50 m di dislivello -> 5 m di margine, arrotondato a 5 (non a 10, che
 *   sprecherebbe metà del riquadro);
 * - fra 50 e 200 m -> il margine cresce da 5 a 10;
 * - oltre 200 m -> il 10% dell'intervallo.
 */
export function dominioY(
  profileData: PuntoProfilo[],
  realProfileData: PuntoProfilo[],
): { yMin: number; yMax: number } {
  const hasReal = realProfileData.length >= 2;
const minAlt = profileData.reduce((min, d) => Math.min(min, d.altitude), Infinity);
const maxAlt = profileData.reduce((max, d) => Math.max(max, d.altitude), -Infinity);
// Extend Y domain to include real altitudes if present
const realMin = hasReal ? realProfileData.reduce((min, d) => Math.min(min, d.altitude), Infinity) : Infinity;
const realMax = hasReal ? realProfileData.reduce((max, d) => Math.max(max, d.altitude), -Infinity) : -Infinity;
const minAltCombined = Math.min(minAlt, realMin);
const maxAltCombined = Math.max(maxAlt, realMax);
// Adaptive padding: keep the curve visually expressive even for small altitude ranges.
// - Range < 50m → 5m padding (tight)
// - 50m ≤ range < 200m → linearly interpolate 5m → 10m
// - Range ≥ 200m → 10% of range
// Also round to 5m for small ranges (vs 10m) to avoid wasting visual space.
const range = maxAltCombined - minAltCombined;
const padding = range < 50 ? 5 : range < 200 ? 5 + (range - 50) / 30 : range * 0.1;
const roundTo = range < 50 ? 5 : 10;
const yMin = Math.floor((minAltCombined - padding) / roundTo) * roundTo;
const yMax = Math.ceil((maxAltCombined + padding) / roundTo) * roundTo;
  return { yMin, yMax };
}

/**
 * **Cosa dire quando il profilo non si puo' disegnare.**
 *
 * Quattro casi distinti, perche' «aggiungi almeno 2 waypoint» detto a chi ne ha tre e' una
 * frase che non dice cosa fare: i waypoint ci sono, manca altro. Ogni frase nomina la cosa
 * che manca **e** dove si scrive.
 *
 * Il caso delle distanze e' arrivato per ultimo, ed e' quello piu' comune: prima di
 * correggere il ripiego a zero chilometri, con le quote scritte e le distanze no si
 * disegnava una riga verticale invece di dire niente. Appena ha smesso di disegnarla, la
 * frase che compariva era «servono waypoint con quota e coordinate» — a chi aveva quota e
 * coordinate. Una correzione che scopre la frase sbagliata dietro.
 */
export function messaggioProfiloVuoto(waypoints: Waypoint[], legs: Leg[] = []): string {
  const conQuota = waypoints.filter((wp) => wp.altitude != null).length;
  if (waypoints.length < 2) {
    return 'Tocca la mappa per aggiungere almeno 2 waypoint: qui comparirà il profilo altimetrico';
  }
  if (conQuota < 2) {
    return 'Inserisci la quota di almeno 2 waypoint nell’Editor: qui comparirà il profilo altimetrico';
  }
  if (legs.some((l) => l.distance == null && l.trackValues?.distance == null)) {
    return 'Inserisci le distanze delle tratte nell’Editor: senza, le quote non hanno un posto sull’asse dei chilometri';
  }
  return 'Servono almeno 2 waypoint con quota e coordinate per il profilo altimetrico';
}
