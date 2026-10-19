import type { HouseholdTransaction } from '@monthloom/contracts';
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
} satisfies HouseholdTransaction['user'];
const shop = { id: 'shop', displayName: 'Grocer', key: 'grocer', aliases: ['Grocer'] };
const work = { id: 'work', displayName: 'Employer', key: 'employer', aliases: ['Employer'] };
const transactions: HouseholdTransaction[] = [
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
    type: 'income',
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

function mockDashboard(currency = 'EUR', monthTransactions = transactions) {
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
        transactions: monthTransactions,
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

  it('only shows total savings when the selected month has savings transactions', async () => {
    mockDashboard();
    const { unmount } = renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    expect(screen.queryByText('Total savings')).not.toBeInTheDocument();
    unmount();

    mockDashboard('EUR', [
      ...transactions,
      {
        ...transactions[0]!,
        id: 'savings',
        type: 'savings',
        amount: '25.00',
      },
    ]);
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    expect(screen.getByText('Total savings').nextElementSibling).toHaveTextContent('25.00');
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
    await waitFor(() =>
      expect(new URL(window.location.href).searchParams.get('household')).toBe('second-home'),
    );
    expect(new URL(window.location.href).searchParams.get('month')).toMatch(/^\d{4}-\d{2}$/);
    expect(screen.queryByRole('button', { name: 'Make default' })).not.toBeInTheDocument();
  });

  it('shows abbreviated months and moves between them with arrow buttons', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });

    const selector = screen.getByRole('combobox', { name: 'Month' });
    const startingIndex = (selector as HTMLSelectElement).selectedIndex;
    expect(selector).toHaveDisplayValue(/^[A-Z][a-z]{2} '\d{2} \(current\)$/);
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveTextContent('←');
    expect(screen.getByRole('button', { name: 'Next month' })).toHaveTextContent('→');

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement).selectedIndex,
      ).toBe(startingIndex - 1),
    );
    const updatedSelector = screen.getByRole('combobox', { name: 'Month' });
    expect(new URL(window.location.href).searchParams.get('month')).toBe(
      (updatedSelector as HTMLSelectElement).value,
    );
  });

  it('shows latest transactions first, sorts by signed amount, and filters expenses', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Date↓', '', '', 'Amount↕', 'Source↕', 'Type↕', 'User↕', '']);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Grocer');
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

  it('shows distinct recurring indicators between the date and transaction icon', async () => {
    mockDashboard('EUR', [
      { ...transactions[0]!, recurring: true },
      { ...transactions[1]!, recurring: true, expiresOn: '2026-12-31' },
      { ...transactions[0]!, id: 'one-off', date: '2026-01-03' },
    ]);
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });

    const table = screen.getByRole('table');
    const recurring = within(table).getByRole('img', { name: 'Recurring indefinitely' });
    const expiring = within(table).getByRole('img', { name: 'Recurring until 2026-12-31' });
    expect(recurring.querySelector('.transactionRecurringEndpoint')).toBeNull();
    expect(expiring.querySelector('.transactionRecurringEndpoint')).toBeInTheDocument();

    for (const indicator of [recurring, expiring]) {
      const cells = within(indicator.closest('tr')!).getAllByRole('cell');
      expect(cells[1]).toContainElement(indicator);
      expect(cells[2]?.querySelector('.transactionIcon')).toBeInTheDocument();
    }

    const oneOffRow = table.querySelector('time[datetime="2026-01-03"]')!.closest('tr')!;
    expect(within(oneOffRow).queryByLabelText(/^Recurring/)).not.toBeInTheDocument();
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
