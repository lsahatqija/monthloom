'use client';

import { useCallback, useEffect, useState } from 'react';

import { calendarMonth } from '../selectors/month';

import {
  isGraphPeriodPreset,
  resolveGraphPeriod,
  type GraphPeriodPreset,
  type ResolvedGraphPeriod,
} from './period';

export const GRAPH_KINDS = ['balance', 'category', 'overview'] as const;
export const BALANCE_CHARTS = ['line', 'area'] as const;
export const BALANCE_MODES = ['daily', 'cumulative'] as const;
export const CATEGORY_GROUPINGS = ['user', 'source', 'transaction-type'] as const;
export const CATEGORY_CHARTS = ['pie', 'bar', 'radial'] as const;
export const OVERVIEW_KINDS = ['expense', 'income'] as const;
export const OVERVIEW_MODES = ['combine', 'compare'] as const;

export type GraphKind = (typeof GRAPH_KINDS)[number];
export type BalanceChart = (typeof BALANCE_CHARTS)[number];
export type BalanceMode = (typeof BALANCE_MODES)[number];
export type CategoryGrouping = (typeof CATEGORY_GROUPINGS)[number];
export type CategoryChart = (typeof CATEGORY_CHARTS)[number];
export type OverviewKind = (typeof OVERVIEW_KINDS)[number];
export type OverviewMode = (typeof OVERVIEW_MODES)[number];

export interface GraphSelection extends ResolvedGraphPeriod {
  householdId: string;
  graph: GraphKind;
  balanceChart: BalanceChart;
  balanceMode: BalanceMode;
  categoryGrouping: CategoryGrouping;
  categoryChart: CategoryChart;
  overviewKind: OverviewKind;
  overviewMode: OverviewMode;
  userIds: string[];
}

type GraphSelectionUpdate = Partial<
  Pick<
    GraphSelection,
    | 'householdId'
    | 'graph'
    | 'balanceChart'
    | 'balanceMode'
    | 'categoryGrouping'
    | 'categoryChart'
    | 'overviewKind'
    | 'overviewMode'
    | 'userIds'
  >
> & { period?: GraphPeriodPreset; from?: string; to?: string };

function fallbackUrl(): URL {
  return new URL('http://localhost/graph');
}

function option<Value extends string>(
  value: string | null,
  options: readonly Value[],
  fallback: Value,
): Value {
  return options.includes(value as Value) ? (value as Value) : fallback;
}

export function readGraphSelection(url: URL, current = calendarMonth()): GraphSelection {
  const requestedPeriod = url.searchParams.get('period');
  const period = isGraphPeriodPreset(requestedPeriod) ? requestedPeriod : 'current-month';
  const resolved = resolveGraphPeriod({
    period,
    current,
    from:
      period === 'custom-month'
        ? (url.searchParams.get('month') ?? undefined)
        : (url.searchParams.get('from') ?? undefined),
    to: url.searchParams.get('to') ?? undefined,
  });
  return {
    householdId: url.searchParams.get('household') ?? '',
    graph: option(url.searchParams.get('graph'), GRAPH_KINDS, 'balance'),
    balanceChart: option(url.searchParams.get('chart'), BALANCE_CHARTS, 'line'),
    balanceMode: option(url.searchParams.get('mode'), BALANCE_MODES, 'daily'),
    categoryGrouping: option(url.searchParams.get('group'), CATEGORY_GROUPINGS, 'user'),
    categoryChart: option(url.searchParams.get('categoryChart'), CATEGORY_CHARTS, 'pie'),
    overviewKind: option(url.searchParams.get('kind'), OVERVIEW_KINDS, 'expense'),
    overviewMode: option(url.searchParams.get('usersMode'), OVERVIEW_MODES, 'combine'),
    userIds: [...new Set((url.searchParams.get('users') ?? '').split(',').filter(Boolean))],
    ...resolved,
  };
}

export function graphSelectionSearch(selection: GraphSelection): string {
  const search = new URLSearchParams();
  if (selection.householdId) search.set('household', selection.householdId);
  search.set('period', selection.period);
  search.set('graph', selection.graph);
  if (selection.period === 'custom-month') search.set('month', selection.from);
  if (selection.period === 'custom-period') {
    search.set('from', selection.from);
    search.set('to', selection.to);
  }
  if (selection.graph === 'balance') {
    search.set('chart', selection.balanceChart);
    search.set('mode', selection.balanceMode);
  }
  if (selection.graph === 'category') {
    search.set('group', selection.categoryGrouping);
    search.set('categoryChart', selection.categoryChart);
  }
  if (selection.graph === 'overview') {
    search.set('kind', selection.overviewKind);
    search.set('usersMode', selection.overviewMode);
    if (selection.userIds.length) search.set('users', selection.userIds.join(','));
  }
  return search.toString();
}

function browserSelection(): GraphSelection {
  return readGraphSelection(
    typeof window === 'undefined' ? fallbackUrl() : new URL(window.location.href),
  );
}

export function useGraphSelection() {
  const [selection, setSelection] = useState(browserSelection);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = graphSelectionSearch(selection);
    window.history.replaceState(window.history.state, '', url);
  }, [selection]);

  useEffect(() => {
    const restoreSelection = () => setSelection(browserSelection());
    window.addEventListener('popstate', restoreSelection);
    return () => window.removeEventListener('popstate', restoreSelection);
  }, []);

  const update = useCallback((next: GraphSelectionUpdate) => {
    setSelection((currentSelection) => {
      const period = next.period ?? currentSelection.period;
      const resolved = resolveGraphPeriod({
        period,
        from: next.from ?? currentSelection.from,
        to: next.to ?? currentSelection.to,
      });
      const updated = { ...currentSelection, ...next, ...resolved };
      const url = new URL(window.location.href);
      url.search = graphSelectionSearch(updated);
      window.history.pushState(window.history.state, '', url);
      return updated;
    });
  }, []);

  const setHouseholdId = useCallback((householdId: string) => update({ householdId }), [update]);
  const setGraph = useCallback((graph: GraphKind) => update({ graph }), [update]);
  const setBalanceChart = useCallback(
    (balanceChart: BalanceChart) => update({ balanceChart }),
    [update],
  );
  const setBalanceMode = useCallback(
    (balanceMode: BalanceMode) => update({ balanceMode }),
    [update],
  );
  const setCategoryGrouping = useCallback(
    (categoryGrouping: CategoryGrouping) => update({ categoryGrouping }),
    [update],
  );
  const setCategoryChart = useCallback(
    (categoryChart: CategoryChart) => update({ categoryChart }),
    [update],
  );
  const setOverviewKind = useCallback(
    (overviewKind: OverviewKind) => update({ overviewKind }),
    [update],
  );
  const setOverviewMode = useCallback(
    (overviewMode: OverviewMode) => update({ overviewMode }),
    [update],
  );
  const setUserIds = useCallback((userIds: string[]) => update({ userIds }), [update]);
  const setPeriod = useCallback((period: GraphPeriodPreset) => update({ period }), [update]);
  const setCustomMonth = useCallback(
    (month: string) => update({ period: 'custom-month', from: month, to: month }),
    [update],
  );
  const setCustomPeriod = useCallback(
    (from: string, to: string) => update({ period: 'custom-period', from, to }),
    [update],
  );

  return {
    ...selection,
    setHouseholdId,
    setGraph,
    setBalanceChart,
    setBalanceMode,
    setCategoryGrouping,
    setCategoryChart,
    setOverviewKind,
    setOverviewMode,
    setUserIds,
    setPeriod,
    setCustomMonth,
    setCustomPeriod,
  };
}
