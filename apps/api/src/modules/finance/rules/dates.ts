import type { RecurrenceUnit } from '../finance.types.js';

export function monthEnd(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year!, monthNumber!, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Keep the requested day where possible, clamping it for shorter occurrence months. */
export function alignOccurrenceDate(existingDate: string, editedDate: string): string {
  const [year, month] = existingDate.split('-').map(Number);
  const requestedDay = Number(editedDate.slice(8, 10));
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return `${existingDate.slice(0, 8)}${String(Math.min(requestedDay, lastDay)).padStart(2, '0')}`;
}

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addOccurrence(startDate: string, count: number, interval: number, unit: RecurrenceUnit) {
  const [year, month, day] = startDate.split('-').map(Number);
  if (unit === 'month' || unit === 'year') {
    const monthOffset = count * interval * (unit === 'year' ? 12 : 1);
    const target = new Date(Date.UTC(year!, month! - 1 + monthOffset, 1));
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day!, lastDay));
    return formatUtcDate(target);
  }

  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() + count * interval * (unit === 'week' ? 7 : 1));
  return formatUtcDate(date);
}

export function recurringOccurrenceDates(
  startDate: string,
  throughMonth: string,
  expiresOn: string | null,
  interval = 1,
  unit: RecurrenceUnit = 'month',
): string[] {
  const dates: string[] = [];
  const throughDate = monthEnd(throughMonth);
  let count = 0;
  let date = startDate;

  while (date < throughDate) {
    if (expiresOn && date > expiresOn) break;
    dates.push(date);
    count += 1;
    date = addOccurrence(startDate, count, interval, unit);
  }

  return dates;
}
