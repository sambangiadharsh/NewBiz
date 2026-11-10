import { Router } from 'express';
import { customerOrdersController } from './customerOrders.controller.js';
import { authenticate } from '../../middleware/auth.js';

export const customerOrdersRouter = Router();

// POST /api/v1/customer/orders (Place order - requires authenticated customer)
customerOrdersRouter.post('/', authenticate, (req, res, next) => {
  customerOrdersController.create(req, res, next);
});

// GET /api/v1/customer/orders (List customer's past orders)
customerOrdersRouter.get('/', authenticate, (req, res, next) => {
  customerOrdersController.list(req, res, next);
});

// GET /api/v1/customer/orders/:orderId/invoice/pdf (Download Tax Invoice PDF)
customerOrdersRouter.get('/:orderId/invoice/pdf', authenticate, (req, res, next) => {
  customerOrdersController.downloadInvoicePdf(req, res, next);
});
