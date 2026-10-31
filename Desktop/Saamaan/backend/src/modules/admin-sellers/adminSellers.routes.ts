import { Router } from 'express';
import { authenticate, requireAnyPermission } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  listApplications,
  listActiveSellers,
  getApplicationDetails,
  verifyDocument,
  makeDecision,
  reopenApplication,
  onboardSeller,
} from './adminSellers.controller.js';

export const adminSellersRouter = Router();

// Protect all admin seller management routes with seller permissions
adminSellersRouter.use(
  authenticate,
  requireAnyPermission(
    PERMISSIONS.SELLERS_READ,
    PERMISSIONS.SELLERS_MANAGE,
    PERMISSIONS.APPLICATIONS_REVIEW
  )
);

adminSellersRouter.get('/', listActiveSellers);
adminSellersRouter.get('/applications', listApplications);
adminSellersRouter.get('/applications/:id', getApplicationDetails);
adminSellersRouter.patch('/documents/:docId/verify', verifyDocument);
adminSellersRouter.post('/applications/:id/decision', makeDecision);
adminSellersRouter.patch('/applications/:id/reopen', reopenApplication);
adminSellersRouter.post('/onboard', onboardSeller);
