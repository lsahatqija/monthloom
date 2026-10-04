import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from '../common/identifiers.js';
import { Constants } from '../constants.js';
import { publicUserSchema } from '../users/user.schemas.js';

export const financialIconSchema = z.enum(Constants.FINANCIAL_ICONS);
const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format');
const transactionAmountSchema = z
  .string()
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/, 'Enter a positive amount with up to two decimals')
  .refine((amount) => Number(amount) > 0, 'Amount must be greater than zero');

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
  date: calendarDateSchema,
  icon: financialIconSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  amount: z.string(),
  recurring: z.boolean(),
  expiresOn: calendarDateSchema.nullable(),
  user: publicUserSchema.pick({
    id: true,
    displayName: true,
    profileImage: true,
    desiredColor: true,
  }),
  source: z.object({ id: idSchema, displayName: z.string() }),
});

export const householdMemberSchema = publicUserSchema.pick({
  id: true,
  displayName: true,
  profileImage: true,
  desiredColor: true,
});

export const householdSourceSchema = z.object({
  id: idSchema,
  displayName: z.string().min(1).max(Constants.DISPLAY_NAME_MAX_LENGTH),
});

export const createHouseholdTransactionRequestSchema = z
  .object({
    kind: z.enum(['income', 'expense']),
    date: calendarDateSchema,
    source: z.string().trim().min(1, 'Source is required').max(Constants.DISPLAY_NAME_MAX_LENGTH),
    icon: financialIconSchema,
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Choose a valid color'),
    amount: transactionAmountSchema,
    userId: idSchema,
    recurring: z.boolean(),
    expiresOn: calendarDateSchema.nullable(),
  })
  .superRefine((input, context) => {
    if (input.expiresOn && input.expiresOn < input.date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresOn'],
        message: 'Expiration date cannot be before the transaction date',
      });
    }
  });

export const householdMonthResponseSchema = z.object({
  household: householdSchema,
  month: householdMonthQuerySchema.shape.month,
  summary: z.object({
    income: z.string(),
    expenses: z.string(),
    leftover: z.string(),
  }),
  members: z.array(householdMemberSchema),
  sources: z.array(householdSourceSchema),
  transactions: z.array(householdTransactionSchema),
});

export const householdResponseSchema = z.object({ household: householdSchema });
export const householdTransactionResponseSchema = z.object({
  transaction: householdTransactionSchema,
});

export type HouseholdDto = z.infer<typeof householdSchema>;
export type UpdateHouseholdRequest = z.infer<typeof updateHouseholdRequestSchema>;
export type HouseholdTransaction = z.infer<typeof householdTransactionSchema>;
export type CreateHouseholdTransactionRequest = z.infer<
  typeof createHouseholdTransactionRequestSchema
>;
export type HouseholdMonthResponse = z.infer<typeof householdMonthResponseSchema>;
