const REPO = 'pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica';
const COMMITS_API = `https://api.github.com/repos/${REPO}/commits`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/master/files/topojson`;
const CACHE_TTL_MS = 30 * 60 * 1000;
/**
 * Oltre questo limite la cache non viene più servita come buona. Senza tetto un
 * bollettino di due giorni prima veniva restituito con status 200: `bulletinDates`
 * produce due date entrambe passate, `defaultDpcDate` torna null e il layer resta
 * "ready" senza disegnare nulla — assenza di dati indistinguibile da "nessuna
 * allerta", che su una feature di sicurezza è il modo peggiore di sbagliare.
 */
const CACHE_STALE_MAX_MS = 6 * 60 * 60 * 1000;
/** Cache negativa: evita che N richieste in parallelo brucino il rate limit di GitHub. */
const NEGATIVE_TTL_MS = 60 * 1000;
const TIMEOUT_MS = 8000;
/** Deadline complessiva: la somma dei timeout per chiamata supererebbe il limite serverless. */
const TOTAL_DEADLINE_MS = 12000;
const MAX_COMMITS_SCANNED = 3;

export interface DpcBulletinInfo {
  bulletinId: string;
  topojsonToday: string;
  topojsonTomorrow: string;
}

export type DpcDiscoveryResult =
  | { status: 200; data: DpcBulletinInfo }
  | { status: 502; error: string };

const UNREACHABLE = 'Bollettino DPC non raggiungibile';

let cache: { data: DpcBulletinInfo; storedAt: number } | null = null;
let negativeUntil = 0;

export function _resetDpcCacheForTests(): void {
  cache = null;
  negativeUntil = 0;
}

/**
 * Id di bollettino da un path di file del commit, qualunque sia la cartella.
 *
 * I preview NON vanno esclusi: il repo DPC committa spesso quelli da soli — il
 * 26/08/2026 l'ultimo commit su master toccava unicamente
 * `files/preview/20260826_1422_{oggi,domani}.png`, con i topojson dello stesso id già
 * pubblicati. Escluderli buttava via l'unico segnale disponibile e il layer risultava
 * sempre "non raggiungibile". Il rischio opposto — un preview più avanti dei
 * topojson — si gestisce verificando che le geometrie esistano (vedi
 * `hasPublishedGeometry`), non ignorando l'id.
 *
 * Il ramo `[a-z]+/` copre la forma canonica `files/topojson/<id>_today.json`, che la
 * regex originale non matchava affatto: pretendeva l'id subito dopo `files/`.
 */
export function bulletinIdFrom(filename: string): string | null {
  const m = /files\/(?:[a-z]+\/)?(\d{8}_\d{4})/.exec(filename);
  return m ? m[1] : null;
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API: HTTP ${res.status}`);
    // Il body va letto qui dentro: se il timer scadesse dopo il `finally`,
    // l'abort sarebbe già disarmato e la lettura resterebbe appesa.
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

function toInfo(bulletinId: string): DpcBulletinInfo {
  return {
    bulletinId,
    topojsonToday: `${RAW_BASE}/${bulletinId}_today.json`,
    topojsonTomorrow: `${RAW_BASE}/${bulletinId}_tomorrow.json`,
  };
}

/** Id trovati nei file di un commit, nell'ordine, senza ripetizioni. */
function bulletinIdsIn(files: Array<{ filename: string }> | undefined): string[] {
  const ids: string[] = [];
  for (const f of files ?? []) {
    const id = bulletinIdFrom(f.filename);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Le geometrie di questo bollettino sono pubblicate?
 *
 * È la verifica che permette di accettare gli id di preview senza rischiare di
 * costruire un layer su file inesistenti. Va su `raw.githubusercontent.com`, che non
 * ha il rate limit dell'API, quindi costa poco. Basta controllare `_today`: se
 * manca solo `_tomorrow`, il client mostra comunque il giorno che c'è.
 */
async function hasPublishedGeometry(bulletinId: string, signal: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${RAW_BASE}/${bulletinId}_today.json`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

/** Il primo id, nell'ordine dato, che ha le geometrie effettivamente pubblicate. */
async function firstWithGeometry(ids: string[], signal: AbortSignal): Promise<string | null> {
  for (const id of ids) {
    if (await hasPublishedGeometry(id, signal)) return id;
  }
  return null;
}

export async function discoverLatestBulletin(): Promise<DpcDiscoveryResult> {
  const now = Date.now();
  if (cache && now - cache.storedAt < CACHE_TTL_MS) return { status: 200, data: cache.data };
  if (now < negativeUntil) {
    // Discovery appena fallita: serviamo la cache se ancora accettabile, senza
    // ritentare subito (6 chiamate a GitHub per richiesta si auto-amplificano).
    if (cache && now - cache.storedAt < CACHE_STALE_MAX_MS) return { status: 200, data: cache.data };
    return { status: 502, error: UNREACHABLE };
  }

  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), TOTAL_DEADLINE_MS);
  try {
    // Spec §4.3: una sola chiamata nel caso normale. Il commit di `master` porta già
    // l'elenco dei file, quindi la lista dei commit serve solo se lì non si trova
    // nessun id, o se quelli trovati non hanno le geometrie pubblicate.
    const candidati = bulletinIdsIn(
      ((await getJson(`${COMMITS_API}/master`, deadline.signal)) as { files?: Array<{ filename: string }> }).files
    );

    let scelto = await firstWithGeometry(candidati, deadline.signal);

    if (!scelto) {
      const commits = (await getJson(
        `${COMMITS_API}?per_page=${MAX_COMMITS_SCANNED}`, deadline.signal
      )) as Array<{ sha: string }>;
      for (const { sha } of commits) {
        const detail = (await getJson(`${COMMITS_API}/${sha}`, deadline.signal)) as {
          files?: Array<{ filename: string }>;
        };
        const altri = bulletinIdsIn(detail.files).filter((c) => !candidati.includes(c));
        candidati.push(...altri);
        scelto = await firstWithGeometry(altri, deadline.signal);
        if (scelto) break;
      }
    }

    if (!scelto) throw new Error('Nessun bollettino con geometrie pubblicate negli ultimi commit');

    const data = toInfo(scelto);
    cache = { data, storedAt: Date.now() };
    return { status: 200, data };
  } catch {
    negativeUntil = Date.now() + NEGATIVE_TTL_MS;
    // Cache stantia meglio di niente, ma solo entro il tetto d'età.
    if (cache && Date.now() - cache.storedAt < CACHE_STALE_MAX_MS) {
      return { status: 200, data: cache.data };
    }
    // Mai il messaggio grezzo di upstream: sarebbe "GitHub API: HTTP 403", oppure il
    // testo inglese della piattaforma per abort ("This operation was aborted") e DNS
    // ("getaddrinfo ENOTFOUND"), che il pannello mostrerebbe così com'è in una UI
    // italiana. Il dettaglio tecnico non serve all'utente in montagna.
    return { status: 502, error: UNREACHABLE };
  } finally {
    clearTimeout(deadlineTimer);
  }
}
