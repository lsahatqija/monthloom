import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import de from '../../messages/de.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import sq from '../../messages/sq.json';
import tr from '../../messages/tr.json';
import NotFound from '../../src/app/not-found';
import { RestartOnboardingButton } from '../../src/components/onboarding/restart-onboarding-button';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => {
    const messages = {
      pageNotFoundTitle: 'Faqja nuk u gjet',
      pageNotFoundDescription: 'Faqja që po kërkoni nuk ekziston.',
      goHome: 'Shko te faqja kryesore',
    };
    return (key: keyof typeof messages) => messages[key];
  },
}));

function TransactionCounts() {
  const t = useTranslations('Finance');
  return (
    <>
      <span>{t('transactions', { count: 0 })}</span>
      <span>{t('transactions', { count: 1 })}</span>
      <span>{t('transactions', { count: 2 })}</span>
    </>
  );
}

describe('translations', () => {
  it('keeps every locale catalog structurally aligned', () => {
    const keys = (messages: object): string[] =>
      Object.entries(messages).flatMap(([key, value]) =>
        value && typeof value === 'object'
          ? keys(value as object).map((nestedKey) => `${key}.${nestedKey}`)
          : key,
      );
    const englishKeys = keys(en).sort();

    expect(keys(de).sort()).toEqual(englishKeys);
    expect(keys(sq).sort()).toEqual(englishKeys);
    expect(keys(fr).sort()).toEqual(englishKeys);
    expect(keys(tr).sort()).toEqual(englishKeys);
  });

  it('renders a translated Server Component', async () => {
    render(await NotFound());

    expect(screen.getByText('Faqja nuk u gjet')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Shko te faqja kryesore' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('renders a translated Client Component', () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <RestartOnboardingButton userId="user" />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Redémarrer le guide de prise en main' }),
    ).toBeVisible();
  });

  it('renders locale-aware ICU plural forms', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TransactionCounts />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('No transactions')).toBeVisible();
    expect(screen.getByText('1 transaction')).toBeVisible();
    expect(screen.getByText('2 transactions')).toBeVisible();
  });
});
