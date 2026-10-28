import type { PublicUser, SendFeedbackRequest } from '@monthloom/contracts';

import type { AutomatedEmailService } from '../email/automated-email.service.js';

export class FeedbackService {
  constructor(
    private readonly emailService: AutomatedEmailService,
    private readonly feedbackAddress: string,
  ) {}

  sendFeedback(user: PublicUser, input: SendFeedbackRequest): Promise<void> {
    return this.emailService.sendFeedback({
      to: this.feedbackAddress,
      feedbackType: input.type,
      feedback: input.feedback,
      userId: user.id,
      userEmail: user.email,
      displayName: user.displayName,
    });
  }
}
