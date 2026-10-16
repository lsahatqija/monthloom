import type { HouseholdMonthResponse } from '@monthloom/contracts';

import { NotFoundError } from '../../shared/errors/index.js';

import type { HouseholdRepository, SourceRepository, TransactionRepository } from './finance.repository.js';
import { requireHouseholdMember } from './household-access.js';
import { serializeHousehold } from './household-serialization.js';
import { fromCents, toCents } from './rules/money.js';

export class MonthViewService {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly sources: SourceRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async getPrimaryMonth(userId: string, month: string): Promise<HouseholdMonthResponse> {
    const household = await this.households.findPrimaryHousehold(userId);
    if (!household) throw new NotFoundError('You do not have an active household yet.');
    return this.getHouseholdMonth(household.id, userId, month);
  }

  async getHouseholdMonth(
    householdId: string,
    userId: string,
    month: string,
  ): Promise<HouseholdMonthResponse> {
    await requireHouseholdMember(this.households, householdId, userId);
    const household = await this.households.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.');

    const [transactions, members, sources] = await Promise.all([
      this.transactions.getMonth(householdId, month),
      this.households.getMembers(householdId),
      this.sources.getSources(householdId),
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
}

