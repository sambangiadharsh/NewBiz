import { Request, Response, NextFunction } from 'express';
import { reviewsService } from './reviews.service.js';
import { processAndSaveReviewImage } from './reviews.upload.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class ReviewsController {
  async getProductRatingSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await reviewsService.getProductRatingSummary(req.params.productId);
      return sendSuccess(res, summary, 'Rating summary fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getProductReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, rating, sortBy } = req.query;
      const currentCustomerId = req.user?.userId || null;

      const result = await reviewsService.getProductReviews(
        req.params.productId,
        {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 10,
          rating: rating ? parseInt(rating as string, 10) : undefined,
          sortBy: sortBy as any,
        },
        currentCustomerId
      );

      return sendPaginated(
        res,
        result.items,
        result.pagination.page,
        result.pagination.limit,
        result.pagination.total,
        'Reviews fetched successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async checkEligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.userId;
      if (!customerId) {
        throw new UnauthorizedError('Customer authentication required');
      }

      const eligibility = await reviewsService.checkEligibility(
        customerId,
        req.params.productId
      );
      return sendSuccess(res, eligibility, 'Eligibility checked successfully');
    } catch (error) {
      next(error);
    }
  }

  async submitReview(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.userId;
      if (!customerId) {
        throw new UnauthorizedError('Customer authentication required');
      }

      const result = await reviewsService.submitReview(customerId, req.body);
      return sendSuccess(res, result, result.message, 201);
    } catch (error) {
      next(error);
    }
  }

  async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.userId;
      if (!customerId) {
        throw new UnauthorizedError('Customer authentication required');
      }

      const result = await reviewsService.updateReview(customerId, req.params.reviewId, req.body);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async voteHelpful(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.userId;
      if (!customerId) {
        throw new UnauthorizedError('Customer authentication required');
      }

      const result = await reviewsService.voteHelpful(req.params.reviewId, customerId);
      return sendSuccess(res, result, 'Feedback updated');
    } catch (error) {
      next(error);
    }
  }

  async uploadPhotos(req: Request, res: Response, next: NextFunction) {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return sendSuccess(res, { urls: [] }, 'No photos uploaded');
      }

      // Convert all uploaded image files to WebP and save
      const urls: string[] = [];
      for (const file of files) {
        const webpUrl = await processAndSaveReviewImage(file);
        urls.push(webpUrl);
      }

      return sendSuccess(res, { urls }, 'Photos converted to WebP and uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, search } = req.query;

      const result = await reviewsService.getAdminReviews({
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        status: status as string,
        search: search as string,
      });

      return sendPaginated(
        res,
        result.items,
        result.pagination.page,
        result.pagination.limit,
        result.pagination.total,
        'Admin reviews fetched successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getAdminReviewSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await reviewsService.getAdminReviewSummary();
      return sendSuccess(res, summary, 'Review summary metrics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async moderateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const result = await reviewsService.moderateReview(req.params.reviewId, status);
      return sendSuccess(res, result, `Review marked as ${status}`);
    } catch (error) {
      next(error);
    }
  }
}

export const reviewsController = new ReviewsController();

