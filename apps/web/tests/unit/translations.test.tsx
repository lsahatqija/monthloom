import { parse, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import type { Locale } from '@monthloom/contracts';
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

const catalogs = { de, en, fr, sq, tr } satisfies Record<Locale, object>;

function messagesByKey(messages: object, prefix = ''): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>((result, [key, value]) => {
    const messageKey = prefix ? `${prefix}.${key}` : key;
    return Object.assign(
      result,
      value && typeof value === 'object'
        ? messagesByKey(value as object, messageKey)
        : { [messageKey]: value as string },
    );
  }, {});
}

function icuSignature(elements: MessageFormatElement[], context = ''): string[] {
  return elements.flatMap((element) => {
    if (element.type === 0) return [];
    if (element.type === 7) return [`${context}pound`];
    if (element.type === 8) {
      return [
        `${context}tag:${element.value}`,
        ...icuSignature(element.children, `${context}tag:${element.value}>`),
      ];
    }

    const marker = `${context}${element.type}:${element.value}`;
    if (element.type !== 5 && element.type !== 6) return [marker];

    return [
      `${marker}:${Object.keys(element.options).sort().join(',')}`,
      ...Object.entries(element.options).flatMap(([branch, option]) =>
        icuSignature(option.value, `${marker}>${branch}>`),
      ),
    ];
  });
}

describe('translations', () => {
  it.each(Object.entries(catalogs).filter(([locale]) => locale !== 'en'))(
    'keeps the %s catalog aligned with English and its ICU messages valid',
    (_locale, catalog) => {
      const englishMessages = messagesByKey(en);
      const localizedMessages = messagesByKey(catalog);

      expect(Object.keys(localizedMessages).sort()).toEqual(Object.keys(englishMessages).sort());
      for (const [key, englishMessage] of Object.entries(englishMessages)) {
        expect(icuSignature(parse(localizedMessages[key]!)).sort()).toEqual(
          icuSignature(parse(englishMessage)).sort(),
        );
      }
    },
  );

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
