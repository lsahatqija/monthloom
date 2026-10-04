import type {
  CreateHouseholdTransactionRequest,
  HouseholdDto,
  HouseholdMonthResponse,
  HouseholdTransaction,
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

export async function createHouseholdTransaction(
  householdId: string,
  input: CreateHouseholdTransactionRequest,
): Promise<{ transaction: HouseholdTransaction }> {
  const data = await apiClient.post<{ transaction: HouseholdTransaction }>(
    `households/${householdId}/transactions`,
    input,
  );
  if (!data) throw new Error('Unexpected empty transaction response.');
  return data;
}
