import { Router, type RequestHandler } from 'express';

import { authRateLimiter } from '../../middleware/rate-limit.middleware.js';
import { asyncHandler } from '../../shared/utilities/async-handler.js';

import type { AuthController } from './auth.controller.js';

export function createAuthRouter(
  authController: AuthController,
  requireAuth: RequestHandler,
  optionalAuth: RequestHandler,
): Router {
  const router = Router();

  router.post('/register', authRateLimiter, asyncHandler(authController.register));
  router.post('/login', authRateLimiter, asyncHandler(authController.login));
  router.post('/forgot-password', authRateLimiter, asyncHandler(authController.forgotPassword));
  router.post('/reset-password', authRateLimiter, asyncHandler(authController.resetPassword));
  router.post('/verify-email', authRateLimiter, asyncHandler(authController.verifyEmail));
  router.post(
    '/send-email-verification',
    authRateLimiter,
    requireAuth,
    asyncHandler(authController.sendEmailVerification),
  );
  router.post('/logout', requireAuth, asyncHandler(authController.logout));
  router.get('/me', optionalAuth, asyncHandler(authController.me));

  return router;
}
