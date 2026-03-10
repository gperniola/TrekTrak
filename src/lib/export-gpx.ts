import type { Waypoint } from './types';
import { sanitizeFilename } from './format';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateGPX(name: string, waypoints: Waypoint[]): string {
  const validWps = waypoints.filter(
    (wp) => wp.lat != null && wp.lon != null && Number.isFinite(wp.lat) && Number.isFinite(wp.lon)
  );

  const wptElements = validWps
    .map((wp) => {
      const ele = wp.altitude != null ? `\n      <ele>${wp.altitude}</ele>` : '';
      return `    <wpt lat="${wp.lat}" lon="${wp.lon}">${ele}
      <name>${escapeXml(wp.name || `WP${wp.order + 1}`)}</name>
    </wpt>`;
    })
    .join('\n');

  const trkptElements = validWps
    .map((wp) => {
      const ele = wp.altitude != null ? `\n        <ele>${wp.altitude}</ele>` : '';
      return `      <trkpt lat="${wp.lat}" lon="${wp.lon}">${ele}
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="TrekTrak">
  <metadata>
    <name>${escapeXml(name || 'TrekTrak Route')}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wptElements}
  <trk>
    <name>${escapeXml(name || 'TrekTrak Route')}</name>
    <trkseg>
${trkptElements}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGPX(name: string, waypoints: Waypoint[]): void {
  const gpx = generateGPX(name, waypoints);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(name || 'trektrak-route')}.gpx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
