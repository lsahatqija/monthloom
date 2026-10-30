'use client';

import { LineChart, ResponsiveContainer } from 'recharts';

export default function ChartSurface({ label }: { label: string }) {
  return (
    <div className="graphChartCanvas" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[]} accessibilityLayer />
      </ResponsiveContainer>
      <span className="graphZeroLine" aria-hidden="true" />
    </div>
  );
}
