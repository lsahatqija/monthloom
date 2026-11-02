import type { HouseholdTransaction } from '@monthloom/contracts';
import { describe, expect, it } from 'vitest';

import {
  emptyTransactionFilters,
  filterAndSortTransactions,
  includesLocaleText,
  isProjectedTransaction,
  summarizeTransactions,
  toggleFilterSelection,
} from '../../src/features/finance/dashboard/transaction-view';
import { monthLabel } from '../../src/features/finance/transaction-form';

function transaction(
  id: string,
  kind: HouseholdTransaction['kind'],
  amount: string,
  overrides: Partial<HouseholdTransaction> = {},
): HouseholdTransaction {
  return {
    id,
    kind,
    type: kind === 'expense' ? 'other' : 'income',
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
    const filters = { ...emptyTransactionFilters, types: ['expense'] };
    expect(
      filterAndSortTransactions(entries, filters, 'amount', 'ascending', 'en').map(({ id }) => id),
    ).toEqual(['large-expense', 'small-expense']);
  });

  it('combines toggle-list selections and normalizes a complete selection to all', () => {
    const options = ['income', 'expense:groceries', 'expense:savings'];

    expect(toggleFilterSelection(['all'], 'expense:savings', options)).toEqual([
      'income',
      'expense:groceries',
    ]);
    expect(toggleFilterSelection([], 'income', options)).toEqual(['income']);
    expect(
      toggleFilterSelection(['income', 'expense:groceries'], 'expense:savings', options),
    ).toEqual(['all']);
  });

  it('matches any selected type, source, or user and lets an empty selection match none', () => {
    const entries = [
      transaction('income', 'income', '10.00'),
      transaction('groceries', 'expense', '20.00', { type: 'groceries' }),
      transaction('savings', 'expense', '30.00', {
        type: 'savings',
        source: { id: 'bank', displayName: 'Bank', key: 'bank', aliases: ['Bank'] },
      }),
    ];

    expect(
      filterAndSortTransactions(
        entries,
        { ...emptyTransactionFilters, types: ['income', 'expense:groceries'] },
        'date',
        'descending',
        'en',
      ).map(({ id }) => id),
    ).toEqual(['groceries', 'income']);
    expect(
      filterAndSortTransactions(
        entries,
        { ...emptyTransactionFilters, sourceIds: [] },
        'date',
        'descending',
        'en',
      ),
    ).toEqual([]);
  });

  it('sorts dates in reverse chronological order', () => {
    const entries = [
      transaction('oldest', 'expense', '10.00', { date: '2026-01-02' }),
      transaction('latest', 'expense', '10.00', { date: '2026-01-20' }),
      transaction('middle', 'expense', '10.00', { date: '2026-01-11' }),
    ];

    expect(
      filterAndSortTransactions(entries, emptyTransactionFilters, 'date', 'descending', 'en').map(
        ({ id }) => id,
      ),
    ).toEqual(['latest', 'middle', 'oldest']);
  });

  it('excludes future recurring and non-recurring transactions when projections are hidden', () => {
    const entries = [
      transaction('realized', 'expense', '10.00', { date: '2026-10-17', projected: true }),
      transaction('future-one-off', 'expense', '20.00', { date: '2026-10-18' }),
      transaction('future-recurring', 'expense', '30.00', {
        date: '2026-10-19',
        recurring: true,
      }),
    ];

    expect(
      filterAndSortTransactions(
        entries,
        emptyTransactionFilters,
        'date',
        'descending',
        'en',
        undefined,
        false,
        new Date(2026, 9, 17, 12),
      ).map(({ id }) => id),
    ).toEqual(['realized']);
  });

  it('sorts displayed names with Turkish collation', () => {
    const entries = [
      transaction('dotted', 'expense', '10.00', {
        user: { ...transaction('base', 'expense', '1').user, displayName: 'İpek' },
      }),
      transaction('dotless', 'expense', '10.00', {
        user: { ...transaction('base', 'expense', '1').user, displayName: 'Işık' },
      }),
    ];

    expect(
      filterAndSortTransactions(entries, emptyTransactionFilters, 'user', 'ascending', 'tr').map(
        ({ id }) => id,
      ),
    ).toEqual(['dotless', 'dotted']);
  });

  it('uses the selected locale for Turkish search case-folding', () => {
    expect(includesLocaleText('İstanbul', 'istanbul', 'tr')).toBe(true);
    expect(includesLocaleText('İstanbul', 'istanbul', 'en')).toBe(false);
  });

  it('formats month labels with the selected locale', () => {
    expect(monthLabel('2026-03', 'en')).toBe('March 2026');
    expect(monthLabel('2026-03', 'fr')).toBe('mars 2026');
    expect(monthLabel('2026-03', 'tr')).toBe('Mart 2026');
  });

  it('calculates filtered totals without changing the server summary', () => {
    const summary = summarizeTransactions([
      transaction('income', 'income', '0.30'),
      transaction('expense', 'expense', '0.40'),
      transaction('savings', 'expense', '0.20', { type: 'savings' }),
    ]);
    expect(summary.income).toBe(0.3);
    expect(summary.expenses).toBeCloseTo(0.6);
    expect(summary.savings).toBe(0.2);
    expect(summary.balance).toBeCloseTo(-0.3);
  });

  it('identifies every future transaction as projected regardless of recurrence', () => {
    const today = new Date(2026, 9, 17, 12);
    const upcoming = transaction('upcoming', 'expense', '20.00', {
      recurring: true,
      date: '2026-10-18',
    });

    expect(isProjectedTransaction(upcoming, today)).toBe(true);
    expect(isProjectedTransaction({ ...upcoming, recurring: false }, today)).toBe(true);
    expect(isProjectedTransaction({ ...upcoming, date: '2026-10-17' }, today)).toBe(false);
    expect(isProjectedTransaction({ ...upcoming, date: '2026-10-16' }, today)).toBe(false);
  });
});
