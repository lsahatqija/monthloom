import type { HouseholdTransaction } from '@monthloom/contracts';
import { describe, expect, it } from 'vitest';

import {
  emptyTransactionFilters,
  filterAndSortTransactions,
  isUpcomingRecurringTransaction,
  summarizeTransactions,
} from '../../src/features/finance/dashboard/transaction-view';

function transaction(
  id: string,
  kind: HouseholdTransaction['kind'],
  amount: string,
  overrides: Partial<HouseholdTransaction> = {},
): HouseholdTransaction {
  return {
    id,
    kind,
    type: kind === 'expense' ? 'other' : null,
    amount,
    date: '2026-01-01',
    icon: 'wallet',
    color: '#123456',
    recurring: false,
    expiresOn: null,
    projected: false,
    user: {
      id: 'user',
      displayName: 'User',
      profileImage: 'braided-border',
      desiredColor: 'green',
    },
    source: { id: 'source', displayName: 'Source', key: 'source', aliases: ['Source'] },
    ...overrides,
  };
}

describe('transaction view', () => {
  it('filters before sorting signed amounts', () => {
    const entries = [
      transaction('income', 'income', '10.00'),
      transaction('small-expense', 'expense', '2.00'),
      transaction('large-expense', 'expense', '20.00'),
    ];
    const filters = { ...emptyTransactionFilters, type: 'expense' };
    expect(
      filterAndSortTransactions(entries, filters, 'amount', 'ascending').map(({ id }) => id),
    ).toEqual(['large-expense', 'small-expense']);
  });

  it('calculates filtered totals without changing the server summary', () => {
    const summary = summarizeTransactions([
      transaction('income', 'income', '0.30'),
      transaction('expense', 'expense', '0.40'),
    ]);
    expect(summary.income).toBe(0.3);
    expect(summary.expenses).toBe(0.4);
    expect(summary.balance).toBeCloseTo(-0.1);
  });

  it('identifies only upcoming recurring transactions in the current month', () => {
    const today = new Date(2026, 9, 17, 12);
    const upcoming = transaction('upcoming', 'expense', '20.00', {
      recurring: true,
      date: '2026-10-18',
    });

    expect(isUpcomingRecurringTransaction(upcoming, '2026-10', today)).toBe(true);
    expect(
      isUpcomingRecurringTransaction({ ...upcoming, recurring: false }, '2026-10', today),
    ).toBe(false);
    expect(
      isUpcomingRecurringTransaction({ ...upcoming, date: '2026-10-17' }, '2026-10', today),
    ).toBe(false);
    expect(isUpcomingRecurringTransaction(upcoming, '2026-11', today)).toBe(false);
  });
});
