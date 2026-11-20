import { Router } from 'express';
import { ordersController } from './orders.controller.js';
import { authenticate, requirePermissions } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const sellerOrdersRouter = Router();

// Protect all seller order endpoints with orders.read permission
sellerOrdersRouter.use(authenticate, requirePermissions(PERMISSIONS.ORDERS_READ));

sellerOrdersRouter.get('/summary', (req, res) => ordersController.getSummary(req, res));
sellerOrdersRouter.get('/export-xlsx', (req, res) => ordersController.exportOrders(req, res));
sellerOrdersRouter.get('/export', (req, res) => ordersController.exportOrders(req, res));
sellerOrdersRouter.get('/returns', (req, res) => ordersController.getReturns(req, res));
sellerOrdersRouter.patch('/returns/:returnRequestId/status', (req, res) => ordersController.updateReturnStatus(req, res));
sellerOrdersRouter.get('/', (req, res) => ordersController.getList(req, res));
sellerOrdersRouter.get('/:id', (req, res) => ordersController.getDetail(req, res));
sellerOrdersRouter.get('/:id/invoice/pdf', (req, res) => ordersController.downloadInvoicePdf(req, res));
sellerOrdersRouter.patch('/:id/status', (req, res) => ordersController.updateStatus(req, res));
sellerOrdersRouter.post('/:id/shipment', (req, res) => ordersController.dispatchShipment(req, res));
