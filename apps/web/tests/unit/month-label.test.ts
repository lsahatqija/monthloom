import { describe, expect, it } from 'vitest';

import {
  formatTranslatedMonthYear,
  selectMonthLabelVariant,
  shouldCollapseCurrentMonthButton,
} from '../../src/features/finance/household-dashboard';

it('uses the translated month even when the date formatter falls back to English', () => {
  const formatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });

  expect(formatTranslatedMonthYear(formatter, new Date(2026, 2, 1), 'Mars')).toBe('Mars 2026');
});

describe('month label contraction', () => {
  it.each([
    [180, 'full'],
    [140, 'shortYear'],
    [110, 'month'],
    [80, 'abbreviatedShortYear'],
    [50, 'abbreviated'],
  ] as const)('uses the first label that fits within %ipx', (availableWidth, expected) => {
    expect(selectMonthLabelVariant(availableWidth, 150, 130, 100, 70)).toBe(expected);
  });
});

describe('month navigation contraction', () => {
  it('moves the current-month action into the picker when the controls and shortest label overlap', () => {
    expect(shouldCollapseCurrentMonthButton(180, 140, 50)).toBe(true);
    expect(shouldCollapseCurrentMonthButton(200, 140, 50)).toBe(false);
  });
});
