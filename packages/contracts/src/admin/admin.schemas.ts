import { z } from 'zod';

import { isoDateTimeSchema } from '../common/identifiers.js';

export const adminAnalyticsBucketSchema = z.enum(['day', 'week']);
export type AdminAnalyticsBucket = z.infer<typeof adminAnalyticsBucketSchema>;

const calendarDateSchema = z.string().date();
const timeZoneSchema = z
  .string()
  .min(1)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid IANA timezone' },
  );

export const adminAnalyticsRangeQuerySchema = z
  .object({
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    timezone: timeZoneSchema.default('UTC'),
    bucket: adminAnalyticsBucketSchema.optional(),
  })
  .superRefine(({ from, to, bucket }, context) => {
    if (Boolean(from) !== Boolean(to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from and to must be provided together',
      });
      return;
    }
    if (from && to && from > to) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'from must not be after to' });
    }
    if (from && to && from <= to) {
      const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
      if (days > 366) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Date range cannot exceed 366 days',
        });
      }
      if (days > 90 && bucket === 'day') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Ranges over 90 days must use weekly buckets',
        });
      }
    }
  });
export type AdminAnalyticsRangeQuery = z.infer<typeof adminAnalyticsRangeQuerySchema>;

export const adminResolvedRangeSchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  start: isoDateTimeSchema,
  endExclusive: isoDateTimeSchema,
  timezone: timeZoneSchema,
  bucket: adminAnalyticsBucketSchema,
});
export type AdminResolvedRange = z.infer<typeof adminResolvedRangeSchema>;

export const adminAnalyticsContextSchema = z.object({
  generatedAt: isoDateTimeSchema,
  range: adminResolvedRangeSchema,
  comparisonRange: adminResolvedRangeSchema,
});
export type AdminAnalyticsContext = z.infer<typeof adminAnalyticsContextSchema>;

export const adminLogLevelSchema = z.enum(['warn', 'error', 'fatal']);
export type AdminLogLevel = z.infer<typeof adminLogLevelSchema>;

export const adminLogEntrySchema = z.object({
  timestamp: isoDateTimeSchema,
  level: adminLogLevelSchema,
  category: z.string(),
  message: z.string(),
  detail: z.string().optional(),
  statusCode: z.number().int().optional(),
});

const adminMetricsSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  dailyActiveUsers: z.number().int().nonnegative(),
  weeklyActiveUsers: z.number().int().nonnegative(),
  monthlyActiveUsers: z.number().int().nonnegative(),
  currentlyLoggedInUsers: z.number().int().nonnegative(),
  households: z.number().int().nonnegative(),
  transactions: z.number().int().nonnegative(),
  incomes: z.number().int().nonnegative(),
  expenses: z.number().int().nonnegative(),
});

const adminHealthSchema = z.object({
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
});

export const adminOverviewResponseSchema = z.object({
  generatedAt: isoDateTimeSchema,
  metrics: adminMetricsSchema,
});
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;

export const adminHealthResponseSchema = z.object({
  generatedAt: isoDateTimeSchema,
  health: adminHealthSchema,
});
export type AdminHealthResponse = z.infer<typeof adminHealthResponseSchema>;

export const adminDashboardResponseSchema = adminOverviewResponseSchema.extend({
  health: adminHealthSchema,
});

export type AdminLogEntry = z.infer<typeof adminLogEntrySchema>;
export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>;
