const ORS_API_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY ?? '';
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';
const TIMEOUT_MS = 8000;

export interface TrailRouteResult {
  geometry: [number, number][];
  distanceKm: number;
  ascent: number;
  descent: number;
  fromElevation: number | null;
  toElevation: number | null;
  elevationProfile: { distance: number; altitude: number }[];
}

export function isRoutingAvailable(): boolean {
  return ORS_API_KEY.length > 0;
}

export async function fetchTrailRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): Promise<TrailRouteResult | null> {
  if (!ORS_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ORS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify({
        coordinates: [
          [fromLon, fromLat],
          [toLon, toLat],
        ],
        elevation: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const feature = data?.features?.[0];
    if (!feature) return null;

    const summary = feature.properties?.summary;
    const segments = feature.properties?.segments;
    const coords = feature.geometry?.coordinates;
    if (!summary || !Array.isArray(coords)) return null;

    // ORS puts ascent/descent in segments, not in summary
    const seg0 = Array.isArray(segments) && segments.length > 0 ? segments[0] : null;

    // ORS returns [lon, lat, elevation] - convert to [lat, lon] for Leaflet
    const geometry: [number, number][] = coords.map(
      (c: number[]) => [c[1], c[0]] as [number, number]
    );

    // Extract elevation from first/last coordinate (ORS includes it with elevation: true)
    const firstCoord = coords[0];
    const lastCoord = coords[coords.length - 1];
    const fromElevation = firstCoord?.length >= 3 ? firstCoord[2] : null;
    const toElevation = lastCoord?.length >= 3 ? lastCoord[2] : null;

    // Build elevation profile from ORS coordinates (which include elevation)
    const totalDistKm = summary.distance / 1000;
    const elevationProfile: { distance: number; altitude: number }[] = [];
    let cumulDist = 0;
    for (let i = 0; i < coords.length; i++) {
      if (i > 0) {
        const [lon1, lat1] = coords[i - 1];
        const [lon2, lat2] = coords[i];
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        cumulDist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      const elev = coords[i].length >= 3 ? coords[i][2] : null;
      if (elev != null) {
        elevationProfile.push({
          distance: Math.round(cumulDist * 10000) / 10000,
          altitude: elev,
        });
      }
    }

    return {
      geometry,
      distanceKm: totalDistKm,
      ascent: seg0?.ascent ?? summary.ascent ?? 0,
      descent: seg0?.descent ?? summary.descent ?? 0,
      fromElevation,
      toElevation,
      elevationProfile,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
