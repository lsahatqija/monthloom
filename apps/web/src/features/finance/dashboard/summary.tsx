import { useTranslations } from 'next-intl';

import type { MotionState } from '../../../components/motion/use-motion-presence';

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
  motionState = 'entered',
}: {
  currency: string;
  totals: Totals;
  filtered?: boolean;
  motionState?: MotionState;
}) {
  const t = useTranslations('Finance');
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
      aria-label={filtered ? t('filteredRecap') : t('monthlyRecap')}
      aria-hidden={motionState === 'exiting' ? 'true' : undefined}
      data-motion={motionState}
    >
      {filtered ? <p className="filteredRecapLabel">{t('filteredTotals')}</p> : null}
      <div>
        <span>{t('income')}</span>
        <strong className="incomeAmount">
          {signedMoney.format(Math.abs(Number(totals.income)))}
        </strong>
      </div>
      <div>
        <span>{t('expenses')}</span>
        <strong className="expenseAmount">
          {signedMoney.format(-Math.abs(Number(totals.expenses)))}
        </strong>
      </div>
      {hasSavings ? (
        <div className="savingsRecap">
          <span>{t('savings')}</span>
          <strong className="savingsAmount">{money.format(Number(totals.savings))}</strong>
        </div>
      ) : null}
      <div className="balanceRecap">
        <span>{t('balance')}</span>
        <strong className={balance < 0 ? 'expenseAmount' : undefined}>
          {signedMoney.format(balance)}
        </strong>
      </div>
    </div>
  );
}
