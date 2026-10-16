import { useQuery } from '@tanstack/react-query';

import { getHouseholdMonth, getHouseholds, getHouseholdSources } from '../finance.api';

import { financeKeys } from './keys';

export function useHouseholds() {
  return useQuery({ queryKey: financeKeys.households(), queryFn: getHouseholds });
}

export function useHouseholdMonth(householdId: string, month: string) {
  return useQuery({
    queryKey: financeKeys.householdMonth(householdId, month),
    queryFn: () => getHouseholdMonth(householdId, month),
    enabled: Boolean(householdId),
  });
}

export function useHouseholdSources(householdId: string) {
  return useQuery({
    queryKey: financeKeys.sources(householdId),
    queryFn: () => getHouseholdSources(householdId),
    enabled: Boolean(householdId),
  });
}
