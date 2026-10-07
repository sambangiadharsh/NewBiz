import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

export const sellerInventoryRouter = Router();

// Protect all seller inventory endpoints
sellerInventoryRouter.use(authenticate, requireRoles('SELLER_ADMIN', 'SUPER_ADMIN'));

// Summary & Grid
sellerInventoryRouter.get('/summary', (req, res) => inventoryController.getSummary(req, res));
sellerInventoryRouter.get('/grid', (req, res) => inventoryController.getGrid(req, res));

// Stock Operations
sellerInventoryRouter.post('/inbound', (req, res) => inventoryController.createInboundNotice(req, res));
sellerInventoryRouter.get('/ledger', (req, res) => inventoryController.getLedger(req, res));
sellerInventoryRouter.get('/alerts', (req, res) => inventoryController.getAlerts(req, res));
sellerInventoryRouter.patch('/:inventoryId/safety-stock', (req, res) =>
  inventoryController.updateSafetyStock(req, res)
);
