import type {
  CreateHouseholdTransactionRequest,
  HouseholdMonthResponse,
  UpdateHouseholdRequest,
} from '@template/contracts';

import { AuthorizationError, NotFoundError } from '../../shared/errors/index.js';
import type { UserRepository } from '../users/user.repository.js';

import type { FinanceRepository } from './finance.repository.js';

function serializeHousehold(
  household: Awaited<ReturnType<FinanceRepository['findPrimaryHousehold']>>,
) {
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
  constructor(
    private readonly financeRepository: FinanceRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async createDefaultHousehold(userId: string, displayName: string): Promise<void> {
    await this.financeRepository.createDefaultHousehold(userId, displayName);
  }

  async getPrimaryMonth(userId: string, month: string): Promise<HouseholdMonthResponse> {
    let household = await this.financeRepository.findPrimaryHousehold(userId);
    if (!household) {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new NotFoundError('User was not found.');
      household = await this.financeRepository.createDefaultHousehold(userId, user.displayName);
    }

    const [transactions, members, sources] = await Promise.all([
      this.financeRepository.getMonth(household.id, month),
      this.financeRepository.getMembers(household.id),
      this.financeRepository.getSources(household.id),
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

  async updateHousehold(householdId: string, userId: string, input: UpdateHouseholdRequest) {
    if (!(await this.financeRepository.isMember(householdId, userId))) {
      throw new AuthorizationError('You are not a member of this household.');
    }
    return serializeHousehold(
      await this.financeRepository.updateHouseholdName(householdId, input.name),
    );
  }
}
