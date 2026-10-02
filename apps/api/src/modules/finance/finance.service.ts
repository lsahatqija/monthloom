import type { HouseholdMonthResponse, UpdateHouseholdRequest } from '@template/contracts';

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

    const transactions = await this.financeRepository.getMonth(household.id, month);
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
      transactions,
    };
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
