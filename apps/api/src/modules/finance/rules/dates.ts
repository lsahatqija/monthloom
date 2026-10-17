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

export function recurringOccurrenceDates(
  startDate: string,
  throughMonth: string,
  expiresOn: string | null,
): string[] {
  const dates: string[] = [];
  let month = startDate.slice(0, 7);

  while (month <= throughMonth) {
    const date = alignOccurrenceDate(`${month}-01`, startDate);
    if (expiresOn && date > expiresOn) break;
    dates.push(date);
    month = monthEnd(month).slice(0, 7);
  }

  return dates;
}
