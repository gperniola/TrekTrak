import type { Waypoint } from './types';

export function buildMeteoUrl(waypoints: Waypoint[]): string | null {
  const valid = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  if (valid.length < 2) return null;

  const lat = valid.reduce((sum, wp) => sum + wp.lat!, 0) / valid.length;
  const lon = valid.reduce((sum, wp) => sum + wp.lon!, 0) / valid.length;

  return `https://www.meteoblue.com/it/tempo/settimana/${lat.toFixed(4)}N${lon.toFixed(4)}E`;
}
