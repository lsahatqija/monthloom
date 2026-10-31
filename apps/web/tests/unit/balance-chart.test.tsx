import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../messages/en.json';
import type { BalanceViewModel } from '../../src/features/finance/graph/aggregation/types';
import { BalanceChart } from '../../src/features/finance/graph/balance-chart';

vi.mock('recharts', () => {
  function Container({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  function ChartContainer({ children, data }: { children: ReactNode; data?: unknown }) {
    return (
      <svg>
        <metadata data-testid="chart-data">{JSON.stringify(data)}</metadata>
        {children}
      </svg>
    );
  }

  function Series({
    dataKey,
    strokeDasharray,
    dot,
  }: {
    dataKey: string;
    strokeDasharray?: string;
    dot?:
      | false
      | ((props: {
          cx: number;
          cy: number;
          payload: Record<string, number | boolean>;
        }) => ReactNode);
  }) {
    return (
      <g data-testid="chart-series" data-key={dataKey} data-dash={strokeDasharray ?? 'solid'}>
        {typeof dot === 'function'
          ? dot({
              cx: 10,
              cy: 10,
              payload: { [`${dataKey.replace('Total', '')}HasProjection`]: true },
            })
          : null}
      </g>
    );
  }

  return {
    Area: Series,
    AreaChart: ChartContainer,
    CartesianGrid: () => null,
    Line: Series,
    LineChart: ChartContainer,
    ReferenceLine: ({ label }: { label: { value: string } }) => (
      <text data-testid="zero-line">{label.value}</text>
    ),
    ResponsiveContainer: Container,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const model: BalanceViewModel = {
  mode: 'daily',
  domain: [-12500, 12500],
  points: [
    {
      date: '2026-10-01',
      anchor: false,
      income: { realizedCents: 10000, projectedCents: 2500, totalCents: 12500 },
      expenses: { realizedCents: -4000, projectedCents: -1000, totalCents: -5000 },
      balance: { realizedCents: 6000, projectedCents: 1500, totalCents: 7500 },
    },
  ],
};

function renderChart(props: Partial<ComponentProps<typeof BalanceChart>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BalanceChart model={model} variant="line" currency="EUR" {...props} />
    </NextIntlClientProvider>,
  );
}

describe('BalanceChart', () => {
  it('renders solid realized and dashed total line series around a labeled zero line', () => {
    renderChart();

    const series = screen.getAllByTestId('chart-series');
    expect(series).toHaveLength(6);
    expect(series.filter((item) => item.dataset.dash === 'solid')).toHaveLength(3);
    expect(series.filter((item) => item.dataset.dash !== 'solid')).toHaveLength(3);
    expect(series.map((item) => item.dataset.key)).toEqual([
      'incomeTotal',
      'expensesTotal',
      'balanceTotal',
      'incomeRealized',
      'expensesRealized',
      'balanceRealized',
    ]);
    expect(screen.getByTestId('zero-line')).toHaveTextContent('Zero');
    expect(screen.getByLabelText('Balance line chart')).toBeVisible();
  });

  it('renders realized and patterned projected area layers', () => {
    renderChart({ variant: 'area' });

    const series = screen.getAllByTestId('chart-series');
    expect(series).toHaveLength(2);
    expect(series.map((item) => item.dataset.key)).toEqual(['balanceTotal', 'balanceRealized']);
    expect(series[0]).toHaveAttribute('data-dash', '7 5');
    expect(series[1]).toHaveAttribute('data-dash', 'solid');
    expect(document.querySelector('#balance-area-fill stop:nth-child(2)')).toHaveAttribute(
      'offset',
      '100%',
    );
  });

  it('provides localized totals and an exact realized/projected data table', () => {
    renderChart();

    expect(screen.getByText(/Income €125\.00/)).toBeVisible();
    expect(screen.getByText(/expenses -€50\.00/)).toBeVisible();
    expect(screen.getByText(/net balance €75\.00/)).toBeVisible();

    const disclosure = screen.getByText('Show data table');
    expect(disclosure).toBeVisible();
    fireEvent.click(disclosure);
    const table = screen.getByRole('table', { name: 'Exact balance values' });
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getByText('Oct 1')).toBeVisible();
    expect(within(row).getByText('€100.00')).toBeVisible();
    expect(within(row).getAllByText('€25.00')).toHaveLength(1);
    expect(within(row).getByText('-€40.00')).toBeVisible();
    expect(within(row).getByText('-€10.00')).toBeVisible();
  });

  it('marks only dates where a cumulative projection changes', () => {
    const first = model.points[0]!;
    const zero = { realizedCents: 0, projectedCents: 0, totalCents: 0 };
    renderChart({
      model: {
        ...model,
        mode: 'cumulative',
        points: [
          { ...first, anchor: true, income: zero, expenses: zero, balance: zero },
          first,
          { ...first, date: '2026-10-02' },
        ],
      },
    });

    const data = JSON.parse(screen.getByTestId('chart-data').textContent ?? '[]') as Array<{
      incomeHasProjection: boolean;
      expensesHasProjection: boolean;
      balanceHasProjection: boolean;
    }>;
    expect(data.map(({ incomeHasProjection }) => incomeHasProjection)).toEqual([
      false,
      true,
      false,
    ]);
    expect(data.map(({ expensesHasProjection }) => expensesHasProjection)).toEqual([
      false,
      true,
      false,
    ]);
    expect(data.map(({ balanceHasProjection }) => balanceHasProjection)).toEqual([
      false,
      true,
      false,
    ]);
  });
});
