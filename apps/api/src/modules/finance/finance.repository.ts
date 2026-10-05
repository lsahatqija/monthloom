import type {
  CreateHouseholdTransactionRequest,
  CreateHouseholdRequest,
  HouseholdMonthResponse,
  HouseholdTransaction,
  TransactionEditScope,
  UpdateHouseholdRequest,
  UpdateHouseholdTransactionRequest,
} from '@template/contracts';

import type {
  AcceptInvitationResult,
  HouseholdInvitationRecord,
  HouseholdRecord,
  ManagedHouseholdRecord,
} from './finance.types.js';

export interface FinanceRepository {
  createHousehold(userId: string, input: CreateHouseholdRequest): Promise<HouseholdRecord>;
  listHouseholds(userId: string): Promise<ManagedHouseholdRecord[]>;
  findHousehold(householdId: string): Promise<HouseholdRecord | null>;
  findPrimaryHousehold(userId: string): Promise<HouseholdRecord | null>;
  getMonth(householdId: string, month: string): Promise<HouseholdMonthResponse['transactions']>;
  getMembers(householdId: string): Promise<HouseholdMonthResponse['members']>;
  getSources(householdId: string): Promise<HouseholdMonthResponse['sources']>;
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
  isMember(householdId: string, userId: string): Promise<boolean>;
  updateHousehold(householdId: string, input: UpdateHouseholdRequest): Promise<HouseholdRecord>;
  setPrimaryHousehold(householdId: string, userId: string): Promise<void>;
  removeMember(householdId: string, userId: string): Promise<boolean>;
  leaveHousehold(householdId: string, userId: string, newOwnerId?: string): Promise<boolean>;
  deleteHousehold(householdId: string): Promise<boolean>;
  createInvitation(
    householdId: string,
    createdById: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  findInvitation(tokenHash: string): Promise<HouseholdInvitationRecord | null>;
  acceptInvitation(tokenHash: string, userId: string, now: Date): Promise<AcceptInvitationResult>;
}
