import { Router } from 'express';
import { adminDashboardController } from './adminDashboard.controller.js';
import { authenticate, requireAnyPermission } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const adminDashboardRouter = Router();

// Protect admin dashboard endpoints with any operational read permission
adminDashboardRouter.use(
  authenticate,
  requireAnyPermission(PERMISSIONS.USERS_READ, PERMISSIONS.SELLERS_READ, PERMISSIONS.CATALOG_READ)
);

adminDashboardRouter.get('/stats', adminDashboardController.getStats);
