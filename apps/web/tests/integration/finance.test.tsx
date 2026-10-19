import type { HouseholdTransaction } from '@monthloom/contracts';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TransactionForm } from '../../src/features/finance/transaction-form';
import { renderWithQuery } from '../render';

const member = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Person',
  profileImage: 'diamond-kilim' as const,
  desiredColor: 'indigo' as const,
};
const source = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Shop',
  key: 'shop',
  aliases: ['Shop'],
};
const salarySource = {
  id: '33333333-3333-4333-8333-333333333333',
  displayName: 'Salary',
  key: 'salary',
  aliases: ['Paycheck'],
};

function renderForm(
  transaction?: HouseholdTransaction,
  sources = [source],
  transactions: HouseholdTransaction[] = [],
) {
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
      sources={sources}
      transactions={transactions}
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

  it('clears a hidden legacy expiration before validating an edited recurring transaction', async () => {
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
      expiresOn: '2026-01-31',
      projected: false,
      user: member,
      source,
    });

    await userEvent.clear(screen.getByLabelText(/Date/));
    await userEvent.type(screen.getByLabelText(/Date/), '2026-02-01');
    await userEvent.click(screen.getByRole('switch', { name: 'Expires' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
      transaction: { date: '2026-02-01', expiresOn: null },
    });
  });

  it('normalizes the renamed legacy gadgets type when editing', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ transaction: { id: 'entry' } }));
    vi.stubGlobal('fetch', fetch);
    const { onClose } = renderForm({
      id: 'entry',
      kind: 'expense',
      type: 'gadgets',
      date: '2026-01-01',
      icon: 'smartphone',
      color: '#123456',
      amount: '12.34',
      recurring: false,
      expiresOn: null,
      projected: false,
      user: member,
      source,
    } as unknown as HouseholdTransaction);

    expect(screen.getByLabelText('Type')).toHaveValue('technology');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
      transaction: { type: 'technology' },
    });
  });

  it('canonicalizes a stale expense type before editing an existing income', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ transaction: { id: 'entry' } }));
    vi.stubGlobal('fetch', fetch);
    const { onClose } = renderForm({
      id: 'entry',
      kind: 'income',
      type: 'other',
      date: '2026-01-01',
      icon: 'banknote',
      color: '#123456',
      amount: '100.00',
      recurring: false,
      expiresOn: null,
      projected: false,
      user: member,
      source,
    } as unknown as HouseholdTransaction);

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
      transaction: { kind: 'income', type: 'income' },
    });
  });

  it.each([null, '2026-10-30'])(
    'edits an existing recurring income with expiration %s',
    async (expiresOn) => {
      const fetch = vi.fn().mockResolvedValue(Response.json({ transaction: { id: 'entry' } }));
      vi.stubGlobal('fetch', fetch);
      const { onClose } = renderForm({
        id: 'entry',
        kind: 'income',
        type: 'income',
        date: '2026-10-04',
        icon: 'banknote',
        color: '#33805C',
        amount: '1700.00',
        recurring: true,
        expiresOn,
        projected: false,
        user: member,
        source,
      });

      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
        transaction: { kind: 'income', type: 'income', recurring: true, expiresOn },
      });
    },
  );

  it('requires a source, normalizes decimal commas and submits the income type', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ transaction: { id: 'new' } }));
    vi.stubGlobal('fetch', fetch);
    const { onClose, client } = renderForm();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeDisabled();
    await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
    await userEvent.click(screen.getByRole('option', { name: source.displayName }));
    await userEvent.click(screen.getByRole('radio', { name: 'Income' }));
    await userEvent.type(screen.getByLabelText('Amount'), '12,34');
    await userEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
      amount: '12.34',
      kind: 'income',
      type: 'income',
      userId: member.id,
      sourceId: source.id,
      recurring: false,
      expiresOn: null,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance'] });
  });

  it('prefills fields from the most recent transaction for a selected source', async () => {
    const older: HouseholdTransaction = {
      id: '33333333-3333-4333-8333-333333333333',
      kind: 'expense',
      type: 'groceries',
      date: '2026-01-02',
      icon: 'receipt',
      color: '#123456',
      amount: '12.34',
      recurring: false,
      expiresOn: null,
      projected: false,
      user: member,
      source,
    };
    const newest: HouseholdTransaction = {
      ...older,
      id: '44444444-4444-4444-8444-444444444444',
      kind: 'income',
      type: 'income',
      date: '2026-01-20',
      icon: 'banknote',
      color: '#ABCDEF',
    };
    renderForm(undefined, [source], [newest, older]);

    await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
    await userEvent.click(screen.getByRole('option', { name: source.displayName }));

    expect(screen.getByRole('radio', { name: 'Income' })).toBeChecked();
    expect(screen.getByLabelText('Type')).toHaveValue('income');
    expect(screen.getByText('Banknote')).toBeInTheDocument();
    expect(screen.getByText('#ABCDEF')).toBeInTheDocument();
  });

  it('filters sources live and always offers adding a new source', async () => {
    renderForm(undefined, [source, salarySource]);
    const sourceInput = screen.getByRole('combobox', { name: 'Source' });

    expect(sourceInput).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox', { name: 'Sources' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add new source' })).not.toBeInTheDocument();

    await userEvent.click(sourceInput);

    expect(screen.getByRole('option', { name: 'Shop' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Salary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add new source' })).toBeInTheDocument();

    await userEvent.type(sourceInput, 'pay');

    expect(screen.queryByRole('option', { name: 'Shop' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Salary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add new source' })).toBeInTheDocument();

    await userEvent.clear(sourceInput);
    await userEvent.type(sourceInput, 'missing');

    expect(screen.getByText('No matching sources')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add new source' })).toBeInTheDocument();
  });

  it('prefills a new source from the source search', async () => {
    renderForm();
    const sourceInput = screen.getByRole('combobox', { name: 'Source' });

    await userEvent.type(sourceInput, 'Neighborhood Market');
    await userEvent.click(screen.getByRole('button', { name: 'Add new source' }));

    expect(screen.getByRole('dialog', { name: 'Add new source' })).toBeInTheDocument();
    expect(screen.getByLabelText('Source Display Name')).toHaveValue('Neighborhood Market');
    expect(screen.queryByLabelText('Display name alias')).not.toBeInTheDocument();
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

  it('closes the source menu before closing the dialog on Escape', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { onClose } = renderForm();
    await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('combobox', { name: 'Source' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders icon and color pickers outside the scrolling dialog', async () => {
    renderForm();

    await userEvent.click(screen.getByText('Receipt').closest('summary')!);
    const iconGrid = screen.getByRole('group', { name: 'Choose an icon' });
    expect(iconGrid.closest('[role="dialog"]')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'House' }));
    expect(screen.queryByRole('group', { name: 'Choose an icon' })).not.toBeInTheDocument();
    expect(screen.getByText('House')).toBeInTheDocument();

    await userEvent.click(screen.getByText('#35675B').closest('summary')!);
    const colorOption = screen.getByRole('radio', { name: '#33805C' });
    expect(colorOption.closest('[role="dialog"]')).toBeNull();
    await userEvent.click(colorOption);
    expect(screen.queryByRole('radio', { name: '#33805C' })).not.toBeInTheDocument();
    expect(screen.getByText('#33805C')).toBeInTheDocument();
  });
});
