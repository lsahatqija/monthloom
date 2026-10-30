import type { HouseholdTransaction } from '@monthloom/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    expect(
      within(screen.getByLabelText('Monthly recap')).getByText('Income').nextElementSibling,
    ).toHaveTextContent(symbol!);
  });

  it('only shows total savings when the selected month has savings transactions', async () => {
    mockDashboard();
    const { unmount } = renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    expect(
      within(screen.getByLabelText('Monthly recap')).queryByText('Savings'),
    ).not.toBeInTheDocument();
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
    expect(
      within(screen.getByLabelText('Monthly recap')).getByText('Savings').nextElementSibling,
    ).toHaveTextContent('25.00');
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

  it('falls back before requesting a household that is not available to the user', async () => {
    window.history.replaceState({}, '', '/?household=missing&month=2026-01');
    const fetch = mockDashboard();
    renderWithQuery(<HouseholdDashboard />);

    await screen.findByRole('heading', { name: 'Our Home' });
    await waitFor(() =>
      expect(new URL(window.location.href).searchParams.get('household')).toBe('home'),
    );
    const requestedPaths = fetch.mock.calls.map(([input]) => new URL(String(input)).pathname);
    expect(requestedPaths).toContain('/api/v1/households/home/month');
    expect(requestedPaths).not.toContain('/api/v1/households/missing/month');
    window.history.replaceState({}, '', '/');
  });

  it('shows the month in the heading and preserves month navigation in browser history', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByText('Our Home');

    expect(screen.getByRole('button', { name: /Choose month/i })).toHaveTextContent(
      new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date()),
    );
    expect(
      screen.getByRole('button', { name: 'Previous month' }).querySelector('svg'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next month' }).querySelector('svg')).toBeTruthy();

    const startingMonth = new URL(window.location.href).searchParams.get('month');
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(new URL(window.location.href).searchParams.get('month')).not.toBe(startingMonth);
    expect(screen.getByRole('button', { name: 'Current month' })).toBeVisible();

    window.history.back();
    await waitFor(() =>
      expect(new URL(window.location.href).searchParams.get('month')).toBe(startingMonth),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Current month' })).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /Choose month/i }));
    expect(screen.getByRole('group', { name: 'Choose month' })).toBeVisible();
  });

  it('keeps the dashboard mounted while the next month loads', async () => {
    let monthRequest = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/v1/households') {
          return Response.json({ households: [household] });
        }
        if (url.pathname === '/api/v1/households/home/month') {
          monthRequest += 1;
          if (monthRequest > 1) return new Promise<Response>(() => undefined);
          return Response.json({
            household,
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
    await screen.findByRole('heading', { name: 'Our Home' });
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByRole('heading', { name: 'Our Home' })).toBeVisible();
    expect(screen.queryByText('Loading householdâ€¦')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Household dashboard' })).toHaveAttribute(
      'aria-busy',
      'true',
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
    ).toEqual(['', '', 'Date↓', 'Amount↕', 'Source↕', 'Type↕', 'User↕', '']);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Grocer');
    await userEvent.click(screen.getByRole('button', { name: 'Sort by Amount' }));
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Grocer');
    await userEvent.click(screen.getByText('Filters', { exact: true }));
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'expense');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).queryByText('Employer')).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Monthly recap')).getByText('Income').nextElementSibling,
    ).toHaveTextContent('100.00');
    const filteredRecap = screen.getByRole('group', { name: 'Filtered recap' });
    expect(within(filteredRecap).getByText('Filtered totals')).toBeVisible();
    expect(within(filteredRecap).getByText('Income').nextElementSibling).toHaveTextContent('0.00');
    expect(within(filteredRecap).getByText('Expenses').nextElementSibling).toHaveTextContent(
      /-.*20\.00/,
    );
    expect(within(filteredRecap).getByText('Balance').nextElementSibling).toHaveTextContent(
      /-.*20\.00/,
    );

    await userEvent.click(screen.getByText('Filters', { exact: true }));
    const activeFilters = screen.getByLabelText('Active filters');
    expect(
      within(activeFilters).getByRole('button', { name: 'Remove Expenses filter' }),
    ).toBeVisible();
    await userEvent.click(
      within(activeFilters).getByRole('button', { name: 'Remove Expenses filter' }),
    );
    expect(screen.queryByRole('group', { name: 'Filtered recap' })).not.toBeInTheDocument();
  });

  it('dismisses the mobile filter sheet with Escape and retains active filters', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });

    await userEvent.click(screen.getByText('Filters', { exact: true }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Close filters' })).toHaveFocus(),
    );
    const type = screen.getByLabelText('Type');
    await userEvent.selectOptions(type, 'expense');
    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('group', { name: 'Filtered recap' })).toBeInTheDocument();
    expect(screen.getByLabelText('Active filters')).toHaveTextContent('Expenses');
    expect(screen.getByText('Filters', { exact: true }).closest('details')).not.toHaveAttribute(
      'open',
    );
  });

  it('settles rapid filter toggles in the latest requested state', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    const trigger = screen.getByText('Filters', { exact: true });

    await userEvent.click(trigger);
    await userEvent.click(trigger);
    await userEvent.click(trigger);

    expect(trigger.closest('details')).toHaveAttribute('open');
    expect(screen.getByLabelText('Type')).toBeVisible();
    expect(screen.getByLabelText('Type').closest('[data-motion]')).toHaveAttribute(
      'data-motion',
      'entered',
    );
  });

  it('restores focus as a transaction dialog begins its exit', async () => {
    mockDashboard();
    const { container } = renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    const trigger = screen.getByRole('button', { name: 'Add transaction' });

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Add transaction' })).not.toBeInTheDocument();
    expect(container.querySelector('.transactionModalBackdrop')).toHaveAttribute('inert');
  });

  it('keeps reduced-motion exits brief and semantically hidden', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
      })),
    );
    mockDashboard();
    const { container } = renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    const trigger = screen.getByText('Filters', { exact: true });

    await userEvent.click(trigger);
    await userEvent.click(trigger);

    expect(container.querySelector('.transactionFilterDrawer')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await waitFor(
      () => expect(container.querySelector('.transactionFilterDrawer')).not.toBeVisible(),
      { timeout: 160 },
    );
  });

  it('filters with the accessible household-currency amount range', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });
    await userEvent.click(screen.getByText('Filters', { exact: true }));

    const amountRange = screen.getByRole('group', { name: 'Amount range in EUR' });
    fireEvent.change(within(amountRange).getByRole('slider', { name: 'Maximum amount in EUR' }), {
      target: { value: '50' },
    });

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(
      within(amountRange).getByRole('spinbutton', { name: 'Maximum amount in EUR' }),
    ).toHaveValue(50);
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
    const recurring = within(table).getByRole('img', { name: 'Every 1 month' });
    const expiring = within(table).getByRole('img', {
      name: 'Every 1 month, until Dec 31, 2026',
    });
    expect(recurring.querySelector('.transactionRecurringEndpoint')).toBeNull();
    expect(expiring.querySelector('.transactionRecurringEndpoint')).toBeInTheDocument();

    for (const indicator of [recurring, expiring]) {
      const cells = within(indicator.closest('tr')!).getAllByRole('cell');
      expect(cells[0]?.querySelector('.transactionIcon')).toBeInTheDocument();
      expect(cells[1]).toContainElement(indicator);
    }

    const oneOffRow = table.querySelector('time[datetime="2026-01-03"]')!.closest('tr')!;
    expect(within(oneOffRow).queryByLabelText(/^Every/)).not.toBeInTheDocument();
  });

  it('uses the responsive single-line transaction column contract', async () => {
    mockDashboard();
    renderWithQuery(<HouseholdDashboard />);
    await screen.findByRole('heading', { name: 'Our Home' });

    const row = within(screen.getByRole('table')).getAllByRole('row')[1]!;
    const cells = within(row).getAllByRole('cell');
    expect(cells.map((cell) => cell.className)).toEqual([
      'transactionIconColumn',
      'transactionRecurringColumn',
      'transactionDateColumn',
      expect.stringContaining('transactionAmountColumn'),
      'transactionSourceColumn',
      'transactionTypeColumn',
      'transactionUserColumn',
      'transactionActionsColumn',
    ]);
    expect(within(row).getByTitle('Grocer')).toHaveClass('transactionSourceName');
    expect(within(row).getByText('Person')).toHaveClass('transactionUserName');
    for (const label of ['Date', 'Amount', 'Source', 'Type', 'User']) {
      expect(
        screen.getByRole('button', { name: `Sort by ${label}` }).querySelector('svg'),
      ).toBeInTheDocument();
    }
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
