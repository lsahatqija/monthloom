import type { HouseholdTransaction } from '@monthloom/contracts';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TransactionForm } from '../../src/features/finance/transaction-form';
import { renderWithQuery } from '../render';

const member = {
  id: 'user',
  displayName: 'Person',
  profileImage: 'diamond-kilim' as const,
  desiredColor: 'indigo' as const,
};
const source = { id: 'source', displayName: 'Shop', key: 'shop', aliases: ['Shop'] };

function renderForm(transaction?: HouseholdTransaction) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  client.setQueryData(['auth', 'me'], { user: member });
  const onClose = vi.fn();
  renderWithQuery(
    <TransactionForm
      householdId="home"
      members={[member]}
      sources={[source]}
      transaction={transaction}
      onClose={onClose}
    />,
    client,
  );
  return { onClose, client };
}

describe('transaction form + query + HTTP client', () => {
  it('starts recurring transactions without expiration and reveals a required date when enabled', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('switch', { name: /Recurring transaction/ }));
    const expires = screen.getByRole('switch', { name: 'Expires' });
    expect(expires).not.toBeChecked();
    expect(screen.queryByLabelText('Expiration date')).not.toBeInTheDocument();
    await userEvent.click(expires);
    expect(screen.getByLabelText('Expiration date')).toBeRequired();
    await userEvent.click(expires);
    expect(screen.queryByLabelText('Expiration date')).not.toBeInTheDocument();
  });

  it.each([true, false])('saves an existing expiration with Expires set to %s', async (expires) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ transaction: { id: 'entry' } }));
    vi.stubGlobal('fetch', fetch);
    const { onClose } = renderForm({
      id: 'entry',
      kind: 'expense',
      type: 'groceries',
      date: '2026-01-01',
      icon: 'receipt',
      color: '#123456',
      amount: '12.34',
      recurring: true,
      expiresOn: '2026-12-31',
      projected: false,
      user: member,
      source,
    });
    expect(screen.getByRole('switch', { name: 'Expires' })).toBeChecked();
    expect(screen.getByLabelText('Expiration date')).toHaveValue('2026-12-31');
    if (!expires) await userEvent.click(screen.getByRole('switch', { name: 'Expires' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
      transaction: { recurring: true, expiresOn: expires ? '2026-12-31' : null },
    });
  });

  it('requires a source, normalizes decimal commas and submits income without an expense type', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ transaction: { id: 'new' } }));
    vi.stubGlobal('fetch', fetch);
    const { onClose, client } = renderForm();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'source');
    await userEvent.click(screen.getByRole('radio', { name: 'Income' }));
    await userEvent.type(screen.getByLabelText('Amount'), '12,34');
    await userEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
      amount: '12.34',
      kind: 'income',
      type: null,
      userId: member.id,
      sourceId: source.id,
      recurring: false,
      expiresOn: null,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance'] });
  });

  it('disables recurring edits when no occurrences are selected', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderForm({
      id: 'entry',
      kind: 'expense',
      type: 'groceries',
      date: '2026-01-01',
      icon: 'receipt',
      color: '#123456',
      amount: '12.34',
      recurring: true,
      expiresOn: null,
      projected: false,
      user: member,
      source,
    });
    await userEvent.click(screen.getByRole('checkbox', { name: 'This transaction' }));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Future' }));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('closes the dialog on Escape without saving', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { onClose } = renderForm();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
});
