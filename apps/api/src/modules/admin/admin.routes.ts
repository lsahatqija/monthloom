import { Router, type RequestHandler } from 'express';

import { asyncHandler } from '../../shared/utilities/async-handler.js';

import type { AdminController } from './admin.controller.js';

export function createAdminRouter(
  adminController: AdminController,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
): Router {
  const router = Router();
  router.get('/overview', requireAuth, requireAdmin, asyncHandler(adminController.getOverview));
  router.get('/health', requireAuth, requireAdmin, asyncHandler(adminController.getHealth));
  router.get('/usage', requireAuth, requireAdmin, asyncHandler(adminController.getUsage));
  router.get('/adoption', requireAuth, requireAdmin, asyncHandler(adminController.getAdoption));
  router.get('/retention', requireAuth, requireAdmin, asyncHandler(adminController.getRetention));
  router.get(
    '/reliability',
    requireAuth,
    requireAdmin,
    asyncHandler(adminController.getReliability),
  );
  router.get('/dashboard', requireAuth, requireAdmin, asyncHandler(adminController.getDashboard));
  return router;
}
