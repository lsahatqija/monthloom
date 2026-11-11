import { adminAnalyticsRangeQuerySchema } from '@monthloom/contracts';
import { describe, expect, it } from 'vitest';

import {
  adminCalendarBuckets,
  resolveAdminAnalyticsRange,
} from '../../src/modules/admin/admin-range.js';

describe('admin analytics ranges', () => {
  it('defaults to the current calendar month in the requested timezone', () => {
    const result = resolveAdminAnalyticsRange(
      adminAnalyticsRangeQuerySchema.parse({ timezone: 'Europe/Berlin' }),
      new Date('2026-11-09T23:30:00.000Z'),
    );

    expect(result.range).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-10',
      start: '2026-10-31T23:00:00.000Z',
      endExclusive: '2026-11-10T23:00:00.000Z',
      bucket: 'day',
    });
    expect(result.comparisonRange).toMatchObject({
      from: '2026-10-22',
      to: '2026-10-31',
    });
  });

  it('uses exclusive UTC bounds across the spring DST transition', () => {
    const result = resolveAdminAnalyticsRange(
      adminAnalyticsRangeQuerySchema.parse({
        from: '2026-03-28',
        to: '2026-03-30',
        timezone: 'Europe/Berlin',
      }),
    );

    expect(result.range).toMatchObject({
      start: '2026-03-27T23:00:00.000Z',
      endExclusive: '2026-03-30T22:00:00.000Z',
    });
  });

  it('keeps leap day and an equal-length preceding comparison', () => {
    const result = resolveAdminAnalyticsRange(
      adminAnalyticsRangeQuerySchema.parse({
        from: '2024-02-28',
        to: '2024-03-01',
        timezone: 'UTC',
      }),
    );

    expect(result.range).toMatchObject({ from: '2024-02-28', to: '2024-03-01' });
    expect(result.comparisonRange).toMatchObject({ from: '2024-02-25', to: '2024-02-27' });
  });

  it('chooses weekly buckets above 90 days and rejects more than 366 days', () => {
    const result = resolveAdminAnalyticsRange(
      adminAnalyticsRangeQuerySchema.parse({
        from: '2026-01-01',
        to: '2026-04-01',
        timezone: 'UTC',
      }),
    );
    expect(result.range.bucket).toBe('week');
    expect(adminCalendarBuckets(result.range)).toEqual([
      { from: '2026-01-01', to: '2026-01-07' },
      { from: '2026-01-08', to: '2026-01-14' },
      { from: '2026-01-15', to: '2026-01-21' },
      { from: '2026-01-22', to: '2026-01-28' },
      { from: '2026-01-29', to: '2026-02-04' },
      { from: '2026-02-05', to: '2026-02-11' },
      { from: '2026-02-12', to: '2026-02-18' },
      { from: '2026-02-19', to: '2026-02-25' },
      { from: '2026-02-26', to: '2026-03-04' },
      { from: '2026-03-05', to: '2026-03-11' },
      { from: '2026-03-12', to: '2026-03-18' },
      { from: '2026-03-19', to: '2026-03-25' },
      { from: '2026-03-26', to: '2026-04-01' },
    ]);

    expect(
      adminAnalyticsRangeQuerySchema.safeParse({
        from: '2025-01-01',
        to: '2026-01-02',
        timezone: 'UTC',
      }).success,
    ).toBe(false);
  });
});
