const REPO = 'pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica';
const COMMITS_API = `https://api.github.com/repos/${REPO}/commits`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/master/files/topojson`;
const CACHE_TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 8000;
const BULLETIN_RE = /files\/(?:preview\/)?(\d{8}_\d{4})/;

export interface DpcBulletinInfo {
  bulletinId: string;
  topojsonToday: string;
  topojsonTomorrow: string;
}

export type DpcDiscoveryResult =
  | { status: 200; data: DpcBulletinInfo }
  | { status: 502; error: string };

let cache: { data: DpcBulletinInfo; expiresAt: number } | null = null;

export function _resetDpcCacheForTests(): void {
  cache = null;
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API: HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function toInfo(bulletinId: string): DpcBulletinInfo {
  return {
    bulletinId,
    topojsonToday: `${RAW_BASE}/${bulletinId}_today.json`,
    topojsonTomorrow: `${RAW_BASE}/${bulletinId}_tomorrow.json`,
  };
}

export async function discoverLatestBulletin(): Promise<DpcDiscoveryResult> {
  if (cache && Date.now() < cache.expiresAt) return { status: 200, data: cache.data };

  try {
    const commits = (await getJson(`${COMMITS_API}?per_page=5`)) as Array<{ sha: string }>;
    for (const { sha } of commits) {
      const detail = (await getJson(`${COMMITS_API}/${sha}`)) as { files?: Array<{ filename: string }> };
      for (const f of detail.files ?? []) {
        const m = BULLETIN_RE.exec(f.filename);
        if (m) {
          const data = toInfo(m[1]);
          cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
          return { status: 200, data };
        }
      }
    }
    throw new Error('Nessun bollettino trovato negli ultimi commit');
  } catch (e) {
    // Fallback: cache stantia meglio di niente (bollettino giornaliero).
    if (cache) return { status: 200, data: cache.data };
    return { status: 502, error: e instanceof Error ? e.message : 'Discovery DPC fallita' };
  }
}
