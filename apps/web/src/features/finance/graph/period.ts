import {
  calendarMonth,
  calendarMonthDates,
  isCalendarMonth,
  shiftCalendarMonth,
} from '../selectors/month';

export const GRAPH_PERIOD_PRESETS = [
  'current-month',
  'last-month',
  'current-year',
  'last-year',
  'last-12-months',
  'custom-month',
  'custom-period',
] as const;

export type GraphPeriodPreset = (typeof GRAPH_PERIOD_PRESETS)[number];
export type GraphPeriodError = 'invalid-month' | 'out-of-bounds' | 'inverted-range';

export interface ResolvedGraphPeriod {
  period: GraphPeriodPreset;
  from: string;
  to: string;
  fromDate: string;
  toDate: string;
  error?: GraphPeriodError;
}

export function isGraphPeriodPreset(value: string | null): value is GraphPeriodPreset {
  return GRAPH_PERIOD_PRESETS.some((preset) => preset === value);
}

export function graphMonthBounds(current = calendarMonth()): { minimum: string; maximum: string } {
  return {
    minimum: shiftCalendarMonth(current, -60),
    maximum: shiftCalendarMonth(current, 12),
  };
}

function customMonthError(
  value: string | undefined,
  minimum: string,
  maximum: string,
): GraphPeriodError | undefined {
  if (!isCalendarMonth(value)) return 'invalid-month';
  if (value < minimum || value > maximum) return 'out-of-bounds';
}

export function resolveGraphPeriod({
  period,
  current = calendarMonth(),
  from,
  to,
}: {
  period: GraphPeriodPreset;
  current?: string;
  from?: string;
  to?: string;
}): ResolvedGraphPeriod {
  const { minimum, maximum } = graphMonthBounds(current);
  let resolvedFrom = current;
  let resolvedTo = current;
  let error: GraphPeriodError | undefined;

  switch (period) {
    case 'last-month':
      resolvedFrom = resolvedTo = shiftCalendarMonth(current, -1);
      break;
    case 'current-year':
      resolvedFrom = `${current.slice(0, 4)}-01`;
      break;
    case 'last-year': {
      const year = Number(current.slice(0, 4)) - 1;
      resolvedFrom = `${year}-01`;
      resolvedTo = `${year}-12`;
      break;
    }
    case 'last-12-months':
      resolvedFrom = shiftCalendarMonth(current, -11);
      break;
    case 'custom-month':
      error = customMonthError(from, minimum, maximum);
      if (!error) resolvedFrom = resolvedTo = from!;
      break;
    case 'custom-period': {
      error = customMonthError(from, minimum, maximum) ?? customMonthError(to, minimum, maximum);
      if (!error && from! > to!) error = 'inverted-range';
      if (!error) {
        resolvedFrom = from!;
        resolvedTo = to!;
      }
      break;
    }
    case 'current-month':
      break;
  }

  const { fromDate } = calendarMonthDates(resolvedFrom);
  const { toDate } = calendarMonthDates(resolvedTo);
  return { period, from: resolvedFrom, to: resolvedTo, fromDate, toDate, ...(error && { error }) };
}
