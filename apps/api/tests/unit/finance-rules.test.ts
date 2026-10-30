import { describe, expect, it } from 'vitest';

import {
  alignOccurrenceDate,
  addMonths,
  currentMonth,
  monthEnd,
  recurringOccurrenceDates,
} from '../../src/modules/finance/rules/dates.js';
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
  it('calculates bounded calendar months across years', () => {
    expect(addMonths('2026-01', -60)).toBe('2021-01');
    expect(addMonths('2026-12', 12)).toBe('2027-12');
  });
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

  it('lists monthly occurrences from a past start date through the requested month', () => {
    expect(recurringOccurrenceDates('2026-01-31', '2026-04', null)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('stops monthly occurrences at the recurrence expiration date', () => {
    expect(recurringOccurrenceDates('2026-01-31', '2026-04', '2026-03-15')).toEqual([
      '2026-01-31',
      '2026-02-28',
    ]);
  });

  it('lists occurrences for daily and multi-week schedules', () => {
    expect(recurringOccurrenceDates('2026-04-28', '2026-05', null, 2, 'day')).toEqual([
      '2026-04-28',
      '2026-04-30',
      '2026-05-02',
      '2026-05-04',
      '2026-05-06',
      '2026-05-08',
      '2026-05-10',
      '2026-05-12',
      '2026-05-14',
      '2026-05-16',
      '2026-05-18',
      '2026-05-20',
      '2026-05-22',
      '2026-05-24',
      '2026-05-26',
      '2026-05-28',
      '2026-05-30',
    ]);
    expect(recurringOccurrenceDates('2026-01-06', '2026-02', null, 2, 'week')).toEqual([
      '2026-01-06',
      '2026-01-20',
      '2026-02-03',
      '2026-02-17',
    ]);
  });

  it('keeps calendar alignment for multi-month and yearly schedules', () => {
    expect(recurringOccurrenceDates('2024-02-29', '2028-02', null, 1, 'year')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
    expect(recurringOccurrenceDates('2026-01-31', '2026-07', null, 3, 'month')).toEqual([
      '2026-01-31',
      '2026-04-30',
      '2026-07-31',
    ]);
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
