import { Router, type RequestHandler } from 'express';

import { auditEvent } from '../../infrastructure/logging/audit-logger.js';

import type { UserController } from './user.controller.js';

export function createUserRouter(
  userController: UserController,
  requireAuth: RequestHandler,
  audit: typeof auditEvent = auditEvent,
): Router {
  const router = Router();

  router.get('/me', requireAuth, userController.getMe);
  router.patch('/me', requireAuth, userController.updateMe);
  router.put(
    '/me/password',
    audit('auth.password_changed', { includeSecurityContext: true }),
    requireAuth,
    userController.changePassword,
  );

  return router;
}
