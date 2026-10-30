import type { ManagedHousehold, PublicUser } from '@monthloom/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HouseholdSettings } from '../../src/features/finance/household-settings';
import { renderWithQuery } from '../render';

const user: PublicUser = {
  id: 'user',
  email: 'person@example.com',
  emailVerified: true,
  displayName: 'Person',
  profileImage: 'diamond-kilim',
  desiredColor: 'indigo',
  locale: 'en',
  role: 'user',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('household currency settings', () => {
  it('creates with the selected currency and edits it without affecting another household', async () => {
    let households: ManagedHousehold[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input, options) => {
      const url = new URL(String(input));
      if (options?.method === 'POST') {
        const details = JSON.parse(String(options.body));
        const household: ManagedHousehold = {
          ...details,
          id: 'home',
          ownerId: user.id,
          isPrimary: true,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          members: [{ ...user, joinedAt: user.createdAt }],
        };
        households = [
          household,
          { ...household, id: 'other', name: 'Other home', currency: 'GBP' },
        ];
        return Response.json({ household });
      }
      if (options?.method === 'PATCH' && url.pathname.endsWith('/home')) {
        households = households.map((household) =>
          household.id === 'home'
            ? { ...household, ...JSON.parse(String(options.body)) }
            : household,
        );
        return Response.json({ household: households[0] });
      }
      return Response.json({ households });
    });
    vi.stubGlobal('fetch', fetch);
    renderWithQuery(<HouseholdSettings user={user} />);
    const picker = await screen.findByLabelText('Currency');
    expect(picker).toHaveValue('EUR');
    expect(
      within(picker)
        .getAllByRole('option')
        .slice(0, 2)
        .map((option) => option.textContent),
    ).toEqual(['Euro (EUR)', 'US dollar (USD)']);
    await userEvent.type(screen.getByLabelText('Name'), 'Home');
    await userEvent.selectOptions(picker, 'USD');
    await userEvent.click(screen.getByRole('button', { name: 'Create household' }));
    const card = (await screen.findByRole('heading', { name: 'Home' })).closest('article')!;
    expect(households[0]?.currency).toBe('USD');
    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    expect(within(card).getByLabelText('Currency')).toHaveValue('USD');
    await userEvent.selectOptions(within(card).getByLabelText('Currency'), 'JPY');
    await userEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(card).queryByLabelText('Currency')).not.toBeInTheDocument());
    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    expect(within(card).getByLabelText('Currency')).toHaveValue('JPY');
    expect(households[1]?.currency).toBe('GBP');
  });

  it('opens household creation in a modal when the user already has a household', async () => {
    const existingHousehold: ManagedHousehold = {
      id: 'existing-home',
      ownerId: user.id,
      name: 'Existing home',
      currency: 'EUR',
      icon: 'small-house',
      color: '#35675B',
      isPrimary: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      members: [{ ...user, joinedAt: user.createdAt }],
    };
    let households = [existingHousehold];
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_input, options) => {
      if (options?.method === 'POST') {
        const details = JSON.parse(String(options.body));
        const household = { ...existingHousehold, ...details, id: 'new-home', isPrimary: false };
        households = [...households, household];
        return Response.json({ household });
      }
      return Response.json({ households });
    });
    vi.stubGlobal('fetch', fetch);
    renderWithQuery(<HouseholdSettings user={user} />);

    const addButton = await screen.findByRole('button', { name: 'Add Household' });
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();

    await userEvent.click(addButton);
    const dialog = screen.getByRole('dialog', { name: 'Add a household' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Second home');
    await userEvent.selectOptions(within(dialog).getByLabelText('Currency'), 'USD');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create household' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(households[1]).toMatchObject({ name: 'Second home', currency: 'USD' });
  });
});
