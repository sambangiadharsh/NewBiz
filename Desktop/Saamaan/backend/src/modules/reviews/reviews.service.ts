import { z } from 'zod';
import { reviewsRepository } from './reviews.repository.js';
import { BadRequestError } from '../../utils/errors.js';

export const submitReviewSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  rating: z.number().int().min(1).max(5, 'Rating must be an integer between 1 and 5'),
  title: z.string().max(150, 'Title cannot exceed 150 characters').optional().nullable(),
  comment: z.string().max(3000, 'Review comment cannot exceed 3000 characters').optional().nullable(),
  imageUrls: z
    .array(
      z
        .string()
        .min(1, 'Image path cannot be empty')
        .max(1000, 'Image URL cannot exceed 1000 characters')
        .refine(
          (val) => val.startsWith('/') || val.startsWith('http://') || val.startsWith('https://'),
          'Image must be a valid URL or path'
        )
    )
    .max(5, 'Maximum 5 images allowed')
    .optional(),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5, 'Rating must be an integer between 1 and 5'),
  title: z.string().max(150, 'Title cannot exceed 150 characters').optional().nullable(),
  comment: z.string().max(3000, 'Review comment cannot exceed 3000 characters').optional().nullable(),
  imageUrls: z
    .array(
      z
        .string()
        .min(1, 'Image path cannot be empty')
        .max(1000, 'Image URL cannot exceed 1000 characters')
        .refine(
          (val) => val.startsWith('/') || val.startsWith('http://') || val.startsWith('https://'),
          'Image must be a valid URL or path'
        )
    )
    .max(5, 'Maximum 5 images allowed')
    .optional(),
});

export class ReviewsService {
  /**
   * Product rating aggregate summary for PDP & card badges.
   */
  async getProductRatingSummary(productIdStr: string) {
    let productId: bigint;
    try {
      productId = BigInt(productIdStr);
    } catch {
      throw new BadRequestError('Invalid Product ID');
    }

    return reviewsRepository.getProductRatingSummary(productId);
  }

  /**
   * Paginated list of customer reviews with filters and sort.
   */
  async getProductReviews(
    productIdStr: string,
    params: {
      page?: number;
      limit?: number;
      rating?: number;
      sortBy?: 'recent' | 'highest' | 'lowest' | 'helpful';
    },
    currentCustomerIdStr?: string | null
  ) {
    let productId: bigint;
    try {
      productId = BigInt(productIdStr);
    } catch {
      throw new BadRequestError('Invalid Product ID');
    }

    const currentCustomerId = currentCustomerIdStr ? BigInt(currentCustomerIdStr) : null;
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 10));

    const { items, total } = await reviewsRepository.getProductReviews({
      productId,
      page,
      limit,
      rating: params.rating,
      sortBy: params.sortBy,
      currentCustomerId,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Verify if a logged-in customer is eligible to review.
   */
  async checkEligibility(customerIdStr: string, productIdStr: string) {
    const customerId = BigInt(customerIdStr);
    let productId: bigint;
    try {
      productId = BigInt(productIdStr);
    } catch {
      throw new BadRequestError('Invalid Product ID');
    }

    return reviewsRepository.checkReviewEligibility(customerId, productId);
  }

  /**
   * Submit verified customer review with optional photos.
   */
  async submitReview(
    customerIdStr: string,
    input: z.infer<typeof submitReviewSchema>
  ) {
    const customerId = BigInt(customerIdStr);
    const validated = submitReviewSchema.parse(input);
    const productId = BigInt(validated.productId);

    // Enforce verified purchase gate
    const eligibility = await reviewsRepository.checkReviewEligibility(customerId, productId);
    if (!eligibility.canReview) {
      if (eligibility.alreadyReviewed) {
        throw new BadRequestError('You have already submitted a review for this product');
      }
      throw new BadRequestError(
        eligibility.reason || 'Only customers who ordered this product can write a review'
      );
    }

    const result = await reviewsRepository.createReview({
      productId,
      customerId,
      orderId: eligibility.orderId ? BigInt(eligibility.orderId) : null,
      orderItemId: eligibility.orderItemId ? BigInt(eligibility.orderItemId) : null,
      productVariantId: eligibility.productVariantId ? BigInt(eligibility.productVariantId) : null,
      rating: validated.rating,
      title: validated.title || null,
      comment: validated.comment || null,
      imageUrls: validated.imageUrls || [],
    });

    return {
      reviewId: result.reviewId,
      message: 'Review submitted successfully! It will appear publicly once approved by our moderation team.',
    };
  }

  /**
   * Updates an existing customer review and strictly resets its moderation status to PENDING_APPROVAL.
   */
  async updateReview(
    customerIdStr: string,
    reviewIdStr: string,
    input: z.infer<typeof updateReviewSchema>
  ) {
    const customerId = BigInt(customerIdStr);
    let reviewId: bigint;
    try {
      reviewId = BigInt(reviewIdStr);
    } catch {
      throw new BadRequestError('Invalid Review ID');
    }

    const validated = updateReviewSchema.parse(input);

    return reviewsRepository.updateCustomerReview(reviewId, customerId, {
      rating: validated.rating,
      title: validated.title || null,
      comment: validated.comment || null,
      imageUrls: validated.imageUrls,
    });
  }

  /**
   * Upvote review as helpful.
   */
  async voteHelpful(reviewIdStr: string, customerIdStr: string) {
    let reviewId: bigint;
    try {
      reviewId = BigInt(reviewIdStr);
    } catch {
      throw new BadRequestError('Invalid Review ID');
    }
    const customerId = BigInt(customerIdStr);

    return reviewsRepository.voteHelpful(reviewId, customerId);
  }

  /**
   * Admin reviews queue.
   */
  async getAdminReviews(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const { items, total } = await reviewsRepository.getAdminReviews({
      page,
      limit,
      status: params.status,
      search: params.search,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin moderate review.
   */
  async moderateReview(
    reviewIdStr: string,
    status: 'APPROVED' | 'FLAGGED' | 'REJECTED' | 'PENDING_APPROVAL'
  ) {
    let reviewId: bigint;
    try {
      reviewId = BigInt(reviewIdStr);
    } catch {
      throw new BadRequestError('Invalid Review ID');
    }

    return reviewsRepository.moderateReview(reviewId, status);
  }

  /**
   * Admin review summary statistics.
   */
  async getAdminReviewSummary() {
    return reviewsRepository.getAdminReviewSummary();
  }
}

export const reviewsService = new ReviewsService();

