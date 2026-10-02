import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from '../common/identifiers.js';
import { Constants } from '../constants.js';
import { publicUserSchema } from '../users/user.schemas.js';

export const financialIconSchema = z.enum(Constants.FINANCIAL_ICONS);

export const householdSchema = z.object({
  id: idSchema,
  name: z
    .string()
    .min(Constants.HOUSEHOLD_NAME_MIN_LENGTH)
    .max(Constants.HOUSEHOLD_NAME_MAX_LENGTH),
  currency: z.string().regex(/^[A-Z]{3}$/),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const updateHouseholdRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(Constants.HOUSEHOLD_NAME_MIN_LENGTH, 'Household name is required')
    .max(Constants.HOUSEHOLD_NAME_MAX_LENGTH),
});

export const householdMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use YYYY-MM format'),
});

export const householdTransactionSchema = z.object({
  id: idSchema,
  kind: z.enum(['income', 'expense']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  icon: financialIconSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  amount: z.string(),
  user: publicUserSchema.pick({
    id: true,
    displayName: true,
    profileImage: true,
    desiredColor: true,
  }),
  source: z.object({ id: idSchema, displayName: z.string() }),
});

export const householdMonthResponseSchema = z.object({
  household: householdSchema,
  month: householdMonthQuerySchema.shape.month,
  summary: z.object({
    income: z.string(),
    expenses: z.string(),
    leftover: z.string(),
  }),
  transactions: z.array(householdTransactionSchema),
});

export const householdResponseSchema = z.object({ household: householdSchema });

export type HouseholdDto = z.infer<typeof householdSchema>;
export type UpdateHouseholdRequest = z.infer<typeof updateHouseholdRequestSchema>;
export type HouseholdTransaction = z.infer<typeof householdTransactionSchema>;
export type HouseholdMonthResponse = z.infer<typeof householdMonthResponseSchema>;
