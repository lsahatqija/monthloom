import { NotFoundError } from '../../shared/errors/index.js';

import type { HouseholdRecord } from './finance.types.js';

export function serializeHousehold(household: HouseholdRecord | null) {
  if (!household) throw new NotFoundError('No household was found.', 'HOUSEHOLD_NOT_FOUND');
  return {
    ...household,
    createdAt: household.createdAt.toISOString(),
    updatedAt: household.updatedAt.toISOString(),
  };
}
