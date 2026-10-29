import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../messages/fr.json';
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

describe('translations', () => {
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
      <NextIntlClientProvider locale="fr" messages={messages}>
        <RestartOnboardingButton userId="user" />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Redémarrer le guide de prise en main' }),
    ).toBeVisible();
  });
});
