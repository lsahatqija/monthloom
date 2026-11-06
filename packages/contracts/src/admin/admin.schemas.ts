import { z } from 'zod';

import { isoDateTimeSchema } from '../common/identifiers.js';

export const adminLogLevelSchema = z.enum(['warn', 'error', 'fatal']);
export type AdminLogLevel = z.infer<typeof adminLogLevelSchema>;

export const adminLogEntrySchema = z.object({
  timestamp: isoDateTimeSchema,
  level: adminLogLevelSchema,
  category: z.string(),
  message: z.string(),
  detail: z.string().optional(),
});

export const adminDashboardResponseSchema = z.object({
  generatedAt: isoDateTimeSchema,
  metrics: z.object({
    totalUsers: z.number().int().nonnegative(),
    activeUsers: z.number().int().nonnegative(),
    households: z.number().int().nonnegative(),
    transactions: z.number().int().nonnegative(),
    incomes: z.number().int().nonnegative(),
    expenses: z.number().int().nonnegative(),
  }),
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'critical', 'unavailable']),
    loggingAvailable: z.boolean(),
    windowDays: z.number().int().positive(),
    counts: z.object({
      warn: z.number().int().nonnegative(),
      error: z.number().int().nonnegative(),
      fatal: z.number().int().nonnegative(),
    }),
    last24Hours: z.object({
      warn: z.number().int().nonnegative(),
      error: z.number().int().nonnegative(),
      fatal: z.number().int().nonnegative(),
    }),
    entries: z.array(adminLogEntrySchema),
  }),
});

export type AdminLogEntry = z.infer<typeof adminLogEntrySchema>;
export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>;
