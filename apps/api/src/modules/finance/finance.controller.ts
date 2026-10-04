import type { Request, Response } from 'express';

import {
  createHouseholdTransactionRequestSchema,
  householdIdParamsSchema,
  householdMonthQuerySchema,
  householdTransactionParamsSchema,
  removeHouseholdTransactionQuerySchema,
  updateHouseholdRequestSchema,
  updateHouseholdTransactionRequestSchema,
} from './finance.schemas.js';
import type { FinanceService } from './finance.service.js';

export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  getPrimaryMonth = async (req: Request, res: Response): Promise<void> => {
    const { month } = householdMonthQuerySchema.parse(req.query);
    const result = await this.financeService.getPrimaryMonth(req.authUser!.id, month);
    res.status(200).json(result);
  };

  updateHousehold = async (req: Request, res: Response): Promise<void> => {
    const { id } = householdIdParamsSchema.parse(req.params);
    const input = updateHouseholdRequestSchema.parse(req.body);
    const household = await this.financeService.updateHousehold(id, req.authUser!.id, input);
    res.status(200).json({ household });
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
