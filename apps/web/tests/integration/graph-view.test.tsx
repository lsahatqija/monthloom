import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../../src/components/theme-provider';
import type {
  BalanceViewModel,
  CategoryViewModel,
  OverviewViewModel,
} from '../../src/features/finance/graph/aggregation/types';
import { GraphView } from '../../src/features/finance/graph/graph-view';
import { renderWithQuery } from '../render';

vi.mock('../../src/features/finance/graph/chart-surface', () => ({
  default: ({
    label,
    balance,
    category,
    overview,
  }: {
    label: string;
    balance?: { model: BalanceViewModel; variant: string; currency: string };
    category?: { model: CategoryViewModel; variant: string; currency: string };
    overview?: { model: OverviewViewModel; currency: string };
  }) => (
    <div
      role="img"
      aria-label={label}
      data-variant={balance?.variant}
      data-mode={balance?.model.mode}
      data-currency={balance?.currency}
      data-category-variant={category?.variant}
      data-category-total={category?.model.totalCents}
      data-overview-dimensions={overview?.model.dimensions.length}
      data-overview-series={overview?.model.series.length}
      data-overview-currency={overview?.currency}
    />
  ),
}));

const household = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Our Home',
  currency: 'EUR',
  icon: 'small-house',
  color: '#123456',
  ownerId: '00000000-0000-4000-8000-000000000002',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  isPrimary: true,
  members: [],
};

const member = {
  id: '00000000-0000-4000-8000-000000000002',
  displayName: 'Ada',
  profileImage: 'diamond-kilim',
  desiredColor: 'blue',
};

const source = {
  id: '00000000-0000-4000-8000-000000000003',
  displayName: 'Market',
  key: 'market',
  aliases: ['Market'],
};

const transaction = {
  id: '00000000-0000-4000-8000-000000000004',
  kind: 'expense',
  type: 'groceries',
  date: '2026-10-02',
  icon: 'shopping-cart',
  color: '#123456',
  amount: '20.00',
  recurring: false,
  expiresOn: null,
  projected: false,
  user: member,
  source,
};

function mockGraph({
  transactions = [transaction],
  failRange = false,
  households = [household],
} = {}) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/households') return Response.json({ households });
    if (url.pathname === `/api/v1/households/${household.id}/transactions`) {
      if (failRange) return Response.json({ message: 'Unavailable' }, { status: 500 });
      return Response.json({
        household,
        from: url.searchParams.get('from'),
        to: url.searchParams.get('to'),
        members: [member],
        sources: [source],
        transactions,
      });
    }
    throw new Error(`Unexpected test request: ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function renderGraph() {
  return renderWithQuery(
    <ThemeProvider>
      <GraphView />
    </ThemeProvider>,
  );
}

describe('Graph view', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('falls back before querying an inaccessible household and writes controls to the URL', async () => {
    window.history.replaceState({}, '', '/graph?household=missing&period=current-month');
    const fetch = mockGraph();
    renderGraph();

    expect(await screen.findByRole('heading', { name: 'Balance' })).toBeVisible();
    const paths = vi.mocked(fetch).mock.calls.map(([input]) => new URL(String(input)).pathname);
    expect(paths).toContain(`/api/v1/households/${household.id}/transactions`);
    expect(paths).not.toContain('/api/v1/households/missing/transactions');
    const chart = screen.getByRole('img');
    expect(chart).toHaveAttribute('data-variant', 'line');
    expect(chart).toHaveAttribute('data-mode', 'daily');
    expect(chart).toHaveAttribute('data-currency', 'EUR');

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Chart type' })).getByText('Area'),
    );
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Calculation' })).getByText('Cumulative'),
    );
    expect(chart).toHaveAttribute('data-variant', 'area');
    expect(chart).toHaveAttribute('data-mode', 'cumulative');

    await userEvent.selectOptions(screen.getByLabelText('Graph'), 'category');
    expect(new URL(window.location.href).searchParams.get('graph')).toBe('category');
    expect(
      screen.queryByText('Exact realized and projected values will appear here with the chart.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Group by' })).toBeVisible();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Group by' })).getByText('Source'),
    );
    expect(new URL(window.location.href).searchParams.get('group')).toBe('source');
    expect(screen.getByRole('img')).toHaveAttribute('data-category-variant', 'pie');
    expect(screen.getByRole('img')).toHaveAttribute('data-category-total', '2000');
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Chart type' })).getByText('Radial bar'),
    );
    expect(screen.getByRole('img')).toHaveAttribute('data-category-variant', 'radial');

    await userEvent.selectOptions(screen.getByLabelText('Graph'), 'overview');
    expect(screen.getByRole('group', { name: 'Transaction kind' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'User presentation' })).toBeVisible();
    const ada = screen.getByRole('checkbox', { name: 'Ada' });
    expect(ada).toBeChecked();
    await userEvent.click(ada);
    expect(ada).toBeChecked();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'User presentation' })).getByText('Compare'),
    );
    expect(new URL(window.location.href).searchParams.get('usersMode')).toBe('compare');
    expect(screen.getByRole('img')).toHaveAttribute('data-overview-dimensions', '1');
    expect(screen.getByRole('img')).toHaveAttribute('data-overview-series', '1');
    expect(screen.getByRole('img')).toHaveAttribute('data-overview-currency', 'EUR');
  });

  it('shows accessible validation for an inverted custom period', async () => {
    window.history.replaceState({}, '', '/graph?period=current-month');
    mockGraph();
    renderGraph();
    await screen.findByRole('heading', { name: 'Balance' });

    await userEvent.selectOptions(screen.getByLabelText('Period'), 'custom-period');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-04' } });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The start month must not be after the end month.',
    );
  });

  it('keeps the control surface for empty periods and retryable errors', async () => {
    mockGraph({ transactions: [] });
    const { unmount } = renderGraph();
    expect(
      await screen.findByRole('heading', { name: 'No activity in this period' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Period')).toBeVisible();
    unmount();

    mockGraph({ failRange: true });
    renderGraph();
    expect(await screen.findByRole('heading', { name: 'Graph data unavailable' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.getByLabelText('Graph')).toBeVisible();
  });

  it('links first-run users to household settings', async () => {
    mockGraph({ households: [] });
    renderGraph();
    expect(await screen.findByRole('heading', { name: 'No households yet' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open household settings' })).toHaveAttribute(
      'href',
      '/settings/households',
    );
  });
});
