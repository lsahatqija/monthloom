import { describe, expect, it } from 'vitest';

import {
  adminAnalyticsRangeQuerySchema,
  adminHealthResponseSchema,
  adminOverviewResponseSchema,
} from '../src/index.js';

const generatedAt = '2026-11-09T12:00:00.000Z';

describe('admin contracts', () => {
  it('accepts representative overview and health responses', () => {
    expect(
      adminOverviewResponseSchema.parse({
        generatedAt,
        metrics: {
          totalUsers: 12,
          dailyActiveUsers: 4,
          weeklyActiveUsers: 7,
          monthlyActiveUsers: 9,
          currentlyLoggedInUsers: 3,
          households: 6,
          transactions: 30,
          incomes: 10,
          expenses: 20,
        },
      }),
    ).toMatchObject({ metrics: { totalUsers: 12, transactions: 30 } });

    expect(
      adminHealthResponseSchema.parse({
        generatedAt,
        health: {
          status: 'healthy',
          loggingAvailable: true,
          windowDays: 7,
          counts: { warn: 1, error: 0, fatal: 0 },
          last24Hours: { warn: 0, error: 0, fatal: 0 },
          entries: [],
        },
      }),
    ).toMatchObject({ health: { status: 'healthy' } });
  });

  it('validates analytics range query shape and timezone', () => {
    expect(adminAnalyticsRangeQuerySchema.parse({})).toEqual({ timezone: 'UTC' });
    expect(
      adminAnalyticsRangeQuerySchema.parse({
        from: '2026-03-01',
        to: '2026-03-31',
        timezone: 'Europe/Berlin',
        bucket: 'day',
      }),
    ).toMatchObject({ from: '2026-03-01', to: '2026-03-31', bucket: 'day' });

    expect(adminAnalyticsRangeQuerySchema.safeParse({ from: '2026-01-01' }).success).toBe(false);
    expect(
      adminAnalyticsRangeQuerySchema.safeParse({
        from: '2026-02-01',
        to: '2026-01-01',
      }).success,
    ).toBe(false);
    expect(adminAnalyticsRangeQuerySchema.safeParse({ timezone: 'Berlin' }).success).toBe(false);
    expect(
      adminAnalyticsRangeQuerySchema.safeParse({
        from: '2025-01-01',
        to: '2026-01-02',
      }).success,
    ).toBe(false);
    expect(
      adminAnalyticsRangeQuerySchema.safeParse({
        from: '2026-01-01',
        to: '2026-04-01',
        bucket: 'day',
      }).success,
    ).toBe(false);
  });
});
