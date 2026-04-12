import React from 'react';

export const ResponsiveContainer = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-responsive-container">{children}</div>
);

export const LineChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-line-chart">{children}</div>
);

export const Line = () => null;
export const XAxis = () => null;
export const YAxis = () => null;
export const Tooltip = () => null;
export const Legend = () => null;
export const AreaChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-area-chart">{children}</div>
);
export const Area = () => null;
export const CartesianGrid = () => null;
export const ReferenceLine = () => null;
