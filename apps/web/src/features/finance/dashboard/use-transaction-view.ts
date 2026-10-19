import { Defaults, type HouseholdTransaction } from '@monthloom/contracts';
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
  const [sortKey, setSortKey] = useState<TransactionSortKey>(Defaults.TRANSACTION_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    Defaults.TRANSACTION_SORT_DIRECTION,
  );
  const [filters, setFilters] = useState<TransactionFilters>(emptyTransactionFilters);
  const visibleTransactions = useMemo(
    () => filterAndSortTransactions(transactions, filters, sortKey, sortDirection),
    [filters, sortDirection, sortKey, transactions],
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
