import type {
  AdminAnalyticsBucket,
  AdminAnalyticsRangeQuery,
  AdminResolvedRange,
} from '@monthloom/contracts';

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_RANGE_DAYS = 366;

export interface ResolvedAdminAnalyticsRange {
  range: AdminResolvedRange;
  comparisonRange: AdminResolvedRange;
}

export interface AdminCalendarBucket {
  from: string;
  to: string;
}

export function resolveAdminAnalyticsRange(
  query: AdminAnalyticsRangeQuery,
  now = new Date(),
): ResolvedAdminAnalyticsRange {
  const today = dateInTimeZone(now, query.timezone);
  const from = query.from ?? `${today.slice(0, 7)}-01`;
  const to = query.to ?? today;
  const days = calendarDayNumber(to) - calendarDayNumber(from) + 1;

  if (days < 1) throw new RangeError('from must not be after to');
  if (days > MAX_RANGE_DAYS)
    throw new RangeError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);

  const bucket = query.bucket ?? (days <= 90 ? 'day' : 'week');
  const comparisonTo = addCalendarDays(from, -1);
  const comparisonFrom = addCalendarDays(comparisonTo, -(days - 1));

  return {
    range: resolvedRange(from, to, query.timezone, bucket),
    comparisonRange: resolvedRange(comparisonFrom, comparisonTo, query.timezone, bucket),
  };
}

export function adminCalendarBuckets(
  range: Pick<AdminResolvedRange, 'from' | 'to' | 'bucket'>,
): AdminCalendarBucket[] {
  const step = range.bucket === 'day' ? 1 : 7;
  const buckets: AdminCalendarBucket[] = [];
  for (let from = range.from; from <= range.to; from = addCalendarDays(from, step)) {
    const candidateTo = addCalendarDays(from, step - 1);
    buckets.push({ from, to: candidateTo < range.to ? candidateTo : range.to });
  }
  return buckets;
}

function resolvedRange(
  from: string,
  to: string,
  timezone: string,
  bucket: AdminAnalyticsBucket,
): AdminResolvedRange {
  return {
    from,
    to,
    start: zonedStartOfDay(from, timezone).toISOString(),
    endExclusive: zonedStartOfDay(addCalendarDays(to, 1), timezone).toISOString(),
    timezone,
    bucket,
  };
}

function dateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function zonedStartOfDay(calendarDate: string, timeZone: string): Date {
  const [year, month, day] = calendarDate.split('-').map(Number) as [number, number, number];
  const target = Date.UTC(year, month - 1, day);
  let instant = target;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    instant -= represented - target;
  }
  return new Date(instant);
}

function zonedParts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return values as { year: number; month: number; day: number; hour: number; minute: number };
}

function calendarDayNumber(value: string): number {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function addCalendarDays(value: string, amount: number): string {
  return new Date((calendarDayNumber(value) + amount) * DAY_MS).toISOString().slice(0, 10);
}
