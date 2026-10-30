'use client';

import { useCallback, useEffect, useState } from 'react';

import { calendarMonth } from '../selectors/month';

import {
  isGraphPeriodPreset,
  resolveGraphPeriod,
  type GraphPeriodPreset,
  type ResolvedGraphPeriod,
} from './period';

export interface GraphSelection extends ResolvedGraphPeriod {
  householdId: string;
}

function fallbackUrl(): URL {
  return new URL('http://localhost/graph');
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
  return { householdId: url.searchParams.get('household') ?? '', ...resolved };
}

export function graphSelectionSearch(selection: GraphSelection): string {
  const search = new URLSearchParams();
  if (selection.householdId) search.set('household', selection.householdId);
  search.set('period', selection.period);
  if (selection.period === 'custom-month') search.set('month', selection.from);
  if (selection.period === 'custom-period') {
    search.set('from', selection.from);
    search.set('to', selection.to);
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

  const update = useCallback(
    (next: { householdId?: string; period?: GraphPeriodPreset; from?: string; to?: string }) => {
      setSelection((current) => {
        const period = next.period ?? current.period;
        const resolved = resolveGraphPeriod({
          period,
          from: next.from ?? current.from,
          to: next.to ?? current.to,
        });
        const updated = {
          householdId: next.householdId ?? current.householdId,
          ...resolved,
        };
        const url = new URL(window.location.href);
        url.search = graphSelectionSearch(updated);
        window.history.pushState(window.history.state, '', url);
        return updated;
      });
    },
    [],
  );

  return {
    ...selection,
    setHouseholdId: (householdId: string) => update({ householdId }),
    setPeriod: (period: GraphPeriodPreset) => update({ period }),
    setCustomMonth: (month: string) => update({ period: 'custom-month', from: month, to: month }),
    setCustomPeriod: (from: string, to: string) => update({ period: 'custom-period', from, to }),
  };
}
