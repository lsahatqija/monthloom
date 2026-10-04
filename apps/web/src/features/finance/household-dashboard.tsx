'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HouseholdTransaction } from '@template/contracts';
import { useMemo, useState } from 'react';

import { Alert, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { financeKeys, getPrimaryHouseholdMonth, updateHousehold } from './finance.api';
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

export function HouseholdDashboard() {
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0]!.value);
  const [addingTransaction, setAddingTransaction] = useState(false);
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
          month={month}
          members={query.data.members}
          sources={query.data.sources}
          onClose={() => setAddingTransaction(false)}
        />
      ) : null}
    </section>
  );
}
