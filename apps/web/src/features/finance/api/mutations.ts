import type {
  CopyHouseholdSourcesRequest,
  CreateHouseholdInvitationRequest,
  CreateHouseholdRequest,
  CreateHouseholdSourceRequest,
  CreateHouseholdTransactionRequest,
  TransactionEditScope,
  UpdateHouseholdRequest,
  UpdateHouseholdSourceRequest,
  UpdateHouseholdTransactionRequest,
} from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createHousehold,
  createHouseholdInvitation,
  createHouseholdSource,
  createHouseholdTransaction,
  copyHouseholdSources,
  deleteHousehold,
  deleteHouseholdSource,
  leaveHousehold,
  removeHouseholdMember,
  removeHouseholdTransaction,
  setPrimaryHousehold,
  updateHousehold,
  updateHouseholdSource,
  updateHouseholdTransaction,
} from '../finance.api';

import { financeKeys } from './keys';

function useFinanceInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: financeKeys.all });
}

export function useTransactionMutations() {
  const invalidate = useFinanceInvalidation();
  return {
    create: useMutation({
      mutationFn: (input: { householdId: string; transaction: CreateHouseholdTransactionRequest }) =>
        createHouseholdTransaction(input.householdId, input.transaction),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: {
        householdId: string;
        transactionId: string;
        transaction: UpdateHouseholdTransactionRequest;
      }) => updateHouseholdTransaction(input.householdId, input.transactionId, input.transaction),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (input: {
        householdId: string;
        transactionId: string;
        scope: TransactionEditScope;
      }) => removeHouseholdTransaction(input.householdId, input.transactionId, input.scope),
      onSuccess: invalidate,
    }),
  };
}

export function useHouseholdMutations() {
  const invalidate = useFinanceInvalidation();
  return {
    create: useMutation({ mutationFn: (input: CreateHouseholdRequest) => createHousehold(input), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: (input: { householdId: string; household: UpdateHouseholdRequest }) =>
        updateHousehold(input.householdId, input.household),
      onSuccess: invalidate,
    }),
    setPrimary: useMutation({ mutationFn: setPrimaryHousehold, onSuccess: invalidate }),
    removeMember: useMutation({
      mutationFn: (input: { householdId: string; memberId: string }) =>
        removeHouseholdMember(input.householdId, input.memberId),
      onSuccess: invalidate,
    }),
    leave: useMutation({
      mutationFn: (input: { householdId: string; newOwnerId?: string }) =>
        leaveHousehold(input.householdId, input.newOwnerId),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteHousehold, onSuccess: invalidate }),
    invite: useMutation({
      mutationFn: (input: { householdId: string; invitation: CreateHouseholdInvitationRequest }) =>
        createHouseholdInvitation(input.householdId, input.invitation),
    }),
  };
}

export function useSourceMutations() {
  const invalidate = useFinanceInvalidation();
  return {
    create: useMutation({
      mutationFn: (input: { householdId: string; source: CreateHouseholdSourceRequest }) =>
        createHouseholdSource(input.householdId, input.source),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: {
        householdId: string;
        sourceId: string;
        source: UpdateHouseholdSourceRequest;
      }) => updateHouseholdSource(input.householdId, input.sourceId, input.source),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (input: { householdId: string; sourceId: string }) =>
        deleteHouseholdSource(input.householdId, input.sourceId),
      onSuccess: invalidate,
    }),
    copy: useMutation({
      mutationFn: (input: { sourceHouseholdId: string; request: CopyHouseholdSourcesRequest }) =>
        copyHouseholdSources(input.sourceHouseholdId, input.request),
      onSuccess: invalidate,
    }),
  };
}
