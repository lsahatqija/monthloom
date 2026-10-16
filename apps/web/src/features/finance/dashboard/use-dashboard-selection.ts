import { useEffect, useState } from 'react';

function currentMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function initialParameter(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return new URL(window.location.href).searchParams.get(name) ?? fallback;
}

export function useDashboardSelection() {
  const [month, setMonth] = useState(() => initialParameter('month', currentMonth()));
  const [householdId, setHouseholdId] = useState(() => initialParameter('household', ''));

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('month', month);
    if (householdId) url.searchParams.set('household', householdId);
    else url.searchParams.delete('household');
    window.history.replaceState(window.history.state, '', url);
  }, [householdId, month]);

  return { householdId, setHouseholdId, month, setMonth };
}
