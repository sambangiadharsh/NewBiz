import { Request, Response, NextFunction } from 'express';
import { sellerDashboardService } from './sellerDashboard.service.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError } from '../../utils/errors.js';

export class SellerDashboardController {
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new BadRequestError('User not authenticated');
      }
      const userId = BigInt(req.user.userId);
      const stats = await sellerDashboardService.getStats(userId);
      return sendSuccess(res, stats, 'Seller dashboard statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const sellerDashboardController = new SellerDashboardController();
