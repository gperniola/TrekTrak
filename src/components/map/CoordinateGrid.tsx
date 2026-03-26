'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { computeGridLines } from '@/lib/grid';

export function CoordinateGrid() {
  const map = useMap();
  const [grid, setGrid] = useState<ReturnType<typeof computeGridLines> | null>(null);

  const updateGrid = useCallback(() => {
    const b = map.getBounds();
    const lines = computeGridLines(
      { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
      map.getZoom()
    );
    setGrid(lines);
  }, [map]);

  useEffect(() => {
    updateGrid();
  }, [updateGrid]);

  useMapEvents({
    moveend: updateGrid,
    zoomend: updateGrid,
  });

  if (!grid) return null;

  const { latLines, lonLines, interval } = grid;
  const b = map.getBounds();
  const decimals = interval >= 1 ? 0 : interval >= 0.1 ? 1 : interval >= 0.01 ? 2 : 3;

  return (
    <>
      {/* Horizontal lines (latitude) */}
      {latLines.map((lat) => (
        <Polyline
          key={`lat-${lat}`}
          positions={[[lat, b.getWest() - 1], [lat, b.getEast() + 1]]}
          color="#9ca3af"
          weight={1}
          opacity={0.3}
          interactive={false}
        />
      ))}
      {/* Vertical lines (longitude) */}
      {lonLines.map((lon) => (
        <Polyline
          key={`lon-${lon}`}
          positions={[[b.getSouth() - 1, lon], [b.getNorth() + 1, lon]]}
          color="#9ca3af"
          weight={1}
          opacity={0.3}
          interactive={false}
        />
      ))}
      {/* Labels on left edge for lat */}
      {latLines.map((lat) => {
        const point = map.latLngToContainerPoint([lat, b.getWest()]);
        if (point.y < 10 || point.y > map.getSize().y - 10) return null;
        return (
          <LatLonLabel key={`lbl-lat-${lat}`} lat={lat} lon={b.getWest()} text={`${lat.toFixed(decimals)}°`} position="left" map={map} />
        );
      })}
      {/* Labels on bottom edge for lon */}
      {lonLines.map((lon) => {
        const point = map.latLngToContainerPoint([b.getSouth(), lon]);
        if (point.x < 10 || point.x > map.getSize().x - 10) return null;
        return (
          <LatLonLabel key={`lbl-lon-${lon}`} lat={b.getSouth()} lon={lon} text={`${lon.toFixed(decimals)}°`} position="bottom" map={map} />
        );
      })}
    </>
  );
}

function LatLonLabel({ lat, lon, text, position, map }: {
  lat: number; lon: number; text: string; position: 'left' | 'bottom'; map: L.Map;
}) {
  useEffect(() => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="font-size:9px;color:#9ca3af;white-space:nowrap;pointer-events:none;text-shadow:0 0 3px #000,0 0 3px #000;">${text}</div>`,
      iconSize: [60, 14],
      iconAnchor: position === 'left' ? [0, 7] : [30, 0],
    });
    const m = L.marker([lat, lon], { icon, interactive: false, pane: 'overlayPane' }).addTo(map);
    return () => { m.remove(); };
  }, [lat, lon, text, position, map]);

  return null;
}
