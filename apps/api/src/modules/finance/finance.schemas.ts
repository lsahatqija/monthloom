import {
  copyHouseholdSourcesRequestSchema,
  createHouseholdSourceRequestSchema,
  createHouseholdRequestSchema,
  createHouseholdTransactionRequestSchema,
  householdMonthQuerySchema,
  householdInvitationTokenSchema,
  removeHouseholdTransactionQuerySchema,
  transferHouseholdOwnershipRequestSchema,
  updateHouseholdRequestSchema,
  updateHouseholdSourceRequestSchema,
  updateHouseholdTransactionRequestSchema,
} from '@template/contracts';
import { z } from 'zod';

export {
  copyHouseholdSourcesRequestSchema,
  createHouseholdSourceRequestSchema,
  createHouseholdRequestSchema,
  createHouseholdTransactionRequestSchema,
  householdMonthQuerySchema,
  householdInvitationTokenSchema,
  removeHouseholdTransactionQuerySchema,
  transferHouseholdOwnershipRequestSchema,
  updateHouseholdRequestSchema,
  updateHouseholdSourceRequestSchema,
  updateHouseholdTransactionRequestSchema,
};
export const householdIdParamsSchema = z.object({ id: z.string().uuid() });
export const householdInvitationParamsSchema = z.object({ token: householdInvitationTokenSchema });
export const householdMemberParamsSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
});
export const householdTransactionParamsSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
});
export const householdSourceParamsSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
});
