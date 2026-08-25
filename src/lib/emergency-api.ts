import type { FirePoint } from './firms';
import { parseDpcTopology, bulletinDates, type DpcZone } from './dpc';

export interface DpcDay { date: string; zones: DpcZone[]; }
export interface DpcData { bulletinId: string; issuedLabel: string; days: DpcDay[]; }

export async function fetchFiresClient(): Promise<{ points: FirePoint[]; fetchedAt: string }> {
  const res = await fetch('/api/fires');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { error?: string })?.error ?? 'Focolai non disponibili');
  }
  return res.json();
}

export async function fetchDpcClient(): Promise<DpcData> {
  const res = await fetch('/api/dpc-alerts');
  if (!res.ok) throw new Error('Bollettino DPC non disponibile');
  const info = (await res.json()) as { bulletinId: string; topojsonToday: string; topojsonTomorrow: string };
  const { today, tomorrow, issuedLabel } = bulletinDates(info.bulletinId);

  const [todayRes, tomorrowRes] = await Promise.allSettled([
    fetch(info.topojsonToday).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    fetch(info.topojsonTomorrow).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
  ]);

  const days: DpcDay[] = [];
  if (todayRes.status === 'fulfilled') days.push({ date: today, zones: parseDpcTopology(todayRes.value) });
  if (tomorrowRes.status === 'fulfilled') days.push({ date: tomorrow, zones: parseDpcTopology(tomorrowRes.value) });
  if (days.length === 0) throw new Error('Geometrie del bollettino DPC non scaricabili');
  return { bulletinId: info.bulletinId, issuedLabel, days };
}
