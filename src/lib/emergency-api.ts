import type { FirePoint } from './firms';
import { parseDpcTopology, bulletinDates, toYmd, type DpcZone } from './dpc';
import { NoDataError } from './no-data-error';
import { describesNoAlerts, isDpcManifest } from './dpc-manifest';
import { safeJson } from './safe-json';

export interface DpcDay { date: string; zones: DpcZone[]; }
export interface DpcData { bulletinId: string; issuedLabel: string; days: DpcDay[] }

export { NoDataError };

const GEOMETRIE_NON_PUBBLICATE = 'Geometrie del giorno non ancora pubblicate';

function isFiresPayload(v: unknown): v is { points: FirePoint[]; fetchedAt: string; partial?: boolean } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.points) && typeof o.fetchedAt === 'string';
}

function isBulletinInfo(v: unknown): v is {
  bulletinId: string; topojsonToday: string; topojsonTomorrow: string; manifest?: string;
} {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return /^\d{8}_\d{4}$/.test(String(o.bulletinId))
    && typeof o.topojsonToday === 'string'
    && typeof o.topojsonTomorrow === 'string';
}

export async function fetchFiresClient(): Promise<{ points: FirePoint[]; fetchedAt: string; partial?: boolean }> {
  const body = await safeJson('/api/fires');
  // Senza questo controllo un corpo di forma diversa arrivava fino al render come
  // `points={undefined}` e `points.map` faceva crashare l'albero React — e nel
  // progetto non c'è alcun ErrorBoundary che limiti il danno al solo layer.
  if (!isFiresPayload(body)) throw new Error('Risposta focolai non valida');
  return body;
}

/**
 * Solo le zone del giorno corrente, per il controllo "sono in una zona in allerta?".
 *
 * Scarica UN topojson invece dei due di `fetchDpcClient`: sono ~400 KB compressi
 * ciascuno, e questo controllo parte all'avvio dell'app, spesso su rete mobile.
 * Riusa discovery, `safeJson` e parser, quindi nessuna logica di rete duplicata.
 *
 * `null` quando il bollettino disponibile non copre la data odierna: in quel caso non
 * c'è niente da dire all'utente, ed è giusto tacere.
 */
export type DpcTodayResult =
  /** Nessuna allerta in tutta Italia per oggi: nota dal manifest, senza geometrie. */
  | { kind: 'no-alerts'; date: string; bulletinId: string }
  | { kind: 'zones'; date: string; bulletinId: string; zones: DpcZone[] };

/**
 * Le zone del giorno corrente, per il controllo "sono in una zona in allerta?".
 *
 * Prima interroga il **manifest** (~2,4 KB): se il riepilogo nazionale dice che per
 * quel giorno non ci sono allerte da nessuna parte, nessuna posizione può cadere in
 * una zona in allerta, e si conclude lì. Le geometrie (~400 KB compressi) si scaricano
 * solo quando servono davvero — cioè nei giorni in cui c'è qualcosa da dire.
 *
 * Il manifest è solo un'ottimizzazione, e fallisce nel verso giusto: se non è
 * raggiungibile, o se il testo non è riconosciuto, si scaricano le geometrie come
 * prima. Non può produrre un falso "nessuna allerta".
 *
 * `null` quando il bollettino disponibile non copre la data odierna.
 */
export async function fetchDpcTodayZones(
  signal?: AbortSignal
): Promise<DpcTodayResult | null> {
  const info = await safeJson('/api/dpc-alerts', { signal });
  if (!isBulletinInfo(info)) throw new Error('Risposta bollettino DPC non valida');
  const { today, tomorrow } = bulletinDates(info.bulletinId);
  const oggi = toYmd(new Date());
  // Il bollettino è emesso nel pomeriggio e copre "oggi" e "domani" RISPETTO
  // ALL'EMISSIONE: la data odierna può quindi stare nel file `_tomorrow`.
  const quale = today === oggi ? 'today' : tomorrow === oggi ? 'tomorrow' : null;
  if (quale == null) return null;

  if (info.manifest) {
    try {
      const manifest = await safeJson(info.manifest, { signal });
      if (isDpcManifest(manifest) && describesNoAlerts(manifest[quale]?.html_descrition)) {
        return { kind: 'no-alerts', date: oggi, bulletinId: info.bulletinId };
      }
    } catch {
      // Manifest non raggiungibile: si procede col percorso completo.
    }
  }

  const url = quale === 'today' ? info.topojsonToday : info.topojsonTomorrow;
  const raw = await safeJson(url, { nonTrovato: GEOMETRIE_NON_PUBBLICATE, signal });
  return { kind: 'zones', date: oggi, bulletinId: info.bulletinId, zones: parseDpcTopology(raw) };
}

export async function fetchDpcClient(): Promise<DpcData> {
  const info = await safeJson('/api/dpc-alerts');
  if (!isBulletinInfo(info)) throw new Error('Risposta bollettino DPC non valida');
  const { today, tomorrow, issuedLabel } = bulletinDates(info.bulletinId);

  const [todayRes, tomorrowRes] = await Promise.allSettled([
    safeJson(info.topojsonToday, { nonTrovato: GEOMETRIE_NON_PUBBLICATE }),
    safeJson(info.topojsonTomorrow, { nonTrovato: GEOMETRIE_NON_PUBBLICATE }),
  ]);

  const days: DpcDay[] = [];
  if (todayRes.status === 'fulfilled') days.push({ date: today, zones: parseDpcTopology(todayRes.value) });
  if (tomorrowRes.status === 'fulfilled') days.push({ date: tomorrow, zones: parseDpcTopology(tomorrowRes.value) });

  if (days.length === 0) {
    // Entrambi 404 è una finestra reale del repo DPC (bollettino emesso, topojson non
    // ancora pushati): "nessun dato disponibile", non un guasto da toast rosso.
    const bothMissing = [todayRes, tomorrowRes].every(
      (r) => r.status === 'rejected' && r.reason instanceof NoDataError
    );
    if (bothMissing) throw new NoDataError('Geometrie del bollettino non ancora pubblicate');
    throw new Error('Geometrie del bollettino DPC non scaricabili');
  }
  return { bulletinId: info.bulletinId, issuedLabel, days };
}
