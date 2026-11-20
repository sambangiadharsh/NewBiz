import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  ThumbsUp,
  CheckCircle2,
  Filter,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ShoppingBag,
  X,
  User,
  Edit3,
} from 'lucide-react';
import { reviewsApi, ProductRatingSummary, ReviewItem, ReviewEligibility } from '../../lib/reviewsApi';
import { getImageUrl } from '../../lib/productsApi';
import { StarRating } from './StarRating';
import { WriteReviewModal } from './WriteReviewModal';

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
  productImage?: string;
  currentVariantSku?: string;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productId,
  productName,
  productImage,
  currentVariantSku,
  isLoggedIn = false,
  onRequireLogin,
}) => {
  const [summary, setSummary] = useState<ProductRatingSummary | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalReviews, setTotalReviews] = useState<number>(0);
  const [activeRatingFilter, setActiveRatingFilter] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest' | 'helpful'>('recent');
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(1);

  // Review modal & verification notice state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [checkingEligibility, setCheckingEligibility] = useState<boolean>(false);
  const [userExistingReview, setUserExistingReview] = useState<ReviewEligibility['existingReview'] | null>(null);
  const [eligibilityNotice, setEligibilityNotice] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    canGoToOrders: boolean;
  } | null>(null);

  const checkCustomerReviewStatus = async () => {
    if (!productId) {
      setUserExistingReview(null);
      return;
    }
    try {
      const res = await reviewsApi.checkEligibility(productId);
      if (res?.alreadyReviewed && res.existingReview) {
        setUserExistingReview(res.existingReview);
      } else {
        setUserExistingReview(null);
      }
    } catch {
      setUserExistingReview(null);
    }
  };

  useEffect(() => {
    checkCustomerReviewStatus();
  }, [isLoggedIn, productId]);

  const fetchSummary = async () => {
    const data = await reviewsApi.getSummary(productId);
    if (data) setSummary(data);
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await reviewsApi.getReviews(productId, {
        page,
        limit: 10,
        rating: activeRatingFilter,
        sortBy,
      });
      setReviews(Array.isArray(res?.items) ? res.items : []);
      setTotalReviews(res?.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [productId]);

  useEffect(() => {
    fetchReviews();
  }, [productId, page, activeRatingFilter, sortBy]);

  // Lock body scroll when eligibility dialog is open
  useEffect(() => {
    if (!eligibilityNotice?.isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [eligibilityNotice?.isOpen]);

  const handleOpenWriteReview = async () => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }

    try {
      setCheckingEligibility(true);
      const res = await reviewsApi.checkEligibility(productId);

      if (!res) {
        setEligibilityNotice({
          isOpen: true,
          title: 'Unable to Verify Purchase',
          description: 'We were unable to verify your order history right now. Please try again shortly.',
          canGoToOrders: false,
        });
        return;
      }

      if (!res.canReview) {
        if (res.alreadyReviewed && res.existingReview) {
          // Verified buyer already reviewed -> allow editing their existing review
          setUserExistingReview(res.existingReview);
          setModalOpen(true);
          return;
        }

        setEligibilityNotice({
          isOpen: true,
          title: 'Verified Purchase Required',
          description:
            res.reason ||
            'To protect all shoppers from spam and fake reviews, only verified customers who ordered and received this product on Saamaan can write a review.',
          canGoToOrders: true,
        });
        return;
      }

      // Eligible for a new review
      setUserExistingReview(null);
      setModalOpen(true);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleVoteHelpful = async (reviewId: string) => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }

    // Optimistic toggle
    setReviews((prev) =>
      (Array.isArray(prev) ? prev : []).map((r) => {
        if (r.reviewId === reviewId) {
          const newVoted = !r.hasVotedHelpful;
          const newCount = newVoted
            ? r.helpfulVotesCount + 1
            : Math.max(0, r.helpfulVotesCount - 1);
          return { ...r, hasVotedHelpful: newVoted, helpfulVotesCount: newCount };
        }
        return r;
      })
    );

    await reviewsApi.voteHelpful(reviewId);
  };

  const totalSummaryReviews = summary?.totalReviews || 0;
  const avgRating = summary?.averageRating || 0;

  return (
    <div className="py-2 space-y-8 text-slate-800">
      {/* ── Top Summary & Rating Overview ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-200/80">
        {/* Score & Stars */}
        <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-slate-200">
          <div className="text-5xl font-black text-slate-900 tracking-tight">
            {avgRating > 0 ? avgRating.toFixed(1) : '0.0'}
          </div>
          <div className="mt-2">
            <StarRating rating={Math.round(avgRating)} size="lg" />
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1.5">
            Based on {totalSummaryReviews.toLocaleString()} verified {totalSummaryReviews === 1 ? 'review' : 'reviews'}
          </p>
        
        </div>

        {/* 5-Star Histogram Progress Bars */}
        <div className="md:col-span-5 space-y-2 px-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = (summary?.ratingDistribution as any)?.[stars] || 0;
            const pct = totalSummaryReviews > 0 ? Math.round((count / totalSummaryReviews) * 100) : 0;
            const isSelected = activeRatingFilter === stars;

            return (
              <button
                key={stars}
                onClick={() =>
                  setActiveRatingFilter(isSelected ? undefined : stars)
                }
                className={`w-full flex items-center gap-3 text-xs group cursor-pointer transition-colors p-1 rounded-lg ${
                  isSelected ? 'bg-primary-50 font-bold' : 'hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center gap-1 w-12 text-slate-700 shrink-0 font-medium">
                  <span>{stars}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                </div>
                <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-slate-400 font-mono text-[11px]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Write a Review Card */}
        <div className="md:col-span-3 flex flex-col justify-between items-center text-center p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Have this product?</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Help other shoppers by sharing your genuine experience
            </p>
          </div>

          <button
            onClick={handleOpenWriteReview}
            disabled={checkingEligibility}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm shadow-primary-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {userExistingReview ? (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                Edit Your Review
              </>
            ) : (
              'Write a Review'
            )}
          </button>
        </div>
      </div>

      {/* ── Filter Bar & Sort ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-b border-slate-100 pb-4">
        {/* Rating Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveRatingFilter(undefined)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeRatingFilter === undefined
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Reviews ({totalSummaryReviews})
          </button>
          {[5, 4, 3, 2, 1].map((stars) => {
            const isSelected = activeRatingFilter === stars;
            return (
              <button
                key={stars}
                onClick={() =>
                  setActiveRatingFilter(isSelected ? undefined : stars)
                }
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{stars}</span>
                <Star className={`w-3 h-3 ${isSelected ? 'fill-white text-white' : 'fill-amber-400 text-amber-400'}`} />
              </button>
            );
          })}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
          >
            <option value="recent">Most Recent</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
            <option value="helpful">Most Helpful</option>
          </select>
        </div>
      </div>

      {/* ── Review Cards Feed ─────────────────────────────────────── */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
            <p className="text-xs font-medium">Loading customer feedback...</p>
          </div>
        ) : !Array.isArray(reviews) || reviews.length === 0 ? (
          <div className="py-14 text-center rounded-3xl bg-slate-50 border border-slate-200/80 p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">No reviews found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeRatingFilter
                ? `There are no ${activeRatingFilter}-star reviews for this item yet.`
                : 'Be the first verified customer to share your thoughts on this product!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((rev) => (
              <div key={rev.reviewId} className="py-6 space-y-3">
                {/* Review Header: User & Rating */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={rev.rating} size="sm" />
                      {rev.title && (
                        <h4 className="text-sm font-bold text-slate-900">{rev.title}</h4>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
                          <User className="w-2.5 h-2.5 text-slate-600" />
                        </span>
                        <span className="font-semibold text-slate-800">{rev.customerName}</span>
                      </div>
                      <span>•</span>
                      <span className="text-slate-400">
                        {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {userExistingReview?.reviewId === rev.reviewId && (
                    <button
                      type="button"
                      onClick={() => setModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-colors shadow-2xs cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-primary-600" />
                      Edit Review
                    </button>
                  )}
                </div>

                {/* Comment Prose */}
                {rev.comment && (
                  <p className="text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-line">
                    {rev.comment}
                  </p>
                )}

                {/* Attached Customer Photos */}
                {rev.images && rev.images.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {rev.images.map((img) => {
                      const fullUrl = getImageUrl(img.url);
                      return (
                        <a
                          key={img.assetId}
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-primary-500 transition-all"
                        >
                          <img
                            src={fullUrl}
                            alt="Customer product photo"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Helpful Button */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleVoteHelpful(rev.reviewId)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                      rev.hasVotedHelpful
                        ? 'bg-primary-50 text-primary-700 border-primary-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${rev.hasVotedHelpful ? 'fill-primary-600' : ''}`} />
                    <span>Helpful ({rev.helpfulVotesCount})</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Write / Edit Review Modal */}
      <WriteReviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        productId={productId}
        productName={productName}
        productImage={productImage}
        variantSku={currentVariantSku}
        initialReview={userExistingReview}
        onReviewSubmitted={() => {
          fetchSummary();
          fetchReviews();
          checkCustomerReviewStatus();
        }}
      />

      {/* Amazon / Flipkart Style Verified Purchase Notice Dialog */}
      {eligibilityNotice?.isOpen && createPortal(
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[99999] overflow-y-auto bg-slate-900/50 flex justify-center items-center p-4 animate-in fade-in duration-150"
          style={{ margin: 0, padding: '1rem', width: '100vw', height: '100vh', top: 0, left: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEligibilityNotice(null);
          }}
        >
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 ring-1 ring-slate-900/5 p-6 space-y-5 text-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                {eligibilityNotice.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {eligibilityNotice.description}
              </p>
            </div>

            

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {eligibilityNotice.canGoToOrders && (
                <button
                  type="button"
                  onClick={() => {
                    setEligibilityNotice(null);
                    navigate('/profile?tab=orders');
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm shadow-primary-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  View My Orders
                </button>
              )}
              <button
                type="button"
                onClick={() => setEligibilityNotice(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

