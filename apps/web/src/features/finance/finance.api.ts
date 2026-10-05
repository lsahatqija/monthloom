import type {
  CreateHouseholdTransactionRequest,
  CreateHouseholdRequest,
  HouseholdDto,
  HouseholdMonthResponse,
  HouseholdTransaction,
  ManagedHousehold,
  TransactionEditScope,
  UpdateHouseholdRequest,
  UpdateHouseholdTransactionRequest,
} from '@template/contracts';

import { apiClient } from '../../lib/api/client';

export const financeKeys = {
  all: ['finance'] as const,
  households: () => [...financeKeys.all, 'households'] as const,
  primaryMonth: (month: string) => [...financeKeys.all, 'primary', month] as const,
  householdMonth: (householdId: string, month: string) =>
    [...financeKeys.all, 'household', householdId, month] as const,
};

export async function getHouseholds(): Promise<ManagedHousehold[]> {
  const data = await apiClient.get<{ households: ManagedHousehold[] }>('households');
  if (!data) throw new Error('Unexpected empty households response.');
  return data.households;
}

export async function createHousehold(
  input: CreateHouseholdRequest,
): Promise<{ household: HouseholdDto }> {
  const data = await apiClient.post<{ household: HouseholdDto }>('households', input);
  if (!data) throw new Error('Unexpected empty household response.');
  return data;
}

export async function setPrimaryHousehold(householdId: string): Promise<void> {
  await apiClient.put(`households/${householdId}/primary`);
}

export async function removeHouseholdMember(householdId: string, memberId: string): Promise<void> {
  await apiClient.delete(`households/${householdId}/members/${memberId}`);
}

export async function leaveHousehold(householdId: string, newOwnerId?: string): Promise<void> {
  await apiClient.post(`households/${householdId}/leave`, newOwnerId ? { newOwnerId } : {});
}

export async function deleteHousehold(householdId: string): Promise<void> {
  await apiClient.delete(`households/${householdId}`);
}

export async function getPrimaryHouseholdMonth(month: string): Promise<HouseholdMonthResponse> {
  const data = await apiClient.get<HouseholdMonthResponse>('households/primary/month', {
    query: { month },
  });
  if (!data) throw new Error('Unexpected empty household response.');
  return data;
}

export async function getHouseholdMonth(
  householdId: string,
  month: string,
): Promise<HouseholdMonthResponse> {
  const data = await apiClient.get<HouseholdMonthResponse>(`households/${householdId}/month`, {
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
