import type {
  CreateHouseholdTransactionRequest,
  HouseholdMonthResponse,
  HouseholdTransaction,
} from '@template/contracts';

import type { HouseholdRecord } from './finance.types.js';

export interface FinanceRepository {
  createDefaultHousehold(userId: string, displayName: string): Promise<HouseholdRecord>;
  findPrimaryHousehold(userId: string): Promise<HouseholdRecord | null>;
  getMonth(householdId: string, month: string): Promise<HouseholdMonthResponse['transactions']>;
  getMembers(householdId: string): Promise<HouseholdMonthResponse['members']>;
  getSources(householdId: string): Promise<HouseholdMonthResponse['sources']>;
  createTransaction(
    householdId: string,
    input: CreateHouseholdTransactionRequest,
  ): Promise<HouseholdTransaction>;
  isMember(householdId: string, userId: string): Promise<boolean>;
  updateHouseholdName(householdId: string, name: string): Promise<HouseholdRecord>;
}
