import { expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { EmailSender } from '../../src/infrastructure/email/email-sender.js';
import { AutomatedEmailService } from '../../src/modules/email/automated-email.service.js';

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
