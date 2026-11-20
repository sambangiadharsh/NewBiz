import { fetchWithAuth } from './fetchWithAuth';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:7000/api/v1';

export interface ProductRatingSummary {
  productId: string;
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  recommendedPercentage: number;
}

export interface ReviewItem {
  reviewId: string;
  productId: string;
  customerId: string;
  customerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: string;
  isVerifiedPurchase: boolean;
  helpfulVotesCount: number;
  hasVotedHelpful?: boolean;
  createdAt: string;
  updatedAt: string | null;
  variant?: {
    variantId: string;
    variantSku: string;
  } | null;
  images: {
    assetId: string;
    url: string;
  }[];
}

export interface ReviewEligibility {
  canReview: boolean;
  canEdit?: boolean;
  alreadyReviewed: boolean;
  reason?: string;
  orderId?: string;
  orderItemId?: string;
  productVariantId?: string;
  variantSku?: string;
  existingReview?: {
    reviewId: string;
    rating: number;
    title: string | null;
    comment: string | null;
    status?: string;
    images?: { assetId?: string; url: string }[];
  };
}

export const reviewsApi = {
  /**
   * Fetches aggregate rating metrics & 5-star distribution.
   */
  async getSummary(productId: string): Promise<ProductRatingSummary | null> {
    try {
      const res = await fetch(`${API_BASE}/reviews/product/${productId}/summary`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.warn('Failed to fetch review summary:', err);
      return null;
    }
  },

  /**
   * Fetches paginated reviews for a product with filters.
   */
  async getReviews(
    productId: string,
    params?: {
      page?: number;
      limit?: number;
      rating?: number;
      sortBy?: 'recent' | 'highest' | 'lowest' | 'helpful';
    }
  ): Promise<{ items: ReviewItem[]; total: number; totalPages: number }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.rating) searchParams.set('rating', String(params.rating));
      if (params?.sortBy) searchParams.set('sortBy', params.sortBy);

      const qs = searchParams.toString();
      const res = await fetchWithAuth(`${API_BASE}/reviews/product/${productId}${qs ? `?${qs}` : ''}`);
      if (!res.ok) return { items: [], total: 0, totalPages: 1 };
      const json = await res.json();
      const rawItems = Array.isArray(json.data?.items)
        ? json.data.items
        : Array.isArray(json.data)
        ? json.data
        : [];
      const total =
        json.data?.meta?.totalCount ??
        json.data?.meta?.total ??
        json.pagination?.total ??
        rawItems.length;
      const totalPages =
        json.data?.meta?.totalPages ??
        json.pagination?.totalPages ??
        1;

      return {
        items: rawItems,
        total,
        totalPages,
      };
    } catch (err) {
      console.warn('Failed to fetch reviews:', err);
      return { items: [], total: 0, totalPages: 1 };
    }
  },

  /**
   * Checks whether the current customer can write a verified review.
   */
  async checkEligibility(productId: string): Promise<ReviewEligibility | null> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/reviews/eligibility/${productId}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.warn('Failed to check review eligibility:', err);
      return null;
    }
  },

  /**
   * Uploads review image files to the server and returns their URLs.
   */
  async uploadPhotos(files: File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('photos', file);
      });

      const res = await fetchWithAuth(`${API_BASE}/reviews/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || json.error?.message || 'Failed to upload images');
      }

      const json = await res.json();
      return json.data?.urls || [];
    } catch (err) {
      console.error('Photo upload failed:', err);
      throw err;
    }
  },

  /**
   * Submits a verified review.
   */
  async submitReview(data: {
    productId: string;
    rating: number;
    title?: string;
    comment?: string;
    imageUrls?: string[];
  }): Promise<{ success: boolean; reviewId?: string; message?: string }> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/reviews`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: json.error?.message || json.message || 'Failed to submit review',
        };
      }
      return {
        success: true,
        reviewId: json.data?.reviewId,
        message: json.message || 'Review submitted successfully',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error occurred while submitting review',
      };
    }
  },

  /**
   * Updates an existing customer review.
   * Resets status to PENDING_APPROVAL for re-moderation.
   */
  async updateReview(
    reviewId: string,
    data: {
      rating: number;
      title?: string;
      comment?: string;
      imageUrls?: string[];
    }
  ): Promise<{ success: boolean; reviewId?: string; message?: string }> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/reviews/${reviewId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        return {
          success: false,
          message: json.error?.message || json.message || 'Failed to update review',
        };
      }
      return {
        success: true,
        reviewId: json.data?.reviewId,
        message: json.message || 'Review updated and submitted for moderation',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error occurred while updating review',
      };
    }
  },

  /**
   * Votes a review as helpful.
   */
  async voteHelpful(reviewId: string): Promise<{ helpfulVotes: number; hasVoted: boolean } | null> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/reviews/${reviewId}/vote`, {
        method: 'POST',
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.warn('Failed to vote helpful:', err);
      return null;
    }
  },
};

