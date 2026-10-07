import type { Constants } from '@template/contracts';

import type { User } from '../users/user.types.js';

export type FinancialIcon = (typeof Constants.FINANCIAL_ICONS)[number];
export type HouseholdIcon = (typeof Constants.HOUSEHOLD_ICONS)[number];
export type ExpenseType = (typeof Constants.EXPENSE_TYPES)[number];

export interface HouseholdRecord {
  id: string;
  name: string;
  currency: string;
  icon: HouseholdIcon;
  color: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdMember {
  householdId: string;
  userId: string;
  isPrimary: boolean;
  joinedAt: Date;
}

export interface HouseholdInvitationRecord {
  id: string;
  householdId: string;
  householdName: string;
  householdIcon: HouseholdIcon;
  householdColor: string;
  expiresAt: Date;
  acceptedAt: Date | null;
}

export type AcceptInvitationResult =
  | { status: 'accepted'; householdId: string }
  | { status: 'already_member'; householdId: string }
  | { status: 'expired' }
  | { status: 'used' }
  | { status: 'not_found' };

export interface ManagedHouseholdRecord extends HouseholdRecord {
  isPrimary: boolean;
  members: Array<
    Pick<User, 'id' | 'displayName' | 'profileImage' | 'desiredColor'> & { joinedAt: Date }
  >;
}

export interface Source {
  id: string;
  householdId: string;
  displayName: string;
  key: string;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface Transaction {
  id: string;
  householdId: string;
  sourceId: string;
  userId: string;
  icon: FinancialIcon;
  color: string;
  /** Exact decimal value as returned by PostgreSQL numeric. */
  amount: string;
  /** Calendar date in YYYY-MM-DD format. */
  date: string;
  recurring: boolean;
  /** Optional final calendar date for a recurring transaction. */
  expiresOn: string | null;
  /** Groups persisted occurrences that belong to the same recurring transaction. */
  recurrenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Income extends Transaction {
  source: Source;
  user: User;
}

export interface Expense extends Transaction {
  type: ExpenseType;
  source: Source;
  user: User;
}

/** Fully loaded household aggregate. Relations are stored in normalized database tables. */
export interface Household extends HouseholdRecord {
  users: User[];
  incomes: Income[];
  expenses: Expense[];
}
