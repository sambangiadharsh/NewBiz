import { Router } from 'express';
import { sellerDashboardController } from './sellerDashboard.controller.js';
import { authenticate, requirePermissions } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const sellerDashboardRouter = Router();

// Protect all seller dashboard endpoints with sellers.read permission
sellerDashboardRouter.use(authenticate, requirePermissions(PERMISSIONS.SELLERS_READ));

sellerDashboardRouter.get('/stats', sellerDashboardController.getStats);
