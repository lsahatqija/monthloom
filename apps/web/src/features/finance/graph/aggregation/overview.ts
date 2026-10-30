import type { HouseholdTransaction, HouseholdTransactionRangeResponse } from '@monthloom/contracts';

import { transactionTypeLabel } from '../../transaction-type';

import { chartStyleForKey, type ChartTheme } from './colors';
import { amountToCents, checkedAdd } from './helpers';
import type { OverviewKind, OverviewMode, OverviewViewModel } from './types';

type HouseholdMember = HouseholdTransactionRangeResponse['members'][number];

export function normalizeSelectedUserIds(
  members: Pick<HouseholdMember, 'id'>[],
  selectedUserIds: string[],
): string[] {
  const available = new Set(members.map(({ id }) => id));
  const selected = [...new Set(selectedUserIds)].filter((id) => available.has(id));
  return selected.length ? selected : members.map(({ id }) => id);
}

export function aggregateOverview({
  transactions,
  members,
  selectedUserIds,
  kind,
  mode,
  theme = 'light',
  typeLabel = transactionTypeLabel,
  combinedLabel = 'Combined',
}: {
  transactions: HouseholdTransaction[];
  members: HouseholdMember[];
  selectedUserIds: string[];
  kind: OverviewKind;
  mode: OverviewMode;
  theme?: ChartTheme;
  typeLabel?: (type: string) => string;
  combinedLabel?: string;
}): OverviewViewModel {
  const normalizedUsers = normalizeSelectedUserIds(members, selectedUserIds);
  const selected = new Set(normalizedUsers);
  const labels = new Map<string, string>();
  const totals = new Map<string, Map<string, [number, number]>>();

  for (const transaction of transactions) {
    if (transaction.kind !== kind || !selected.has(transaction.user.id)) continue;
    const key = kind === 'expense' ? transaction.type : transaction.source.id;
    labels.set(
      key,
      kind === 'expense' ? typeLabel(transaction.type) : transaction.source.displayName,
    );
    const userTotals = totals.get(transaction.user.id) ?? new Map<string, [number, number]>();
    const amounts = userTotals.get(key) ?? [0, 0];
    const index = transaction.projected ? 1 : 0;
    amounts[index] = checkedAdd(amounts[index]!, amountToCents(transaction.amount));
    userTotals.set(key, amounts);
    totals.set(transaction.user.id, userTotals);
  }

  const dimensionKeys = [...labels.keys()]
    .filter((key) =>
      normalizedUsers.some((userId) => {
        const amount = totals.get(userId)?.get(key);
        return amount && checkedAdd(amount[0], amount[1]) !== 0;
      }),
    )
    .sort((left, right) => {
      const leftLabel = labels.get(left)!;
      const rightLabel = labels.get(right)!;
      return leftLabel < rightLabel ? -1 : leftLabel > rightLabel ? 1 : 0;
    });

  const seriesDefinitions =
    mode === 'combine'
      ? [{ key: 'combined', label: combinedLabel, userIds: normalizedUsers }]
      : normalizedUsers.map((id) => ({
          key: id,
          label: members.find((member) => member.id === id)!.displayName,
          userIds: [id],
        }));

  const rawSeries = seriesDefinitions.map((definition) => ({
    ...definition,
    values: dimensionKeys.map((dimensionKey) => {
      let realizedCents = 0;
      let projectedCents = 0;
      for (const userId of definition.userIds) {
        const amounts = totals.get(userId)?.get(dimensionKey);
        if (amounts) {
          realizedCents = checkedAdd(realizedCents, amounts[0]);
          projectedCents = checkedAdd(projectedCents, amounts[1]);
        }
      }
      return {
        dimensionKey,
        realizedCents,
        projectedCents,
        totalCents: checkedAdd(realizedCents, projectedCents),
      };
    }),
  }));
  const highestAmountCents = rawSeries.reduce(
    (highest, series) => Math.max(highest, ...series.values.map(({ totalCents }) => totalCents)),
    0,
  );
  const normalize = (amount: number) =>
    highestAmountCents === 0 ? 0 : Math.log1p(amount) / Math.log1p(highestAmountCents);

  return {
    dimensions: dimensionKeys.map((key) => ({ key, label: labels.get(key)! })),
    series: rawSeries.map(({ userIds: _userIds, ...series }) => {
      const member = mode === 'compare' ? members.find(({ id }) => id === series.key) : undefined;
      return {
        ...series,
        ...chartStyleForKey(`overview:${series.key}`, theme, member?.desiredColor),
        values: series.values.map((value) => ({
          ...value,
          realizedNormalized: normalize(value.realizedCents),
          totalNormalized: normalize(value.totalCents),
        })),
      };
    }),
    selectedUserIds: normalizedUsers,
    highestAmountCents,
  };
}
