import type { HouseholdTransaction } from '@monthloom/contracts';

import { amountToCents, calendarDates, checkedAdd } from './helpers';
import type { BalancePoint, BalanceValues, BalanceViewModel, ProjectionSplit } from './types';

function split(realizedCents: number, projectedCents: number): ProjectionSplit {
  return { realizedCents, projectedCents, totalCents: checkedAdd(realizedCents, projectedCents) };
}

function values(
  realizedIncome = 0,
  projectedIncome = 0,
  realizedExpenses = 0,
  projectedExpenses = 0,
): BalanceValues {
  const income = split(realizedIncome, projectedIncome);
  const expenses = split(
    realizedExpenses ? -realizedExpenses : 0,
    projectedExpenses ? -projectedExpenses : 0,
  );
  return {
    income,
    expenses,
    balance: split(
      checkedAdd(income.realizedCents, expenses.realizedCents),
      checkedAdd(income.projectedCents, expenses.projectedCents),
    ),
  };
}

const ZERO_VALUES = values();

export function aggregateBalance({
  transactions,
  from,
  to,
  mode,
}: {
  transactions: HouseholdTransaction[];
  from: string;
  to: string;
  mode: 'daily' | 'cumulative';
}): BalanceViewModel {
  const byDate = new Map<string, [number, number, number, number]>();
  for (const transaction of transactions) {
    if (transaction.date < from || transaction.date > to) continue;
    const totals = byDate.get(transaction.date) ?? [0, 0, 0, 0];
    const offset = transaction.kind === 'income' ? 0 : 2;
    const projectionOffset = transaction.projected ? 1 : 0;
    totals[offset + projectionOffset] = checkedAdd(
      totals[offset + projectionOffset]!,
      amountToCents(transaction.amount),
    );
    byDate.set(transaction.date, totals);
  }

  const daily = calendarDates(from, to).map<BalancePoint>((date) => ({
    date,
    anchor: false,
    ...values(...(byDate.get(date) ?? [0, 0, 0, 0])),
  }));

  let points = daily;
  if (mode === 'cumulative') {
    let running = [0, 0, 0, 0] as [number, number, number, number];
    points = [
      { date: from, anchor: true, ...ZERO_VALUES },
      ...daily.map((point) => {
        const current = byDate.get(point.date) ?? [0, 0, 0, 0];
        running = running.map((amount, valueIndex) => checkedAdd(amount, current[valueIndex]!)) as [
          number,
          number,
          number,
          number,
        ];
        return { date: point.date, anchor: false, ...values(...running) };
      }),
    ];
  }

  const maximum = points.reduce(
    (current, point) =>
      Math.max(
        current,
        ...[point.income, point.expenses, point.balance].flatMap((value) => [
          Math.abs(value.realizedCents),
          Math.abs(value.projectedCents),
          Math.abs(value.totalCents),
        ]),
      ),
    0,
  );
  return { mode, points, domain: [-maximum, maximum] };
}
