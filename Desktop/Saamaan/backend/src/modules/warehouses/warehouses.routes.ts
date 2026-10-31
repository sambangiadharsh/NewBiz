import { Router } from 'express';
import { warehousesController } from './warehouses.controller.js';
import {
  authenticate,
  optionalAuthenticate,
  requirePermissions,
  requireAnyPermission,
  requireWarehouseAccess,
} from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const warehousesRouter = Router();

// Public invitation routes (No authentication required)
warehousesRouter.get('/invites/:token/validate', warehousesController.validateInvite);
warehousesRouter.post('/invites/:token/accept', optionalAuthenticate, warehousesController.acceptInviteExisting);
warehousesRouter.post('/invites/:token/register-and-accept', warehousesController.registerAndAcceptInvite);

// All subsequent warehouse routes require authentication
warehousesRouter.use(authenticate);

// 1. Current logged-in warehouse staff facility
warehousesRouter.get(
  '/my-warehouse',
  requireAnyPermission(PERMISSIONS.WAREHOUSES_READ, PERMISSIONS.FULFILLMENTS_MANAGE),
  warehousesController.getMyWarehouse
);

// 1b. Current logged-in warehouse facility dynamic statistics
warehousesRouter.get(
  '/my-warehouse/stats',
  requireAnyPermission(PERMISSIONS.WAREHOUSES_READ, PERMISSIONS.FULFILLMENTS_MANAGE),
  warehousesController.getMyWarehouseStats
);

// 1c. Alias for warehouse dashboard statistics
warehousesRouter.get(
  '/dashboard/stats',
  requireAnyPermission(PERMISSIONS.WAREHOUSES_READ, PERMISSIONS.FULFILLMENTS_MANAGE),
  warehousesController.getMyWarehouseStats
);

// 1d. Order Fulfillments queue for logged-in warehouse staff
warehousesRouter.get(
  '/my-warehouse/fulfillments',
  requireAnyPermission(PERMISSIONS.FULFILLMENTS_MANAGE, PERMISSIONS.ORDERS_READ),
  warehousesController.getMyWarehouseFulfillments
);

warehousesRouter.get(
  '/my-warehouse/fulfillments/:id',
  requireAnyPermission(PERMISSIONS.FULFILLMENTS_MANAGE, PERMISSIONS.ORDERS_READ),
  warehousesController.getMyWarehouseFulfillmentById
);

warehousesRouter.patch(
  '/my-warehouse/fulfillments/:id/status',
  requirePermissions(PERMISSIONS.FULFILLMENTS_MANAGE),
  warehousesController.updateFulfillmentStatus
);

warehousesRouter.get(
  '/my-warehouse/fulfillments/:id/invoice/pdf',
  requireAnyPermission(PERMISSIONS.FULFILLMENTS_MANAGE, PERMISSIONS.ORDERS_READ),
  warehousesController.downloadFulfillmentInvoicePdf
);

// 2. Admin: List all warehouses with filters & search
warehousesRouter.get(
  '/',
  requireAnyPermission(PERMISSIONS.WAREHOUSES_READ, PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.list
);

// 3. Admin: Directly link an active seller to an active 3PL warehouse
warehousesRouter.post(
  '/link-seller',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.linkSeller
);

// 4. Admin: Review pending seller-3PL linkage request
warehousesRouter.patch(
  '/seller-warehouses/:id/review',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.reviewLinkage
);

// 5. Admin: Unlink / terminate a seller from a warehouse
warehousesRouter.delete(
  '/seller-warehouses/:id',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.unlinkSeller
);

// 6. Dynamic document requirements for warehouse types (OWN, 3PL)
warehousesRouter.get(
  '/document-requirements',
  requireAnyPermission(PERMISSIONS.WAREHOUSES_READ, PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.getDocumentRequirements
);

// 7. Admin: Review warehouse compliance document
warehousesRouter.patch(
  '/documents/:id/review',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.reviewDocument
);

// 8. Facility details: Accessible by Admin OR assigned Warehouse User
warehousesRouter.get(
  '/:id',
  requireWarehouseAccess('id'),
  warehousesController.getById
);

// 8b. Facility dynamic statistics: Accessible by Admin OR assigned Warehouse User
warehousesRouter.get(
  '/:id/stats',
  requireWarehouseAccess('id'),
  warehousesController.getWarehouseStats
);

// 4. Admin: Create new warehouse
warehousesRouter.post(
  '/',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.create
);

// 5. Admin: Update warehouse details/status
warehousesRouter.put(
  '/:id',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.update
);

// 6. Admin: Assign staff to warehouse
warehousesRouter.post(
  '/:id/users',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.assignUser
);

// 7. Admin: Remove staff from warehouse
warehousesRouter.delete(
  '/:id/users/:userId',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.removeUser
);

// 8. Admin: Approve pending warehouse application
warehousesRouter.post(
  '/:id/approve',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.approve
);

// 9. Admin: Reject pending warehouse application
warehousesRouter.post(
  '/:id/reject',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.reject
);

// 10. Admin: Request rework on pending warehouse application
warehousesRouter.post(
  '/:id/rework',
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehousesController.requestRework
);

// 11. Facility status history timeline
warehousesRouter.get(
  '/:id/history',
  requireWarehouseAccess('id'),
  warehousesController.getStatusHistory
);

