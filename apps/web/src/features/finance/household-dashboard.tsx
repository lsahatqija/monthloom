'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HouseholdTransaction, TransactionEditScope } from '@template/contracts';
import { useMemo, useState } from 'react';

import { ProfileImage } from '../../components/profile-image';
import { Alert, Button, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import {
  financeKeys,
  getPrimaryHouseholdMonth,
  removeHouseholdTransaction,
  updateHousehold,
} from './finance.api';
import { FinancialIcon, financialIconLabel } from './financial-icon';
import { TransactionForm } from './transaction-form';

type TransactionSortKey = 'date' | 'amount' | 'user' | 'source' | 'type';
type SortDirection = 'ascending' | 'descending';
type RecurringFilter = 'all' | 'recurring' | 'one-off';

type TransactionFilters = {
  type: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  sourceId: string;
  recurring: RecurringFilter;
  amountOver: string;
  amountUnder: string;
};

const emptyTransactionFilters: TransactionFilters = {
  type: 'all',
  userId: 'all',
  dateFrom: '',
  dateTo: '',
  sourceId: 'all',
  recurring: 'all',
  amountOver: '',
  amountUnder: '',
};

const transactionCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function transactionTypeLabel(transaction: HouseholdTransaction): string {
  if (transaction.kind === 'income') return 'Income';
  return transaction.type
    ? transaction.type
        .split('-')
        .map((word) => word[0]!.toUpperCase() + word.slice(1))
        .join(' ')
    : 'Other';
}

function compareTransactions(
  first: HouseholdTransaction,
  second: HouseholdTransaction,
  sortKey: TransactionSortKey,
): number {
  switch (sortKey) {
    case 'amount': {
      const firstAmount = Number(first.amount) * (first.kind === 'income' ? 1 : -1);
      const secondAmount = Number(second.amount) * (second.kind === 'income' ? 1 : -1);
      return firstAmount - secondAmount;
    }
    case 'user':
      return transactionCollator.compare(first.user.displayName, second.user.displayName);
    case 'source':
      return transactionCollator.compare(first.source.displayName, second.source.displayName);
    case 'type':
      return transactionCollator.compare(transactionTypeLabel(first), transactionTypeLabel(second));
    case 'date':
      return first.date.localeCompare(second.date);
  }
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions(): Array<{ value: string; label: string }> {
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const today = new Date();
  return Array.from({ length: 13 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    return { value: monthKey(date), label: formatter.format(date) };
  });
}

function EntryIcon({ entry }: { entry: HouseholdTransaction }) {
  return (
    <span
      className="transactionIcon"
      style={{ backgroundColor: entry.color }}
      title={financialIconLabel(entry.icon)}
    >
      <FinancialIcon name={entry.icon} size={18} />
      <span className="srOnly">{financialIconLabel(entry.icon)}</span>
    </span>
  );
}

function HouseholdName({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const mutation = useMutation({
    mutationFn: () => updateHousehold(id, { name: value }),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });

  if (editing) {
    return (
      <form
        className="householdNameForm"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) mutation.mutate();
        }}
      >
        <label className="srOnly" htmlFor="household-name">
          Household name
        </label>
        <input
          id="household-name"
          className="householdNameInput"
          value={value}
          maxLength={160}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className="nameAction" disabled={mutation.isPending || !value.trim()}>
          Save
        </button>
        <button
          type="button"
          className="nameAction"
          onClick={() => {
            setValue(name);
            setEditing(false);
          }}
        >
          Cancel
        </button>
        {mutation.isError ? (
          <span className="nameError">
            {isApiClientError(mutation.error) ? mutation.error.message : 'Could not save the name.'}
          </span>
        ) : null}
      </form>
    );
  }

  return (
    <div className="householdTitleRow">
      <h1>{name}</h1>
      <button
        type="button"
        className="editNameButton"
        onClick={() => setEditing(true)}
        aria-label="Edit household name"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Zm10.5-12.9 2.8 2.8" />
        </svg>
      </button>
    </div>
  );
}

function RemoveTransactionDialog({
  householdId,
  transaction,
  onClose,
}: {
  householdId: string;
  transaction: HouseholdTransaction;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<TransactionEditScope>(
    transaction.recurring ? 'current_and_future' : 'current',
  );
  const mutation = useMutation({
    mutationFn: () => removeHouseholdTransaction(householdId, transaction.id, scope),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      onClose();
    },
  });

  return (
    <div
      className="transactionModalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="transactionModal confirmationModal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-transaction-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">Remove entry</p>
            <h2 id="remove-transaction-title">Remove transaction?</h2>
          </div>
          <button type="button" className="modalCloseButton" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="removeTransactionContent">
          <p>
            This will remove <strong>{transaction.source.displayName}</strong> for{' '}
            <strong>{transaction.amount}</strong>.
          </p>
          {transaction.recurring ? (
            <fieldset className="transactionScope">
              <legend>Which transactions should be removed?</legend>
              <label>
                <input
                  type="radio"
                  name="removeScope"
                  checked={scope === 'current_and_future'}
                  onChange={() => setScope('current_and_future')}
                />
                Current and future transactions
              </label>
              <label>
                <input
                  type="radio"
                  name="removeScope"
                  checked={scope === 'past_current_and_future'}
                  onChange={() => setScope('past_current_and_future')}
                />
                Past, current and future transactions
              </label>
            </fieldset>
          ) : null}
          {mutation.isError ? (
            <Alert variant="error">
              {isApiClientError(mutation.error)
                ? mutation.error.message
                : 'We could not remove this transaction.'}
            </Alert>
          ) : null}
          <div className="transactionFormActions">
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function HouseholdDashboard() {
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0]!.value);
  const [addingTransaction, setAddingTransaction] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<HouseholdTransaction | null>(null);
  const [transactionToRemove, setTransactionToRemove] = useState<HouseholdTransaction | null>(null);
  const [sortKey, setSortKey] = useState<TransactionSortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');
  const [filters, setFilters] = useState<TransactionFilters>(emptyTransactionFilters);
  const query = useQuery({
    queryKey: financeKeys.primaryMonth(month),
    queryFn: () => getPrimaryHouseholdMonth(month),
  });

  if (query.isPending) {
    return (
      <div className="dashboardState">
        <LoadingIndicator label="Loading household…" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="dashboardState">
        <Alert variant="error">We could not load your household.</Alert>
      </div>
    );
  }

  const { household, summary, transactions } = query.data;
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value !== '' && value !== 'all' && !(key === 'recurring' && value === 'all'),
  ).length;
  const filteredTransactions = transactions.filter((transaction) => {
    if (filters.type === 'income' && transaction.kind !== 'income') return false;
    if (filters.type === 'expense' && transaction.kind !== 'expense') return false;
    if (
      filters.type.startsWith('expense:') &&
      transaction.type !== filters.type.slice('expense:'.length)
    ) {
      return false;
    }
    if (filters.userId !== 'all' && transaction.user.id !== filters.userId) return false;
    if (filters.sourceId !== 'all' && transaction.source.id !== filters.sourceId) return false;
    if (filters.dateFrom && transaction.date < filters.dateFrom) return false;
    if (filters.dateTo && transaction.date > filters.dateTo) return false;
    if (filters.recurring === 'recurring' && !transaction.recurring) return false;
    if (filters.recurring === 'one-off' && transaction.recurring) return false;

    const amount = Number(transaction.amount);
    if (filters.amountOver !== '' && amount <= Number(filters.amountOver)) return false;
    if (filters.amountUnder !== '' && amount >= Number(filters.amountUnder)) return false;
    return true;
  });
  const sortedTransactions = [...filteredTransactions].sort((first, second) => {
    const comparison = compareTransactions(first, second, sortKey);
    if (comparison !== 0) return sortDirection === 'ascending' ? comparison : -comparison;
    return first.date.localeCompare(second.date) || first.id.localeCompare(second.id);
  });
  const sortBy = (nextSortKey: TransactionSortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === 'ascending' ? 'descending' : 'ascending'));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection('ascending');
  };
  const sortableHeader = (key: TransactionSortKey, label: string) => (
    <th aria-sort={sortKey === key ? sortDirection : 'none'}>
      <button type="button" className="transactionSortButton" onClick={() => sortBy(key)}>
        {label}
        <span className="transactionSortIndicator" aria-hidden="true">
          {sortKey === key ? (sortDirection === 'ascending' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: household.currency,
  });
  const date = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short' });
  const expenseTypes = Array.from(
    new Set(
      transactions
        .filter((transaction) => transaction.kind === 'expense' && transaction.type)
        .map((transaction) => transaction.type!),
    ),
  ).sort(transactionCollator.compare);
  const updateFilter = <Key extends keyof TransactionFilters>(
    key: Key,
    value: TransactionFilters[Key],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <section className="householdDashboard" aria-label="Primary household">
      <div className="dashboardHeading">
        <HouseholdName id={household.id} name={household.name} />
        <label className="monthPicker">
          <span className="srOnly">Month</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            {months.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="financeRecap" aria-label="Monthly recap">
        <div>
          <span>Total income</span>
          <strong className="incomeAmount">{money.format(Number(summary.income))}</strong>
        </div>
        <div>
          <span>Total expenses</span>
          <strong className="expenseAmount">{money.format(Number(summary.expenses))}</strong>
        </div>
        <div className="leftoverRecap">
          <span>Leftover</span>
          <strong>{money.format(Number(summary.leftover))}</strong>
        </div>
      </div>

      <div className="transactionPanel">
        <div className="transactionPanelHeading">
          <h2>Activity</h2>
          <div className="transactionPanelActions">
            <span>{transactions.length} entries</span>
            <button
              type="button"
              className="addTransactionButton"
              aria-label="Add transaction"
              onClick={() => setAddingTransaction(true)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </div>
        <details className="transactionFilters">
          <summary>
            <span className="transactionFilterTitle">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M7 12h10m-7 6h4" />
              </svg>
              Filters
              {activeFilterCount ? (
                <span className="transactionFilterCount">{activeFilterCount}</span>
              ) : null}
            </span>
            <span className="transactionFilterHint">
              {activeFilterCount ? `${filteredTransactions.length} matching` : 'Show options'}
            </span>
          </summary>
          <div className="transactionFilterDrawer">
            <label className="transactionFilterField">
              <span>Type</span>
              <select
                value={filters.type}
                onChange={(event) => updateFilter('type', event.target.value)}
              >
                <option value="all">All types</option>
                <option value="income">Income</option>
                <option value="expense">All expenses</option>
                {expenseTypes.map((type) => (
                  <option key={type} value={`expense:${type}`}>
                    {type
                      .split('-')
                      .map((word) => word[0]!.toUpperCase() + word.slice(1))
                      .join(' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="transactionFilterField">
              <span>User</span>
              <select
                value={filters.userId}
                onChange={(event) => updateFilter('userId', event.target.value)}
              >
                <option value="all">All users</option>
                {query.data.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="transactionFilterField">
              <span>Source</span>
              <select
                value={filters.sourceId}
                onChange={(event) => updateFilter('sourceId', event.target.value)}
              >
                <option value="all">All sources</option>
                {query.data.sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="transactionFilterField">
              <span>Recurring</span>
              <select
                value={filters.recurring}
                onChange={(event) =>
                  updateFilter('recurring', event.target.value as RecurringFilter)
                }
              >
                <option value="all">All transactions</option>
                <option value="recurring">Recurring only</option>
                <option value="one-off">One-off only</option>
              </select>
            </label>
            <label className="transactionFilterField">
              <span>Date from</span>
              <input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(event) => updateFilter('dateFrom', event.target.value)}
              />
            </label>
            <label className="transactionFilterField">
              <span>Date to</span>
              <input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(event) => updateFilter('dateTo', event.target.value)}
              />
            </label>
            <label className="transactionFilterField">
              <span>Amount over</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={filters.amountOver}
                onChange={(event) => updateFilter('amountOver', event.target.value)}
              />
            </label>
            <label className="transactionFilterField">
              <span>Amount under</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="No maximum"
                value={filters.amountUnder}
                onChange={(event) => updateFilter('amountUnder', event.target.value)}
              />
            </label>
            <div className="transactionFilterFooter">
              <span aria-live="polite">
                Showing {filteredTransactions.length} of {transactions.length} entries
              </span>
              {activeFilterCount ? (
                <button type="button" onClick={() => setFilters(emptyTransactionFilters)}>
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        </details>
        <div className="transactionScroll">
          {filteredTransactions.length ? (
            <table className="transactionTable">
              <thead>
                <tr>
                  {sortableHeader('date', 'Date')}
                  <th aria-label="Icon" />
                  {sortableHeader('user', 'User')}
                  {sortableHeader('source', 'Source')}
                  {sortableHeader('type', 'Type')}
                  {sortableHeader('amount', 'Amount')}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((entry) => (
                  <tr key={`${entry.kind}-${entry.id}`}>
                    <td>
                      <time dateTime={entry.date}>
                        {date.format(new Date(`${entry.date}T12:00:00`))}
                      </time>
                    </td>
                    <td>
                      <EntryIcon entry={entry} />
                    </td>
                    <td>
                      <span className="transactionUser">
                        <ProfileImage
                          image={entry.user.profileImage}
                          color={entry.user.desiredColor}
                          size={32}
                        />
                        <span>{entry.user.displayName}</span>
                      </span>
                    </td>
                    <td>{entry.source.displayName}</td>
                    <td>{transactionTypeLabel(entry)}</td>
                    <td className={entry.kind === 'income' ? 'incomeAmount' : 'expenseAmount'}>
                      {entry.kind === 'income' ? '+' : '−'}
                      {money.format(Number(entry.amount))}
                    </td>
                    <td>
                      <details className="transactionMenu">
                        <summary aria-label={`Actions for ${entry.source.displayName}`}>⋯</summary>
                        <div className="transactionMenuPopover">
                          <button type="button" onClick={() => setTransactionToEdit(entry)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => setTransactionToRemove(entry)}>
                            Remove
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : transactions.length ? (
            <p className="transactionEmpty">
              No transactions match these filters.{' '}
              <button type="button" onClick={() => setFilters(emptyTransactionFilters)}>
                Clear filters
              </button>
            </p>
          ) : (
            <p className="transactionEmpty">No income or expenses recorded for this month.</p>
          )}
        </div>
      </div>

      <footer className="householdFooter" aria-label="Household footer" />
      {addingTransaction ? (
        <TransactionForm
          householdId={household.id}
          members={query.data.members}
          sources={query.data.sources}
          onClose={() => setAddingTransaction(false)}
        />
      ) : null}
      {transactionToEdit ? (
        <TransactionForm
          householdId={household.id}
          members={query.data.members}
          sources={query.data.sources}
          transaction={transactionToEdit}
          onClose={() => setTransactionToEdit(null)}
        />
      ) : null}
      {transactionToRemove ? (
        <RemoveTransactionDialog
          householdId={household.id}
          transaction={transactionToRemove}
          onClose={() => setTransactionToRemove(null)}
        />
      ) : null}
    </section>
  );
}
