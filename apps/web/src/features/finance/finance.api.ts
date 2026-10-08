import type {
  CopyHouseholdSourcesRequest,
  CopyHouseholdSourcesResponse,
  CreateHouseholdInvitationRequest,
  CreateHouseholdSourceRequest,
  CreateHouseholdTransactionRequest,
  CreateHouseholdRequest,
  CreateHouseholdInvitationResponse,
  HouseholdDto,
  HouseholdInvitation,
  HouseholdMonthResponse,
  HouseholdSource,
  HouseholdTransaction,
  ManagedHousehold,
  TransactionEditScope,
  UpdateHouseholdRequest,
  UpdateHouseholdSourceRequest,
  UpdateHouseholdTransactionRequest,
} from '@template/contracts';

import { apiClient } from '../../lib/api/client';

export const financeKeys = {
  all: ['finance'] as const,
  households: () => [...financeKeys.all, 'households'] as const,
  primaryMonth: (month: string) => [...financeKeys.all, 'primary', month] as const,
  householdMonth: (householdId: string, month: string) =>
    [...financeKeys.all, 'household', householdId, month] as const,
  sources: (householdId: string) => [...financeKeys.all, 'sources', householdId] as const,
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

export async function createHouseholdInvitation(
  householdId: string,
  input: CreateHouseholdInvitationRequest,
): Promise<CreateHouseholdInvitationResponse> {
  const data = await apiClient.post<CreateHouseholdInvitationResponse>(
    `households/${householdId}/invitations`,
    input,
  );
  if (!data) throw new Error('Unexpected empty invitation response.');
  return data;
}

export async function getHouseholdInvitation(token: string): Promise<HouseholdInvitation> {
  const data = await apiClient.get<HouseholdInvitation>(`households/invitations/${token}`);
  if (!data) throw new Error('Unexpected empty invitation response.');
  return data;
}

export async function acceptHouseholdInvitation(token: string): Promise<{ householdId: string }> {
  const data = await apiClient.post<{ householdId: string }>(
    `households/invitations/${token}/accept`,
  );
  if (!data) throw new Error('Unexpected empty invitation response.');
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

export async function createHouseholdSource(
  householdId: string,
  input: CreateHouseholdSourceRequest,
): Promise<{ source: HouseholdSource }> {
  const data = await apiClient.post<{ source: HouseholdSource }>(
    `households/${householdId}/sources`,
    input,
  );
  if (!data) throw new Error('Unexpected empty source response.');
  return data;
}

export async function getHouseholdSources(householdId: string): Promise<HouseholdSource[]> {
  const data = await apiClient.get<{ sources: HouseholdSource[] }>(
    `households/${householdId}/sources`,
  );
  if (!data) throw new Error('Unexpected empty sources response.');
  return data.sources;
}

export async function updateHouseholdSource(
  householdId: string,
  sourceId: string,
  input: UpdateHouseholdSourceRequest,
): Promise<{ source: HouseholdSource }> {
  const data = await apiClient.patch<{ source: HouseholdSource }>(
    `households/${householdId}/sources/${sourceId}`,
    input,
  );
  if (!data) throw new Error('Unexpected empty source response.');
  return data;
}

export async function deleteHouseholdSource(householdId: string, sourceId: string): Promise<void> {
  await apiClient.delete(`households/${householdId}/sources/${sourceId}`);
}

export async function copyHouseholdSources(
  sourceHouseholdId: string,
  input: CopyHouseholdSourcesRequest,
): Promise<CopyHouseholdSourcesResponse> {
  const data = await apiClient.post<CopyHouseholdSourcesResponse>(
    `households/${sourceHouseholdId}/sources/copy`,
    input,
  );
  if (!data) throw new Error('Unexpected empty copy response.');
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
