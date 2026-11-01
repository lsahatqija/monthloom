import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../messages/en.json';
import type { OverviewViewModel } from '../../src/features/finance/graph/aggregation/types';
import { OverviewChart } from '../../src/features/finance/graph/overview-chart';

vi.mock('recharts', () => ({
  PolarAngleAxis: ({
    tickFormatter,
  }: {
    tickFormatter: (value: string, index: number) => string;
  }) => (
    <g data-testid="overview-axis" data-samples-labels={tickFormatter('Dimension', 13) === ''} />
  ),
  PolarGrid: ({ gridType, strokeDasharray }: { gridType?: string; strokeDasharray?: string }) => (
    <g
      data-testid="overview-grid"
      data-dash={strokeDasharray ?? 'solid'}
      data-grid-type={gridType}
    />
  ),
  PolarRadiusAxis: ({ ticks, tickFormatter }: Record<string, unknown>) => {
    const values = ticks as number[];
    const formatter = tickFormatter as (value: number) => string;
    return (
      <g
        data-testid="overview-scale"
        data-ticks={JSON.stringify(values)}
        data-labels={values.map(formatter).join('|')}
      />
    );
  },
  Radar: ({
    dataKey,
    fill,
    fillOpacity,
    isAnimationActive,
    strokeDasharray,
  }: Record<string, string | number | boolean>) => (
    <path
      data-testid="overview-series"
      data-key={dataKey}
      data-fill={fill}
      data-opacity={fillOpacity}
      data-dash={strokeDasharray ?? 'solid'}
      data-animated={String(isAnimationActive)}
    />
  ),
  RadarChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => (
    <svg data-testid="overview-chart" data-count={data.length}>
      {children}
    </svg>
  ),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
}));

const model: OverviewViewModel = {
  dimensions: [
    { key: 'groceries', label: 'Groceries' },
    { key: 'travel', label: 'Travel' },
  ],
  selectedUserIds: ['ada', 'ben'],
  highestAmountCents: 12000,
  series: [
    {
      key: 'ada',
      label: 'Ada',
      color: '#245f73',
      pattern: 'diagonal',
      values: [
        {
          dimensionKey: 'groceries',
          realizedCents: 10000,
          projectedCents: 2000,
          totalCents: 12000,
          realizedNormalized: 0.98,
          totalNormalized: 1,
        },
        {
          dimensionKey: 'travel',
          realizedCents: 0,
          projectedCents: 1000,
          totalCents: 1000,
          realizedNormalized: 0,
          totalNormalized: 0.74,
        },
      ],
    },
    {
      key: 'ben',
      label: 'Ben',
      color: '#dc2626',
      pattern: 'dots',
      values: [
        {
          dimensionKey: 'groceries',
          realizedCents: 3000,
          projectedCents: 0,
          totalCents: 3000,
          realizedNormalized: 0.84,
          totalNormalized: 0.84,
        },
        {
          dimensionKey: 'travel',
          realizedCents: 2000,
          projectedCents: 0,
          totalCents: 2000,
          realizedNormalized: 0.8,
          totalNormalized: 0.8,
        },
      ],
    },
  ],
};

function renderChart(value = model) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OverviewChart model={value} currency="EUR" />
    </NextIntlClientProvider>,
  );
}

describe('OverviewChart', () => {
  it('renders realized polygons and projected-total outlines for every user on one scale', () => {
    renderChart();

    const series = screen.getAllByTestId('overview-series');
    expect(series.map((item) => item.dataset.key)).toEqual([
      'ada-realized',
      'ada-total',
      'ben-realized',
      'ben-total',
    ]);
    expect(series.filter((item) => item.dataset.dash !== 'solid')).toHaveLength(2);
    expect(series.filter((item) => item.dataset.fill?.startsWith('url('))).toHaveLength(2);
    expect(series.every((item) => item.dataset.animated === 'true')).toBe(true);
    expect(screen.getByLabelText('Household overview radar chart')).toBeVisible();
  });

  it('shows dotted polygon graduations at whole currency values', () => {
    renderChart();

    expect(screen.getByTestId('overview-grid')).toBeVisible();
    expect(screen.getByTestId('overview-grid')).toHaveAttribute('data-dash', '2 4');
    expect(screen.getByTestId('overview-grid')).toHaveAttribute('data-grid-type', 'polygon');
    expect(screen.getByTestId('overview-scale')).toHaveAttribute(
      'data-labels',
      '€10.00|€50.00|€100.00|€120.00',
    );
    const ticks = JSON.parse(screen.getByTestId('overview-scale').dataset.ticks ?? '[]');
    expect(ticks).toHaveLength(4);
    expect(ticks[0]).toBeCloseTo(Math.sqrt(1 / 12), 8);
    expect(ticks[3]).toBe(1);
  });

  it('shows explicit users, raw totals, projection values, and the exact-value table', () => {
    renderChart();

    expect(screen.getByText(/Focus the chart/)).toHaveClass('srOnly');
    expect(screen.getByText(/€180\.00 across 2 dimensions for 2 users/)).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(screen.getByText(/€180\.00 across 2 dimensions for 2 users/)).toBeVisible();
    const legend = screen.getByRole('list', { name: 'Overview legend' });
    expect(within(legend).getByText('Ada')).toBeVisible();
    expect(within(legend).getByText(/Total: €130\.00/)).toBeVisible();
    expect(within(legend).getByText(/Projected: €30\.00/)).toBeVisible();

    fireEvent.click(screen.getByText('Show data table'));
    const table = screen.getByRole('table', { name: 'Exact overview values' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Groceries')).toBeVisible();
    expect(within(table).getByText('€120.00')).toBeVisible();
  });

  it('keeps every dense dimension while sampling visual axis labels', () => {
    const dimensions = Array.from({ length: 30 }, (_, index) => ({
      key: `dimension-${index}`,
      label: `Dimension ${index}`,
    }));
    renderChart({
      ...model,
      dimensions,
      series: model.series.map((series) => ({
        ...series,
        values: dimensions.map((dimension) => ({
          dimensionKey: dimension.key,
          realizedCents: 100,
          projectedCents: 0,
          totalCents: 100,
          realizedNormalized: 1,
          totalNormalized: 1,
        })),
      })),
    });

    expect(screen.getByTestId('overview-chart')).toHaveAttribute('data-count', '30');
    expect(screen.getByTestId('overview-axis')).toHaveAttribute('data-samples-labels', 'true');
    fireEvent.click(screen.getByText('Show data table'));
    expect(screen.getByRole('table')).toHaveTextContent('Dimension 29');
  });
});
