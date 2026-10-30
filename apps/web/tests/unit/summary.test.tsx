import { HOUSEHOLD_CURRENCIES } from '@monthloom/contracts';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import fr from '../../messages/fr.json';
import { TransactionSummary } from '../../src/features/finance/dashboard/summary';
import { renderWithQuery } from '../render';

describe('transaction summary', () => {
  it.each(HOUSEHOLD_CURRENCIES)('formats positive totals in %s', (currency) => {
    renderWithQuery(
      <TransactionSummary
        currency={currency}
        totals={{ income: 100, expenses: 20, savings: 10, balance: 80 }}
      />,
    );

    const recap = screen.getByLabelText('Monthly recap');
    expect(within(recap).getByText('Balance').nextElementSibling).toHaveTextContent('+');
    expect(within(recap).getByText('Income').nextElementSibling).toHaveTextContent('+');
    expect(within(recap).getByText('Expenses').nextElementSibling).toHaveTextContent('-');
    expect(within(recap).getByText('Savings').nextElementSibling).toHaveTextContent(/10/);
  });

  it.each([
    [-20, /-.*20/],
    [0, /0/],
    [80, /\+.*80/],
  ])('shows a meaningful balance for %s', (balance, expected) => {
    renderWithQuery(
      <TransactionSummary currency="EUR" totals={{ income: 0, expenses: 0, balance }} filtered />,
    );

    const recap = screen.getByRole('group', { name: 'Filtered recap' });
    expect(within(recap).getByText('Filtered totals')).toBeVisible();
    expect(within(recap).getByText('Balance').nextElementSibling).toHaveTextContent(expected);
  });

  it('uses locale punctuation while retaining the household currency', () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <TransactionSummary
          currency="EUR"
          totals={{ income: 1234.5, expenses: 0, balance: 1234.5 }}
        />
      </NextIntlClientProvider>,
    );

    expect(container.querySelector('.incomeAmount')?.textContent).toContain('1 234,50');
    expect(container.querySelector('.incomeAmount')?.textContent).toContain('€');
  });
});
