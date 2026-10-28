import type { PublicUser, SendFeedbackRequest } from '@monthloom/contracts';

import type { AutomatedEmailService } from '../email/automated-email.service.js';

export class FeedbackService {
  constructor(
    private readonly emailService: AutomatedEmailService,
    private readonly feedbackAddress: string,
  ) {}

  sendFeedback(
    user: Pick<PublicUser, 'id' | 'email' | 'displayName'> | null,
    input: SendFeedbackRequest,
  ): Promise<void> {
    return this.emailService.sendFeedback({
      to: this.feedbackAddress,
      feedbackType: input.type,
      feedback: input.feedback,
      identity: user
        ? { userId: user.id, userEmail: user.email, displayName: user.displayName }
        : undefined,
    });
  }
}
