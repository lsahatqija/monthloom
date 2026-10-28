import { expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { EmailSender } from '../../src/infrastructure/email/email-sender.js';
import { AutomatedEmailService } from '../../src/modules/email/automated-email.service.js';
import { resendTemplateDefinitions } from '../../src/modules/email/resend-template-definitions.js';

it('uses the selected feedback type in the Resend template subject', () => {
  expect(
    resendTemplateDefinitions.find((template) => template.alias === 'monthloom-feedback')?.subject,
  ).toBe('Monthloom Feedback: {{{FEEDBACK_TYPE}}}');
});

it('escapes user-controlled values before passing them to email templates', async () => {
  const sender = mock<EmailSender>();
  await new AutomatedEmailService(sender).sendWelcome({
    to: 'person@example.com',
    displayName: '<img onerror="alert(1)">',
    verificationUrl: 'https://example.com/?a=1&b=2',
    expiresIn: '24 hours',
  });
  expect(sender.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'person@example.com',
      variables: {
        DISPLAY_NAME: '&lt;img onerror=&quot;alert(1)&quot;&gt;',
        VERIFICATION_URL: 'https://example.com/?a=1&amp;b=2',
        EXPIRES_IN: '24 hours',
      },
    }),
  );
});

it('escapes feedback while preserving line breaks in its template variables', async () => {
  const sender = mock<EmailSender>();
  await new AutomatedEmailService(sender).sendFeedback({
    to: 'feedback@example.com',
    feedbackType: 'bug report',
    feedback: '<strong>Broken</strong>\nOn the dashboard',
    userId: 'user-1',
    userEmail: 'person@example.com',
    displayName: 'Person',
  });

  expect(sender.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'feedback@example.com',
      templateId: 'monthloom-feedback',
      variables: expect.objectContaining({
        FEEDBACK_TYPE: 'bug report',
        FEEDBACK: '&lt;strong&gt;Broken&lt;/strong&gt;<br>On the dashboard',
      }),
    }),
  );
});
