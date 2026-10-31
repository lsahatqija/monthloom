'use client';

import { LineChart, ResponsiveContainer } from 'recharts';

import { useTheme } from '../../../components/theme-provider';

import type { BalanceViewModel } from './aggregation/types';
import { BalanceChart } from './balance-chart';

export default function ChartSurface({
  label,
  balance,
}: {
  label: string;
  balance?: {
    model: BalanceViewModel;
    variant: 'line' | 'area';
    currency: string;
  };
}) {
  const { mode: theme } = useTheme();
  if (balance) return <BalanceChart {...balance} theme={theme} />;

  return (
    <div className="graphChartCanvas" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[]} accessibilityLayer />
      </ResponsiveContainer>
      <span className="graphZeroLine" aria-hidden="true" />
    </div>
  );
}
