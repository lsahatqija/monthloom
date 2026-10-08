import { Router, type RequestHandler } from 'express';

import type { UserController } from './user.controller.js';

export function createUserRouter(
  userController: UserController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();

  router.get('/me', requireAuth, userController.getMe);
  router.patch('/me', requireAuth, userController.updateMe);
  router.put('/me/password', requireAuth, userController.changePassword);

  return router;
}
