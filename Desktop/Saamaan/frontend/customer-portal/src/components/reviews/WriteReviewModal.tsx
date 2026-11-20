import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, Edit3, ShieldAlert } from 'lucide-react';
import { reviewsApi } from '../../lib/reviewsApi';
import { getImageUrl } from '../../lib/productsApi';
import { StarRating } from './StarRating';

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  productImage?: string;
  variantSku?: string;
  initialReview?: {
    reviewId: string;
    rating: number;
    title: string | null;
    comment: string | null;
    status?: string;
    images?: { assetId?: string; url: string }[];
  } | null;
  onReviewSubmitted?: () => void;
}

interface PhotoItem {
  file: File;
  previewUrl: string;
}

/**
 * Converts any browser-supported image file into a modern, optimized WebP format
 */
async function convertToWebP(file: File, quality = 0.85): Promise<File> {
  if (file.type === 'image/webp') return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const webpFile = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
          resolve(webpFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback gracefully if image format cannot be rendered in canvas
    };

    img.src = objectUrl;
  });
}

export const WriteReviewModal: React.FC<WriteReviewModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  productImage,
  variantSku,
  initialReview,
  onReviewSubmitted,
}) => {
  const [editReviewId, setEditReviewId] = useState<string | null>(initialReview?.reviewId || null);
  const [rating, setRating] = useState<number>(initialReview?.rating || 5);
  const [title, setTitle] = useState<string>(initialReview?.title || '');
  const [comment, setComment] = useState<string>(initialReview?.comment || '');
  const [existingImages, setExistingImages] = useState<string[]>(
    initialReview?.images?.map((img) => img.url) || []
  );
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state on open or when initialReview changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialReview) {
      setEditReviewId(initialReview.reviewId);
      setRating(initialReview.rating);
      setTitle(initialReview.title || '');
      setComment(initialReview.comment || '');
      setExistingImages(initialReview.images?.map((img) => img.url) || []);
      setPhotos([]);
      setErrorMsg(null);
      setSubmittedSuccess(false);
    } else {
      // Auto-detect if customer already reviewed to populate for editing
      setLoadingInitial(true);
      reviewsApi
        .checkEligibility(productId)
        .then((res) => {
          if (res?.alreadyReviewed && res.existingReview) {
            setEditReviewId(res.existingReview.reviewId);
            setRating(res.existingReview.rating);
            setTitle(res.existingReview.title || '');
            setComment(res.existingReview.comment || '');
            setExistingImages(res.existingReview.images?.map((img) => img.url) || []);
          } else {
            setEditReviewId(null);
            setRating(5);
            setTitle('');
            setComment('');
            setExistingImages([]);
          }
        })
        .finally(() => {
          setLoadingInitial(false);
        });
    }
  }, [isOpen, initialReview, productId]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [photos]);

  // Lock background body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const RATING_LABELS: Record<number, string> = {
    1: 'Terrible - Very dissatisfied',
    2: 'Poor - Not what I expected',
    3: 'Average - It was okay',
    4: 'Good - Satisfied with purchase',
    5: 'Excellent! - Exceeded expectations',
  };

  const totalPhotosCount = existingImages.length + photos.length;

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);

    const filesToConvert: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (totalPhotosCount + filesToConvert.length >= 5) {
        setErrorMsg('You can upload a maximum of 5 photos');
        break;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg(`Photo "${file.name}" exceeds the 10MB limit`);
        continue;
      }
      filesToConvert.push(file);
    }

    if (filesToConvert.length > 0) {
      const newPhotos: PhotoItem[] = [];
      for (const file of filesToConvert) {
        try {
          const webpFile = await convertToWebP(file);
          newPhotos.push({
            file: webpFile,
            previewUrl: URL.createObjectURL(webpFile),
          });
        } catch {
          newPhotos.push({
            file,
            previewUrl: URL.createObjectURL(file),
          });
        }
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const itemToRemove = prev[index];
      if (itemToRemove) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (rating < 1 || rating > 5) {
      setErrorMsg('Please select a star rating');
      return;
    }

    try {
      setSubmitting(true);

      // Upload newly added photos first if any
      let uploadedUrls: string[] = [];
      if (photos.length > 0) {
        try {
          uploadedUrls = await reviewsApi.uploadPhotos(photos.map((p) => p.file));
        } catch (uploadErr: any) {
          setErrorMsg(uploadErr.message || 'Failed to upload attached photos');
          setSubmitting(false);
          return;
        }
      }

      const finalImageUrls = [...existingImages, ...uploadedUrls];

      if (editReviewId) {
        // Edit Mode: Updates review and automatically resets status to PENDING_APPROVAL
        const res = await reviewsApi.updateReview(editReviewId, {
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
          imageUrls: finalImageUrls,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to update review');
          return;
        }
      } else {
        // Create Mode: Submits new review with PENDING_APPROVAL
        const res = await reviewsApi.submitReview({
          productId,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
          imageUrls: finalImageUrls.length > 0 ? finalImageUrls : undefined,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to submit review');
          return;
        }
      }

      setSubmittedSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[99999] overflow-y-auto bg-slate-900/50 flex justify-center items-center p-4 animate-in fade-in duration-150"
      style={{ margin: 0, padding: '1rem', width: '100vw', height: '100vh', top: 0, left: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (submittedSuccess) onReviewSubmitted?.();
          onClose();
        }
      }}
    >
      {submittedSuccess ? (
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 ring-1 ring-slate-900/5 p-6 sm:p-8 text-center my-auto space-y-4 animate-in zoom-in-95 duration-150">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              {editReviewId ? 'Review Updated & In Moderation' : 'Review Submitted for Moderation'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {editReviewId
                ? 'Your updated review has been submitted for moderation. In accordance with safety policies, it will appear on the store once re-verified by our moderation team.'
                : 'Thank you for sharing your experience! Your review has been submitted and will appear on the product page once approved by our moderation team.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSubmittedSuccess(false);
              onReviewSubmitted?.();
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm shadow-primary-600/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 ring-1 ring-slate-900/5 overflow-hidden flex flex-col my-auto max-h-[90vh]">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {editReviewId ? 'Edit Your Review' : 'Write a Review'}
                </h2>
                {editReviewId && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                    Editing
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Verified Purchase Review
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Product mini bar */}
          <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
            {productImage && (
              <img
                src={getImageUrl(productImage)}
                alt={productName}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
              />
            )}
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 truncate">{productName}</h4>
              {variantSku && (
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {variantSku}</p>
              )}
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
            {loadingInitial && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                <span>Loading your existing review details...</span>
              </div>
            )}

           

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Star Rating Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Overall Rating <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <StarRating
                  rating={rating}
                  interactive={true}
                  onRatingChange={(newRating) => setRating(newRating)}
                  size="lg"
                />
                <span className="text-xs font-bold text-slate-800">
                  {RATING_LABELS[rating]}
                </span>
              </div>
            </div>

            {/* Headline / Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Review Title (Headline)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Great quality, fits perfectly!"
                maxLength={150}
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            {/* Detailed Comment */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Detailed Experience
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you like or dislike? How is the material, performance, or packaging?"
                rows={4}
                maxLength={3000}
                className="w-full text-xs p-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <div className="text-[10px] text-slate-400 text-right mt-1">
                {comment.length} / 3000 characters
              </div>
            </div>

            {/* Customer Photos Upload */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Photos (Optional)
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {totalPhotosCount} / 5 photos
                </span>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
                multiple
                onChange={handleFilesSelect}
                className="hidden"
              />

              {/* Upload Click Area */}
              {totalPhotosCount < 5 && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-primary-400 bg-slate-50/70 hover:bg-primary-50/40 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 group-hover:text-primary-600 flex items-center justify-center transition-colors shadow-2xs">
                    <Upload className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 group-hover:text-primary-700 transition-colors">
                    Click to select photos
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Auto-converted to lightweight WebP format
                  </p>
                </div>
              )}

              {/* Photo Previews */}
              {totalPhotosCount > 0 && (
                <div className="flex flex-wrap gap-2.5 mt-3">
                  {/* Existing Photos */}
                  {existingImages.map((url, idx) => (
                    <div
                      key={`existing-${idx}`}
                      className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs"
                    >
                      <img
                        src={getImageUrl(url)}
                        alt={`existing-${idx}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingImage(idx)}
                        className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* New Photos */}
                  {photos.map((item, idx) => (
                    <div
                      key={`new-${idx}`}
                      className="relative group w-16 h-16 rounded-xl overflow-hidden border border-primary-300 ring-2 ring-primary-500/20 bg-slate-100 shadow-2xs"
                    >
                      <img
                        src={item.previewUrl}
                        alt={`upload-${idx}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loadingInitial}
                className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm shadow-primary-600/20 cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting
                  ? editReviewId
                    ? 'Updating...'
                    : 'Submitting...'
                  : editReviewId
                  ? 'Update & Submit Review'
                  : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};
