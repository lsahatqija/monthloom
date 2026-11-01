const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONEY = /^(\d+)(?:\.(\d{1,2}))?$/;

export function amountToCents(amount: string): number {
  const match = MONEY.exec(amount);
  if (!match) throw new Error(`Invalid monetary amount: ${amount}`);
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error(`Monetary amount is too large: ${amount}`);
  return cents;
}

function calendarDateValue(value: string): number {
  const match = CALENDAR_DATE.exec(value);
  if (!match) throw new Error(`Invalid calendar date: ${value}`);
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return timestamp;
}

export function calendarDates(from: string, to: string): string[] {
  const start = calendarDateValue(from);
  const end = calendarDateValue(to);
  if (start > end) throw new Error('Start date cannot be after end date');

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function checkedAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new Error('Monetary total exceeds the safe integer range');
  return result;
}
