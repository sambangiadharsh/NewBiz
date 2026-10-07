import { Router } from 'express';
import { adminDashboardController } from './adminDashboard.controller.js';
import { authenticate, requireRoles } from '../../middleware/auth.js';

export const adminDashboardRouter = Router();

// Protect all admin dashboard endpoints
adminDashboardRouter.use(authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'));

adminDashboardRouter.get('/stats', adminDashboardController.getStats);
