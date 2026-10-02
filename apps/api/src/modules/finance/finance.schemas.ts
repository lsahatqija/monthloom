import { householdMonthQuerySchema, updateHouseholdRequestSchema } from '@template/contracts';
import { z } from 'zod';

export { householdMonthQuerySchema, updateHouseholdRequestSchema };
export const householdIdParamsSchema = z.object({ id: z.string().uuid() });
