'use client';

import { Defaults, type HouseholdTransaction } from '@monthloom/contracts';
import {
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  RefreshCw,
  SlidersHorizontal,
  Store,
  Tags,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useMotionPresence } from '../../components/motion/use-motion-presence';
import { ProfileImage } from '../../components/profile-image';
import { Alert, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { useHouseholdMonth, useHouseholds } from './api/queries';
import { RemoveTransactionDialog } from './dashboard/remove-transaction-dialog';
import { TransactionSummary } from './dashboard/summary';
import { TransactionMenu } from './dashboard/transaction-menu';
import {
  isProjectedTransaction,
  toggleFilterSelection,
  type RecurringFilter,
  type TransactionFilters,
  type TransactionSortKey,
} from './dashboard/transaction-view';
import { useDashboardSelection } from './dashboard/use-dashboard-selection';
import { useTransactionView } from './dashboard/use-transaction-view';
import { FinancialIcon } from './financial-icon';
import { HouseholdPicker, resolveHouseholdId } from './selectors/household-picker';
import { MONTH_KEYS, formatTranslatedMonthYear } from './selectors/month';
import { MonthPicker } from './selectors/month-picker';
import { TransactionForm } from './transaction-form';

function isMobileFilterSheet(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 620px)').matches;
}

function ToggleFilterList({
  label,
  options,
  value,
  allLabel,
  noneLabel,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  allLabel: string;
  noneLabel: string;
  onChange: (value: string[]) => void;
}) {
  const allSelected = value.includes('all');
  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);
  const selectionSummary = allSelected
    ? allLabel
    : value.length === 0
      ? noneLabel
      : selectedLabels.length > 1
        ? `${selectedLabels[0]} +${selectedLabels.length - 1}`
        : (selectedLabels[0] ?? noneLabel);
  const renderOption = (option: { value: string; label: string }, selected: boolean) => (
    <button
      key={option.value}
      type="button"
      aria-pressed={selected}
      onClick={() =>
        onChange(
          toggleFilterSelection(
            value,
            option.value,
            options.map(({ value }) => value),
          ),
        )
      }
    >
      <Check aria-hidden="true" />
      <span>{option.label}</span>
    </button>
  );

  return (
    <fieldset className="transactionFilterField transactionFilterToggleField">
      <legend>{label}</legend>
      <details
        className="transactionFilterToggleDropdown"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            event.currentTarget.removeAttribute('open');
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }}
      >
        <summary aria-label={`${label}: ${selectionSummary}`}>
          <span>{selectionSummary}</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="transactionFilterToggleList">
          <button type="button" aria-pressed={allSelected} onClick={() => onChange(['all'])}>
            <Check aria-hidden="true" />
            <span>{allLabel}</span>
          </button>
          <button
            type="button"
            className="transactionFilterNone"
            aria-pressed={value.length === 0}
            onClick={() => onChange([])}
          >
            <Check aria-hidden="true" />
            <span>{noneLabel}</span>
          </button>
          {options.map((option) =>
            renderOption(option, allSelected || value.includes(option.value)),
          )}
        </div>
      </details>
    </fieldset>
  );
}

function EntryIcon({ entry }: { entry: HouseholdTransaction }) {
  const labels = useTranslations('Labels.financialIcons');
  const label = labels(entry.icon);
  return (
    <span className="transactionIcon" style={{ backgroundColor: entry.color }} title={label}>
      <FinancialIcon name={entry.icon} size={18} />
      <span className="srOnly">{label}</span>
    </span>
  );
}

function RecurringIcon({ entry }: { entry: HouseholdTransaction }) {
  const t = useTranslations('Finance');
  const locale = useLocale();
  if (!entry.recurring) return null;

  const interval = entry.recurrenceInterval ?? Defaults.TRANSACTION_RECURRENCE_INTERVAL;
  const unit = entry.recurrenceUnit ?? Defaults.TRANSACTION_RECURRENCE_UNIT;
  const schedule = t('recurrenceSchedule', {
    interval,
    unit: t(`recurrenceUnits.${unit}`, { interval }),
  });
  const label = entry.expiresOn
    ? t('recurrenceUntil', {
        schedule,
        date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
          new Date(`${entry.expiresOn}T12:00:00`),
        ),
      })
    : schedule;
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
  const t = useTranslations('Finance');
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
        aria-label={t('sortBy', { label })}
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
  const t = useTranslations('Finance');
  const typeLabels = useTranslations('Labels.expenseTypes');
  const monthLabels = useTranslations('Labels.months');
  const locale = useLocale();
  const monthYearFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    [locale],
  );
  const { month, setMonth, householdId, setHouseholdId } = useDashboardSelection();
  const addTransactionTriggerRef = useRef<HTMLButtonElement>(null);
  const [addingTransaction, setAddingTransaction] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<HouseholdTransaction | null>(null);
  const [transactionToRemove, setTransactionToRemove] = useState<HouseholdTransaction | null>(null);
  const [savedDestinationMonth, setSavedDestinationMonth] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filterSummaryRef = useRef<HTMLElement>(null);
  const filterSheetRef = useRef<HTMLDivElement>(null);
  const addingTransactionPresence = useMotionPresence(addingTransaction);
  const editingTransactionPresence = useMotionPresence(Boolean(transactionToEdit));
  const removingTransactionPresence = useMotionPresence(Boolean(transactionToRemove));
  const filtersPresence = useMotionPresence(filtersExpanded);
  const lastTransactionToEditRef = useRef<HouseholdTransaction | null>(null);
  const lastTransactionToRemoveRef = useRef<HouseholdTransaction | null>(null);
  if (transactionToEdit) lastTransactionToEditRef.current = transactionToEdit;
  if (transactionToRemove) lastTransactionToRemoveRef.current = transactionToRemove;
  const householdsQuery = useHouseholds();
  const activeHouseholdId = householdsQuery.data
    ? resolveHouseholdId(householdsQuery.data, householdId)
    : '';
  useEffect(() => {
    if (!householdsQuery.data) return;
    setHouseholdId((current) => resolveHouseholdId(householdsQuery.data, current));
  }, [householdsQuery.data, setHouseholdId]);
  const query = useHouseholdMonth(activeHouseholdId, month);
  const transactionView = useTransactionView(query.data?.transactions ?? []);
  const filteredRecapPresence = useMotionPresence(transactionView.activeFilterCount > 0);
  const filterChipsPresence = useMotionPresence(
    transactionView.activeFilterCount > 0 && !filtersExpanded,
  );
  const lastFilteredSummaryRef = useRef(transactionView.filteredSummary);
  const lastActiveFiltersRef = useRef<Array<{ key: keyof TransactionFilters; label: string }>>([]);
  if (transactionView.activeFilterCount) {
    lastFilteredSummaryRef.current = transactionView.filteredSummary;
  }
  useEffect(() => {
    if (!filtersExpanded || !filtersPresence.visible || !isMobileFilterSheet()) return;

    const sheet = filterSheetRef.current;
    const focusable = () =>
      Array.from(
        sheet?.querySelectorAll<HTMLElement>('button:not([disabled]), select, input') ?? [],
      );
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFiltersExpanded(false);
        filterSummaryRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filtersExpanded, filtersPresence.visible]);
  if (householdsQuery.isPending || (householdsQuery.data?.length && query.isPending)) {
    return (
      <div className="dashboardState">
        <LoadingIndicator label={t('loadingHousehold')} />
      </div>
    );
  }
  if (householdsQuery.isError) {
    return (
      <div className="dashboardState">
        <Alert variant="error">{t('loadHouseholdsError')}</Alert>
      </div>
    );
  }
  if (householdsQuery.data?.length === 0) {
    return (
      <div className="dashboardState">
        <h1>{t('noHouseholds')}</h1>
        <p>{t('createOrWait')}</p>
        <Link href="/settings/households" className="button">
          {t('openSettings')}
        </Link>
      </div>
    );
  }
  if (query.isError || !query.data) {
    if (isApiClientError(query.error) && query.error.status === 404) {
      return (
        <div className="dashboardState">
          <h1>{t('householdUnavailable')}</h1>
          <p>{t('createOrWait')}</p>
          <Link href="/settings/households" className="button">
            {t('openSettings')}
          </Link>
        </div>
      );
    }
    return (
      <div className="dashboardState">
        <Alert variant="error">{t('loadHouseholdError')}</Alert>
      </div>
    );
  }

  const { household, summary, transactions } = query.data;
  const {
    activeFilterCount,
    filters,
    includeProjected,
    resetFilters,
    recapSummary,
    setFilters,
    setIncludeProjected,
    sortBy,
    sortDirection,
    sortKey,
    visibleTransactions: sortedTransactions,
  } = transactionView;
  const filteredTransactions = sortedTransactions;
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
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: household.currency,
    currencyDisplay: 'narrowSymbol',
  });
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' });
  const filterDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const transactionCollator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: 'base',
  });
  const expenseTypes = Array.from(
    new Set(
      transactions
        .filter((transaction) => transaction.kind === 'expense' && transaction.type)
        .map((transaction) => transaction.type!),
    ),
  ).sort((left, right) => transactionCollator.compare(typeLabels(left), typeLabels(right)));
  const amountRangeMax = Math.max(
    100,
    Math.ceil(
      Math.max(
        ...transactions.map((transaction) => Number(transaction.amount)),
        Number(filters.amountOver) || 0,
        Number(filters.amountUnder) || 0,
      ) / 100,
    ) * 100,
  );
  const amountRangeMinValue = Math.min(Number(filters.amountOver) || 0, amountRangeMax - 0.01);
  const amountRangeMaxValue = Math.max(
    Number(filters.amountUnder) || amountRangeMax,
    amountRangeMinValue + 0.01,
  );
  const updateFilter = <Key extends keyof TransactionFilters>(
    key: Key,
    value: TransactionFilters[Key],
  ) => setFilters((current) => ({ ...current, [key]: value }));
  const closeFilters = () => {
    setFiltersExpanded(false);
    filterSummaryRef.current?.focus();
  };
  const typeFilterOptions = [
    { value: 'income', label: t('income') },
    ...expenseTypes.map((type) => ({ value: `expense:${type}`, label: typeLabels(type) })),
  ];
  const sourceFilterOptions = query.data.sources.map((source) => ({
    value: source.id,
    label: source.displayName,
  }));
  const userFilterOptions = query.data.members.map((member) => ({
    value: member.id,
    label: member.displayName,
  }));
  const selectionLabel = (
    selection: string[],
    options: Array<{ value: string; label: string }>,
    fallback: string,
  ) =>
    selection.length
      ? selection
          .map((value) => options.find((option) => option.value === value)?.label)
          .filter(Boolean)
          .join(', ')
      : fallback;
  const activeFilters: Array<{ key: keyof TransactionFilters; label: string }> = [
    !filters.types.includes('all')
      ? {
          key: 'types',
          label: selectionLabel(filters.types, typeFilterOptions, `${t('type')}: ${t('none')}`),
        }
      : null,
    !filters.userIds.includes('all')
      ? {
          key: 'userIds',
          label: selectionLabel(filters.userIds, userFilterOptions, `${t('user')}: ${t('none')}`),
        }
      : null,
    !filters.sourceIds.includes('all')
      ? {
          key: 'sourceIds',
          label: selectionLabel(
            filters.sourceIds,
            sourceFilterOptions,
            `${t('source')}: ${t('none')}`,
          ),
        }
      : null,
    filters.recurring !== 'all'
      ? {
          key: 'recurring',
          label: filters.recurring === 'recurring' ? t('recurring') : t('oneOff'),
        }
      : null,
    filters.dateFrom
      ? {
          key: 'dateFrom',
          label: t('fromDate', {
            date: filterDate.format(new Date(`${filters.dateFrom}T12:00:00`)),
          }),
        }
      : null,
    filters.dateTo
      ? {
          key: 'dateTo',
          label: t('toDate', {
            date: filterDate.format(new Date(`${filters.dateTo}T12:00:00`)),
          }),
        }
      : null,
    filters.amountOver
      ? {
          key: 'amountOver',
          label: t('overAmount', { amount: money.format(Number(filters.amountOver)) }),
        }
      : null,
    filters.amountUnder
      ? {
          key: 'amountUnder',
          label: t('underAmount', { amount: money.format(Number(filters.amountUnder)) }),
        }
      : null,
  ].filter((filter): filter is { key: keyof TransactionFilters; label: string } => Boolean(filter));
  if (activeFilters.length) lastActiveFiltersRef.current = activeFilters;
  const removeFilter = (key: keyof TransactionFilters) =>
    updateFilter(
      key,
      key === 'types' || key === 'userIds' || key === 'sourceIds'
        ? ['all']
        : key === 'recurring'
          ? 'all'
          : '',
    );

  return (
    <section
      className="householdDashboard"
      aria-label={t('householdDashboard')}
      aria-busy={query.isFetching}
    >
      <div className="dashboardHeading">
        <div className="dashboardSelectors" data-onboarding="month-overview">
          <HouseholdPicker
            households={householdsQuery.data ?? []}
            value={householdId}
            onChange={(nextHouseholdId) => {
              setHouseholdId(nextHouseholdId);
              resetFilters();
            }}
          />
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>
      {savedDestinationMonth ? (
        <div className="transactionSavedNotice" role="status">
          <span>
            {t('transactionSavedTo')}{' '}
            {formatTranslatedMonthYear(
              monthYearFormatter,
              new Date(`${savedDestinationMonth}-01T12:00:00`),
              monthLabels(MONTH_KEYS[Number(savedDestinationMonth.slice(5, 7)) - 1]!),
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
              {t('viewMonth')}{' '}
              {monthLabels(MONTH_KEYS[Number(savedDestinationMonth.slice(5, 7)) - 1]!)}
            </button>
          ) : null}
        </div>
      ) : null}
      <TransactionSummary
        currency={household.currency}
        totals={{
          income: includeProjected ? summary.income : recapSummary.income,
          expenses: includeProjected ? summary.expenses : recapSummary.expenses,
          savings: recapSummary.savings,
          balance: includeProjected ? summary.leftover : recapSummary.balance,
        }}
      />
      {filteredRecapPresence.visible ? (
        <TransactionSummary
          currency={household.currency}
          totals={lastFilteredSummaryRef.current}
          filtered
          motionState={filteredRecapPresence.state}
        />
      ) : null}

      <div className="transactionPanel">
        <div className="transactionPanelHeading">
          <h2>{t('activity')}</h2>
          <div className="transactionPanelActions">
            <span>{t('entries', { count: transactions.length })}</span>
            <button
              type="button"
              className="projectionToggle"
              aria-pressed={includeProjected}
              aria-label={t('includeProjected')}
              onClick={() => setIncludeProjected((included) => !included)}
            >
              {includeProjected ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              {t('projected')}
            </button>
            <button
              ref={addTransactionTriggerRef}
              type="button"
              className="addTransactionButton"
              data-onboarding="add-transaction"
              onClick={() => setAddingTransaction(true)}
            >
              {t('addTransaction')}
            </button>
          </div>
        </div>
        <div className="transactionFiltersRegion">
          <details className="transactionFilters" open={filtersExpanded}>
            <summary
              ref={filterSummaryRef}
              onClick={(event) => {
                event.preventDefault();
                setFiltersExpanded((expanded) => !expanded);
              }}
            >
              <span className="transactionFilterTitle">
                <SlidersHorizontal aria-hidden="true" />
                {t('filters')}
                {activeFilterCount ? (
                  <span className="transactionFilterCount">{activeFilterCount}</span>
                ) : null}
              </span>
              <span className="transactionFilterHint">
                {activeFilterCount
                  ? t('matching', { count: filteredTransactions.length })
                  : t('showOptions')}
              </span>
            </summary>
          </details>
          <div
            className="transactionFilterDrawer"
            data-motion={filtersPresence.state}
            aria-hidden={filtersPresence.state === 'exiting' ? 'true' : undefined}
            inert={filtersPresence.state === 'exiting' ? ('' as unknown as boolean) : undefined}
            hidden={!filtersPresence.visible}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && isMobileFilterSheet()) closeFilters();
            }}
          >
            <div
              ref={filterSheetRef}
              className="transactionFilterSheet"
              role="dialog"
              aria-modal={filtersExpanded && isMobileFilterSheet() ? 'true' : undefined}
              aria-label={t('transactionFilters')}
            >
              <div className="transactionFilterSheetHeader">
                <div>
                  <strong>{t('filterActivity')}</strong>
                  <span>{t('refineActivity')}</span>
                </div>
                <button type="button" aria-label={t('closeFilters')} onClick={closeFilters}>
                  <X aria-hidden="true" />
                </button>
              </div>
              <div className="transactionFilterGroup transactionFilterGroupPrimary">
                <div className="transactionFilterGroupFields">
                  <ToggleFilterList
                    label={t('type')}
                    options={typeFilterOptions}
                    value={filters.types}
                    allLabel={t('all')}
                    noneLabel={t('none')}
                    onChange={(value) => updateFilter('types', value)}
                  />
                  <ToggleFilterList
                    label={t('source')}
                    options={sourceFilterOptions}
                    value={filters.sourceIds}
                    allLabel={t('all')}
                    noneLabel={t('none')}
                    onChange={(value) => updateFilter('sourceIds', value)}
                  />
                </div>
              </div>
              <div className="transactionFilterGroup transactionFilterGroupSecondary">
                <div className="transactionFilterGroupFields">
                  <ToggleFilterList
                    label={t('user')}
                    options={userFilterOptions}
                    value={filters.userIds}
                    allLabel={t('all')}
                    noneLabel={t('none')}
                    onChange={(value) => updateFilter('userIds', value)}
                  />
                  <label className="transactionFilterField">
                    <span>{t('recurring')}</span>
                    <select
                      value={filters.recurring}
                      onChange={(event) =>
                        updateFilter('recurring', event.target.value as RecurringFilter)
                      }
                    >
                      <option value="all">{t('allTransactions')}</option>
                      <option value="recurring">{t('recurringOnly')}</option>
                      <option value="one-off">{t('oneOffOnly')}</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="transactionFilterGroup transactionFilterGroupDate">
                <div className="transactionFilterGroupFields">
                  <label className="transactionFilterField">
                    <span>{t('from')}</span>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      max={filters.dateTo || undefined}
                      onChange={(event) => updateFilter('dateFrom', event.target.value)}
                    />
                  </label>
                  <label className="transactionFilterField">
                    <span>{t('to')}</span>
                    <input
                      type="date"
                      value={filters.dateTo}
                      min={filters.dateFrom || undefined}
                      onChange={(event) => updateFilter('dateTo', event.target.value)}
                    />
                  </label>
                </div>
              </div>
              <div
                className="transactionFilterGroup transactionFilterGroupAmount"
                role="group"
                aria-label={t('amountRange', { currency: household.currency })}
              >
                <div className="amountRangeControl">
                  <label className="amountRangeValue">
                    <span className="srOnly">
                      {t('minimumAmount', { currency: household.currency })}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={filters.amountUnder || amountRangeMax}
                      step="0.01"
                      placeholder={t('min')}
                      value={filters.amountOver}
                      onChange={(event) => updateFilter('amountOver', event.target.value)}
                    />
                    <span aria-hidden="true">{household.currency}</span>
                  </label>
                  <div className="amountRangeSliders">
                    <input
                      type="range"
                      aria-label={t('minimumAmount', { currency: household.currency })}
                      min="0"
                      max={amountRangeMax}
                      step="0.01"
                      value={amountRangeMinValue}
                      onChange={(event) => {
                        const value = Math.min(
                          Number(event.target.value),
                          amountRangeMaxValue - 0.01,
                        );
                        updateFilter('amountOver', value === 0 ? '' : String(value));
                      }}
                    />
                    <input
                      type="range"
                      aria-label={t('maximumAmount', { currency: household.currency })}
                      min="0"
                      max={amountRangeMax}
                      step="0.01"
                      value={amountRangeMaxValue}
                      onChange={(event) => {
                        const value = Math.max(
                          Number(event.target.value),
                          amountRangeMinValue + 0.01,
                        );
                        updateFilter('amountUnder', value === amountRangeMax ? '' : String(value));
                      }}
                    />
                  </div>
                  <label className="amountRangeValue">
                    <span className="srOnly">
                      {t('maximumAmount', { currency: household.currency })}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={filters.amountOver || 0}
                      max={amountRangeMax}
                      step="0.01"
                      placeholder={t('max')}
                      value={filters.amountUnder}
                      onChange={(event) => updateFilter('amountUnder', event.target.value)}
                    />
                    <span aria-hidden="true">{household.currency}</span>
                  </label>
                </div>
              </div>
              <div className="transactionFilterFooter">
                <span aria-live="polite">
                  {t('showingEntries', {
                    shown: filteredTransactions.length,
                    total: transactions.length,
                  })}
                </span>
                <div className="transactionFilterActions">
                  <button
                    className="transactionFilterClear"
                    type="button"
                    disabled={!activeFilterCount}
                    onClick={resetFilters}
                  >
                    {t('clearFilters')}
                  </button>
                  <button
                    className="transactionFilterApply"
                    type="button"
                    disabled={!activeFilterCount}
                    onClick={closeFilters}
                  >
                    {t('applyFilters')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {filterChipsPresence.visible ? (
          <div
            className="transactionFilterChips"
            aria-label={t('activeFilters')}
            aria-hidden={filterChipsPresence.state === 'exiting' ? 'true' : undefined}
            data-motion={filterChipsPresence.state}
          >
            {lastActiveFiltersRef.current.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => removeFilter(filter.key)}
                aria-label={t('removeFilter', { filter: filter.label })}
              >
                <span>{filter.label}</span>
                <X aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="transactionScroll">
          {filteredTransactions.length ? (
            <table className="transactionTable">
              <thead>
                <tr>
                  <th className="transactionIconColumn" aria-label={t('iconAndColor')} />
                  <th className="transactionRecurringColumn" aria-label={t('recurringStatus')} />
                  {sortableHeader('date', t('date'), 'transactionDateColumn')}
                  {sortableHeader('amount', t('amount'), 'transactionAmountColumn')}
                  {sortableHeader('source', t('source'), 'transactionSourceColumn')}
                  {sortableHeader('type', t('type'), 'transactionTypeColumn')}
                  {sortableHeader('user', t('user'), 'transactionUserColumn')}
                  <th className="transactionActionsColumn" aria-label={t('actions')} />
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((entry) => (
                  <tr
                    key={`${entry.kind}-${entry.id}-${entry.date}`}
                    className={isProjectedTransaction(entry) ? 'projectedTransaction' : undefined}
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
                      {isProjectedTransaction(entry) ? (
                        <span className="srOnly">{t('projected')}: </span>
                      ) : null}
                      <span className="transactionSourceName" title={entry.source.displayName}>
                        {entry.source.displayName}
                      </span>
                    </td>
                    <td className="transactionTypeColumn">
                      {entry.kind === 'income' ? t('income') : typeLabels(entry.type ?? 'other')}
                    </td>
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
                      <TransactionMenu
                        entry={entry}
                        onEdit={() => setTransactionToEdit(entry)}
                        onRemove={() => setTransactionToRemove(entry)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : transactions.length ? (
            <p className="transactionEmpty">
              {t('noMatchingTransactions')}{' '}
              <button type="button" onClick={resetFilters}>
                {t('clearFilters')}
              </button>
            </p>
          ) : (
            <p className="transactionEmpty">{t('noTransactionsThisMonth')}</p>
          )}
        </div>
      </div>

      {addingTransactionPresence.visible ? (
        <TransactionForm
          motionState={addingTransactionPresence.state}
          returnFocusTo={addTransactionTriggerRef.current}
          householdId={household.id}
          currency={household.currency}
          selectedMonth={month}
          members={query.data.members}
          sources={query.data.sources}
          transactions={query.data.transactions}
          onSaved={(destinationMonth) => {
            if (destinationMonth !== month) setSavedDestinationMonth(destinationMonth);
          }}
          onClose={() => {
            setAddingTransaction(false);
            addTransactionTriggerRef.current?.focus();
          }}
        />
      ) : null}
      {editingTransactionPresence.visible && lastTransactionToEditRef.current ? (
        <TransactionForm
          motionState={editingTransactionPresence.state}
          householdId={household.id}
          currency={household.currency}
          selectedMonth={month}
          members={query.data.members}
          sources={query.data.sources}
          transaction={lastTransactionToEditRef.current}
          onSaved={(destinationMonth) => {
            if (destinationMonth !== month) setSavedDestinationMonth(destinationMonth);
          }}
          onClose={() => setTransactionToEdit(null)}
        />
      ) : null}
      {removingTransactionPresence.visible && lastTransactionToRemoveRef.current ? (
        <RemoveTransactionDialog
          motionState={removingTransactionPresence.state}
          householdId={household.id}
          transaction={lastTransactionToRemoveRef.current}
          onClose={() => setTransactionToRemove(null)}
        />
      ) : null}
    </section>
  );
}
