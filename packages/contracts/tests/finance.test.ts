import { describe, expect, it } from 'vitest';

import {
  copyHouseholdSourcesRequestSchema,
  createHouseholdInvitationRequestSchema,
  createHouseholdTransactionRequestSchema,
  householdMonthQuerySchema,
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
  expiresOn: null,
};

describe('finance contracts', () => {
  it('accepts a valid transaction', () => {
    expect(createHouseholdTransactionRequestSchema.parse(transaction)).toEqual(transaction);
  });
  it.each(['0', '-1', '1.234', '1e3', 'NaN', '1000000000000'])(
    'rejects invalid amount %s',
    (amount) => {
      expect(
        createHouseholdTransactionRequestSchema.safeParse({ ...transaction, amount }).success,
      ).toBe(false);
    },
  );
  it.each([{ type: null }, { kind: 'income' }, { expiresOn: '2026-01-14' }])(
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
