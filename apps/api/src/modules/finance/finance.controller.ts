import type { Request, Response } from 'express';

import {
  householdIdParamsSchema,
  householdMonthQuerySchema,
  updateHouseholdRequestSchema,
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
}
