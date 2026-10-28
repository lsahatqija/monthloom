import { sendFeedbackRequestSchema } from '@monthloom/contracts';
import type { Request, Response } from 'express';

import type { FeedbackService } from './feedback.service.js';

export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  send = async (req: Request, res: Response): Promise<void> => {
    const input = sendFeedbackRequestSchema.parse(req.body);
    await this.feedbackService.sendFeedback(input.anonymous ? null : req.authUser!, input);
    res.status(204).send();
  };
}
