import { Router, type RequestHandler } from 'express';

import { asyncHandler } from '../../shared/utilities/async-handler.js';

import type { FeedbackController } from './feedback.controller.js';

export function createFeedbackRouter(
  feedbackController: FeedbackController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireAuth);
  router.post('/', asyncHandler(feedbackController.send));
  return router;
}
