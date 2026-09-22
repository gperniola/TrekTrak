import React from 'react';

export const ResponsiveContainer = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-responsive-container">{children}</div>
);

export const LineChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-line-chart">{children}</div>
);

export const Line = () => null;
/*
  L'asse X espone il suo `domain`: e' l'unico attributo che i test devono poter leggere,
  perche' e' li' che si decide se il grafico finisce dove finisce il percorso o a una tacca
  «tonda» piu' in la' (il difetto della v0.31.x: 10 km disegnati su un asse da 12).
*/
export const XAxis = ({ domain }: { domain?: unknown }) => (
  <div data-testid="recharts-x-axis" data-domain={JSON.stringify(domain ?? null)} />
);
export const YAxis = () => null;
export const Tooltip = () => null;
export const Legend = () => null;
export const AreaChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-area-chart">{children}</div>
);
export const Area = () => null;
export const CartesianGrid = () => null;
export const ReferenceLine = () => null;
/*
  Anche il pallino di riferimento espone le sue coordinate: e' cosi' che un test puo' dire
  «il punto della posizione sta a 4,2 km sul profilo» senza un browser.
*/
export const ReferenceDot = ({ x, y, className }: { x?: unknown; y?: unknown; className?: string }) => (
  <div data-testid={className ?? 'recharts-reference-dot'} data-x={String(x)} data-y={String(y)} />
);
