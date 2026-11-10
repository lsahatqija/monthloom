import { adminAnalyticsRangeQuerySchema } from '@monthloom/contracts';
import type { Request, Response } from 'express';

import type { AdminService } from './admin.service.js';

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  getDashboard = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.adminService.getDashboard());
  };

  getOverview = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.adminService.getOverview());
  };

  getHealth = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.adminService.getHealth());
  };

  getUsage = async (req: Request, res: Response): Promise<void> => {
    const query = adminAnalyticsRangeQuerySchema.parse(req.query);
    res.status(200).json(await this.adminService.getUsage(query));
  };

  getAdoption = async (req: Request, res: Response): Promise<void> => {
    const query = adminAnalyticsRangeQuerySchema.parse(req.query);
    res.status(200).json(await this.adminService.getAdoption(query));
  };

  getRetention = async (req: Request, res: Response): Promise<void> => {
    res
      .status(200)
      .json(await this.adminService.getRetention(adminAnalyticsRangeQuerySchema.parse(req.query)));
  };

  getReliability = async (req: Request, res: Response): Promise<void> => {
    res
      .status(200)
      .json(
        await this.adminService.getReliability(adminAnalyticsRangeQuerySchema.parse(req.query)),
      );
  };
}
