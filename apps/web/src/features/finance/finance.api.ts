import type {
  CreateHouseholdTransactionRequest,
  HouseholdDto,
  HouseholdMonthResponse,
  HouseholdTransaction,
  TransactionEditScope,
  UpdateHouseholdRequest,
  UpdateHouseholdTransactionRequest,
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

export async function updateHouseholdTransaction(
  householdId: string,
  transactionId: string,
  input: UpdateHouseholdTransactionRequest,
): Promise<{ transaction: HouseholdTransaction }> {
  const data = await apiClient.patch<{ transaction: HouseholdTransaction }>(
    `households/${householdId}/transactions/${transactionId}`,
    input,
  );
  if (!data) throw new Error('Unexpected empty transaction response.');
  return data;
}

export async function removeHouseholdTransaction(
  householdId: string,
  transactionId: string,
  scope: TransactionEditScope,
): Promise<void> {
  await apiClient.delete(`households/${householdId}/transactions/${transactionId}`, {
    query: { scope },
  });
}
