import assert from 'node:assert/strict';

import type { expenses, incomes } from './schema/index.js';

const EXPENSE_TEMPLATES = [
  { source: 1, type: 'groceries', icon: 'shopping-basket', color: '#65a30d', min: 8, max: 95 },
  { source: 2, type: 'housing', icon: 'house', color: '#4f46e5', min: 850, max: 1050 },
  { source: 3, type: 'utilities', icon: 'plug', color: '#0284c7', min: 25, max: 130 },
  { source: 4, type: 'transport', icon: 'bus', color: '#d97706', min: 3, max: 70 },
  { source: 5, type: 'dining', icon: 'utensils', color: '#dc2626', min: 9, max: 85 },
  { source: 6, type: 'shopping', icon: 'shopping-bag', color: '#bf33ea', min: 12, max: 180 },
  { source: 7, type: 'entertainment', icon: 'film', color: '#0d9488', min: 7, max: 75 },
] as const;

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function monthDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function generateHouseholdTransactions({
  householdId,
  memberIds,
  sourceIds,
  now,
  seed,
}: {
  householdId: string;
  memberIds: string[];
  sourceIds: string[];
  now: Date;
  seed: number;
}) {
  assert(memberIds.length > 0);
  assert.equal(sourceIds.length, 8);

  const random = seededRandom(seed);
  const generated = { expenses: [], incomes: [] } as {
    expenses: (typeof expenses.$inferInsert)[];
    incomes: (typeof incomes.$inferInsert)[];
  };

  for (let monthOffset = -12; monthOffset <= 12; monthOffset += 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const transactionCount = 20 + Math.floor(random() * 21);

    generated.incomes.push(
      {
        householdId,
        sourceId: sourceIds[0]!,
        userId: memberIds[Math.floor(random() * memberIds.length)]!,
        icon: 'briefcase',
        color: '#048d36',
        amount: (2800 + Math.floor(random() * 900)).toFixed(2),
        date: monthDate(year, month, 1),
      },
      {
        householdId,
        sourceId: sourceIds[0]!,
        userId: memberIds[Math.floor(random() * memberIds.length)]!,
        icon: 'coins',
        color: '#0d9488',
        amount: (50 + random() * 350).toFixed(2),
        date: monthDate(year, month, 15),
      },
    );

    for (let index = 0; index < transactionCount - 2; index += 1) {
      const template = EXPENSE_TEMPLATES[Math.floor(random() * EXPENSE_TEMPLATES.length)];
      assert(template);
      generated.expenses.push({
        householdId,
        sourceId: sourceIds[template.source]!,
        userId: memberIds[Math.floor(random() * memberIds.length)]!,
        type: template.type,
        icon: template.icon,
        color: template.color,
        amount: (template.min + random() * (template.max - template.min)).toFixed(2),
        date: monthDate(year, month, 1 + Math.floor(random() * daysInMonth)),
      });
    }
  }

  return generated;
}
