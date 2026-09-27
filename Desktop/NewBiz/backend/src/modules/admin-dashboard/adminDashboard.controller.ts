import { Request, Response, NextFunction } from 'express';
import { adminDashboardService } from './adminDashboard.service.js';
import { sendSuccess } from '../../utils/response.js';

export class AdminDashboardController {
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminDashboardService.getStats();
      return sendSuccess(res, stats, 'Admin dashboard statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const adminDashboardController = new AdminDashboardController();
