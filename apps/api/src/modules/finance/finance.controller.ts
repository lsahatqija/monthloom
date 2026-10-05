import type { Request, Response } from 'express';

import {
  createHouseholdRequestSchema,
  createHouseholdTransactionRequestSchema,
  householdIdParamsSchema,
  householdMemberParamsSchema,
  householdMonthQuerySchema,
  householdTransactionParamsSchema,
  removeHouseholdTransactionQuerySchema,
  transferHouseholdOwnershipRequestSchema,
  updateHouseholdRequestSchema,
  updateHouseholdTransactionRequestSchema,
} from './finance.schemas.js';
import type { FinanceService } from './finance.service.js';

export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  listHouseholds = async (req: Request, res: Response): Promise<void> => {
    const households = await this.financeService.listHouseholds(req.authUser!.id);
    res.status(200).json({ households });
  };

  createHousehold = async (req: Request, res: Response): Promise<void> => {
    const input = createHouseholdRequestSchema.parse(req.body);
    const household = await this.financeService.createHousehold(req.authUser!.id, input);
    res.status(201).json({ household });
  };

  getPrimaryMonth = async (req: Request, res: Response): Promise<void> => {
    const { month } = householdMonthQuerySchema.parse(req.query);
    const result = await this.financeService.getPrimaryMonth(req.authUser!.id, month);
    res.status(200).json(result);
  };

  getHouseholdMonth = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const { month } = householdMonthQuerySchema.parse(req.query);
    const result = await this.financeService.getHouseholdMonth(id, req.authUser!.id, month);
    res.status(200).json(result);
  };

  updateHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = updateHouseholdRequestSchema.parse(req.body);
    const household = await this.financeService.updateHousehold(id, req.authUser!.id, input);
    res.status(200).json({ household });
  };

  setPrimaryHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    await this.financeService.setPrimaryHousehold(id, req.authUser!.id);
    res.status(204).send();
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    const { id, memberId } = householdMemberParamsSchema.parse(req.params);
    await this.financeService.removeMember(id, memberId, req.authUser!.id);
    res.status(204).send();
  };

  leaveHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = transferHouseholdOwnershipRequestSchema.partial().parse(req.body ?? {});
    await this.financeService.leaveHousehold(id, req.authUser!.id, input.newOwnerId);
    res.status(204).send();
  };

  deleteHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    await this.financeService.deleteHousehold(id, req.authUser!.id);
    res.status(204).send();
  };

  createTransaction = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = createHouseholdTransactionRequestSchema.parse(req.body);
    const transaction = await this.financeService.createTransaction(id, req.authUser!.id, input);
    res.status(201).json({ transaction });
  };

  updateTransaction = async (req: Request, res: Response): Promise<void> => {
    const { id, transactionId } = householdTransactionParamsSchema.parse(req.params);
    const input = updateHouseholdTransactionRequestSchema.parse(req.body);
    const transaction = await this.financeService.updateTransaction(
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
    await this.financeService.removeTransaction(id, transactionId, req.authUser!.id, scope);
    res.status(204).send();
  };
}
