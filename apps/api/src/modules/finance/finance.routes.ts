import { Router, type RequestHandler } from 'express';

import { asyncHandler } from '../../shared/utilities/async-handler.js';

import type { FinanceController } from './finance.controller.js';

export function createFinanceRouter(
  financeController: FinanceController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/primary/month', asyncHandler(financeController.getPrimaryMonth));
  router.patch('/:id', asyncHandler(financeController.updateHousehold));
  return router;
}
