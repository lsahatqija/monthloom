'use client';

import { Defaults, type HouseholdTransaction } from '@monthloom/contracts';
import { Banknote, CalendarDays, RefreshCw, Store, Tags, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ProfileImage } from '../../components/profile-image';
import { Alert, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { useHouseholdMonth, useHouseholds } from './api/queries';
import { RemoveTransactionDialog } from './dashboard/remove-transaction-dialog';
import { TransactionSummary } from './dashboard/summary';
import { TransactionMenu } from './dashboard/transaction-menu';
import {
  isUpcomingRecurringTransaction,
  summarizeTransactions,
  transactionTypeLabel,
  type RecurringFilter,
  type TransactionFilters,
  type TransactionSortKey,
} from './dashboard/transaction-view';
import { useDashboardSelection } from './dashboard/use-dashboard-selection';
import { useTransactionView } from './dashboard/use-transaction-view';
import { FinancialIcon, financialIconLabel } from './financial-icon';
import { TransactionForm } from './transaction-form';

const transactionCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions(): Array<{
  value: string;
  label: string;
  isCurrent: boolean;
  isFuture: boolean;
}> {
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const today = new Date();
  const offsets = Array.from({ length: 25 }, (_, index) => index - 12);
  return offsets.map((offset) => {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const isCurrent = offset === 0;
    return {
      value: monthKey(date),
      label: `${formatter.format(date)} '${String(date.getFullYear()).slice(-2)}${isCurrent ? ' (current)' : ''}`,
      isCurrent,
      isFuture: offset > 0,
    };
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

function RecurringIcon({ entry }: { entry: HouseholdTransaction }) {
  if (!entry.recurring) return null;

  const interval = entry.recurrenceInterval ?? Defaults.TRANSACTION_RECURRENCE_INTERVAL;
  const unit = entry.recurrenceUnit ?? Defaults.TRANSACTION_RECURRENCE_UNIT;
  const schedule = `Every ${interval} ${unit}${interval === 1 ? '' : 's'}`;
  const label = entry.expiresOn ? `${schedule}, until ${entry.expiresOn}` : schedule;
  return (
    <span className="transactionRecurringIcon" role="img" aria-label={label} title={label}>
      <RefreshCw aria-hidden="true" />
      {entry.expiresOn ? (
        <svg className="transactionRecurringEndpoint" viewBox="0 0 12 12" aria-hidden="true">
          <polygon points="3.5,0.75 8.5,0.75 11.25,3.5 11.25,8.5 8.5,11.25 3.5,11.25 0.75,8.5 0.75,3.5" />
        </svg>
      ) : null}
    </span>
  );
}

const transactionHeaderIcons = {
  date: CalendarDays,
  amount: Banknote,
  source: Store,
  type: Tags,
  user: UserRound,
};

function SortableHeader({
  column,
  label,
  className,
  activeColumn,
  direction,
  onSort,
}: {
  column: TransactionSortKey;
  label: string;
  className?: string;
  activeColumn: TransactionSortKey;
  direction: 'ascending' | 'descending';
  onSort: (column: TransactionSortKey) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [compact, setCompact] = useState(false);
  const HeaderIcon = transactionHeaderIcons[column];

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const [icon, title, indicator] = Array.from(button.children) as HTMLElement[];
      const gap = Number.parseFloat(getComputedStyle(button).columnGap) || 0;
      const requiredWidth =
        (icon?.getBoundingClientRect().width ?? 0) +
        Math.max(title?.scrollWidth ?? 0, title?.getBoundingClientRect().width ?? 0) +
        (indicator?.getBoundingClientRect().width ?? 0) +
        gap * 2;
      setCompact(requiredWidth > button.clientWidth);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(button);
    measure();
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [label]);

  return (
    <th className={className} aria-sort={activeColumn === column ? direction : 'none'}>
      <button
        ref={buttonRef}
        type="button"
        className={`transactionSortButton${compact ? ' isCompact' : ''}`}
        aria-label={`Sort by ${label}`}
        onClick={() => onSort(column)}
      >
        <HeaderIcon className="transactionHeaderIcon" aria-hidden="true" />
        <span className="transactionHeaderLabel">{label}</span>
        <span className="transactionSortIndicator" aria-hidden="true">
          {activeColumn === column ? (direction === 'ascending' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

export function HouseholdDashboard() {
  const months = useMemo(monthOptions, []);
  const { month, setMonth, householdId, setHouseholdId } = useDashboardSelection();
  const selectedMonthIndex = months.findIndex((option) => option.value === month);
  const [addingTransaction, setAddingTransaction] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<HouseholdTransaction | null>(null);
  const [transactionToRemove, setTransactionToRemove] = useState<HouseholdTransaction | null>(null);
  const [savedDestinationMonth, setSavedDestinationMonth] = useState<string | null>(null);
  const householdsQuery = useHouseholds();
  useEffect(() => {
    if (!householdsQuery.data) return;
    setHouseholdId((current) => {
      if (householdsQuery.data.some((household) => household.id === current)) return current;
      return (
        householdsQuery.data.find((household) => household.isPrimary)?.id ??
        householdsQuery.data[0]?.id ??
        ''
      );
    });
  }, [householdsQuery.data, setHouseholdId]);
  const query = useHouseholdMonth(householdId, month);
  const transactionView = useTransactionView(query.data?.transactions ?? []);
  if (householdsQuery.isPending || (householdsQuery.data?.length && query.isPending)) {
    return (
      <div className="dashboardState">
        <LoadingIndicator label="Loading household…" />
      </div>
    );
  }
  if (householdsQuery.isError) {
    return (
      <div className="dashboardState">
        <Alert variant="error">We could not load your households.</Alert>
      </div>
    );
  }
  if (householdsQuery.data?.length === 0) {
    return (
      <div className="dashboardState">
        <h1>No households yet</h1>
        <p>Create a household in settings, or wait until another member invites you.</p>
        <Link href="/settings/households" className="button">
          Open settings
        </Link>
      </div>
    );
  }
  if (query.isError || !query.data) {
    if (isApiClientError(query.error) && query.error.status === 404) {
      return (
        <div className="dashboardState">
          <h1>Household unavailable</h1>
          <p>Create a household in settings, or wait until another member invites you.</p>
          <Link href="/settings/households" className="button">
            Open settings
          </Link>
        </div>
      );
    }
    return (
      <div className="dashboardState">
        <Alert variant="error">We could not load your household.</Alert>
      </div>
    );
  }

  const { household, summary, transactions } = query.data;
  const {
    activeFilterCount,
    filteredSummary,
    filters,
    resetFilters,
    setFilters,
    sortBy,
    sortDirection,
    sortKey,
    visibleTransactions: sortedTransactions,
  } = transactionView;
  const filteredTransactions = sortedTransactions;
  const savings = summarizeTransactions(transactions).savings;
  const sortableHeader = (key: TransactionSortKey, label: string, className?: string) => (
    <SortableHeader
      column={key}
      label={label}
      className={className}
      activeColumn={sortKey}
      direction={sortDirection}
      onSort={sortBy}
    />
  );
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: household.currency,
    currencyDisplay: 'narrowSymbol',
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
    <section className="householdDashboard" aria-label="Household dashboard">
      <div className="dashboardHeading">
        <div className="dashboardSelectors" data-onboarding="month-overview">
          <div className="householdControl">
            {(householdsQuery.data?.length ?? 0) > 1 ? (
              <label className="householdPicker">
                <span className="srOnly">Household</span>
                <select
                  value={householdId}
                  onChange={(event) => {
                    setHouseholdId(event.target.value);
                    resetFilters();
                  }}
                >
                  {householdsQuery.data?.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                      {entry.isPrimary ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <h1 className="householdNameText">{household.name}</h1>
            )}
          </div>
          <div className="monthNavigation">
            <button
              type="button"
              className="monthNavigationButton"
              aria-label="Previous month"
              disabled={selectedMonthIndex <= 0}
              onClick={() => setMonth(months[selectedMonthIndex - 1]!.value)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <label className="monthPicker">
              <span className="srOnly">Month</span>
              <select value={month} onChange={(event) => setMonth(event.target.value)}>
                {months.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className={option.isFuture ? 'futureMonthOption' : undefined}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="monthNavigationButton"
              aria-label="Next month"
              disabled={selectedMonthIndex < 0 || selectedMonthIndex >= months.length - 1}
              onClick={() => setMonth(months[selectedMonthIndex + 1]!.value)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
      {savedDestinationMonth ? (
        <div className="transactionSavedNotice" role="status">
          <span>
            Transaction saved to{' '}
            {new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
              new Date(`${savedDestinationMonth}-01T12:00:00`),
            )}
            .
          </span>
          {savedDestinationMonth !== month ? (
            <button
              type="button"
              onClick={() => {
                setMonth(savedDestinationMonth);
                setSavedDestinationMonth(null);
              }}
            >
              View{' '}
              {new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
                new Date(`${savedDestinationMonth}-01T12:00:00`),
              )}
            </button>
          ) : null}
        </div>
      ) : null}
      <TransactionSummary
        currency={household.currency}
        totals={{
          income: summary.income,
          expenses: summary.expenses,
          savings,
          balance: summary.leftover,
        }}
      />
      {activeFilterCount ? (
        <TransactionSummary currency={household.currency} totals={filteredSummary} filtered />
      ) : null}

      <div className="transactionPanel">
        <div className="transactionPanelHeading">
          <h2>Activity</h2>
          <div className="transactionPanelActions">
            <span>{transactions.length} entries</span>
            <button
              type="button"
              className="addTransactionButton"
              data-onboarding="add-transaction"
              onClick={() => setAddingTransaction(true)}
            >
              Add transaction
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
                <button type="button" onClick={resetFilters}>
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
                  <th className="transactionIconColumn" aria-label="Icon and color" />
                  <th className="transactionRecurringColumn" aria-label="Recurring status" />
                  {sortableHeader('date', 'Date', 'transactionDateColumn')}
                  {sortableHeader('amount', 'Amount', 'transactionAmountColumn')}
                  {sortableHeader('source', 'Source', 'transactionSourceColumn')}
                  {sortableHeader('type', 'Type', 'transactionTypeColumn')}
                  {sortableHeader('user', 'User', 'transactionUserColumn')}
                  <th className="transactionActionsColumn" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((entry) => (
                  <tr
                    key={`${entry.kind}-${entry.id}-${entry.date}`}
                    className={
                      entry.projected || isUpcomingRecurringTransaction(entry, month)
                        ? 'projectedTransaction'
                        : undefined
                    }
                  >
                    <td className="transactionIconColumn">
                      <EntryIcon entry={entry} />
                    </td>
                    <td className="transactionRecurringColumn">
                      <RecurringIcon entry={entry} />
                    </td>
                    <td className="transactionDateColumn">
                      <time dateTime={entry.date}>
                        {date.format(new Date(`${entry.date}T12:00:00`))}
                      </time>
                    </td>
                    <td
                      className={`transactionAmountColumn ${
                        entry.kind === 'income' ? 'incomeAmount' : 'expenseAmount'
                      }`}
                    >
                      {entry.kind === 'income' ? '+' : '−'}
                      {money.format(Number(entry.amount))}
                    </td>
                    <td className="transactionSourceColumn">
                      {entry.projected ? <span className="srOnly">Projected: </span> : null}
                      <span className="transactionSourceName" title={entry.source.displayName}>
                        {entry.source.displayName}
                      </span>
                    </td>
                    <td className="transactionTypeColumn">{transactionTypeLabel(entry)}</td>
                    <td className="transactionUserColumn">
                      <span className="transactionUser">
                        <ProfileImage
                          image={entry.user.profileImage}
                          color={entry.user.desiredColor}
                          size={32}
                        />
                        <span className="transactionUserName">{entry.user.displayName}</span>
                      </span>
                    </td>
                    <td className="transactionActionsColumn">
                      {entry.projected ? null : (
                        <TransactionMenu
                          entry={entry}
                          onEdit={() => setTransactionToEdit(entry)}
                          onRemove={() => setTransactionToRemove(entry)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : transactions.length ? (
            <p className="transactionEmpty">
              No transactions match these filters.{' '}
              <button type="button" onClick={resetFilters}>
                Clear filters
              </button>
            </p>
          ) : (
            <p className="transactionEmpty">No income or expenses recorded for this month.</p>
          )}
        </div>
      </div>

      {addingTransaction ? (
        <TransactionForm
          householdId={household.id}
          currency={household.currency}
          selectedMonth={month}
          members={query.data.members}
          sources={query.data.sources}
          transactions={query.data.transactions}
          onSaved={(destinationMonth) => {
            if (destinationMonth !== month) setSavedDestinationMonth(destinationMonth);
          }}
          onClose={() => setAddingTransaction(false)}
        />
      ) : null}
      {transactionToEdit ? (
        <TransactionForm
          householdId={household.id}
          currency={household.currency}
          selectedMonth={month}
          members={query.data.members}
          sources={query.data.sources}
          transaction={transactionToEdit}
          onSaved={(destinationMonth) => {
            if (destinationMonth !== month) setSavedDestinationMonth(destinationMonth);
          }}
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
