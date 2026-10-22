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
  const signedMoney = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    signDisplay: 'exceptZero',
  });
  const hasSavings = totals.savings !== undefined && Number(totals.savings) > 0;
  const balance = Number(totals.balance);

  return (
    <div
      className={`financeRecap${hasSavings ? ' hasSavings' : ''}${filtered ? ' filteredRecap' : ''}`}
      role={filtered ? 'group' : undefined}
      aria-label={filtered ? 'Filtered recap' : 'Monthly recap'}
    >
      {filtered ? <p className="filteredRecapLabel">Filtered totals</p> : null}
      <div>
        <span>Income</span>
        <strong className="incomeAmount">
          {signedMoney.format(Math.abs(Number(totals.income)))}
        </strong>
      </div>
      <div>
        <span>Expenses</span>
        <strong className="expenseAmount">
          {signedMoney.format(-Math.abs(Number(totals.expenses)))}
        </strong>
      </div>
      {hasSavings ? (
        <div className="savingsRecap">
          <span>Savings</span>
          <strong className="savingsAmount">{money.format(Number(totals.savings))}</strong>
        </div>
      ) : null}
      <div className="balanceRecap">
        <span>Balance</span>
        <strong className={balance < 0 ? 'expenseAmount' : undefined}>
          {signedMoney.format(balance)}
        </strong>
      </div>
    </div>
  );
}
