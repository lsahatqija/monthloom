import type { HouseholdSource, ManagedHousehold } from '@monthloom/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourceSettings } from '../../src/features/finance/source-settings';
import { renderWithQuery } from '../render';

const household: ManagedHousehold = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Home',
  currency: 'EUR',
  icon: 'small-house',
  color: '#35675B',
  ownerId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
  isPrimary: true,
};

describe('source settings', () => {
  it('adds a source with the shared source modal', async () => {
    let sources: HouseholdSource[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_input, options) => {
      if (options?.method === 'POST') {
        const input = JSON.parse(String(options.body)) as {
          displayName: string;
          aliases: string[];
        };
        const source: HouseholdSource = {
          id: '33333333-3333-4333-8333-333333333333',
          displayName: input.displayName,
          key: 'neighborhood-market',
          aliases: [input.displayName, ...input.aliases],
        };
        sources = [source];
        return Response.json({ source });
      }

      return Response.json({ sources });
    });
    vi.stubGlobal('fetch', fetch);

    renderWithQuery(<SourceSettings households={[household]} />);
    await screen.findByText('This household has no sources yet.');

    await userEvent.click(screen.getByRole('button', { name: 'Add source' }));
    const dialog = screen.getByRole('dialog', { name: 'Add new source' });
    await userEvent.type(
      within(dialog).getByLabelText('Source Display Name'),
      'Neighborhood Market',
    );
    await userEvent.type(within(dialog).getByLabelText('Alias 1'), 'NBRHD MKT 1042');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add source' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByText('Source added.')).toBeInTheDocument();
    expect(await screen.findByText('Neighborhood Market')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/households/${household.id}/sources`),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          displayName: 'Neighborhood Market',
          aliases: ['NBRHD MKT 1042'],
        }),
      }),
    );
  });
});
