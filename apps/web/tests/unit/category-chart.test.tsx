import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '../../messages/en.json';
import type { CategoryViewModel } from '../../src/features/finance/graph/aggregation/types';
import { CategoryChart } from '../../src/features/finance/graph/category-chart';

vi.mock('recharts', () => {
  function Container({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  function Chart({ children, layout }: { children: ReactNode; layout?: string }) {
    return (
      <svg data-testid="category-chart" data-layout={layout ?? 'horizontal'}>
        {children}
      </svg>
    );
  }

  function Series({
    children,
    data,
    dataKey,
    isAnimationActive,
    stackId,
  }: {
    children?: ReactNode;
    data?: unknown[];
    dataKey: string;
    isAnimationActive?: boolean;
    stackId?: string;
  }) {
    return (
      <g
        data-testid="category-series"
        data-key={dataKey}
        data-stack={stackId}
        data-count={data?.length}
        data-animated={String(isAnimationActive)}
      >
        {children}
      </g>
    );
  }

  return {
    Bar: Series,
    BarChart: Chart,
    CartesianGrid: () => null,
    Cell: ({ fill, fillOpacity, strokeDasharray }: Record<string, string | number>) => (
      <path
        data-testid="category-cell"
        data-fill={fill}
        data-opacity={fillOpacity ?? 1}
        data-dash={strokeDasharray ?? 'solid'}
      />
    ),
    Pie: Series,
    PieChart: Chart,
    RadialBar: Series,
    RadialBarChart: Chart,
    ResponsiveContainer: Container,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const model: CategoryViewModel = {
  totalCents: 20000,
  groups: [
    {
      key: 'groceries',
      label: 'Groceries and household supplies',
      realizedCents: 10000,
      projectedCents: 2000,
      totalCents: 12000,
      percentage: 0.6,
      color: '#245f73',
      pattern: 'diagonal',
    },
    {
      key: 'travel',
      label: 'Travel',
      realizedCents: 5000,
      projectedCents: 3000,
      totalCents: 8000,
      percentage: 0.4,
      color: '#dc2626',
      pattern: 'dots',
    },
  ],
};

function renderChart(variant: 'pie' | 'bar' | 'radial' = 'pie', value: CategoryViewModel = model) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CategoryChart model={value} variant={variant} currency="EUR" />
    </NextIntlClientProvider>,
  );
}

describe('CategoryChart', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  it('renders every realized and projected value as adjacent pie slices', () => {
    renderChart('pie');

    expect(screen.getByTestId('category-series')).toHaveAttribute('data-count', '4');
    expect(screen.getAllByTestId('category-cell')).toHaveLength(4);
    expect(
      screen.getAllByTestId('category-cell').filter((cell) => cell.dataset.dash !== 'solid'),
    ).toHaveLength(2);
    expect(screen.getByLabelText('Category pie chart')).toBeVisible();
    expect(screen.getByTestId('category-series')).toHaveAttribute('data-animated', 'true');
    expect(document.querySelector('pattern')).toHaveAttribute('width', '16');
    expect(document.querySelector('pattern path')).toHaveAttribute(
      'transform',
      'translate(3 3) scale(0.65)',
    );
  });

  it.each(['bar', 'radial'] as const)(
    'stacks realized and projected portions in the %s chart',
    (variant) => {
      renderChart(variant);

      const series = screen.getAllByTestId('category-series');
      expect(series).toHaveLength(2);
      expect(series.map((item) => item.dataset.key)).toEqual(['realizedCents', 'projectedCents']);
      expect(series.every((item) => item.dataset.stack === 'category')).toBe(true);
      expect(screen.getAllByTestId('category-cell')).toHaveLength(4);
    },
  );

  it('disables entrance motion when reduced motion is requested', () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );

    renderChart('radial');
    expect(screen.getAllByTestId('category-series')[0]).toHaveAttribute('data-animated', 'false');
  });

  it('keeps colors primary while separating clashing patterns on adjacent categories', () => {
    renderChart('pie', {
      ...model,
      groups: model.groups.map((group) => ({ ...group, pattern: 'diagonal' })),
    });

    const swatches = document.querySelectorAll<HTMLElement>('.graphCategorySwatch');
    expect([...swatches].map(({ style }) => style.backgroundColor)).toEqual([
      'rgb(36, 95, 115)',
      'rgb(220, 38, 38)',
    ]);
    expect([...swatches].map(({ className }) => className)).toEqual([
      expect.stringContaining('graphCategoryPattern-diagonal'),
      expect.stringContaining('graphCategoryPattern-solid'),
    ]);
  });

  it('uses horizontal bars on narrow screens', () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    renderChart('bar');
    expect(screen.getByTestId('category-chart')).toHaveAttribute('data-layout', 'vertical');
  });

  it.each(['pie', 'bar', 'radial'] as const)(
    'shows identical totals and every exact category value in the %s chart',
    (variant) => {
      renderChart(variant);

      expect(screen.getByText(/Focus the chart/)).toHaveClass('srOnly');
      expect(screen.getByText(/€200\.00 across 2 categories/)).toHaveAttribute(
        'aria-live',
        'polite',
      );
      expect(screen.getByText(/€200\.00 across 2 categories/)).toBeVisible();
      const legend = screen.getByRole('list', { name: 'Category legend' });
      expect(within(legend).getByText('Groceries and household supplies')).toBeVisible();
      expect(within(legend).getByText('60%')).toBeVisible();
      expect(within(legend).getByText('€120.00')).toBeVisible();

      fireEvent.click(screen.getByText('Show data table'));
      const table = screen.getByRole('table', { name: 'Exact category values' });
      expect(within(table).getAllByRole('row')).toHaveLength(3);
      const firstRow = within(table).getAllByRole('row')[1]!;
      expect(within(firstRow).getByText('€100.00')).toBeVisible();
      expect(within(firstRow).getByText('€20.00')).toBeVisible();
      expect(within(firstRow).getByText('€120.00')).toBeVisible();
    },
  );
});
