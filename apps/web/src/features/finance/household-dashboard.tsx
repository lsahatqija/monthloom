'use client';

import { Defaults, type HouseholdTransaction } from '@monthloom/contracts';
import {
  Banknote,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  Store,
  Tags,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
  isUpcomingRecurringTransaction,
  summarizeTransactions,
  type RecurringFilter,
  type TransactionFilters,
  type TransactionSortKey,
} from './dashboard/transaction-view';
import { useDashboardSelection } from './dashboard/use-dashboard-selection';
import { useTransactionView } from './dashboard/use-transaction-view';
import { FinancialIcon } from './financial-icon';
import { TransactionForm } from './transaction-form';

const transactionCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isMobileFilterSheet(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 620px)').matches;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthKey(new Date(year!, monthNumber! - 1 + offset, 1));
}

export function selectMonthLabelVariant(
  availableWidth: number,
  fullWidth: number,
  shortYearWidth: number,
  monthWidth: number,
  abbreviatedShortYearWidth: number,
): 'full' | 'shortYear' | 'month' | 'abbreviatedShortYear' | 'abbreviated' {
  if (fullWidth <= availableWidth) return 'full';
  if (shortYearWidth <= availableWidth) return 'shortYear';
  if (monthWidth <= availableWidth) return 'month';
  if (abbreviatedShortYearWidth <= availableWidth) return 'abbreviatedShortYear';
  return 'abbreviated';
}

export function shouldCollapseCurrentMonthButton(
  availableWidth: number,
  controlsWidth: number,
  abbreviatedLabelWidth: number,
): boolean {
  return controlsWidth + abbreviatedLabelWidth > availableWidth;
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
  if (!entry.recurring) return null;

  const interval = entry.recurrenceInterval ?? Defaults.TRANSACTION_RECURRENCE_INTERVAL;
  const unit = entry.recurrenceUnit ?? Defaults.TRANSACTION_RECURRENCE_UNIT;
  const schedule = t('recurrenceSchedule', {
    interval,
    unit: t(`recurrenceUnits.${unit}`, { interval }),
  });
  const label = entry.expiresOn
    ? t('recurrenceUntil', { schedule, date: entry.expiresOn })
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
  const { month, setMonth, householdId, setHouseholdId } = useDashboardSelection();
  const [selectedYear, selectedMonthNumber] = month.split('-').map(Number);
  const currentMonthKey = monthKey(new Date());
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(selectedYear!, selectedMonthNumber! - 1, 1));
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
    new Date(selectedYear!, selectedMonthNumber! - 1, 1),
  );
  const abbreviatedMonthName = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(
    new Date(selectedYear!, selectedMonthNumber! - 1, 1),
  );
  const shortYear = `'${String(selectedYear).slice(-2)}`;
  const monthNameWithShortYear = `${monthName} ${shortYear}`;
  const abbreviatedMonthNameWithShortYear = `${abbreviatedMonthName} ${shortYear}`;
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
          new Date(2024, index, 1),
        ),
        abbreviatedLabel: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(
          new Date(2024, index, 1),
        ),
      })),
    [],
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
    if (!years.includes(selectedYear!)) years.push(selectedYear!);
    return years.sort((a, b) => a - b);
  }, [selectedYear]);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const previousMonthRef = useRef(month);
  const monthDirection =
    month === previousMonthRef.current
      ? 'none'
      : month > previousMonthRef.current
        ? 'forward'
        : 'backward';
  const [monthLabelVariant, setMonthLabelVariant] = useState<
    'full' | 'shortYear' | 'month' | 'abbreviatedShortYear' | 'abbreviated'
  >('full');
  const [currentMonthButtonInPicker, setCurrentMonthButtonInPicker] = useState(false);
  const [monthLabelWidth, setMonthLabelWidth] = useState<number>();
  const monthNavigationRef = useRef<HTMLDivElement>(null);
  const monthLabelRef = useRef<HTMLSpanElement>(null);
  const monthLabelMeasureRef = useRef<HTMLSpanElement>(null);
  const monthNameWithShortYearMeasureRef = useRef<HTMLSpanElement>(null);
  const monthNameMeasureRef = useRef<HTMLSpanElement>(null);
  const abbreviatedMonthNameWithShortYearMeasureRef = useRef<HTMLSpanElement>(null);
  const abbreviatedMonthNameMeasureRef = useRef<HTMLSpanElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const monthPickerTriggerRef = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    previousMonthRef.current = month;
  }, [month]);
  useLayoutEffect(() => {
    const navigation = monthNavigationRef.current;
    const visibleLabel = monthLabelRef.current;
    const monthPicker = monthPickerRef.current;
    const monthPickerTrigger = monthPickerTriggerRef.current;
    const fullLabel = monthLabelMeasureRef.current;
    const shortYearLabel = monthNameWithShortYearMeasureRef.current;
    const monthOnlyLabel = monthNameMeasureRef.current;
    const abbreviatedShortYearLabel = abbreviatedMonthNameWithShortYearMeasureRef.current;
    const abbreviatedLabel = abbreviatedMonthNameMeasureRef.current;
    if (
      !navigation ||
      !visibleLabel ||
      !monthPicker ||
      !monthPickerTrigger ||
      !fullLabel ||
      !shortYearLabel ||
      !monthOnlyLabel ||
      !abbreviatedShortYearLabel ||
      !abbreviatedLabel ||
      typeof ResizeObserver === 'undefined'
    )
      return;

    const measure = () => {
      const fullLabelWidth = fullLabel.getBoundingClientRect().width;
      const shortYearLabelWidth = shortYearLabel.getBoundingClientRect().width;
      const monthNameWidth = monthOnlyLabel.getBoundingClientRect().width;
      const abbreviatedShortYearLabelWidth =
        abbreviatedShortYearLabel.getBoundingClientRect().width;
      const abbreviatedMonthNameWidth = abbreviatedLabel.getBoundingClientRect().width;
      const visibleLabelWidth = visibleLabel.getBoundingClientRect().width;
      const gap = Number.parseFloat(getComputedStyle(navigation).columnGap) || 0;
      const showCurrentMonthButton = month !== currentMonthKey;
      const navigationButtonWidth =
        navigation.querySelector<HTMLElement>('.monthNavigationButton')?.getBoundingClientRect()
          .width ?? 0;
      const monthPickerChromeWidth =
        monthPickerTrigger.getBoundingClientRect().width - visibleLabelWidth;
      const otherControlsWidth = Array.from(navigation.children).reduce(
        (width, child) =>
          child === monthPicker || child.classList.contains('currentMonthButton')
            ? width
            : width + child.getBoundingClientRect().width,
        0,
      );
      const expandedControlsWidth =
        otherControlsWidth +
        monthPickerChromeWidth +
        (showCurrentMonthButton ? navigationButtonWidth : 0) +
        gap * (showCurrentMonthButton ? 3 : 2);
      const collapseCurrentMonthButton =
        showCurrentMonthButton &&
        shouldCollapseCurrentMonthButton(
          navigation.clientWidth,
          expandedControlsWidth,
          abbreviatedMonthNameWidth,
        );
      const navigationWithoutLabelWidth = collapseCurrentMonthButton
        ? otherControlsWidth + monthPickerChromeWidth + gap * 2
        : expandedControlsWidth;
      const availableLabelWidth = navigation.clientWidth - navigationWithoutLabelWidth;
      const variant = selectMonthLabelVariant(
        availableLabelWidth,
        fullLabelWidth,
        shortYearLabelWidth,
        monthNameWidth,
        abbreviatedShortYearLabelWidth,
      );
      setCurrentMonthButtonInPicker(collapseCurrentMonthButton);
      setMonthLabelVariant(variant);
      setMonthLabelWidth(
        variant === 'full'
          ? fullLabelWidth
          : variant === 'shortYear'
            ? shortYearLabelWidth
            : variant === 'month'
              ? monthNameWidth
              : variant === 'abbreviatedShortYear'
                ? abbreviatedShortYearLabelWidth
                : abbreviatedMonthNameWidth,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(navigation);
    measure();
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [currentMonthKey, month, monthLabel]);
  useEffect(() => {
    if (!monthPickerOpen) return;
    const closePicker = (event: MouseEvent) => {
      if (!monthPickerRef.current?.contains(event.target as Node)) setMonthPickerOpen(false);
    };
    const closePickerWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMonthPickerOpen(false);
        monthPickerTriggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', closePicker);
    document.addEventListener('keydown', closePickerWithKeyboard);
    return () => {
      document.removeEventListener('mousedown', closePicker);
      document.removeEventListener('keydown', closePickerWithKeyboard);
    };
  }, [monthPickerOpen]);
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
  const activeFilters: Array<{ key: keyof TransactionFilters; label: string }> = [
    filters.type !== 'all'
      ? {
          key: 'type',
          label:
            filters.type === 'income'
              ? t('income')
              : filters.type === 'expense'
                ? t('expenses')
                : typeLabels(filters.type.slice(8)),
        }
      : null,
    filters.userId !== 'all'
      ? {
          key: 'userId',
          label:
            query.data.members.find((member) => member.id === filters.userId)?.displayName ??
            t('selectedUser'),
        }
      : null,
    filters.sourceId !== 'all'
      ? {
          key: 'sourceId',
          label:
            query.data.sources.find((source) => source.id === filters.sourceId)?.displayName ??
            t('selectedSource'),
        }
      : null,
    filters.recurring !== 'all'
      ? {
          key: 'recurring',
          label: filters.recurring === 'recurring' ? t('recurring') : t('oneOff'),
        }
      : null,
    filters.dateFrom ? { key: 'dateFrom', label: t('fromDate', { date: filters.dateFrom }) } : null,
    filters.dateTo ? { key: 'dateTo', label: t('toDate', { date: filters.dateTo }) } : null,
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
      key === 'type' || key === 'userId' || key === 'sourceId' || key === 'recurring' ? 'all' : '',
    );

  return (
    <section
      className="householdDashboard"
      aria-label={t('householdDashboard')}
      aria-busy={query.isFetching}
    >
      <div className="dashboardHeading">
        <div className="dashboardSelectors" data-onboarding="month-overview">
          <div className="householdControl">
            {(householdsQuery.data?.length ?? 0) > 1 ? (
              <>
                <label className="householdPicker">
                  <span className="srOnly">{t('household')}</span>
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
                        {entry.isPrimary ? t('defaultSuffix') : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <h1 className="srOnly">{household.name}</h1>
              </>
            ) : (
              <h1 className="householdNameText" title={household.name}>
                {household.name}
              </h1>
            )}
          </div>
          <div
            ref={monthNavigationRef}
            className={`monthNavigation${currentMonthButtonInPicker ? ' isCompact' : ''}`}
            aria-label={t('monthNavigation')}
          >
            <button
              type="button"
              className={`currentMonthButton${month === currentMonthKey ? ' isHidden' : ''}`}
              aria-label={t('currentMonth')}
              aria-hidden={month === currentMonthKey ? 'true' : undefined}
              tabIndex={month === currentMonthKey ? -1 : undefined}
              title={month === currentMonthKey ? undefined : t('currentMonth')}
              onClick={() => setMonth(currentMonthKey)}
            >
              <CalendarCheck aria-hidden="true" />
            </button>
            <button
              type="button"
              className="monthNavigationButton"
              aria-label={t('previousMonth')}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <div ref={monthPickerRef} className="monthPicker">
              <div className="monthHeading">
                <button
                  ref={monthPickerTriggerRef}
                  type="button"
                  className="monthPickerTrigger"
                  aria-label={t('chooseMonthValue', { month: monthLabel })}
                  aria-expanded={monthPickerOpen}
                  aria-controls="month-picker-popover"
                  onClick={() => setMonthPickerOpen((open) => !open)}
                >
                  <span
                    key={month}
                    ref={monthLabelRef}
                    className="monthLabelText"
                    data-direction={monthDirection}
                    style={monthLabelWidth ? { width: `${monthLabelWidth}px` } : undefined}
                  >
                    {monthLabelVariant === 'full'
                      ? monthLabel
                      : monthLabelVariant === 'shortYear'
                        ? monthNameWithShortYear
                        : monthLabelVariant === 'month'
                          ? monthName
                          : monthLabelVariant === 'abbreviatedShortYear'
                            ? abbreviatedMonthNameWithShortYear
                            : abbreviatedMonthName}
                  </span>
                  <span ref={monthLabelMeasureRef} className="monthLabelMeasure" aria-hidden="true">
                    {monthNames.map((option) => (
                      <span key={option.value}>{`${option.label} ${selectedYear}`}</span>
                    ))}
                  </span>
                  <span
                    ref={monthNameWithShortYearMeasureRef}
                    className="monthLabelMeasure"
                    aria-hidden="true"
                  >
                    {monthNames.map((option) => (
                      <span key={option.value}>{`${option.label} ${shortYear}`}</span>
                    ))}
                  </span>
                  <span ref={monthNameMeasureRef} className="monthLabelMeasure" aria-hidden="true">
                    {monthNames.map((option) => (
                      <span key={option.value}>{option.label}</span>
                    ))}
                  </span>
                  <span
                    ref={abbreviatedMonthNameWithShortYearMeasureRef}
                    className="monthLabelMeasure"
                    aria-hidden="true"
                  >
                    {monthNames.map((option) => (
                      <span key={option.value}>{`${option.abbreviatedLabel} ${shortYear}`}</span>
                    ))}
                  </span>
                  <span
                    ref={abbreviatedMonthNameMeasureRef}
                    className="monthLabelMeasure"
                    aria-hidden="true"
                  >
                    {monthNames.map((option) => (
                      <span key={option.value}>{option.abbreviatedLabel}</span>
                    ))}
                  </span>
                  <ChevronDown aria-hidden="true" />
                </button>
              </div>
              {monthPickerOpen ? (
                <div
                  id="month-picker-popover"
                  className="monthPickerPopover"
                  role="group"
                  aria-label={t('chooseMonth')}
                >
                  <label>
                    <span>{t('month')}</span>
                    <select
                      value={selectedMonthNumber}
                      onChange={(event) => {
                        setMonth(`${selectedYear}-${event.target.value.padStart(2, '0')}`);
                        setMonthPickerOpen(false);
                      }}
                    >
                      {monthNames.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{t('year')}</span>
                    <select
                      value={selectedYear}
                      onChange={(event) => {
                        setMonth(
                          `${event.target.value}-${String(selectedMonthNumber).padStart(2, '0')}`,
                        );
                        setMonthPickerOpen(false);
                      }}
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  {currentMonthButtonInPicker ? (
                    <button
                      type="button"
                      className="monthPickerCurrentMonthButton"
                      onClick={() => {
                        setMonth(currentMonthKey);
                        setMonthPickerOpen(false);
                      }}
                    >
                      {t('currentMonth')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="monthNavigationButton"
              aria-label={t('nextMonth')}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {savedDestinationMonth ? (
        <div className="transactionSavedNotice" role="status">
          <span>
            {t('transactionSavedTo')}{' '}
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
              {t('viewMonth')}{' '}
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
                  <label className="transactionFilterField">
                    <span>{t('type')}</span>
                    <select
                      value={filters.type}
                      onChange={(event) => updateFilter('type', event.target.value)}
                    >
                      <option value="all">{t('allTypes')}</option>
                      <option value="income">{t('income')}</option>
                      <option value="expense">{t('allExpenses')}</option>
                      {expenseTypes.map((type) => (
                        <option key={type} value={`expense:${type}`}>
                          {typeLabels(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="transactionFilterField">
                    <span>{t('source')}</span>
                    <select
                      value={filters.sourceId}
                      onChange={(event) => updateFilter('sourceId', event.target.value)}
                    >
                      <option value="all">{t('allSources')}</option>
                      {query.data.sources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="transactionFilterGroup transactionFilterGroupSecondary">
                <div className="transactionFilterGroupFields">
                  <label className="transactionFilterField">
                    <span>{t('user')}</span>
                    <select
                      value={filters.userId}
                      onChange={(event) => updateFilter('userId', event.target.value)}
                    >
                      <option value="all">{t('allUsers')}</option>
                      {query.data.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
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
                {activeFilterCount ? (
                  <button type="button" onClick={resetFilters}>
                    {t('clearFilters')}
                  </button>
                ) : null}
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
                      {entry.projected ? <span className="srOnly">{t('projected')}: </span> : null}
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
