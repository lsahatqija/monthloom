import { describe, expect, it } from 'vitest';

import {
  selectMonthLabelVariant,
  shouldCollapseCurrentMonthButton,
} from '../../src/features/finance/household-dashboard';

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
