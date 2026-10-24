import { Router } from 'express';
import { warehousesController } from './warehouses.controller.js';
import { authenticate, optionalAuthenticate, requireRoles, requireWarehouseAccess } from '../../middleware/auth.js';

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
  requireRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN', 'ADMIN'),
  warehousesController.getMyWarehouse
);

// 1b. Current logged-in warehouse facility dynamic statistics
warehousesRouter.get(
  '/my-warehouse/stats',
  requireRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN', 'ADMIN'),
  warehousesController.getMyWarehouseStats
);

// 1c. Alias for warehouse dashboard statistics
warehousesRouter.get(
  '/dashboard/stats',
  requireRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN', 'ADMIN'),
  warehousesController.getMyWarehouseStats
);

// 1d. Order Fulfillments queue for logged-in warehouse staff
warehousesRouter.get(
  '/my-warehouse/fulfillments',
  requireRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN', 'ADMIN'),
  warehousesController.getMyWarehouseFulfillments
);

warehousesRouter.get(
  '/my-warehouse/fulfillments/:id',
  requireRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN', 'ADMIN'),
  warehousesController.getMyWarehouseFulfillmentById
);

warehousesRouter.patch(
  '/my-warehouse/fulfillments/:id/status',
  requireRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN', 'ADMIN'),
  warehousesController.updateFulfillmentStatus
);

warehousesRouter.get(
  '/my-warehouse/fulfillments/:id/invoice/pdf',
  requireRoles('WAREHOUSE_MANAGER', 'SUPER_ADMIN', 'ADMIN'),
  warehousesController.downloadFulfillmentInvoicePdf
);

// 2. Admin: List all warehouses with filters & search
warehousesRouter.get(
  '/',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.list
);

// 3. Admin: Directly link an active seller to an active 3PL warehouse
warehousesRouter.post(
  '/link-seller',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.linkSeller
);

// 4. Admin: Review pending seller-3PL linkage request
warehousesRouter.patch(
  '/seller-warehouses/:id/review',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.reviewLinkage
);

// 5. Admin: Unlink / terminate a seller from a warehouse
warehousesRouter.delete(
  '/seller-warehouses/:id',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.unlinkSeller
);

// 6. Dynamic document requirements for warehouse types (OWN, 3PL)
warehousesRouter.get(
  '/document-requirements',
  requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER'),
  warehousesController.getDocumentRequirements
);

// 7. Admin: Review warehouse compliance document
warehousesRouter.patch(
  '/documents/:id/review',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
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
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.create
);

// 5. Admin: Update warehouse details/status
warehousesRouter.put(
  '/:id',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.update
);

// 6. Admin: Assign staff to warehouse
warehousesRouter.post(
  '/:id/users',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.assignUser
);

// 7. Admin: Remove staff from warehouse
warehousesRouter.delete(
  '/:id/users/:userId',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.removeUser
);

// 8. Admin: Approve pending warehouse application
warehousesRouter.post(
  '/:id/approve',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.approve
);

// 9. Admin: Reject pending warehouse application
warehousesRouter.post(
  '/:id/reject',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.reject
);

// 10. Admin: Request rework on pending warehouse application
warehousesRouter.post(
  '/:id/rework',
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  warehousesController.requestRework
);

// 11. Facility status history timeline
warehousesRouter.get(
  '/:id/history',
  requireWarehouseAccess('id'),
  warehousesController.getStatusHistory
);

