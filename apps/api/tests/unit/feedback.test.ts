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
    anonymous: false,
    feedback: 'Please add a yearly overview.',
  });

  expect(email.sendFeedback).toHaveBeenCalledWith({
    to: 'team@example.com',
    feedbackType: 'feature request',
    feedback: 'Please add a yearly overview.',
    identity: {
      userId: user.id,
      userEmail: user.email,
      displayName: user.displayName,
    },
  });
});

it('sends anonymous feedback without receiving identity input', async () => {
  const email = mock<AutomatedEmailService>();
  const service = new FeedbackService(email, 'team@example.com');

  await service.sendFeedback(null, {
    type: 'complaint',
    anonymous: true,
    feedback: 'This workflow is difficult to understand.',
  });

  expect(email.sendFeedback).toHaveBeenCalledWith({
    to: 'team@example.com',
    feedbackType: 'complaint',
    feedback: 'This workflow is difficult to understand.',
    identity: undefined,
  });
});
