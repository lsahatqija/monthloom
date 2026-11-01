import type { HouseholdTransactionRangeResponse } from '@monthloom/contracts';

import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

import type {
  HouseholdRepository,
  SourceRepository,
  TransactionRepository,
} from './finance.repository.js';
import { requireHouseholdMember } from './household-access.js';
import { serializeHousehold } from './household-serialization.js';
import { addMonths, currentMonth } from './rules/dates.js';

export class RangeViewService {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly sources: SourceRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async getHouseholdRange(
    householdId: string,
    userId: string,
    from: string,
    to: string,
  ): Promise<HouseholdTransactionRangeResponse> {
    const current = currentMonth();
    if (from < addMonths(current, -60) || to > addMonths(current, 12)) {
      throw new ValidationError('Transaction range is outside the supported period.', {
        from: ['Months may be at most five years before the current month.'],
        to: ['Months may be at most one year after the current month.'],
      });
    }

    await requireHouseholdMember(this.households, householdId, userId);
    const household = await this.households.findHousehold(householdId);
    if (!household) throw new NotFoundError('Household was not found.', 'HOUSEHOLD_NOT_FOUND');

    const [transactions, members, sources] = await Promise.all([
      this.transactions.getRange(householdId, from, to),
      this.households.getMembers(householdId),
      this.sources.getSources(householdId),
    ]);
    const currentMember = members.find((member) => member.id === userId);
    return {
      household: serializeHousehold(household),
      from,
      to,
      members: currentMember
        ? [currentMember, ...members.filter((member) => member.id !== userId)]
        : members,
      sources,
      transactions,
    };
  }
}
