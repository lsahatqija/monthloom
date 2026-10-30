import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { calendarMonth } from '../selectors/month';

function initialParameter(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return new URL(window.location.href).searchParams.get(name) ?? fallback;
}

export function useDashboardSelection() {
  const [month, setMonthState] = useState(() => initialParameter('month', calendarMonth()));
  const [householdId, setHouseholdId] = useState(() => initialParameter('household', ''));

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('month', month);
    if (householdId) url.searchParams.set('household', householdId);
    else url.searchParams.delete('household');
    window.history.replaceState(window.history.state, '', url);
  }, [householdId, month]);

  useEffect(() => {
    const restoreSelection = () => {
      setMonthState(initialParameter('month', calendarMonth()));
      setHouseholdId(initialParameter('household', ''));
    };
    window.addEventListener('popstate', restoreSelection);
    return () => window.removeEventListener('popstate', restoreSelection);
  }, []);

  const setMonth: Dispatch<SetStateAction<string>> = useCallback(
    (value) => {
      setMonthState((current) => {
        const next = typeof value === 'function' ? value(current) : value;
        if (next === current) return current;
        const url = new URL(window.location.href);
        url.searchParams.set('month', next);
        if (householdId) url.searchParams.set('household', householdId);
        window.history.pushState(window.history.state, '', url);
        return next;
      });
    },
    [householdId],
  );

  return { householdId, setHouseholdId, month, setMonth };
}
