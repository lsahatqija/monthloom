import { useQuery } from '@tanstack/react-query';

import {
  getHouseholdMonth,
  getHouseholds,
  getHouseholdSources,
  getHouseholdTransactionRange,
} from '../finance.api';

import { financeKeys } from './keys';

export function useHouseholds() {
  return useQuery({ queryKey: financeKeys.households(), queryFn: getHouseholds });
}

export function useHouseholdMonth(householdId: string, month: string) {
  return useQuery({
    queryKey: financeKeys.householdMonth(householdId, month),
    queryFn: () => getHouseholdMonth(householdId, month),
    enabled: Boolean(householdId),
    placeholderData: (previous) => (previous?.household.id === householdId ? previous : undefined),
  });
}

export function useHouseholdSources(householdId: string) {
  return useQuery({
    queryKey: financeKeys.sources(householdId),
    queryFn: () => getHouseholdSources(householdId),
    enabled: Boolean(householdId),
  });
}

export function useHouseholdTransactionRange(householdId: string, from: string, to: string) {
  return useQuery({
    queryKey: financeKeys.householdRange(householdId, from, to),
    queryFn: () => getHouseholdTransactionRange(householdId, from, to),
    enabled: Boolean(householdId && from && to),
    placeholderData: (previous) => (previous?.household.id === householdId ? previous : undefined),
  });
}
