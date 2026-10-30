import { AuthorizationError } from '../../shared/errors/index.js';

import type { HouseholdRepository } from './finance.repository.js';

export async function requireHouseholdMember(
  households: HouseholdRepository,
  householdId: string,
  userId: string,
): Promise<void> {
  if (!(await households.isMember(householdId, userId))) {
    throw new AuthorizationError(
      'You are not a member of this household.',
      'HOUSEHOLD_ACCESS_DENIED',
    );
  }
}
