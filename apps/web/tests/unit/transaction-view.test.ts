import type { HouseholdTransaction } from '@monthloom/contracts';
import { describe, expect, it } from 'vitest';

import {
  emptyTransactionFilters,
  filterAndSortTransactions,
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
    user: { id: 'user', displayName: 'User', profileImage: 'braided-border', desiredColor: 'green' },
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
    expect(filterAndSortTransactions(entries, filters, 'amount', 'ascending').map(({ id }) => id)).toEqual([
      'large-expense',
      'small-expense',
    ]);
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
});
