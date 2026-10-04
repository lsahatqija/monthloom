import {
  createHouseholdTransactionRequestSchema,
  householdMonthQuerySchema,
  removeHouseholdTransactionQuerySchema,
  updateHouseholdRequestSchema,
  updateHouseholdTransactionRequestSchema,
} from '@template/contracts';
import { z } from 'zod';

export {
  createHouseholdTransactionRequestSchema,
  householdMonthQuerySchema,
  removeHouseholdTransactionQuerySchema,
  updateHouseholdRequestSchema,
  updateHouseholdTransactionRequestSchema,
};
export const householdIdParamsSchema = z.object({ id: z.string().uuid() });
export const householdTransactionParamsSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
});
