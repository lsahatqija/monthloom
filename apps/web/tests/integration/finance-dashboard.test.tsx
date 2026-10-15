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

function mockDashboard(currency = 'EUR') {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/households') return Response.json({ households: [household] });
    if (url.pathname === '/api/v1/households/home/month')
      return Response.json({
        household: { ...household, currency },
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
  it.each([
    ['EUR', '€'],
    ['USD', '$'],
    ['JPY', '¥'],
    ['GBP', '£'],
  ])('displays the household currency %s in transactions and totals', async (currency, symbol) => {
    mockDashboard(currency);
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    expect(screen.getByRole('table')).toHaveTextContent(symbol!);
    expect(screen.getByText('Total income').nextElementSibling).toHaveTextContent(symbol!);
  });

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

  it('shows a household name for one household and a selector for multiple households', async () => {
    mockDashboard();
    const { unmount } = renderWithQuery(<HouseholdDashboard />);
    expect(await screen.findByRole('heading', { name: 'Our Home' })).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Household' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit household name' })).not.toBeInTheDocument();
    unmount();

    const secondHousehold = {
      id: 'second-home',
      name: 'Weekend Home',
      currency: 'EUR',
      isPrimary: false,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/v1/households') {
          return Response.json({ households: [household, secondHousehold] });
        }
        if (
          url.pathname === '/api/v1/households/home/month' ||
          url.pathname === '/api/v1/households/second-home/month'
        ) {
          const selected = url.pathname.includes('second-home') ? secondHousehold : household;
          return Response.json({
            household: selected,
            month: url.searchParams.get('month'),
            summary: { income: '100.00', expenses: '20.00', leftover: '80.00' },
            members: [member],
            sources: [shop, work],
            transactions,
          });
        }
        throw new Error(`Unexpected test request: ${url}`);
      }),
    );
    renderWithQuery(<HouseholdDashboard />);
    const selector = await screen.findByRole('combobox', { name: 'Household' });
    expect(within(selector).getAllByRole('option')).toHaveLength(2);
    await userEvent.selectOptions(selector, 'second-home');
    await waitFor(() => expect(selector).toHaveValue('second-home'));
    expect(screen.queryByRole('button', { name: 'Make default' })).not.toBeInTheDocument();
  });

  it('sorts by signed amount and filters expenses without changing monthly totals', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Date↑', '', 'Amount↕', 'Source↕', 'Type↕', 'User↕', '']);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Employer');
    await userEvent.click(screen.getByRole('button', { name: 'Amount' }));
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Grocer');
    await userEvent.click(screen.getByText('Filters', { exact: true }));
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'expense');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).queryByText('Employer')).not.toBeInTheDocument();
    expect(screen.getByText('Total income').nextElementSibling).toHaveTextContent('100.00');
    const filteredRecap = screen.getByRole('group', { name: 'Filtered recap' });
    expect(within(filteredRecap).getByText('Filtered income').nextElementSibling).toHaveTextContent(
      '0.00',
    );
    expect(
      within(filteredRecap).getByText('Filtered expenses').nextElementSibling,
    ).toHaveTextContent('20.00');
    expect(
      within(filteredRecap).getByText('Filtered balance').nextElementSibling,
    ).toHaveTextContent(/-.*20\.00/);

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.queryByRole('group', { name: 'Filtered recap' })).not.toBeInTheDocument();
  });

  it('confirms transaction removal before making the DELETE request', async () => {
    const fetch = mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    await userEvent.click(screen.getByLabelText('Actions for Employer'));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('alertdialog');
    expect(fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/transactions/income?scope=current'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('closes a transaction menu after selecting Edit or clicking elsewhere', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });

    const actions = screen.getByLabelText('Actions for Employer');
    const menu = actions.closest('details')!;
    await userEvent.click(actions);
    expect(menu).toHaveAttribute('open');
    expect(document.querySelector('.transactionMenuPopover')?.parentElement).toBe(document.body);

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(menu).not.toHaveAttribute('open');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(actions);
    expect(menu).toHaveAttribute('open');
    await userEvent.click(screen.getByRole('heading', { name: 'Activity' }));
    expect(menu).not.toHaveAttribute('open');
  });
});
