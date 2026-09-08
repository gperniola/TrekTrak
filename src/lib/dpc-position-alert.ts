import { DPC_LEVEL_LABELS, type DpcZone } from './dpc';
import { attributionText } from './emergency-layers';
import { featureContainsPoint } from './geo-contains';

export interface PositionAlert {
  zoneName: string;
  /** Il livello più alto fra i rischi della zona. */
  level: 1 | 2 | 3;
  /** I rischi in allerta, ognuno col PROPRIO livello. */
  risks: Array<{ label: string; level: 1 | 2 | 3 }>;
}

/** Esito del controllo: si distingue "nessuna allerta" da "non è stato possibile dirlo". */
export type PositionCheck =
  | { outcome: 'alert'; alert: PositionAlert }
  | { outcome: 'clear' }
  | { outcome: 'unknown' };

const RISK_LABELS = {
  idraulico: 'idraulico',
  temporali: 'temporali',
  idrogeologico: 'idrogeologico',
} as const;

/** Nome di zona: i valori reali arrivano a 146 caratteri, e qui vanno in un banner. */
const MAX_ZONE_NAME = 90;

function shortenZoneName(name: string): string {
  const pulito = name.trim();
  if (pulito.length <= MAX_ZONE_NAME) return pulito;
  return `${pulito.slice(0, MAX_ZONE_NAME - 1).trimEnd()}…`;
}

/**
 * La zona in allerta **più grave** che contiene la posizione.
 *
 * "Più grave" e non "la prima": l'ordine dell'array è quello del bollettino, e le zone
 * possono sovrapporsi, quindi prendere la prima potrebbe declassare una rossa a
 * gialla — l'errore che conta di più fra i due possibili.
 *
 * `unknown` quando una zona in allerta contiene una geometria che non sappiamo
 * interrogare: meglio dire "non lo so" che dire "non sei in allerta".
 */
export function checkPosition(zones: DpcZone[], lat: number, lon: number): PositionCheck {
  if (zones.length === 0) return { outcome: 'unknown' };

  let migliore: DpcZone | null = null;
  let indeterminato = false;

  for (const zone of zones) {
    if (zone.maxLevel === 0) continue; // zone tranquille: nulla da dire
    const dentro = featureContainsPoint(zone.feature, lon, lat);
    if (dentro === null) { indeterminato = true; continue; }
    if (!dentro) continue;
    if (migliore == null || zone.maxLevel > migliore.maxLevel) migliore = zone;
  }

  if (migliore != null) {
    const risks = (['idraulico', 'temporali', 'idrogeologico'] as const)
      .filter((k) => migliore![k] > 0)
      .map((k) => ({ label: RISK_LABELS[k], level: migliore![k] as 1 | 2 | 3 }));
    return {
      outcome: 'alert',
      alert: { zoneName: shortenZoneName(migliore.name), level: migliore.maxLevel as 1 | 2 | 3, risks },
    };
  }
  return indeterminato ? { outcome: 'unknown' } : { outcome: 'clear' };
}

/**
 * Il testo dell'avviso.
 *
 * Ogni rischio porta **il proprio** livello. Attribuire a tutti il massimo della zona
 * — come faceva la prima versione — produce sia un falso allarme sia una falsa
 * rassicurazione nella stessa frase: con idraulico giallo e idrogeologico rosso si
 * leggeva "Allerta rossa per rischio idraulico, idrogeologico", e chi legge evita il
 * guado sbagliato mentre il versante davvero rosso non riceve peso distinto.
 */
export function positionAlertMessage(alert: PositionAlert, giorno: string): string {
  const dettaglio = alert.risks
    .map((r) => `${r.label} ${DPC_LEVEL_LABELS[r.level].toLowerCase()}`)
    .join(', ');
  const rischi = dettaglio ? ` — rischio ${dettaglio}` : '';
  return `Allerta ${DPC_LEVEL_LABELS[alert.level].toLowerCase()} dove ti trovi per ${giorno}:`
    + ` ${alert.zoneName}${rischi}.`
    + ' È il bollettino per l\'intera zona, non una misura sul posto, e non sostituisce'
    + ' i canali ufficiali di allerta: in caso di emergenza chiama il 112.'
    + ` Fonte: ${attributionText('dpc-alerts')}.`;
}

/** Livelli 2 e 3 hanno un peso diverso da un'allerta gialla, e va mostrato. */
export function positionAlertSeverity(alert: PositionAlert): 'warning' | 'severe' {
  return alert.level >= 2 ? 'severe' : 'warning';
}

/**
 * L'allerta **più grave** fra tutti i punti di un percorso.
 *
 * Il meteo del percorso attraversa più zone del bollettino: basta che UN tratto cada in
 * una zona in allerta perché l'escursione sia da valutare. Si prende la più grave (come
 * `checkPosition` fa fra zone sovrapposte), non la prima, per non declassare un rosso a
 * valle di un giallo.
 *
 * `unknown` se nessun punto è in allerta ma qualcuno cade in una geometria illeggibile:
 * "non lo so" non deve diventare "nessuna allerta". `clear` solo se ogni punto è stato
 * collocato e nessuno è in allerta.
 */
export function checkRoute(
  zones: DpcZone[],
  points: Array<{ lat: number; lon: number }>,
): PositionCheck {
  let migliore: PositionAlert | null = null;
  let indeterminato = false;
  for (const p of points) {
    const esito = checkPosition(zones, p.lat, p.lon);
    if (esito.outcome === 'alert') {
      if (migliore == null || esito.alert.level > migliore.level) migliore = esito.alert;
    } else if (esito.outcome === 'unknown') {
      indeterminato = true;
    }
  }
  if (migliore != null) return { outcome: 'alert', alert: migliore };
  return indeterminato ? { outcome: 'unknown' } : { outcome: 'clear' };
}

/**
 * Il testo dell'avviso per il **percorso** (non per la posizione).
 *
 * Stessa sostanza di `positionAlertMessage`, ma dice «su un tratto del percorso» invece
 * di «dove ti trovi»: nel meteo del percorso l'allerta riguarda la traccia, non il punto
 * in cui sei ora.
 */
export function routeAlertMessage(alert: PositionAlert, giorno: string): string {
  const dettaglio = alert.risks
    .map((r) => `${r.label} ${DPC_LEVEL_LABELS[r.level].toLowerCase()}`)
    .join(', ');
  const rischi = dettaglio ? ` — rischio ${dettaglio}` : '';
  return `Allerta ${DPC_LEVEL_LABELS[alert.level].toLowerCase()} della Protezione Civile per ${giorno}`
    + ` su un tratto del percorso: ${alert.zoneName}${rischi}.`
    + ' È il bollettino per l\'intera zona, non una misura sul punto, e non sostituisce'
    + ' i canali ufficiali di allerta: in caso di emergenza chiama il 112.'
    + ` Fonte: ${attributionText('dpc-alerts')}.`;
}
