import { describe, expect, it } from 'vitest';

import {
  adminAnalyticsRangeQuerySchema,
  adminHealthResponseSchema,
  adminOverviewResponseSchema,
  adminReliabilityResponseSchema,
  adminRetentionResponseSchema,
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

  it('accepts retention and reliability view responses', () => {
    const range = {
      from: '2026-10-01',
      to: '2026-10-31',
      start: '2026-10-01T00:00:00.000Z',
      endExclusive: '2026-11-01T00:00:00.000Z',
      timezone: 'UTC',
      bucket: 'day',
    };
    const retention = adminRetentionResponseSchema.parse({
      generatedAt,
      range,
      comparisonRange: range,
      retention: [
        { day: 'd1', retained: 2, eligible: 4, rate: 50 },
        { day: 'd7', retained: 1, eligible: 3, rate: 33.3 },
        { day: 'd30', retained: 0, eligible: 0, rate: null },
      ],
      cohorts: [],
      dormant: { users30Days: 2, users90Days: 1, households30Days: 1 },
      reactivations: [],
      coverageStartedAt: generatedAt,
    });
    expect(retention.retention[0]).toMatchObject({ day: 'd1', eligible: 4 });
    const compared = { current: 0, previous: 0, changePercent: 0 };
    expect(
      adminReliabilityResponseSchema.parse({
        generatedAt,
        range,
        comparisonRange: range,
        summary: {
          requests: compared,
          errorRate: compared,
          averageLatencyMs: compared,
          p95LatencyMs: compared,
          databaseAverageMs: compared,
        },
        series: [],
        slowRoutes: [],
        email: { status: 'unknown', lastObservedAt: null, detail: 'Not connected' },
        readiness: { status: 'unknown', lastObservedAt: null, detail: 'Not connected' },
        backgroundJobs: { status: 'unknown', lastObservedAt: null, detail: 'Not connected' },
        backups: { status: 'unknown', lastObservedAt: null, detail: 'Not connected' },
        deployment: {
          applicationVersion: '0.1.0',
          deployedAt: generatedAt,
          history: [],
          clientVersions: [],
        },
      }),
    ).toMatchObject({ summary: { requests: { current: 0 } } });
  });
});
