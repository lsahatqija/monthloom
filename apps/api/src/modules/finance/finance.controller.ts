import type { Request, Response } from 'express';

import {
  copyHouseholdSourcesRequestSchema,
  createHouseholdSourceRequestSchema,
  createHouseholdRequestSchema,
  createHouseholdInvitationRequestSchema,
  createHouseholdTransactionRequestSchema,
  householdIdParamsSchema,
  householdInvitationParamsSchema,
  householdMemberParamsSchema,
  householdMonthQuerySchema,
  householdTransactionRangeQuerySchema,
  householdSourceParamsSchema,
  householdTransactionParamsSchema,
  removeHouseholdTransactionQuerySchema,
  transferHouseholdOwnershipRequestSchema,
  updateHouseholdRequestSchema,
  updateHouseholdSourceRequestSchema,
  updateHouseholdTransactionRequestSchema,
} from './finance.schemas.js';
import type { HouseholdService } from './household.service.js';
import type { InvitationService } from './invitation.service.js';
import type { MonthViewService } from './month-view.service.js';
import type { RangeViewService } from './range-view.service.js';
import type { SourceService } from './source.service.js';
import type { TransactionService } from './transaction.service.js';

export class FinanceController {
  constructor(
    private readonly services: {
      households: HouseholdService;
      invitations: InvitationService;
      monthView: MonthViewService;
      rangeView: RangeViewService;
      sources: SourceService;
      transactions: TransactionService;
    },
  ) {}

  listHouseholds = async (req: Request, res: Response): Promise<void> => {
    const households = await this.services.households.listHouseholds(req.authUser!.id);
    res.status(200).json({ households });
  };

  createHousehold = async (req: Request, res: Response): Promise<void> => {
    const input = createHouseholdRequestSchema.parse(req.body);
    const household = await this.services.households.createHousehold(req.authUser!.id, input);
    res.status(201).json({ household });
  };

  createInvitation = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = createHouseholdInvitationRequestSchema.parse(req.body);
    const invitation = await this.services.invitations.createInvitation(id, req.authUser!, input);
    res.status(201).json(invitation);
  };

  getInvitation = async (req: Request, res: Response): Promise<void> => {
    const { token } = householdInvitationParamsSchema.parse(req.params);
    const invitation = await this.services.invitations.getInvitation(token);
    res.status(200).json(invitation);
  };

  acceptInvitation = async (req: Request, res: Response): Promise<void> => {
    const { token } = householdInvitationParamsSchema.parse(req.params);
    const result = await this.services.invitations.acceptInvitation(token, req.authUser!.id);
    res.status(200).json(result);
  };

  getPrimaryMonth = async (req: Request, res: Response): Promise<void> => {
    const { month } = householdMonthQuerySchema.parse(req.query);
    const result = await this.services.monthView.getPrimaryMonth(req.authUser!.id, month);
    res.status(200).json(result);
  };

  getHouseholdMonth = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const { month } = householdMonthQuerySchema.parse(req.query);
    const result = await this.services.monthView.getHouseholdMonth(id, req.authUser!.id, month);
    res.status(200).json(result);
  };

  getHouseholdTransactionRange = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const { from, to } = householdTransactionRangeQuerySchema.parse(req.query);
    const result = await this.services.rangeView.getHouseholdRange(id, req.authUser!.id, from, to);
    res.status(200).json(result);
  };

  updateHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = updateHouseholdRequestSchema.parse(req.body);
    const household = await this.services.households.updateHousehold(id, req.authUser!.id, input);
    res.status(200).json({ household });
  };

  setPrimaryHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    await this.services.households.setPrimaryHousehold(id, req.authUser!.id);
    res.status(204).send();
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    const { id, memberId } = householdMemberParamsSchema.parse(req.params);
    await this.services.households.removeMember(id, memberId, req.authUser!.id);
    res.status(204).send();
  };

  leaveHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = transferHouseholdOwnershipRequestSchema.partial().parse(req.body ?? {});
    await this.services.households.leaveHousehold(id, req.authUser!.id, input.newOwnerId);
    res.status(204).send();
  };

  deleteHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    await this.services.households.deleteHousehold(id, req.authUser!.id);
    res.status(204).send();
  };

  createTransaction = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = createHouseholdTransactionRequestSchema.parse(req.body);
    const transaction = await this.services.transactions.createTransaction(
      id,
      req.authUser!.id,
      input,
    );
    res.status(201).json({ transaction });
  };

  createSource = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = createHouseholdSourceRequestSchema.parse(req.body);
    const source = await this.services.sources.createSource(id, req.authUser!.id, input);
    res.status(201).json({ source });
  };

  listSources = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const sources = await this.services.sources.listSources(id, req.authUser!.id);
    res.status(200).json({ sources });
  };

  updateSource = async (req: Request, res: Response): Promise<void> => {
    const { id, sourceId } = householdSourceParamsSchema.parse(req.params);
    const input = updateHouseholdSourceRequestSchema.parse(req.body);
    const source = await this.services.sources.updateSource(id, sourceId, req.authUser!.id, input);
    res.status(200).json({ source });
  };

  deleteSource = async (req: Request, res: Response): Promise<void> => {
    const { id, sourceId } = householdSourceParamsSchema.parse(req.params);
    await this.services.sources.deleteSource(id, sourceId, req.authUser!.id);
    res.status(204).send();
  };

  copySources = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = copyHouseholdSourcesRequestSchema.parse(req.body);
    const result = await this.services.sources.copySources(id, req.authUser!.id, input);
    res.status(201).json(result);
  };

  updateTransaction = async (req: Request, res: Response): Promise<void> => {
    const { id, transactionId } = householdTransactionParamsSchema.parse(req.params);
    const input = updateHouseholdTransactionRequestSchema.parse(req.body);
    const transaction = await this.services.transactions.updateTransaction(
      id,
      transactionId,
      req.authUser!.id,
      input,
    );
    res.status(200).json({ transaction });
  };

  removeTransaction = async (req: Request, res: Response): Promise<void> => {
    const { id, transactionId } = householdTransactionParamsSchema.parse(req.params);
    const { scope } = removeHouseholdTransactionQuerySchema.parse(req.query);
    await this.services.transactions.removeTransaction(id, transactionId, req.authUser!.id, scope);
    res.status(204).send();
  };
}
