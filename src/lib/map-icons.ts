import L from 'leaflet';

// Icon cache to avoid recreating on every render
const iconCache = new Map<number, L.DivIcon>();

/**
 * Marker numerato di un waypoint.
 *
 * Il testo nascosto non è decorazione: Leaflet mette `role="button"` e `tabIndex=0`
 * sull'elemento icona (leaflet-src.js:7914), e il nome accessibile si calcola dal
 * contenuto — che senza di esso è il solo numero. "Waypoint 3" si capisce anche
 * ascoltandolo fuori contesto; "3" no.
 */
export function greenIcon(label: number) {
  if (iconCache.has(label)) return iconCache.get(label)!;
  const icon = L.divIcon({
    className: '',
    html: `<div style="background:#4ade80;color:#000;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid #fff;">`
      + `<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">Waypoint </span>`
      + `${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  iconCache.set(label, icon);
  return icon;
}

export const profileHoverIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;background:#facc15;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(250,204,21,0.6);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});
