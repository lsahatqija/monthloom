function utcDate(value: string): Date {
  return new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`);
}

export function formatCurrency(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function formatPercentage(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
}

export function formatDayLabel(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    utcDate(date),
  );
}

export function formatMonthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    utcDate(month),
  );
}
