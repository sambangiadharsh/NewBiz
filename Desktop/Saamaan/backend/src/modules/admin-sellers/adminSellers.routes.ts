import { Router } from 'express';
import { authenticate, requireAccess } from '../../middleware/auth.js';
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

// Protect all admin seller management routes
adminSellersRouter.use(
  authenticate,
  requireAccess({
    roles: ['SUPER_ADMIN', 'ADMIN'],
    permissions: ['sellers.read', 'sellers.manage', 'applications.review'],
  })
);

adminSellersRouter.get('/', listActiveSellers);
adminSellersRouter.get('/applications', listApplications);
adminSellersRouter.get('/applications/:id', getApplicationDetails);
adminSellersRouter.patch('/documents/:docId/verify', verifyDocument);
adminSellersRouter.post('/applications/:id/decision', makeDecision);
adminSellersRouter.patch('/applications/:id/reopen', reopenApplication);
adminSellersRouter.post('/onboard', onboardSeller);
