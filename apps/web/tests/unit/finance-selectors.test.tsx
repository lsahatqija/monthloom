import type { ManagedHousehold } from '@monthloom/contracts';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  HouseholdPicker,
  resolveHouseholdId,
} from '../../src/features/finance/selectors/household-picker';
import { MonthPicker } from '../../src/features/finance/selectors/month-picker';
import { renderWithQuery } from '../render';

const households = [
  {
    id: 'primary',
    name: 'Primary home',
    currency: 'EUR',
    icon: 'small-house',
    color: '#123456',
    ownerId: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    members: [],
    isPrimary: true,
  },
  {
    id: 'other',
    name: 'Other home',
    currency: 'EUR',
    icon: 'small-house',
    color: '#654321',
    ownerId: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    members: [],
    isPrimary: false,
  },
] satisfies ManagedHousehold[];

describe('household picker', () => {
  it('falls back to the primary household before the first available household', () => {
    expect(resolveHouseholdId(households, 'missing')).toBe('primary');
    expect(
      resolveHouseholdId(
        households.map((household) => ({ ...household, isPrimary: false })),
        'missing',
      ),
    ).toBe('primary');
    expect(resolveHouseholdId([], 'missing')).toBe('');
  });

  it('renders every household and reports selection changes', async () => {
    const onChange = vi.fn();
    renderWithQuery(
      <HouseholdPicker households={households} value="primary" onChange={onChange} />,
    );

    const picker = screen.getByRole('combobox', { name: 'Household' });
    expect(within(picker).getAllByRole('option')).toHaveLength(2);
    expect(within(picker).getByRole('option', { name: 'Primary home (default)' })).toBeVisible();
    await userEvent.selectOptions(picker, 'other');
    expect(onChange).toHaveBeenCalledWith('other');
  });
});

describe('month picker', () => {
  it('selects a translated month and restores focus when Escape closes the picker', async () => {
    const onChange = vi.fn();
    renderWithQuery(<MonthPicker value="2026-03" onChange={onChange} navigation={false} />);

    const trigger = screen.getByRole('button', { name: 'Choose month, March 2026' });
    await userEvent.click(trigger);
    const picker = screen.getByRole('group', { name: 'Choose month' });
    await userEvent.selectOptions(within(picker).getByRole('combobox', { name: 'Month' }), '4');
    expect(onChange).toHaveBeenCalledWith('2026-04');

    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'Choose month' })).not.toBeInTheDocument();
  });

  it('uses distinct popover IDs when two month pickers are rendered', () => {
    renderWithQuery(
      <>
        <MonthPicker value="2026-01" onChange={() => undefined} navigation={false} />
        <MonthPicker value="2026-02" onChange={() => undefined} navigation={false} />
      </>,
    );
    const controls = screen
      .getAllByRole('button', { name: /Choose month/ })
      .map((button) => button.getAttribute('aria-controls'));
    expect(new Set(controls).size).toBe(2);
  });
});
