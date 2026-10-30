import { describe, expect, it } from 'vitest';

import {
  graphMonthBounds,
  resolveGraphPeriod,
  type GraphPeriodPreset,
} from '../../src/features/finance/graph/period';

describe('graph periods', () => {
  it.each([
    ['current-month', '2026-10', '2026-10', '2026-10-01', '2026-10-31'],
    ['last-month', '2026-09', '2026-09', '2026-09-01', '2026-09-30'],
    ['current-year', '2026-01', '2026-10', '2026-01-01', '2026-10-31'],
    ['last-year', '2025-01', '2025-12', '2025-01-01', '2025-12-31'],
    ['last-12-months', '2025-11', '2026-10', '2025-11-01', '2026-10-31'],
  ] as const)('resolves %s to inclusive whole months', (period, from, to, fromDate, toDate) => {
    expect(resolveGraphPeriod({ period, current: '2026-10' })).toEqual({
      period,
      from,
      to,
      fromDate,
      toDate,
    });
  });

  it('includes leap day in a custom month', () => {
    expect(
      resolveGraphPeriod({ period: 'custom-month', current: '2026-10', from: '2024-02' }),
    ).toMatchObject({ fromDate: '2024-02-01', toDate: '2024-02-29' });
  });

  it('crosses a year boundary when resolving the previous month', () => {
    expect(resolveGraphPeriod({ period: 'last-month', current: '2026-01' })).toMatchObject({
      from: '2025-12',
      to: '2025-12',
      fromDate: '2025-12-01',
      toDate: '2025-12-31',
    });
  });

  it('allows five years past and one year future, inclusively', () => {
    expect(graphMonthBounds('2026-10')).toEqual({ minimum: '2021-10', maximum: '2027-10' });
    expect(
      resolveGraphPeriod({
        period: 'custom-period',
        current: '2026-10',
        from: '2021-10',
        to: '2027-10',
      }).error,
    ).toBeUndefined();
  });

  it.each([
    ['custom-month', 'not-a-month', undefined, 'invalid-month'],
    ['custom-month', '2021-09', undefined, 'out-of-bounds'],
    ['custom-period', '2026-05', '2026-04', 'inverted-range'],
  ] as const)('falls back safely for invalid %s input', (period, from, to, error) => {
    expect(
      resolveGraphPeriod({ period: period as GraphPeriodPreset, current: '2026-10', from, to }),
    ).toMatchObject({ from: '2026-10', to: '2026-10', error });
  });
});
