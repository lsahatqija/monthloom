import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphView } from '../../src/features/finance/graph/graph-view';
import { renderWithQuery } from '../render';

vi.mock('../../src/features/finance/graph/chart-surface', () => ({
  default: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
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

describe('Graph view', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('falls back before querying an inaccessible household and writes controls to the URL', async () => {
    window.history.replaceState({}, '', '/graph?household=missing&period=current-month');
    const fetch = mockGraph();
    renderWithQuery(<GraphView />);

    expect(await screen.findByRole('heading', { name: 'Balance' })).toBeVisible();
    const paths = vi.mocked(fetch).mock.calls.map(([input]) => new URL(String(input)).pathname);
    expect(paths).toContain(`/api/v1/households/${household.id}/transactions`);
    expect(paths).not.toContain('/api/v1/households/missing/transactions');

    await userEvent.selectOptions(screen.getByLabelText('Graph'), 'category');
    expect(new URL(window.location.href).searchParams.get('graph')).toBe('category');
    expect(screen.getByRole('group', { name: 'Group by' })).toBeVisible();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Group by' })).getByText('Source'),
    );
    expect(new URL(window.location.href).searchParams.get('group')).toBe('source');
  });

  it('shows accessible validation for an inverted custom period', async () => {
    window.history.replaceState({}, '', '/graph?period=current-month');
    mockGraph();
    renderWithQuery(<GraphView />);
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
    const { unmount } = renderWithQuery(<GraphView />);
    expect(
      await screen.findByRole('heading', { name: 'No activity in this period' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Period')).toBeVisible();
    unmount();

    mockGraph({ failRange: true });
    renderWithQuery(<GraphView />);
    expect(await screen.findByRole('heading', { name: 'Graph data unavailable' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.getByLabelText('Graph')).toBeVisible();
  });

  it('links first-run users to household settings', async () => {
    mockGraph({ households: [] });
    renderWithQuery(<GraphView />);
    expect(await screen.findByRole('heading', { name: 'No households yet' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open household settings' })).toHaveAttribute(
      'href',
      '/settings/households',
    );
  });
});
