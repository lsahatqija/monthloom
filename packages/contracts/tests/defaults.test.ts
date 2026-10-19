import { describe, expect, it } from 'vitest';

import { Constants, Defaults } from '../src/index.js';

describe('Defaults', () => {
  it('uses supported user and finance values', () => {
    expect(Constants.PROFILE_IMAGES).toContain(Defaults.USER_PROFILE_IMAGE);
    expect(Constants.DESIRED_COLORS).toContain(Defaults.USER_DESIRED_COLOR);
    expect(Constants.HOUSEHOLD_ICONS).toContain(Defaults.HOUSEHOLD_ICON);
    expect(Constants.FINANCIAL_ICONS).toContain(Defaults.TRANSACTION_ICON);
    expect(Constants.FINANCIAL_ICONS).toContain(Defaults.INCOME_TRANSACTION_ICON);
    expect(Constants.EXPENSE_TYPES).toContain(Defaults.TRANSACTION_TYPE);
  });

  it('uses a valid color for new households and transactions', () => {
    expect(Defaults.HOUSEHOLD_COLOR).toMatch(/^#[0-9A-F]{6}$/);
    expect(Defaults.TRANSACTION_COLOR).toMatch(/^#[0-9A-F]{6}$/);
  });
});
