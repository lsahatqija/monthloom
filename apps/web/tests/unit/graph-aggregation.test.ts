import type { HouseholdTransaction, HouseholdTransactionRangeResponse } from '@monthloom/contracts';
import { describe, expect, it } from 'vitest';

import { aggregateBalance } from '../../src/features/finance/graph/aggregation/balance';
import { aggregateCategories } from '../../src/features/finance/graph/aggregation/category';
import { chartStyleForKey } from '../../src/features/finance/graph/aggregation/colors';
import {
  aggregateOverview,
  normalizeSelectedUserIds,
} from '../../src/features/finance/graph/aggregation/overview';
import {
  formatCurrency,
  formatDayLabel,
  formatMonthLabel,
  formatPercentage,
} from '../../src/features/finance/graph/formatters';

type HouseholdMember = HouseholdTransactionRangeResponse['members'][number];

const USERS = {
  ada: {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: 'Ada',
    profileImage: 'diamond-kilim',
    desiredColor: 'blue',
  },
  ben: {
    id: '00000000-0000-4000-8000-000000000002',
    displayName: 'Ben',
    profileImage: 'wave-stripe',
    desiredColor: 'orange',
  },
} as const satisfies Record<string, HouseholdMember>;

const SOURCES = {
  bank: {
    id: '00000000-0000-4000-8000-000000000011',
    displayName: 'Bank',
    key: 'bank',
    aliases: ['Bank'],
  },
  cash: {
    id: '00000000-0000-4000-8000-000000000012',
    displayName: 'Cash',
    key: 'cash',
    aliases: ['Cash'],
  },
};

let sequence = 20;
function transaction(
  amount: string,
  options: Partial<HouseholdTransaction> = {},
): HouseholdTransaction {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    kind: 'expense',
    type: 'groceries',
    date: '2026-01-02',
    icon: 'shopping-cart',
    color: '#123456',
    amount,
    recurring: false,
    expiresOn: null,
    projected: false,
    user: USERS.ada,
    source: SOURCES.bank,
    ...options,
  };
}

describe('balance aggregation', () => {
  it('fills zero days and splits positive income from negative expenses and projections', () => {
    const result = aggregateBalance({
      from: '2026-01-01',
      to: '2026-01-03',
      mode: 'daily',
      transactions: [
        transaction('10.25', { kind: 'income', type: 'income', date: '2026-01-01' }),
        transaction('4.25', { date: '2026-01-01' }),
        transaction('2.00', { date: '2026-01-03', projected: true }),
        transaction('999', { date: '2025-12-31' }),
      ],
    });

    expect(result.points).toHaveLength(3);
    expect(result.points[0]).toMatchObject({
      date: '2026-01-01',
      income: { realizedCents: 1025, projectedCents: 0, totalCents: 1025 },
      expenses: { realizedCents: -425, projectedCents: 0, totalCents: -425 },
      balance: { realizedCents: 600, projectedCents: 0, totalCents: 600 },
    });
    expect(result.points[1]!.balance.totalCents).toBe(0);
    expect(result.points[2]!.balance).toEqual({
      realizedCents: 0,
      projectedCents: -200,
      totalCents: -200,
    });
    expect(result.domain).toEqual([-1025, 1025]);
  });

  it('starts cumulative values at zero and ignores transactions before the range', () => {
    const result = aggregateBalance({
      from: '2026-01-01',
      to: '2026-01-02',
      mode: 'cumulative',
      transactions: [
        transaction('50', { kind: 'income', type: 'income', date: '2025-12-31' }),
        transaction('10', { kind: 'income', type: 'income', date: '2026-01-01' }),
        transaction('15', { date: '2026-01-02' }),
      ],
    });

    expect(result.points[0]).toMatchObject({ anchor: true, balance: { totalCents: 0 } });
    expect(result.points.slice(1).map((point) => point.balance.totalCents)).toEqual([1000, -500]);
    expect(result.points[2]!.expenses.totalCents).toBe(-1500);
  });

  it('returns a zero domain for an empty range', () => {
    const result = aggregateBalance({
      from: '2024-02-28',
      to: '2024-02-29',
      mode: 'daily',
      transactions: [],
    });
    expect(result.points.map((point) => point.date)).toEqual(['2024-02-28', '2024-02-29']);
    expect(result.domain).toEqual([-0, 0]);
  });
});

describe('category aggregation', () => {
  const expenses = [
    transaction('10', { user: USERS.ada, source: SOURCES.bank, type: 'groceries' }),
    transaction('5', {
      user: USERS.ada,
      source: SOURCES.bank,
      type: 'groceries',
      projected: true,
    }),
    transaction('15', { user: USERS.ben, source: SOURCES.cash, type: 'travel' }),
    transaction('100', { kind: 'income', type: 'income' }),
  ];

  it.each([
    ['user', [USERS.ada.id, USERS.ben.id]],
    ['source', [SOURCES.bank.id, SOURCES.cash.id]],
    ['transaction-type', ['groceries', 'travel']],
  ] as const)('retains every non-zero %s group', (grouping, keys) => {
    const result = aggregateCategories({ transactions: expenses, grouping });
    expect(result.totalCents).toBe(3000);
    expect(result.groups.map((group) => group.key).sort()).toEqual([...keys].sort());
  });

  it('orders ties by label and reports combined percentages and projection splits', () => {
    const result = aggregateCategories({ transactions: expenses, grouping: 'user' });
    expect(result.groups.map((group) => group.label)).toEqual(['Ada', 'Ben']);
    expect(result.groups[0]).toMatchObject({
      realizedCents: 1000,
      projectedCents: 500,
      totalCents: 1500,
      percentage: 0.5,
    });
  });

  it('returns no groups for no expenses', () => {
    expect(aggregateCategories({ transactions: [], grouping: 'source' })).toEqual({
      groups: [],
      totalCents: 0,
    });
  });

  it('keeps group styles stable when input order and visible period change', () => {
    const original = aggregateCategories({ transactions: expenses, grouping: 'source' });
    const reordered = aggregateCategories({
      transactions: [...expenses].reverse(),
      grouping: 'source',
    });
    const shorterPeriod = aggregateCategories({
      transactions: expenses.slice(0, 2),
      grouping: 'source',
    });
    const style = ({ color, pattern }: (typeof original.groups)[number]) => ({ color, pattern });

    expect(style(reordered.groups.find(({ key }) => key === SOURCES.bank.id)!)).toEqual(
      style(original.groups.find(({ key }) => key === SOURCES.bank.id)!),
    );
    expect(style(shorterPeriod.groups[0]!)).toEqual(
      style(original.groups.find(({ key }) => key === SOURCES.bank.id)!),
    );
  });
});

describe('overview aggregation', () => {
  const transactions = [
    transaction('1000', { user: USERS.ada, type: 'groceries' }),
    transaction('10', { user: USERS.ada, type: 'travel', projected: true }),
    transaction('1', { user: USERS.ben, type: 'groceries' }),
    transaction('20', {
      user: USERS.ben,
      kind: 'income',
      type: 'income',
      source: SOURCES.cash,
    }),
  ];

  it('combines users, retains raw values, and logarithmically normalizes orders of magnitude', () => {
    const result = aggregateOverview({
      transactions,
      members: Object.values(USERS),
      selectedUserIds: [USERS.ada.id, USERS.ben.id],
      kind: 'expense',
      mode: 'combine',
    });
    expect(result.dimensions.map(({ key }) => key)).toEqual(['groceries', 'travel']);
    expect(result.series).toHaveLength(1);
    expect(result.highestAmountCents).toBe(100100);
    expect(result.series[0]!.values[0]).toMatchObject({
      realizedCents: 100100,
      projectedCents: 0,
      totalNormalized: 1,
    });
    expect(result.series[0]!.values[1]!.totalNormalized).toBeGreaterThan(0);
    expect(result.series[0]!.values[1]!.totalNormalized).toBeLessThan(1);
  });

  it('compares users on the same dimensions and scale', () => {
    const result = aggregateOverview({
      transactions,
      members: Object.values(USERS),
      selectedUserIds: [USERS.ada.id, USERS.ben.id],
      kind: 'expense',
      mode: 'compare',
    });
    expect(result.series.map(({ key }) => key)).toEqual([USERS.ada.id, USERS.ben.id]);
    expect(result.series.every((series) => series.values.length === result.dimensions.length)).toBe(
      true,
    );
    expect(result.series[1]!.values[1]!.totalCents).toBe(0);
  });

  it('uses sources for income dimensions and omits zero dimensions', () => {
    const result = aggregateOverview({
      transactions,
      members: Object.values(USERS),
      selectedUserIds: [USERS.ben.id],
      kind: 'income',
      mode: 'combine',
    });
    expect(result.dimensions).toEqual([{ key: SOURCES.cash.id, label: 'Cash' }]);
    expect(result.series[0]!.values[0]!.totalCents).toBe(2000);
  });

  it('automatically selects all users when none remain and handles all-zero normalization', () => {
    expect(normalizeSelectedUserIds(Object.values(USERS), ['missing'])).toEqual([
      USERS.ada.id,
      USERS.ben.id,
    ]);
    const result = aggregateOverview({
      transactions: [],
      members: Object.values(USERS),
      selectedUserIds: [],
      kind: 'expense',
      mode: 'combine',
    });
    expect(result).toMatchObject({ dimensions: [], highestAmountCents: 0 });
    expect(result.series[0]!.values).toEqual([]);
  });
});

describe('chart presentation helpers', () => {
  it('keeps styles stable across reordered data, periods, and themes', () => {
    const first = chartStyleForKey('source:cash', 'light');
    expect(chartStyleForKey('source:cash', 'light')).toEqual(first);
    expect(chartStyleForKey('source:cash', 'dark').pattern).toBe(first.pattern);
    expect(chartStyleForKey('source:bank', 'light')).not.toEqual(first);
  });

  it('formats exact chart boundary values with locale-aware formatters', () => {
    expect(formatCurrency(123456, 'EUR', 'de-DE')).toContain('1.234,56');
    expect(formatPercentage(0.125, 'en-US')).toBe('12.5%');
    expect(formatDayLabel('2026-10-30', 'en-US')).toBe('Oct 30');
    expect(formatMonthLabel('2026-10', 'en-US')).toBe('Oct 2026');
  });
});
