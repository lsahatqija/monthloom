import type {
  CreateHouseholdTransactionRequest,
  CreateHouseholdRequest,
  HouseholdMonthResponse,
  TransactionEditScope,
  UpdateHouseholdRequest,
  UpdateHouseholdTransactionRequest,
} from '@template/contracts';

import { AuthorizationError, ConflictError, NotFoundError } from '../../shared/errors/index.js';

import type { FinanceRepository } from './finance.repository.js';
import type { HouseholdRecord } from './finance.types.js';

function serializeHousehold(household: HouseholdRecord | null) {
  if (!household) throw new NotFoundError('No household was found.');
  return {
    ...household,
    createdAt: household.createdAt.toISOString(),
    updatedAt: household.updatedAt.toISOString(),
  };
}

function toCents(amount: string): number {
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

function fromCents(amount: number): string {
  return (amount / 100).toFixed(2);
}

export class FinanceService {
  constructor(private readonly financeRepository: FinanceRepository) {}

  async createHousehold(userId: string, input: CreateHouseholdRequest) {
    return serializeHousehold(await this.financeRepository.createHousehold(userId, input));
  }

  async listHouseholds(userId: string) {
    const households = await this.financeRepository.listHouseholds(userId);
    return households.map((household) => ({
      ...serializeHousehold(household),
      isPrimary: household.isPrimary,
      members: household.members.map((member) => ({
        ...member,
        joinedAt: member.joinedAt.toISOString(),
      })),
    }));
  }

  async getPrimaryMonth(userId: string, month: string): Promise<HouseholdMonthResponse> {
    const household = await this.financeRepository.findPrimaryHousehold(userId);
    if (!household) throw new NotFoundError('You do not have an active household yet.');
    return this.getHouseholdMonth(household.id, userId, month);
  }

  async getHouseholdMonth(
    householdId: string,
    userId: string,
    month: string,
  ): Promise<HouseholdMonthResponse> {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');

    const [transactions, members, sources] = await Promise.all([
      this.financeRepository.getMonth(householdId, month),
      this.financeRepository.getMembers(householdId),
      this.financeRepository.getSources(householdId),
    ]);
    const currentMember = members.find((member) => member.id === userId);
    const orderedMembers = currentMember
      ? [currentMember, ...members.filter((member) => member.id !== userId)]
      : members;
    const income = transactions
      .filter((entry) => entry.kind === 'income')
      .reduce((sum, entry) => sum + toCents(entry.amount), 0);
    const expenses = transactions
      .filter((entry) => entry.kind === 'expense')
      .reduce((sum, entry) => sum + toCents(entry.amount), 0);

    return {
      household: serializeHousehold(household),
      month,
      summary: {
        income: fromCents(income),
        expenses: fromCents(expenses),
        leftover: fromCents(income - expenses),
      },
      members: orderedMembers,
      sources,
      transactions,
    };
  }

  async createTransaction(
    householdId: string,
    requestingUserId: string,
    input: CreateHouseholdTransactionRequest,
  ) {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    if (!(await this.financeRepository.isMember(householdId, input.userId))) {
      throw new AuthorizationError('The selected user is not a member of this household.');
    }
    return this.financeRepository.createTransaction(householdId, input);
  }

  async updateTransaction(
    householdId: string,
    transactionId: string,
    requestingUserId: string,
    input: UpdateHouseholdTransactionRequest,
  ) {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    if (!(await this.financeRepository.isMember(householdId, input.transaction.userId))) {
      throw new AuthorizationError('The selected user is not a member of this household.');
    }
    const transaction = await this.financeRepository.updateTransaction(
      householdId,
      transactionId,
      input,
    );
    if (!transaction) throw new NotFoundError('Transaction was not found.');
    return transaction;
  }

  async removeTransaction(
    householdId: string,
    transactionId: string,
    requestingUserId: string,
    scope: TransactionEditScope,
  ): Promise<void> {
    if (!(await this.financeRepository.isMember(householdId, requestingUserId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    if (!(await this.financeRepository.removeTransaction(householdId, transactionId, scope))) {
      throw new NotFoundError('Transaction was not found.');
    }
  }

  async updateHousehold(householdId: string, userId: string, input: UpdateHouseholdRequest) {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    return serializeHousehold(await this.financeRepository.updateHousehold(householdId, input));
  }

  async setPrimaryHousehold(householdId: string, userId: string): Promise<void> {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    await this.financeRepository.setPrimaryHousehold(householdId, userId);
  }

  async removeMember(
    householdId: string,
    memberId: string,
    requestingUserId: string,
  ): Promise<void> {
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');
    if (household.ownerId !== requestingUserId) {
      throw new AuthorizationError('Only the household owner can remove members.');
    }
    if (memberId === household.ownerId) {
      throw new ConflictError('The owner must leave the household and transfer ownership.');
    }
    if (!(await this.financeRepository.removeMember(householdId, memberId))) {
      throw new NotFoundError('Household member was not found.');
    }
  }

  async leaveHousehold(householdId: string, userId: string, newOwnerId?: string): Promise<void> {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');

    if (household.ownerId === userId) {
      const members = await this.financeRepository.getMembers(householdId);
      if (members.length === 1) {
        throw new ConflictError('You cannot leave a household with no other members.');
      }
      if (!newOwnerId) {
        throw new ConflictError('Select a new owner before leaving the household.');
      }
      if (
        newOwnerId === userId ||
        !(await this.financeRepository.isMember(householdId, newOwnerId))
      ) {
        throw new ConflictError('The new owner must be another household member.');
      }
    } else if (newOwnerId) {
      throw new ConflictError('Only the current owner can transfer ownership.');
    }

    if (!(await this.financeRepository.leaveHousehold(householdId, userId, newOwnerId))) {
      throw new NotFoundError('Household member was not found.');
    }
  }

  async deleteHousehold(householdId: string, userId: string): Promise<void> {
    const household = await this.financeRepository.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');
    if (household.ownerId !== userId) {
      throw new AuthorizationError('Only the household owner can delete it.');
    }
    if (!(await this.financeRepository.deleteHousehold(householdId))) {
      throw new NotFoundError('Household was not found.');
    }
  }
}
