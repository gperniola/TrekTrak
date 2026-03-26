export interface GridLines {
  latLines: number[];
  lonLines: number[];
  interval: number;
}

function zoomToInterval(zoom: number): number {
  if (zoom <= 8) return 1;
  if (zoom <= 11) return 0.1;
  if (zoom <= 14) return 0.01;
  return 0.001;
}

export function computeGridLines(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number
): GridLines {
  const interval = zoomToInterval(zoom);

  const latStartIdx = Math.floor(bounds.south / interval);
  const latEndIdx = Math.ceil(bounds.north / interval);
  const lonStartIdx = Math.floor(bounds.west / interval);
  const lonEndIdx = Math.ceil(bounds.east / interval);

  const latLines: number[] = [];
  for (let i = latStartIdx; i <= latEndIdx; i++) {
    latLines.push(Math.round(i * interval * 1e9) / 1e9);
  }

  const lonLines: number[] = [];
  for (let i = lonStartIdx; i <= lonEndIdx; i++) {
    lonLines.push(Math.round(i * interval * 1e9) / 1e9);
  }

  return { latLines, lonLines, interval };
}
