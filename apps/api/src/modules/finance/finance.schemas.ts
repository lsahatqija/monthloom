import {
  createHouseholdRequestSchema,
  createHouseholdTransactionRequestSchema,
  householdMonthQuerySchema,
  removeHouseholdTransactionQuerySchema,
  transferHouseholdOwnershipRequestSchema,
  updateHouseholdRequestSchema,
  updateHouseholdTransactionRequestSchema,
} from '@template/contracts';
import { z } from 'zod';

export {
  createHouseholdRequestSchema,
  createHouseholdTransactionRequestSchema,
  householdMonthQuerySchema,
  removeHouseholdTransactionQuerySchema,
  transferHouseholdOwnershipRequestSchema,
  updateHouseholdRequestSchema,
  updateHouseholdTransactionRequestSchema,
};
export const householdIdParamsSchema = z.object({ id: z.string().uuid() });
export const householdMemberParamsSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
});
export const householdTransactionParamsSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
});
