import L from 'leaflet';

// Icon cache to avoid recreating on every render
const iconCache = new Map<number, L.DivIcon>();

export function greenIcon(label: number) {
  if (iconCache.has(label)) return iconCache.get(label)!;
  const icon = L.divIcon({
    className: '',
    html: `<div style="background:#4ade80;color:#000;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid #fff;">${label}</div>`,
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
