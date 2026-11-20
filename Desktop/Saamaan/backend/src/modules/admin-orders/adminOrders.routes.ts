import { Router } from 'express';
import { adminOrdersController } from './adminOrders.controller.js';
import { authenticate, requirePermissions } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const adminOrdersRouter = Router();

// Protect all admin order routes with authentication
adminOrdersRouter.use(authenticate);

// 1. Literal / Aggregate endpoints FIRST (prevents :id swallowing)
adminOrdersRouter.get(
  '/summary',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.getSummary(req, res, next)
);

adminOrdersRouter.get(
  '/fulfillments',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.getFulfillments(req, res, next)
);

adminOrdersRouter.get(
  '/payments',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.getPayments(req, res, next)
);

adminOrdersRouter.get(
  '/cancelled',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.getCancelled(req, res, next)
);

adminOrdersRouter.get(
  '/returns',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.getReturns(req, res, next)
);

adminOrdersRouter.patch(
  '/returns/:returnRequestId/status',
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  (req, res, next) => adminOrdersController.updateReturnStatus(req, res, next)
);

adminOrdersRouter.get(
  '/export-xlsx',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.exportOrders(req, res, next)
);

adminOrdersRouter.get(
  '/export',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.exportOrders(req, res, next)
);

adminOrdersRouter.get(
  '/',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.getList(req, res, next)
);

// 2. Specific item actions with elevated permission
adminOrdersRouter.post(
  '/:id/cancel',
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  (req, res, next) => adminOrdersController.cancelOrder(req, res, next)
);

// 3. Parameterized detail endpoint LAST
adminOrdersRouter.get(
  '/:id',
  requirePermissions(PERMISSIONS.ORDERS_READ),
  (req, res, next) => adminOrdersController.getDetail(req, res, next)
);

