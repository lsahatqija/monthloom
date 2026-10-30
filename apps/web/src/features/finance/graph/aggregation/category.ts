import type { HouseholdTransaction } from '@monthloom/contracts';

import { transactionTypeLabel } from '../../transaction-type';

import { chartStyleForKey, type ChartTheme } from './colors';
import { amountToCents, checkedAdd } from './helpers';
import type { CategoryGrouping, CategoryViewModel } from './types';

export function aggregateCategories({
  transactions,
  grouping,
  theme = 'light',
  typeLabel = transactionTypeLabel,
}: {
  transactions: HouseholdTransaction[];
  grouping: CategoryGrouping;
  theme?: ChartTheme;
  typeLabel?: (type: string) => string;
}): CategoryViewModel {
  const totals = new Map<
    string,
    {
      label: string;
      realizedCents: number;
      projectedCents: number;
      desiredColor?: HouseholdTransaction['user']['desiredColor'];
    }
  >();

  for (const transaction of transactions) {
    if (transaction.kind !== 'expense') continue;
    const [key, label, desiredColor] =
      grouping === 'user'
        ? [transaction.user.id, transaction.user.displayName, transaction.user.desiredColor]
        : grouping === 'source'
          ? [transaction.source.id, transaction.source.displayName, undefined]
          : [transaction.type, typeLabel(transaction.type), undefined];
    const total = totals.get(key) ?? { label, realizedCents: 0, projectedCents: 0, desiredColor };
    const field = transaction.projected ? 'projectedCents' : 'realizedCents';
    total[field] = checkedAdd(total[field], amountToCents(transaction.amount));
    totals.set(key, total);
  }

  const totalCents = [...totals.values()].reduce(
    (sum, group) => checkedAdd(sum, checkedAdd(group.realizedCents, group.projectedCents)),
    0,
  );
  const groups = [...totals.entries()]
    .map(([key, group]) => {
      const groupTotal = checkedAdd(group.realizedCents, group.projectedCents);
      return {
        key,
        label: group.label,
        realizedCents: group.realizedCents,
        projectedCents: group.projectedCents,
        totalCents: groupTotal,
        percentage: totalCents === 0 ? 0 : groupTotal / totalCents,
        ...chartStyleForKey(`category:${grouping}:${key}`, theme, group.desiredColor),
      };
    })
    .filter((group) => group.totalCents !== 0)
    .sort(
      (left, right) =>
        right.totalCents - left.totalCents ||
        (left.label < right.label ? -1 : left.label > right.label ? 1 : 0),
    );

  return { groups, totalCents };
}
