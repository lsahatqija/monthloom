import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HouseholdDashboard } from '../../src/features/finance/household-dashboard';
import { renderWithQuery } from '../render';

const household = { id: 'home', name: 'Our Home', currency: 'EUR', isPrimary: true };
const member = {
  id: 'user',
  displayName: 'Person',
  profileImage: 'diamond-kilim',
  desiredColor: 'indigo',
};
const shop = { id: 'shop', displayName: 'Grocer', key: 'grocer', aliases: ['Grocer'] };
const work = { id: 'work', displayName: 'Employer', key: 'employer', aliases: ['Employer'] };
const transactions = [
  {
    id: 'expense',
    kind: 'expense',
    type: 'groceries',
    date: '2026-01-02',
    amount: '20.00',
    icon: 'receipt',
    color: '#123456',
    recurring: false,
    projected: false,
    expiresOn: null,
    user: member,
    source: shop,
  },
  {
    id: 'income',
    kind: 'income',
    type: null,
    date: '2026-01-01',
    amount: '100.00',
    icon: 'banknote',
    color: '#123456',
    recurring: false,
    projected: false,
    expiresOn: null,
    user: member,
    source: work,
  },
];

function mockDashboard() {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/households') return Response.json({ households: [household] });
    if (url.pathname === '/api/v1/households/home/month')
      return Response.json({
        household,
        month: url.searchParams.get('month'),
        summary: { income: '100.00', expenses: '20.00', leftover: '80.00' },
        members: [member],
        sources: [shop, work],
        transactions,
      });
    if (options?.method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error(`Unexpected test request: ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('household dashboard', () => {
  it('shows an actionable empty state when no households exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ households: [] })));
    renderWithQuery(<HouseholdDashboard />);
    expect(await screen.findByRole('heading', { name: 'No households yet' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute(
      'href',
      '/settings/households',
    );
  });

  it('shows a recoverable error when loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderWithQuery(<HouseholdDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your households.',
    );
  });

  it('sorts by signed amount and filters expenses without changing monthly totals', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Employer');
    await userEvent.click(screen.getByRole('button', { name: 'Amount' }));
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Grocer');
    await userEvent.click(screen.getByText('Filters', { exact: true }));
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'expense');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).queryByText('Employer')).not.toBeInTheDocument();
    expect(screen.getByText('Total income').nextElementSibling).toHaveTextContent('100.00');
  });

  it('confirms transaction removal before making the DELETE request', async () => {
    const fetch = mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    await userEvent.click(screen.getByLabelText('Actions for Employer'));
    const incomeRow = screen.getByText('Employer', { selector: 'td' }).closest('tr')!;
    await userEvent.click(within(incomeRow).getByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('alertdialog');
    expect(fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/transactions/income?scope=current'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
