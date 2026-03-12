import type { Waypoint, Leg } from './types';
import { sanitizeFilename } from './format';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTrkptElements(waypoints: Waypoint[], legs: Leg[]): string {
  const validWps = waypoints.filter(
    (wp) => wp.lat != null && wp.lon != null && Number.isFinite(wp.lat) && Number.isFinite(wp.lon)
  );

  const parts: string[] = [];

  for (let i = 0; i < validWps.length; i++) {
    const wp = validWps[i];

    // If there's a leg with routeGeometry leading TO this waypoint, use it
    if (i > 0) {
      const prevWp = validWps[i - 1];
      const leg = legs.find(
        (l) => l.fromWaypointId === prevWp.id && l.toWaypointId === wp.id
      );
      if (leg?.routeGeometry && leg.routeGeometry.length >= 2) {
        // Use trail points (skip first to avoid duplicating prev waypoint)
        for (let j = 1; j < leg.routeGeometry.length - 1; j++) {
          const [lat, lon] = leg.routeGeometry[j];
          parts.push(`      <trkpt lat="${lat}" lon="${lon}"></trkpt>`);
        }
      }
    }

    // Add the waypoint itself
    const ele = wp.altitude != null && Number.isFinite(wp.altitude) ? `\n        <ele>${wp.altitude}</ele>` : '';
    parts.push(`      <trkpt lat="${wp.lat}" lon="${wp.lon}">${ele}\n      </trkpt>`);
  }

  return parts.join('\n');
}

export function generateGPX(name: string, waypoints: Waypoint[], legs: Leg[] = []): string {
  const validWps = waypoints.filter(
    (wp) => wp.lat != null && wp.lon != null && Number.isFinite(wp.lat) && Number.isFinite(wp.lon)
  );

  const wptElements = validWps
    .map((wp) => {
      const ele = wp.altitude != null && Number.isFinite(wp.altitude) ? `\n      <ele>${wp.altitude}</ele>` : '';
      return `    <wpt lat="${wp.lat}" lon="${wp.lon}">${ele}
      <name>${escapeXml(wp.name || `WP${wp.order + 1}`)}</name>
    </wpt>`;
    })
    .join('\n');

  const trkptElements = buildTrkptElements(validWps, legs);
  const escapedName = escapeXml(name || 'TrekTrak Route');

  const trkSection = validWps.length >= 2
    ? `  <trk>
    <name>${escapedName}</name>
    <trkseg>
${trkptElements}
    </trkseg>
  </trk>`
    : '';

  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="TrekTrak">`,
    `  <metadata>`,
    `    <name>${escapedName}</name>`,
    `    <time>${new Date().toISOString()}</time>`,
    `  </metadata>`,
  ];
  if (wptElements) parts.push(wptElements);
  if (trkSection) parts.push(trkSection);
  parts.push(`</gpx>`);
  return parts.join('\n');
}

export function downloadGPX(name: string, waypoints: Waypoint[], legs: Leg[] = []): void {
  const gpx = generateGPX(name, waypoints, legs);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(name || 'trektrak-route')}.gpx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
