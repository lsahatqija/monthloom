'use client';

import { LineChart, ResponsiveContainer } from 'recharts';

import { useTheme } from '../../../components/theme-provider';

import type { BalanceViewModel, CategoryViewModel, OverviewViewModel } from './aggregation/types';
import { BalanceChart } from './balance-chart';
import { CategoryChart } from './category-chart';
import { OverviewChart } from './overview-chart';

export default function ChartSurface({
  label,
  balance,
  category,
  overview,
}: {
  label: string;
  balance?: {
    model: BalanceViewModel;
    variant: 'line' | 'area';
    currency: string;
  };
  category?: {
    model: CategoryViewModel;
    variant: 'pie' | 'bar' | 'radial';
    currency: string;
  };
  overview?: {
    model: OverviewViewModel;
    currency: string;
  };
}) {
  const { mode: theme } = useTheme();
  if (balance) return <BalanceChart {...balance} theme={theme} />;
  if (category) return <CategoryChart {...category} />;
  if (overview) return <OverviewChart {...overview} />;

  return (
    <div className="graphChartCanvas" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[]} accessibilityLayer />
      </ResponsiveContainer>
      <span className="graphZeroLine" aria-hidden="true" />
    </div>
  );
}
