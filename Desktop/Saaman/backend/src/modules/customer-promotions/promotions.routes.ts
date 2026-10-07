import { Router } from 'express';
import { customerPromotionsController } from './promotions.controller.js';

export const customerPromotionsRouter = Router();

// Validate coupon code against Promotions table (accessible to guests and logged-in customers)
customerPromotionsRouter.post('/validate', (req, res, next) =>
  customerPromotionsController.validate(req, res, next)
);
