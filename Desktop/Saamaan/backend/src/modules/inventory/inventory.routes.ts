import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { authenticate, requirePermissions, requireAnyPermission } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const sellerInventoryRouter = Router();

// Protect all seller inventory endpoints with read permission at baseline
sellerInventoryRouter.use(
  authenticate,
  requireAnyPermission(PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_MANAGE)
);

// Summary & Grid
sellerInventoryRouter.get('/summary', (req, res) => inventoryController.getSummary(req, res));
sellerInventoryRouter.get('/grid', (req, res) => inventoryController.getGrid(req, res));
sellerInventoryRouter.get('/ledger', (req, res) => inventoryController.getLedger(req, res));
sellerInventoryRouter.get('/alerts', (req, res) => inventoryController.getAlerts(req, res));

// Mutation Stock Operations (Requires inventory.manage permission)
sellerInventoryRouter.post(
  '/inbound',
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  (req, res) => inventoryController.createInboundNotice(req, res)
);
sellerInventoryRouter.patch(
  '/:inventoryId/safety-stock',
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  (req, res) => inventoryController.updateSafetyStock(req, res)
);








