import { calendarMonth } from '../selectors/month';

import type { GraphSelection } from './use-graph-selection';

export function graphHrefFromDashboard(
  householdId: string,
  month: string,
  current = calendarMonth(),
): string {
  const search = new URLSearchParams();
  if (householdId) search.set('household', householdId);
  if (!month || month === current) {
    search.set('period', 'current-month');
  } else {
    search.set('period', 'custom-month');
    search.set('month', month);
  }
  return `/graph?${search}`;
}

export function dashboardHrefFromGraph(
  selection: Pick<GraphSelection, 'householdId' | 'from' | 'to'>,
  current = calendarMonth(),
): string {
  const search = new URLSearchParams();
  search.set('month', selection.from === selection.to ? selection.from : current);
  if (selection.householdId) search.set('household', selection.householdId);
  return `/?${search}`;
}
