import { Request, Response, NextFunction } from 'express';
import { customerPromotionsService } from './promotions.service.js';
import { sendSuccess } from '../../utils/response.js';

export class CustomerPromotionsController {
  async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, subtotal } = req.body;
      const result = await customerPromotionsService.validatePromotion({
        code: String(code || ''),
        subtotal: Number(subtotal || 0),
      });

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const customerPromotionsController = new CustomerPromotionsController();
