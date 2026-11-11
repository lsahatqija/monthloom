import { Router, type RequestHandler } from 'express';

import { auditEvent } from '../../infrastructure/logging/audit-logger.js';
import {
  authRateLimiter,
  emailVerificationRateLimiter,
  passwordResetRateLimiter,
} from '../../middleware/rate-limit.middleware.js';
import { asyncHandler } from '../../shared/utilities/async-handler.js';

import type { AuthController } from './auth.controller.js';

export function createAuthRouter(
  authController: AuthController,
  requireAuth: RequestHandler,
  optionalAuth: RequestHandler,
  audit: typeof auditEvent = auditEvent,
): Router {
  const router = Router();

  router.post(
    '/register',
    audit('auth.registration', { includeSecurityContext: true }),
    authRateLimiter,
    asyncHandler(authController.register),
  );
  router.post(
    '/login',
    audit('auth.login', { includeSecurityContext: true }),
    authRateLimiter,
    asyncHandler(authController.login),
  );
  router.post(
    '/forgot-password',
    audit('auth.password_reset_requested', { includeSecurityContext: true }),
    passwordResetRateLimiter,
    asyncHandler(authController.forgotPassword),
  );
  router.post(
    '/reset-password',
    audit('auth.password_reset_completed', { includeSecurityContext: true }),
    passwordResetRateLimiter,
    asyncHandler(authController.resetPassword),
  );
  router.post(
    '/verify-email',
    audit('auth.email_verification_completed', { includeSecurityContext: true }),
    emailVerificationRateLimiter,
    asyncHandler(authController.verifyEmail),
  );
  router.post(
    '/send-email-verification',
    audit('auth.email_verification_requested', { includeSecurityContext: true }),
    emailVerificationRateLimiter,
    requireAuth,
    asyncHandler(authController.sendEmailVerification),
  );
  router.post(
    '/logout',
    audit('auth.logout', { includeSecurityContext: true }),
    requireAuth,
    asyncHandler(authController.logout),
  );
  router.put(
    '/initial-password',
    audit('auth.initial_password_changed', { includeSecurityContext: true }),
    requireAuth,
    asyncHandler(authController.changeInitialPassword),
  );
  router.get('/me', optionalAuth, asyncHandler(authController.me));

  return router;
}
