import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from '../common/identifiers.js';
import { Constants } from '../constants.js';
import { publicUserSchema } from '../users/user.schemas.js';

export const financialIconSchema = z.enum(Constants.FINANCIAL_ICONS);
export const householdIconSchema = z.enum(Constants.HOUSEHOLD_ICONS);
export const expenseTypeSchema = z.enum(Constants.EXPENSE_TYPES);
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
  icon: householdIconSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  ownerId: idSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

const householdDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(Constants.HOUSEHOLD_NAME_MIN_LENGTH, 'Household name is required')
    .max(Constants.HOUSEHOLD_NAME_MAX_LENGTH),
  icon: householdIconSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Choose a valid color'),
});

export const createHouseholdRequestSchema = householdDetailsSchema;
export const updateHouseholdRequestSchema = householdDetailsSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one household change');

export const householdMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use YYYY-MM format'),
});

const sourceNameSchema = z
  .string()
  .trim()
  .min(1, 'Source name is required')
  .max(Constants.DISPLAY_NAME_MAX_LENGTH);

export const householdSourceSchema = z.object({
  id: idSchema,
  displayName: sourceNameSchema,
  key: sourceNameSchema,
  aliases: z.array(sourceNameSchema).min(1).max(Constants.SOURCE_ALIAS_MAX_COUNT),
});

export const createHouseholdSourceRequestSchema = z.object({
  displayName: sourceNameSchema,
  aliases: z.array(sourceNameSchema).max(Constants.SOURCE_ALIAS_MAX_COUNT - 1),
});

export const updateHouseholdSourceRequestSchema = createHouseholdSourceRequestSchema;
export const copyHouseholdSourcesRequestSchema = z
  .object({
    targetHouseholdId: idSchema,
    sourceIds: z.array(idSchema).min(1, 'Select at least one source'),
  })
  .superRefine((input, context) => {
    if (new Set(input.sourceIds).size !== input.sourceIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceIds'],
        message: 'Each source can only be selected once',
      });
    }
  });

export const householdSourceResponseSchema = z.object({ source: householdSourceSchema });
export const householdSourceListResponseSchema = z.object({
  sources: z.array(householdSourceSchema),
});
export const copyHouseholdSourcesResponseSchema = z.object({
  copiedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});

export const householdTransactionSchema = z.object({
  id: idSchema,
  kind: z.enum(['income', 'expense']),
  type: expenseTypeSchema.nullable(),
  date: calendarDateSchema,
  icon: financialIconSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  amount: z.string(),
  recurring: z.boolean(),
  expiresOn: calendarDateSchema.nullable(),
  projected: z.boolean(),
  user: publicUserSchema.pick({
    id: true,
    displayName: true,
    profileImage: true,
    desiredColor: true,
  }),
  source: householdSourceSchema,
});

export const householdMemberSchema = publicUserSchema.pick({
  id: true,
  displayName: true,
  profileImage: true,
  desiredColor: true,
});

export const managedHouseholdMemberSchema = householdMemberSchema.extend({
  joinedAt: isoDateTimeSchema,
});

export const managedHouseholdSchema = householdSchema.extend({
  members: z.array(managedHouseholdMemberSchema),
  isPrimary: z.boolean(),
});

export const householdListResponseSchema = z.object({
  households: z.array(managedHouseholdSchema),
});

export const transferHouseholdOwnershipRequestSchema = z.object({
  newOwnerId: idSchema,
});

const householdTransactionInputSchema = z
  .object({
    kind: z.enum(['income', 'expense']),
    type: expenseTypeSchema.nullable(),
    date: calendarDateSchema,
    sourceId: idSchema,
    icon: financialIconSchema,
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Choose a valid color'),
    amount: transactionAmountSchema,
    userId: idSchema,
    recurring: z.boolean(),
    expiresOn: calendarDateSchema.nullable(),
  })
  .superRefine((input, context) => {
    if (input.kind === 'expense' && !input.type) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'Expense type is required',
      });
    }
    if (input.kind === 'income' && input.type) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'Income transactions cannot have an expense type',
      });
    }
    if (input.expiresOn && input.expiresOn < input.date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresOn'],
        message: 'Expiration date cannot be before the transaction date',
      });
    }
  });

export const createHouseholdTransactionRequestSchema = householdTransactionInputSchema;

export const transactionEditScopeSchema = z.enum([
  'current',
  'current_and_future',
  'past_current_and_future',
]);

export const transactionSeriesSelectionSchema = z
  .object({
    past: z.boolean(),
    current: z.boolean(),
    future: z.boolean(),
  })
  .refine((selection) => selection.past || selection.current || selection.future, {
    message: 'Choose at least one recurring transaction',
  });

export const updateHouseholdTransactionRequestSchema = z.object({
  transaction: householdTransactionInputSchema,
  selection: transactionSeriesSelectionSchema,
});

export const removeHouseholdTransactionQuerySchema = z.object({
  scope: transactionEditScopeSchema,
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
export const householdInvitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid household invitation token');
export const householdInvitationSchema = z.object({
  household: householdSchema.pick({ id: true, name: true, icon: true, color: true }),
  expiresAt: isoDateTimeSchema,
});
export const createHouseholdInvitationResponseSchema = householdInvitationSchema.extend({
  token: householdInvitationTokenSchema,
});
export const acceptHouseholdInvitationResponseSchema = z.object({ householdId: idSchema });
export const householdTransactionResponseSchema = z.object({
  transaction: householdTransactionSchema,
});

export type HouseholdDto = z.infer<typeof householdSchema>;
export type ManagedHousehold = z.infer<typeof managedHouseholdSchema>;
export type CreateHouseholdRequest = z.infer<typeof createHouseholdRequestSchema>;
export type UpdateHouseholdRequest = z.infer<typeof updateHouseholdRequestSchema>;
export type TransferHouseholdOwnershipRequest = z.infer<
  typeof transferHouseholdOwnershipRequestSchema
>;
export type HouseholdTransaction = z.infer<typeof householdTransactionSchema>;
export type HouseholdSource = z.infer<typeof householdSourceSchema>;
export type CreateHouseholdSourceRequest = z.infer<typeof createHouseholdSourceRequestSchema>;
export type UpdateHouseholdSourceRequest = z.infer<typeof updateHouseholdSourceRequestSchema>;
export type CopyHouseholdSourcesRequest = z.infer<typeof copyHouseholdSourcesRequestSchema>;
export type CopyHouseholdSourcesResponse = z.infer<typeof copyHouseholdSourcesResponseSchema>;
export type CreateHouseholdTransactionRequest = z.infer<
  typeof createHouseholdTransactionRequestSchema
>;
export type TransactionEditScope = z.infer<typeof transactionEditScopeSchema>;
export type TransactionSeriesSelection = z.infer<typeof transactionSeriesSelectionSchema>;
export type UpdateHouseholdTransactionRequest = z.infer<
  typeof updateHouseholdTransactionRequestSchema
>;
export type HouseholdMonthResponse = z.infer<typeof householdMonthResponseSchema>;
export type HouseholdInvitation = z.infer<typeof householdInvitationSchema>;
export type CreateHouseholdInvitationResponse = z.infer<
  typeof createHouseholdInvitationResponseSchema
>;
export type AcceptHouseholdInvitationResponse = z.infer<
  typeof acceptHouseholdInvitationResponseSchema
>;
