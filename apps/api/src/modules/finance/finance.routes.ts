import { Router, type RequestHandler } from 'express';

import { auditEvent } from '../../infrastructure/logging/audit-logger.js';
import { asyncHandler } from '../../shared/utilities/async-handler.js';

import type { FinanceController } from './finance.controller.js';

export function createFinanceRouter(
  financeController: FinanceController,
  requireAuth: RequestHandler,
  audit: typeof auditEvent = auditEvent,
): Router {
  const router = Router();
  router.get('/invitations/:token', asyncHandler(financeController.getInvitation));
  router.post(
    '/invitations/:token/accept',
    audit('household.invitation_accepted'),
    requireAuth,
    asyncHandler(financeController.acceptInvitation),
  );
  router.post(
    '/:id/invitations',
    audit('household.invitation_sent'),
    requireAuth,
    asyncHandler(financeController.createInvitation),
  );
  router.delete(
    '/:id/members/:memberId',
    audit('household.member_removed'),
    requireAuth,
    asyncHandler(financeController.removeMember),
  );
  router.post(
    '/:id/leave',
    audit('household.left'),
    requireAuth,
    asyncHandler(financeController.leaveHousehold),
  );
  router.post(
    '/:id/sources',
    audit('source.created'),
    requireAuth,
    asyncHandler(financeController.createSource),
  );
  router.post(
    '/:id/sources/copy',
    audit('source.copied'),
    requireAuth,
    asyncHandler(financeController.copySources),
  );
  router.patch(
    '/:id/sources/:sourceId',
    audit('source.updated'),
    requireAuth,
    asyncHandler(financeController.updateSource),
  );
  router.delete(
    '/:id/sources/:sourceId',
    audit('source.deleted'),
    requireAuth,
    asyncHandler(financeController.deleteSource),
  );
  router.post(
    '/:id/transactions',
    audit('transaction.created'),
    requireAuth,
    asyncHandler(financeController.createTransaction),
  );
  router.patch(
    '/:id/transactions/:transactionId',
    audit('transaction.updated'),
    requireAuth,
    asyncHandler(financeController.updateTransaction),
  );
  router.delete(
    '/:id/transactions/:transactionId',
    audit('transaction.deleted'),
    requireAuth,
    asyncHandler(financeController.removeTransaction),
  );

  router.use(requireAuth);
  router.get('/', asyncHandler(financeController.listHouseholds));
  router.post('/', asyncHandler(financeController.createHousehold));
  router.get('/primary/month', asyncHandler(financeController.getPrimaryMonth));
  router.get('/:id/month', asyncHandler(financeController.getHouseholdMonth));
  router.get('/:id/transactions', asyncHandler(financeController.getHouseholdTransactionRange));
  router.get('/:id/sources', asyncHandler(financeController.listSources));
  router.patch('/:id', asyncHandler(financeController.updateHousehold));
  router.put('/:id/primary', asyncHandler(financeController.setPrimaryHousehold));
  router.delete('/:id', asyncHandler(financeController.deleteHousehold));
  return router;
}
