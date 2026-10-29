import type { HouseholdTransaction } from '@monthloom/contracts';

export type TransactionSortKey = 'date' | 'amount' | 'user' | 'source' | 'type';
export type SortDirection = 'ascending' | 'descending';
export type RecurringFilter = 'all' | 'recurring' | 'one-off';

export type TransactionFilters = {
  type: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  sourceId: string;
  recurring: RecurringFilter;
  amountOver: string;
  amountUnder: string;
};

export const emptyTransactionFilters: TransactionFilters = {
  type: 'all',
  userId: 'all',
  dateFrom: '',
  dateTo: '',
  sourceId: 'all',
  recurring: 'all',
  amountOver: '',
  amountUnder: '',
};

export function includesLocaleText(value: string, query: string, locale: string): boolean {
  return value.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale));
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function isUpcomingRecurringTransaction(
  transaction: HouseholdTransaction,
  selectedMonth: string,
  today = new Date(),
): boolean {
  const todayKey = localDateKey(today);
  return (
    transaction.recurring && selectedMonth === todayKey.slice(0, 7) && transaction.date > todayKey
  );
}

export function filterAndSortTransactions(
  transactions: HouseholdTransaction[],
  filters: TransactionFilters,
  sortKey: TransactionSortKey,
  sortDirection: SortDirection,
  locale: string,
  typeLabel: (transaction: HouseholdTransaction) => string = (transaction) =>
    transaction.kind === 'income' ? 'income' : (transaction.type ?? 'other'),
) {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const filtered = transactions.filter((transaction) => {
    if (filters.type === 'income' && transaction.kind !== 'income') return false;
    if (filters.type === 'expense' && transaction.kind !== 'expense') return false;
    if (
      filters.type.startsWith('expense:') &&
      transaction.type !== filters.type.slice('expense:'.length)
    )
      return false;
    if (filters.userId !== 'all' && transaction.user.id !== filters.userId) return false;
    if (filters.sourceId !== 'all' && transaction.source.id !== filters.sourceId) return false;
    if (filters.dateFrom && transaction.date < filters.dateFrom) return false;
    if (filters.dateTo && transaction.date > filters.dateTo) return false;
    if (filters.recurring === 'recurring' && !transaction.recurring) return false;
    if (filters.recurring === 'one-off' && transaction.recurring) return false;
    const amount = Number(transaction.amount);
    if (filters.amountOver !== '' && amount <= Number(filters.amountOver)) return false;
    return !(filters.amountUnder !== '' && amount >= Number(filters.amountUnder));
  });

  const compare = (first: HouseholdTransaction, second: HouseholdTransaction) => {
    switch (sortKey) {
      case 'amount':
        return (
          Number(first.amount) * (first.kind === 'income' ? 1 : -1) -
          Number(second.amount) * (second.kind === 'income' ? 1 : -1)
        );
      case 'user':
        return collator.compare(first.user.displayName, second.user.displayName);
      case 'source':
        return collator.compare(first.source.displayName, second.source.displayName);
      case 'type':
        return collator.compare(typeLabel(first), typeLabel(second));
      case 'date':
        return first.date.localeCompare(second.date);
    }
  };

  return [...filtered].sort((first, second) => {
    const comparison = compare(first, second);
    if (comparison !== 0) return sortDirection === 'ascending' ? comparison : -comparison;
    return first.date.localeCompare(second.date) || first.id.localeCompare(second.id);
  });
}

export function summarizeTransactions(transactions: HouseholdTransaction[]) {
  return transactions.reduce(
    (totals, transaction) => {
      const amount = Number(transaction.amount);
      if (transaction.kind === 'income') totals.income += amount;
      else {
        totals.expenses += amount;
        if (transaction.type === 'savings') totals.savings += amount;
      }
      totals.balance = totals.income - totals.expenses;
      return totals;
    },
    { income: 0, expenses: 0, savings: 0, balance: 0 },
  );
}

export function activeFilterCount(filters: TransactionFilters): number {
  return Object.values(filters).filter((value) => value !== '' && value !== 'all').length;
}
