type Totals = { income: number | string; expenses: number | string; balance: number | string };

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
  return (
    <div className="financeRecap" role={filtered ? 'group' : undefined} aria-label={filtered ? 'Filtered recap' : 'Monthly recap'}>
      <div>
        <span>{filtered ? 'Filtered income' : 'Total income'}</span>
        <strong className="incomeAmount">{money.format(Number(totals.income))}</strong>
      </div>
      <div>
        <span>{filtered ? 'Filtered expenses' : 'Total expenses'}</span>
        <strong className="expenseAmount">{money.format(Number(totals.expenses))}</strong>
      </div>
      <div className="leftoverRecap">
        <span>{filtered ? 'Filtered balance' : 'Balance'}</span>
        <strong>{money.format(Number(totals.balance))}</strong>
      </div>
    </div>
  );
}
