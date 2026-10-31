import { Router } from 'express';
import { authenticate, requireAnyPermission } from '../../middleware/auth.js';
import { documentUpload } from '../../services/storage/StorageService.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  getStatus,
  saveProfile,
  uploadDocument,
  updateCertificateNumber,
  submitApplication,
} from './sellerOnboarding.controller.js';

export const sellerOnboardingRouter = Router();

// Protect all seller onboarding routes with sellers.read or sellers.manage permission
sellerOnboardingRouter.use(
  authenticate,
  requireAnyPermission(PERMISSIONS.SELLERS_READ, PERMISSIONS.SELLERS_MANAGE)
);

sellerOnboardingRouter.get('/status', getStatus);
sellerOnboardingRouter.post('/profile', saveProfile);
sellerOnboardingRouter.post('/documents', documentUpload.single('file'), uploadDocument);
sellerOnboardingRouter.patch('/documents/:code/certificate-number', updateCertificateNumber);
sellerOnboardingRouter.post('/submit', submitApplication);
