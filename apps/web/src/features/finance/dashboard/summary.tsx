type Totals = {
  income: number | string;
  expenses: number | string;
  savings?: number | string;
  balance: number | string;
};

export function TransactionSummary({
  currency,
  totals,
  filtered = false,
}: {
  currency: string;
  totals: Totals;
  filtered?: boolean;
}) {
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  });
  const hasSavings = totals.savings !== undefined && Number(totals.savings) > 0;

  return (
    <div
      className={`financeRecap${hasSavings ? ' hasSavings' : ''}`}
      role={filtered ? 'group' : undefined}
      aria-label={filtered ? 'Filtered recap' : 'Monthly recap'}
    >
      <div>
        <span>{filtered ? 'Filtered income' : 'Total income'}</span>
        <strong className="incomeAmount">{money.format(Number(totals.income))}</strong>
      </div>
      <div>
        <span>{filtered ? 'Filtered expenses' : 'Total expenses'}</span>
        <strong className="expenseAmount">{money.format(Number(totals.expenses))}</strong>
      </div>
      {hasSavings ? (
        <div className="savingsRecap">
          <span>{filtered ? 'Filtered savings' : 'Total savings'}</span>
          <strong className="savingsAmount">{money.format(Number(totals.savings))}</strong>
        </div>
      ) : null}
      <div className="leftoverRecap">
        <span>{filtered ? 'Filtered balance' : 'Balance'}</span>
        <strong>{money.format(Number(totals.balance))}</strong>
      </div>
    </div>
  );
}
