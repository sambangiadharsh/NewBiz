import { Router } from 'express';
import { sellerDashboardController } from './sellerDashboard.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

export const sellerDashboardRouter = Router();

// Protect all seller dashboard endpoints
sellerDashboardRouter.use(authenticate, requireRoles('SELLER_ADMIN', 'SUPER_ADMIN'));

sellerDashboardRouter.get('/stats', sellerDashboardController.getStats);
