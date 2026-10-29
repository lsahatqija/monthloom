import { Constants } from '@monthloom/contracts';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { EmailSender } from '../../src/infrastructure/email/email-sender.js';
import { AutomatedEmailService } from '../../src/modules/email/automated-email.service.js';
import {
  localizedTemplateAlias,
  resendTemplateDefinitions,
  selectResendTemplateDefinitions,
} from '../../src/modules/email/resend-template-definitions.js';

it('uses the selected feedback type in the Resend template subject', () => {
  expect(
    resendTemplateDefinitions.find((template) => template.alias === 'monthloom-feedback')?.subject,
  ).toBe('Monthloom Feedback: {{{FEEDBACK_TYPE}}}');
});

it('escapes user-controlled values before passing them to email templates', async () => {
  const sender = mock<EmailSender>();
  const expiresAt = new Date('2026-03-01T12:00:00Z');
  await new AutomatedEmailService(sender).sendWelcome({
    to: 'person@example.com',
    displayName: '<img onerror="alert(1)">',
    verificationUrl: 'https://example.com/?a=1&b=2',
    expiresAt,
    locale: 'en',
  });
  expect(sender.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'person@example.com',
      variables: {
        DISPLAY_NAME: '&lt;img onerror=&quot;alert(1)&quot;&gt;',
        VERIFICATION_URL: 'https://example.com/?a=1&amp;b=2',
        EXPIRES_AT: new Intl.DateTimeFormat('en', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short',
        }).format(expiresAt),
      },
    }),
  );
});

describe('localized product email', () => {
  it('defines every user-facing template for every supported locale', () => {
    for (const locale of Constants.SUPPORTED_LOCALES) {
      for (const template of [
        'welcome',
        'email-verification',
        'password-reset',
        'household-invitation',
        'monthly-balance',
      ] as const) {
        const definition = resendTemplateDefinitions.find(
          (item) => item.alias === localizedTemplateAlias(template, locale),
        );
        expect(definition?.html).toContain(`<html lang="${locale}">`);
      }
    }
    expect(resendTemplateDefinitions).toHaveLength(Constants.SUPPORTED_LOCALES.length * 5 + 1);
    expect(selectResendTemplateDefinitions()).toHaveLength(resendTemplateDefinitions.length);
    expect(selectResendTemplateDefinitions('monthloom-password-reset-fr')).toHaveLength(1);
    expect(selectResendTemplateDefinitions('monthloom-welcome-fr')[0]).toMatchObject({
      subject: 'Bienvenue sur Monthloom',
    });
    expect(selectResendTemplateDefinitions('monthloom-welcome-tr')[0]?.html).toContain(
      'otomatik bir mesajdır',
    );
  });

  it('selects the locale alias and formats a monthly report with its locale and currency', async () => {
    const sender = mock<EmailSender>();
    await new AutomatedEmailService(sender).sendMonthlyReport({
      to: 'person@example.com',
      displayName: 'Person',
      householdName: 'Maison',
      month: '2026-03',
      currency: 'EUR',
      income: '1234.50',
      expenses: '200',
      leftover: '1034.50',
      reportUrl: 'https://example.com',
      locale: 'fr',
    });

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'monthloom-monthly-balance-fr',
        variables: expect.objectContaining({
          MONTH_LABEL: 'mars 2026',
          INCOME: new Intl.NumberFormat('fr', { style: 'currency', currency: 'EUR' }).format(
            1234.5,
          ),
        }),
      }),
    );
  });
});

it('escapes feedback while preserving line breaks in its template variables', async () => {
  const sender = mock<EmailSender>();
  await new AutomatedEmailService(sender).sendFeedback({
    to: 'feedback@example.com',
    feedbackType: 'bug report',
    feedback: '<strong>Broken</strong>\nOn the dashboard',
    identity: {
      userId: 'user-1',
      userEmail: 'person@example.com',
      displayName: 'Person',
    },
  });

  expect(sender.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'feedback@example.com',
      templateId: 'monthloom-feedback',
      variables: expect.objectContaining({
        FEEDBACK_TYPE: 'bug report',
        FEEDBACK: '&lt;strong&gt;Broken&lt;/strong&gt;<br>On the dashboard',
        SUBMITTER: '<strong>Person</strong> (person@example.com)',
        USER_REFERENCE: '<p style="color:#74675e;font-size:13px">User ID: user-1</p>',
      }),
    }),
  );
});

it('composes anonymous feedback without identity variables', async () => {
  const sender = mock<EmailSender>();
  await new AutomatedEmailService(sender).sendFeedback({
    to: 'feedback@example.com',
    feedbackType: 'suggestion',
    feedback: 'A private suggestion for the team.',
  });

  expect(sender.send).toHaveBeenCalledWith(
    expect.objectContaining({
      variables: expect.objectContaining({
        SUBMITTER: '<strong>Anonymous user</strong>',
        USER_REFERENCE: '',
      }),
    }),
  );
});
