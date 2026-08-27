import type { FirePoint } from './firms';
import { parseDpcTopology, bulletinDates, toYmd, type DpcZone } from './dpc';
import { NoDataError } from './no-data-error';

export interface DpcDay { date: string; zones: DpcZone[]; }
export interface DpcData { bulletinId: string; issuedLabel: string; days: DpcDay[] }

export { NoDataError };

/**
 * Lato client il timeout non c'era affatto: su una connessione ballerina — l'ambiente
 * tipico di questa app — la fetch resta appesa, il layer non esce mai da "Caricamento"
 * e nessun toast avvisa.
 */
const CLIENT_TIMEOUT_MS = 12000;

/**
 * Un fetch che va in reject (rete assente, DNS, CORS, timeout) propaga il TypeError
 * del browser ("Failed to fetch"): qui lo intercettiamo per mostrare in UI sempre un
 * messaggio in italiano, mai il testo inglese grezzo. Include la lettura del JSON,
 * perché un corpo malformato (captive portal che risponde HTML, risposta troncata)
 * fa lanciare a `res.json()` un `SyntaxError` in inglese, e prima quella chiamata
 * stava fuori dalla protezione.
 */
async function safeJson(
  input: string, notFoundMessage?: string, external?: AbortSignal
): Promise<unknown> {
  const controller = new AbortController();
  // Un segnale esterno (componente smontato) deve poter interrompere: senza, la
  // catena continuava a scaricare e a fare il parse per un componente morto.
  const onAbort = () => controller.abort();
  external?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch(input, { signal: controller.signal });
    if (!res.ok) {
      // Spec §6: 404 = "nessun dato disponibile", non errore. Il pattern serve già
      // ora e la fase 2 ci si appoggia per la stagionalità delle valanghe.
      if (res.status === 404 && notFoundMessage) throw new NoDataError(notFoundMessage);
      const body = await res.json().catch(() => null);
      const upstream = (body as { error?: string } | null)?.error;
      throw new Error(typeof upstream === 'string' && upstream ? upstream : 'Dati non disponibili');
    }
    return await res.json();
  } catch (e) {
    if (e instanceof NoDataError) throw e;
    // Un errore già in italiano (venuto dalla route) va propagato così com'è.
    if (e instanceof Error && e.message && !/fetch|abort|network|json|unexpected|token/i.test(e.message)) {
      throw e;
    }
    throw new Error('Rete non disponibile');
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onAbort);
  }
}

function isFiresPayload(v: unknown): v is { points: FirePoint[]; fetchedAt: string; partial?: boolean } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.points) && typeof o.fetchedAt === 'string';
}

function isBulletinInfo(v: unknown): v is { bulletinId: string; topojsonToday: string; topojsonTomorrow: string } {
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
export async function fetchDpcTodayZones(
  signal?: AbortSignal
): Promise<{ date: string; bulletinId: string; zones: DpcZone[] } | null> {
  const info = await safeJson('/api/dpc-alerts', undefined, signal);
  if (!isBulletinInfo(info)) throw new Error('Risposta bollettino DPC non valida');
  const { today, tomorrow } = bulletinDates(info.bulletinId);
  const oggi = toYmd(new Date());
  // Il bollettino è emesso nel pomeriggio e copre "oggi" e "domani" RISPETTO
  // ALL'EMISSIONE: la data odierna può quindi stare nel file `_tomorrow`.
  const url = today === oggi ? info.topojsonToday : tomorrow === oggi ? info.topojsonTomorrow : null;
  if (url == null) return null;
  const raw = await safeJson(url, 'Geometrie del giorno non ancora pubblicate', signal);
  return { date: oggi, bulletinId: info.bulletinId, zones: parseDpcTopology(raw) };
}

export async function fetchDpcClient(): Promise<DpcData> {
  const info = await safeJson('/api/dpc-alerts');
  if (!isBulletinInfo(info)) throw new Error('Risposta bollettino DPC non valida');
  const { today, tomorrow, issuedLabel } = bulletinDates(info.bulletinId);

  const [todayRes, tomorrowRes] = await Promise.allSettled([
    safeJson(info.topojsonToday, 'Geometrie del giorno non ancora pubblicate'),
    safeJson(info.topojsonTomorrow, 'Geometrie del giorno non ancora pubblicate'),
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
