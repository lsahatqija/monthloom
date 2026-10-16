import { describe, expect, it } from 'vitest';

import { alignOccurrenceDate, currentMonth, monthEnd } from '../../src/modules/finance/rules/dates.js';
import { averageAmounts, fromCents, toCents } from '../../src/modules/finance/rules/money.js';
import { sourceKey, sourceValues } from '../../src/modules/finance/rules/sources.js';

describe('finance money rules', () => {
  it('converts decimal amounts without floating-point arithmetic', () => {
    expect(toCents('12.3')).toBe(1230);
    expect(fromCents(1230)).toBe('12.30');
    expect(averageAmounts(['10.00', '10.01'])).toBe('10.01');
  });

  it('rejects an empty average', () => {
    expect(() => averageAmounts([])).toThrow('At least one amount is required.');
  });
});

describe('finance date and recurrence rules', () => {
  it('calculates exclusive month ends across year boundaries', () => {
    expect(monthEnd('2025-12')).toBe('2026-01-01');
  });

  it('clamps occurrences to the final day of short months', () => {
    expect(alignOccurrenceDate('2026-02-01', '2026-01-31')).toBe('2026-02-28');
    expect(alignOccurrenceDate('2024-02-01', '2024-01-31')).toBe('2024-02-29');
  });

  it('derives the current UTC month from an injected clock', () => {
    expect(currentMonth(new Date('2026-01-31T23:59:59Z'))).toBe('2026-01');
  });
});

describe('source normalization rules', () => {
  it('normalizes compatibility characters, whitespace, casing, and aliases', () => {
    expect(sourceKey('  ＳＨＯＰ  ')).toBe('shop');
    expect(sourceValues(' Shop ', [' shop ', ' Market ', 'MARKET'])).toEqual({
      displayName: 'Shop',
      key: 'shop',
      aliases: ['Shop', 'MARKET'],
    });
  });
});
