import { Router, type RequestHandler } from 'express';

import { asyncHandler } from '../../shared/utilities/async-handler.js';

import type { FinanceController } from './finance.controller.js';

export function createFinanceRouter(
  financeController: FinanceController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();
  router.get('/invitations/:token', asyncHandler(financeController.getInvitation));
  router.use(requireAuth);
  router.post('/invitations/:token/accept', asyncHandler(financeController.acceptInvitation));
  router.get('/', asyncHandler(financeController.listHouseholds));
  router.post('/', asyncHandler(financeController.createHousehold));
  router.get('/primary/month', asyncHandler(financeController.getPrimaryMonth));
  router.get('/:id/month', asyncHandler(financeController.getHouseholdMonth));
  router.post('/:id/invitations', asyncHandler(financeController.createInvitation));
  router.post('/:id/transactions', asyncHandler(financeController.createTransaction));
  router.patch(
    '/:id/transactions/:transactionId',
    asyncHandler(financeController.updateTransaction),
  );
  router.delete(
    '/:id/transactions/:transactionId',
    asyncHandler(financeController.removeTransaction),
  );
  router.patch('/:id', asyncHandler(financeController.updateHousehold));
  router.put('/:id/primary', asyncHandler(financeController.setPrimaryHousehold));
  router.delete('/:id/members/:memberId', asyncHandler(financeController.removeMember));
  router.post('/:id/leave', asyncHandler(financeController.leaveHousehold));
  router.delete('/:id', asyncHandler(financeController.deleteHousehold));
  return router;
}
