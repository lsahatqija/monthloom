import { Router, type RequestHandler } from 'express';

import { asyncHandler } from '../../shared/utilities/async-handler.js';

import type { AdminController } from './admin.controller.js';

export function createAdminRouter(
  adminController: AdminController,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
): Router {
  const router = Router();
  router.get('/dashboard', requireAuth, requireAdmin, asyncHandler(adminController.getDashboard));
  return router;
}
