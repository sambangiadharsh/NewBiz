import { Router } from 'express';
import { customerOrdersController } from './customerOrders.controller.js';
import { uploadReturnProofs } from './returnProof.upload.js';
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

// POST /api/v1/customer/orders/returns (Submit return/replacement request)
customerOrdersRouter.post('/returns', authenticate, (req, res, next) => {
  customerOrdersController.submitReturn(req, res, next);
});

// POST /api/v1/customer/orders/returns/upload-proof (Upload damage/defect photo attachments)
customerOrdersRouter.post(
  '/returns/upload-proof',
  authenticate,
  uploadReturnProofs.array('proofs', 5),
  (req, res, next) => {
    customerOrdersController.uploadProof(req, res, next);
  }
);

// GET /api/v1/customer/orders/returns (List customer's return requests)
customerOrdersRouter.get('/returns', authenticate, (req, res, next) => {
  customerOrdersController.listReturns(req, res, next);
});

// POST /api/v1/customer/orders/returns/:returnRequestId/cancel (Cancel return request)
customerOrdersRouter.post('/returns/:returnRequestId/cancel', authenticate, (req, res, next) => {
  customerOrdersController.cancelReturn(req, res, next);
});
