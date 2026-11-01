import { describe, expect, it } from 'vitest';

import {
  copyHouseholdSourcesRequestSchema,
  createHouseholdRequestSchema,
  Defaults,
  HOUSEHOLD_CURRENCIES,
  createHouseholdInvitationRequestSchema,
  createHouseholdTransactionRequestSchema,
  householdMonthQuerySchema,
  householdTransactionRangeQuerySchema,
  updateHouseholdRequestSchema,
  updateHouseholdTransactionRequestSchema,
} from '../src/index.js';

const transaction = {
  kind: 'expense',
  type: 'groceries',
  date: '2026-01-15',
  sourceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  icon: 'shopping-cart',
  color: '#123456',
  amount: '12.34',
  recurring: false,
  recurrenceInterval: 1,
  recurrenceUnit: 'month',
  expiresOn: null,
};

describe('finance contracts', () => {
  it('accepts supported household currencies and defaults older create requests to EUR', () => {
    const details = { name: 'Home', icon: 'small-house', color: '#123456' };
    expect(createHouseholdRequestSchema.parse(details).currency).toBe('EUR');
    expect(HOUSEHOLD_CURRENCIES.slice(0, 2).map(([code]) => code)).toEqual(['EUR', 'USD']);
    for (const [currency] of HOUSEHOLD_CURRENCIES) {
      expect(createHouseholdRequestSchema.parse({ ...details, currency }).currency).toBe(currency);
      expect(updateHouseholdRequestSchema.parse({ currency })).toEqual({ currency });
    }
    expect(updateHouseholdRequestSchema.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
  });

  it.each(['XYZ', 'eur', '', 'EURO'])('rejects unsupported household currency %s', (currency) => {
    expect(updateHouseholdRequestSchema.safeParse({ currency }).success).toBe(false);
    expect(
      createHouseholdRequestSchema.safeParse({
        name: 'Home',
        icon: 'small-house',
        color: '#123456',
        currency,
      }).success,
    ).toBe(false);
  });

  it('accepts a valid transaction', () => {
    expect(createHouseholdTransactionRequestSchema.parse(transaction)).toEqual(transaction);
  });
  it('derives the canonical income type from the transaction kind', () => {
    const income = { ...transaction, kind: 'income', type: 'income' };
    expect(createHouseholdTransactionRequestSchema.parse(income)).toEqual(income);
    expect(createHouseholdTransactionRequestSchema.parse({ ...income, type: null })).toEqual(
      income,
    );
    expect(
      createHouseholdTransactionRequestSchema.parse({
        ...income,
        type: Defaults.TRANSACTION_TYPE,
      }),
    ).toEqual(income);
  });
  it.each(['0', '-1', '1.234', '1e3', 'NaN', '1000000000000'])(
    'rejects invalid amount %s',
    (amount) => {
      expect(
        createHouseholdTransactionRequestSchema.safeParse({ ...transaction, amount }).success,
      ).toBe(false);
    },
  );
  it('validates recurrence periods and defaults legacy requests to monthly', () => {
    const { recurrenceInterval, recurrenceUnit } = createHouseholdTransactionRequestSchema.parse({
      ...transaction,
      recurrenceInterval: undefined,
      recurrenceUnit: undefined,
    });
    expect({ recurrenceInterval, recurrenceUnit }).toEqual({
      recurrenceInterval: 1,
      recurrenceUnit: 'month',
    });
    expect(
      createHouseholdTransactionRequestSchema.safeParse({
        ...transaction,
        recurrenceInterval: 0,
      }).success,
    ).toBe(false);
  });
  it.each([{ type: null }, { type: 'income' }, { expiresOn: '2026-01-14' }])(
    'rejects invalid transaction %j',
    (change) => {
      expect(
        createHouseholdTransactionRequestSchema.safeParse({ ...transaction, ...change }).success,
      ).toBe(false);
    },
  );
  it.each(['2026-00', '2026-13', '26-01'])('rejects invalid month %s', (month) => {
    expect(householdMonthQuerySchema.safeParse({ month }).success).toBe(false);
  });
  it('validates ordered calendar-month ranges', () => {
    expect(householdTransactionRangeQuerySchema.parse({ from: '2025-12', to: '2026-01' })).toEqual({
      from: '2025-12',
      to: '2026-01',
    });
    expect(
      householdTransactionRangeQuerySchema.safeParse({ from: '2026-02', to: '2026-01' }).success,
    ).toBe(false);
  });
  it('requires a recurring edit selection', () => {
    expect(
      updateHouseholdTransactionRequestSchema.safeParse({
        transaction,
        selection: { past: false, current: false, future: false },
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate source IDs', () => {
    expect(
      copyHouseholdSourcesRequestSchema.safeParse({
        targetHouseholdId: transaction.userId,
        sourceIds: [transaction.sourceId, transaction.sourceId],
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate invitees regardless of case and surrounding whitespace', () => {
    expect(
      createHouseholdInvitationRequestSchema.safeParse({
        mode: 'email',
        emails: ['person@example.com', ' PERSON@example.com '],
      }).success,
    ).toBe(false);
  });
});
