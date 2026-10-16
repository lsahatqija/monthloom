import type {
  CreateHouseholdSourceRequest,
  CopyHouseholdSourcesResponse,
  CreateHouseholdTransactionRequest,
  CreateHouseholdRequest,
  HouseholdMonthResponse,
  HouseholdSource,
  HouseholdTransaction,
  TransactionEditScope,
  UpdateHouseholdRequest,
  UpdateHouseholdSourceRequest,
  UpdateHouseholdTransactionRequest,
} from '@monthloom/contracts';

import type {
  AcceptInvitationResult,
  HouseholdInvitationRecord,
  HouseholdRecord,
  ManagedHouseholdRecord,
} from './finance.types.js';

export interface HouseholdRepository {
  createHousehold(userId: string, input: CreateHouseholdRequest): Promise<HouseholdRecord>;
  listHouseholds(userId: string): Promise<ManagedHouseholdRecord[]>;
  findHousehold(householdId: string): Promise<HouseholdRecord | null>;
  findPrimaryHousehold(userId: string): Promise<HouseholdRecord | null>;
  getMembers(householdId: string): Promise<HouseholdMonthResponse['members']>;
  isMember(householdId: string, userId: string): Promise<boolean>;
  updateHousehold(householdId: string, input: UpdateHouseholdRequest): Promise<HouseholdRecord>;
  setPrimaryHousehold(householdId: string, userId: string): Promise<void>;
  removeMember(householdId: string, userId: string): Promise<boolean>;
  leaveHousehold(householdId: string, userId: string, newOwnerId?: string): Promise<boolean>;
  deleteHousehold(householdId: string): Promise<boolean>;
}

export interface SourceRepository {
  getSources(householdId: string): Promise<HouseholdMonthResponse['sources']>;
  getSource(householdId: string, sourceId: string): Promise<HouseholdSource | null>;
  createSource(
    householdId: string,
    input: CreateHouseholdSourceRequest,
  ): Promise<HouseholdSource | null>;
  updateSource(
    householdId: string,
    sourceId: string,
    input: UpdateHouseholdSourceRequest,
  ): Promise<HouseholdSource | 'not_found' | 'conflict'>;
  deleteSource(householdId: string, sourceId: string): Promise<'deleted' | 'not_found' | 'in_use'>;
  copySources(
    sourceHouseholdId: string,
    targetHouseholdId: string,
    sourceIds: string[],
  ): Promise<CopyHouseholdSourcesResponse | null>;
}

export interface TransactionRepository {
  getMonth(householdId: string, month: string): Promise<HouseholdMonthResponse['transactions']>;
  createTransaction(
    householdId: string,
    input: CreateHouseholdTransactionRequest,
  ): Promise<HouseholdTransaction>;
  updateTransaction(
    householdId: string,
    transactionId: string,
    input: UpdateHouseholdTransactionRequest,
  ): Promise<HouseholdTransaction | null>;
  removeTransaction(
    householdId: string,
    transactionId: string,
    scope: TransactionEditScope,
  ): Promise<boolean>;
}

export interface InvitationRepository {
  createInvitation(
    householdId: string,
    createdById: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  deleteInvitation(tokenHash: string): Promise<void>;
  findInvitation(tokenHash: string): Promise<HouseholdInvitationRecord | null>;
  acceptInvitation(tokenHash: string, userId: string, now: Date): Promise<AcceptInvitationResult>;
}
