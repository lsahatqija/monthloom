import type {
  HouseholdDto,
  HouseholdMonthResponse,
  UpdateHouseholdRequest,
} from '@template/contracts';

import { apiClient } from '../../lib/api/client';

export const financeKeys = {
  all: ['finance'] as const,
  primaryMonth: (month: string) => [...financeKeys.all, 'primary', month] as const,
};

export async function getPrimaryHouseholdMonth(month: string): Promise<HouseholdMonthResponse> {
  const data = await apiClient.get<HouseholdMonthResponse>('households/primary/month', {
    query: { month },
  });
  if (!data) throw new Error('Unexpected empty household response.');
  return data;
}

export async function updateHousehold(
  householdId: string,
  input: UpdateHouseholdRequest,
): Promise<{ household: HouseholdDto }> {
  const data = await apiClient.patch<{ household: HouseholdDto }>(
    `households/${householdId}`,
    input,
  );
  if (!data) throw new Error('Unexpected empty household response.');
  return data;
}
