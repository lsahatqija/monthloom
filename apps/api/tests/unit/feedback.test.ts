import { expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AutomatedEmailService } from '../../src/modules/email/automated-email.service.js';
import { FeedbackService } from '../../src/modules/feedback/feedback.service.js';
import { user } from '../fixtures.js';

it('sends authenticated user feedback to the configured address', async () => {
  const email = mock<AutomatedEmailService>();
  const service = new FeedbackService(email, 'team@example.com');

  await service.sendFeedback(user, {
    type: 'feature request',
    feedback: 'Please add a yearly overview.',
  });

  expect(email.sendFeedback).toHaveBeenCalledWith({
    to: 'team@example.com',
    feedbackType: 'feature request',
    feedback: 'Please add a yearly overview.',
    userId: user.id,
    userEmail: user.email,
    displayName: user.displayName,
  });
});
