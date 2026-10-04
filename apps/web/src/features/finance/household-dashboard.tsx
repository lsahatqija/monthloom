'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HouseholdTransaction, TransactionEditScope } from '@template/contracts';
import { useMemo, useState } from 'react';

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
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: household.currency,
  });
  const date = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short' });

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
        <div className="transactionScroll">
          {transactions.length ? (
            <table className="transactionTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th aria-label="Type" />
                  <th>User</th>
                  <th>Source</th>
                  <th>Amount</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((entry) => (
                  <tr key={`${entry.kind}-${entry.id}`}>
                    <td>
                      <time dateTime={entry.date}>
                        {date.format(new Date(`${entry.date}T12:00:00`))}
                      </time>
                    </td>
                    <td>
                      <EntryIcon entry={entry} />
                    </td>
                    <td>{entry.user.displayName}</td>
                    <td>{entry.source.displayName}</td>
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
