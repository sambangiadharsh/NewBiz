import { Router } from 'express';
import { paymentsController } from './payments.controller.js';
import { optionalAuthenticate } from '../../middleware/auth.js';

export const paymentsRouter = Router();

// 1. POST /api/v1/payments/initiate - Start payment session for an order
paymentsRouter.post('/initiate', optionalAuthenticate, (req, res, next) => {
  paymentsController.initiate(req, res).catch(next);
});

// 2. GET /api/v1/payments/verify/:orderId - Synchronous return check from PhonePe (Way 2)
paymentsRouter.get('/verify/:orderId', optionalAuthenticate, (req, res, next) => {
  paymentsController.verify(req, res).catch(next);
});

// 3. POST /api/v1/payments/webhook/phonepe - Asynchronous server-to-server webhook (Way 1)
paymentsRouter.post('/webhook/phonepe', (req, res, next) => {
  paymentsController.phonepeWebhook(req, res).catch(next);
});
