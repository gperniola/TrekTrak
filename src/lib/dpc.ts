import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { escapeMarkup } from './escape-markup';

export type DpcLevel = 0 | 1 | 2 | 3;

export interface DpcZone {
  name: string;
  idraulico: DpcLevel;
  temporali: DpcLevel;
  idrogeologico: DpcLevel;
  maxLevel: DpcLevel;
  feature: GeoJSON.Feature;
}

export const DPC_LEVEL_COLORS: Record<1 | 2 | 3, string> = {
  1: '#eab308', 2: '#f97316', 3: '#dc2626',
};

export const DPC_LEVEL_LABELS: Record<DpcLevel, string> = {
  0: 'Nessuna', 1: 'Gialla', 2: 'Arancione', 3: 'Rossa',
};

/** I valori DPC sono testuali (es. "MODERATA CRITICITA' / ALLERTA ARANCIONE"). */
export function parseAlertLevel(text: unknown): DpcLevel {
  if (typeof text !== 'string') return 0;
  const t = text.toUpperCase();
  if (t.includes('ROSSA')) return 3;
  if (t.includes('ARANCIONE')) return 2;
  if (t.includes('GIALLA')) return 1;
  return 0;
}

export function parseDpcTopology(topology: unknown): DpcZone[] {
  const topo = topology as Topology | null;
  if (!topo || topo.type !== 'Topology' || !topo.objects) return [];
  // Il nome dell'object può variare: prendi la prima GeometryCollection.
  const objName = Object.keys(topo.objects).find((k) => {
    const obj = topo.objects[k] as GeometryCollection | null | undefined;
    return obj != null && obj.type === 'GeometryCollection';
  });
  if (!objName) return [];
  let fc: GeoJSON.FeatureCollection;
  try {
    fc = feature(topo, topo.objects[objName]) as unknown as GeoJSON.FeatureCollection;
  } catch {
    return [];
  }
  return fc.features.map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const idraulico = parseAlertLevel(p['Per rischio idraulico']);
    const temporali = parseAlertLevel(p['Per rischio temporali']);
    const idrogeologico = parseAlertLevel(p['Per rischio idrogeologico']);
    return {
      name: typeof p['Nome zona'] === 'string' ? (p['Nome zona'] as string) : 'Zona sconosciuta',
      idraulico, temporali, idrogeologico,
      maxLevel: Math.max(idraulico, temporali, idrogeologico) as DpcLevel,
      feature: f,
    };
  });
}

const esc = escapeMarkup;

function riskRow(label: string, level: DpcLevel): string {
  const color = level === 0 ? '#22c55e' : DPC_LEVEL_COLORS[level];
  return `<div style="display:flex;justify-content:space-between;gap:8px">` +
    `<span>${label}</span>` +
    `<span style="color:${color};font-weight:bold">${DPC_LEVEL_LABELS[level]}</span></div>`;
}

/** HTML puro per layer.bindPopup (le zone DPC usano il popup nativo Leaflet). */
export function zonePopupHtml(zone: DpcZone, dayLabel: string, issuedLabel: string): string {
  return `<div style="min-width:190px;font-size:12px">` +
    `<div style="font-weight:bold;margin-bottom:4px">${esc(zone.name)}</div>` +
    `<div style="color:var(--tenue);margin-bottom:6px">${esc(dayLabel)}</div>` +
    riskRow('Idraulico', zone.idraulico) +
    riskRow('Temporali', zone.temporali) +
    riskRow('Idrogeologico', zone.idrogeologico) +
    `<div style="color:var(--tenue);margin-top:6px;font-size:10px">${esc(issuedLabel)}</div></div>`;
}

/** Data locale in `YYYY-MM-DD`. Unica implementazione: la copia in EmergencyWmsLayer
 *  era identica carattere per carattere, e una divergenza avrebbe fatto scivolare il
 *  parametro TIME dei WMS rispetto alle date dei giorni DPC. */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ddmm(ymd: string): string {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

/** Da "YYYYMMDD_HHMM" alle date coperte dai file _today/_tomorrow + label emissione. */
export function bulletinDates(bulletinId: string): { today: string; tomorrow: string; issuedLabel: string } {
  const y = Number(bulletinId.slice(0, 4));
  const m = Number(bulletinId.slice(4, 6));
  const d = Number(bulletinId.slice(6, 8));
  const base = new Date(y, m - 1, d);
  const next = new Date(y, m - 1, d + 1);
  return {
    today: toYmd(base),
    tomorrow: toYmd(next),
    issuedLabel: `${bulletinId.slice(6, 8)}/${bulletinId.slice(4, 6)} ${bulletinId.slice(9, 11)}:${bulletinId.slice(11, 13)}`,
  };
}

export interface DayOption { date: string; label: string; disabled: boolean; }

/** Regola spec §6: le opzioni sono i giorni coperti dal bollettino, etichettati con la data reale. */
export function dayOptions(dates: string[], now: Date): DayOption[] {
  const today = toYmd(now);
  const tomorrow = toYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const yesterday = toYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  return dates.map((date) => {
    let prefix: string;
    if (date === today) prefix = 'Oggi';
    else if (date === tomorrow) prefix = 'Domani';
    // Solo il giorno prima è "Ieri": con un bollettino vecchio di due giorni, prima
    // uscivano due pulsanti entrambi etichettati "Ieri" con date diverse.
    else if (date === yesterday) prefix = 'Ieri';
    else prefix = 'Il';
    return { date, label: `${prefix} ${ddmm(date)}`, disabled: date < today };
  });
}

export function defaultDpcDate(dates: string[], now: Date): string | null {
  const today = toYmd(now);
  if (dates.includes(today)) return today;
  const future = dates.filter((d) => d > today).sort();
  return future[0] ?? null;
}
