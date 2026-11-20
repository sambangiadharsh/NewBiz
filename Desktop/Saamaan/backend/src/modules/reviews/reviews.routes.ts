import { Router } from 'express';
import { reviewsController } from './reviews.controller.js';
import { uploadReviewPhotos } from './reviews.upload.js';
import { authenticate, optionalAuthenticate, requirePermissions } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const reviewsRouter = Router();

// 1. Admin Moderation Routes (Literal paths first)
reviewsRouter.get(
  '/admin/summary',
  authenticate,
  requirePermissions(PERMISSIONS.CATALOG_READ),
  (req, res, next) => reviewsController.getAdminReviewSummary(req, res, next)
);

reviewsRouter.get(
  '/admin',
  authenticate,
  requirePermissions(PERMISSIONS.CATALOG_READ),
  (req, res, next) => reviewsController.getAdminReviews(req, res, next)
);

reviewsRouter.patch(
  '/admin/:reviewId/status',
  authenticate,
  requirePermissions(PERMISSIONS.CATALOG_MANAGE),
  (req, res, next) => reviewsController.moderateReview(req, res, next)
);

// 2. Customer Actions (Authenticated)
reviewsRouter.post(
  '/upload',
  authenticate,
  uploadReviewPhotos.array('photos', 5),
  (req, res, next) => reviewsController.uploadPhotos(req, res, next)
);

reviewsRouter.get(
  '/eligibility/:productId',
  authenticate,
  (req, res, next) => reviewsController.checkEligibility(req, res, next)
);

reviewsRouter.post(
  '/',
  authenticate,
  (req, res, next) => reviewsController.submitReview(req, res, next)
);

reviewsRouter.put(
  '/:reviewId',
  authenticate,
  (req, res, next) => reviewsController.updateReview(req, res, next)
);

reviewsRouter.post(
  '/:reviewId/vote',
  authenticate,
  (req, res, next) => reviewsController.voteHelpful(req, res, next)
);

// 3. Public Endpoints
reviewsRouter.get(
  '/product/:productId/summary',
  (req, res, next) => reviewsController.getProductRatingSummary(req, res, next)
);

reviewsRouter.get(
  '/product/:productId',
  optionalAuthenticate,
  (req, res, next) => reviewsController.getProductReviews(req, res, next)
);

