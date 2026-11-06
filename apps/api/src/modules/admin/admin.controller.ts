import type { Request, Response } from 'express';

import type { AdminService } from './admin.service.js';

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  getDashboard = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.adminService.getDashboard());
  };
}
