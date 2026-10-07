import { Request, Response, NextFunction } from 'express';
import { paymentModesService } from './paymentModes.service.js';
import { sendSuccess } from '../../utils/response.js';

export class PaymentModesController {
  async listActive(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modes = await paymentModesService.getActivePaymentModes();
      sendSuccess(res, modes, 'Active payment modes retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const paymentModesController = new PaymentModesController();
