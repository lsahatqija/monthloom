import { describe, expect, it } from 'vitest';

import { generateHouseholdTransactions } from '../../src/infrastructure/database/seed-data.js';

describe('development seed data', () => {
  it('generates 20-40 transactions for each of 25 months', () => {
    const generated = generateHouseholdTransactions({
      householdId: '00000000-0000-4000-8000-000000000001',
      memberIds: ['00000000-0000-4000-8000-000000000011'],
      sourceIds: Array.from(
        { length: 8 },
        (_, index) => `00000000-0000-4000-8000-${String(index + 101).padStart(12, '0')}`,
      ),
      now: new Date('2026-11-01T00:00:00.000Z'),
      seed: 1,
    });

    expect(generated.incomes).toHaveLength(50);

    const countsByMonth = [...generated.expenses, ...generated.incomes].reduce(
      (counts, transaction) => {
        const month = transaction.date.slice(0, 7);
        counts.set(month, (counts.get(month) ?? 0) + 1);
        return counts;
      },
      new Map<string, number>(),
    );

    expect([...countsByMonth]).toHaveLength(25);
    expect([...countsByMonth.values()].every((count) => count >= 20 && count <= 40)).toBe(true);
    expect([...countsByMonth.keys()].sort()[0]).toBe('2025-11');
    expect([...countsByMonth.keys()].sort().at(-1)).toBe('2027-11');
  });
});
