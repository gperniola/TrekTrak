import type { FirePoint } from './firms';
import { parseDpcTopology, bulletinDates, type DpcZone } from './dpc';

export interface DpcDay { date: string; zones: DpcZone[]; }
export interface DpcData { bulletinId: string; issuedLabel: string; days: DpcDay[]; }

// Un fetch che va in reject (rete assente, DNS, CORS, ecc.) propaga il TypeError
// del browser ("Failed to fetch"): qui lo intercettiamo per mostrare in UI
// sempre un messaggio in italiano, mai il testo inglese grezzo.
async function safeFetch(input: string): Promise<Response> {
  try {
    return await fetch(input);
  } catch {
    throw new Error('Rete non disponibile');
  }
}

export async function fetchFiresClient(): Promise<{ points: FirePoint[]; fetchedAt: string }> {
  const res = await safeFetch('/api/fires');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { error?: string })?.error ?? 'Focolai non disponibili');
  }
  return res.json();
}

export async function fetchDpcClient(): Promise<DpcData> {
  const res = await safeFetch('/api/dpc-alerts');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { error?: string })?.error ?? 'Bollettino DPC non disponibile');
  }
  const info = (await res.json()) as { bulletinId: string; topojsonToday: string; topojsonTomorrow: string };
  const { today, tomorrow, issuedLabel } = bulletinDates(info.bulletinId);

  const [todayRes, tomorrowRes] = await Promise.allSettled([
    safeFetch(info.topojsonToday).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    safeFetch(info.topojsonTomorrow).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
  ]);

  const days: DpcDay[] = [];
  if (todayRes.status === 'fulfilled') days.push({ date: today, zones: parseDpcTopology(todayRes.value) });
  if (tomorrowRes.status === 'fulfilled') days.push({ date: tomorrow, zones: parseDpcTopology(tomorrowRes.value) });
  if (days.length === 0) throw new Error('Geometrie del bollettino DPC non scaricabili');
  return { bulletinId: info.bulletinId, issuedLabel, days };
}
