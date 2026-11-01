export const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

const CALENDAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isCalendarMonth(value: string | null | undefined): value is string {
  return Boolean(value && CALENDAR_MONTH_PATTERN.test(value));
}

export function calendarMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftCalendarMonth(month: string, offset: number): string {
  const match = CALENDAR_MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`Invalid calendar month: ${month}`);
  const totalMonths = Number(match[1]) * 12 + Number(match[2]) - 1 + offset;
  const year = Math.floor(totalMonths / 12);
  const monthNumber = ((totalMonths % 12) + 12) % 12;
  return `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
}

export function clampCalendarMonth(month: string, minimum?: string, maximum?: string): string {
  if (minimum && month < minimum) return minimum;
  if (maximum && month > maximum) return maximum;
  return month;
}

export function calendarMonthDates(month: string): { fromDate: string; toDate: string } {
  const match = CALENDAR_MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`Invalid calendar month: ${month}`);
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const finalDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { fromDate: `${month}-01`, toDate: `${month}-${String(finalDay).padStart(2, '0')}` };
}

export function formatTranslatedMonthYear(
  formatter: Intl.DateTimeFormat,
  date: Date,
  translatedMonth: string,
): string {
  return formatter
    .formatToParts(date)
    .map((part) => (part.type === 'month' ? translatedMonth : part.value))
    .join('');
}
