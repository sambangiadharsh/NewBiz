import { Router } from 'express';
import { authenticate, requireRoles } from '../../middleware/auth.js';
import { documentUpload } from '../../services/storage/StorageService.js';
import {
  getStatus,
  saveProfile,
  uploadDocument,
  updateCertificateNumber,
  submitApplication,
} from './sellerOnboarding.controller.js';

export const sellerOnboardingRouter = Router();

// Protect all seller onboarding routes with authentication and SELLER_USER role
sellerOnboardingRouter.use(authenticate, requireRoles('SELLER_USER', 'SUPER_ADMIN'));

sellerOnboardingRouter.get('/status', getStatus);
sellerOnboardingRouter.post('/profile', saveProfile);
sellerOnboardingRouter.post('/documents', documentUpload.single('file'), uploadDocument);
sellerOnboardingRouter.patch('/documents/:code/certificate-number', updateCertificateNumber);
sellerOnboardingRouter.post('/submit', submitApplication);
