import { Defaults, type HouseholdTransaction } from '@monthloom/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  activeFilterCount,
  emptyTransactionFilters,
  filterAndSortTransactions,
  summarizeTransactions,
  type SortDirection,
  type TransactionFilters,
  type TransactionSortKey,
} from './transaction-view';

export function useTransactionView(transactions: HouseholdTransaction[]) {
  const locale = useLocale();
  const t = useTranslations('Finance');
  const typeLabels = useTranslations('Labels.expenseTypes');
  const [sortKey, setSortKey] = useState<TransactionSortKey>(Defaults.TRANSACTION_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    Defaults.TRANSACTION_SORT_DIRECTION,
  );
  const [filters, setFilters] = useState<TransactionFilters>(emptyTransactionFilters);
  const visibleTransactions = useMemo(
    () =>
      filterAndSortTransactions(transactions, filters, sortKey, sortDirection, locale, (entry) =>
        entry.kind === 'income' ? t('income') : typeLabels(entry.type ?? 'other'),
      ),
    [filters, locale, sortDirection, sortKey, t, transactions, typeLabels],
  );

  const sortBy = (key: TransactionSortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'ascending' ? 'descending' : 'ascending'));
    } else {
      setSortKey(key);
      setSortDirection('ascending');
    }
  };

  return {
    filters,
    setFilters,
    resetFilters: () => setFilters(emptyTransactionFilters),
    sortKey,
    sortDirection,
    sortBy,
    visibleTransactions,
    filteredSummary: summarizeTransactions(visibleTransactions),
    activeFilterCount: activeFilterCount(filters),
  };
}
