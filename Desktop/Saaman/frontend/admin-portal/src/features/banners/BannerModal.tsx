import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Loader2,
  Calendar,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

export interface BannerItem {
  bannerId: string | number;
  title?: string | null;
  description?: string | null;
  imageUrl: string;
  imageURL?: string;
  placement: string;
  displayOrder: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export const BANNER_PLACEMENTS = [
  {
    value: 'HERO_CAROUSEL',
    label: 'Hero Carousel',
    aspect: 'aspect-[21/9] md:aspect-[3/1]',
    recommendedSize: '1920 × 600px',
    description: 'Main homepage hero carousel slider',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    value: 'HOME_MIDDLE',
    label: 'Home Middle Strip',
    aspect: 'aspect-[4/1]',
    recommendedSize: '1200 × 300px',
    description: 'Promotional strip between product grids',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'HOME_BOTTOM',
    label: 'Home Footer Strip',
    aspect: 'aspect-[5/1]',
    recommendedSize: '1200 × 240px',
    description: 'Footer promotional call-to-action strip',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'CATEGORY_HEADER',
    label: 'Category Header',
    aspect: 'aspect-[5/1]',
    recommendedSize: '1200 × 240px',
    description: 'Banner displayed atop category listings',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  {
    value: 'SIDEBAR_PROMO',
    label: 'Sidebar Card',
    aspect: 'aspect-square',
    recommendedSize: '600 × 600px',
    description: 'Compact advertisement card in sidebars',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
];

interface BannerModalProps {
  banner?: BannerItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BannerModal: React.FC<BannerModalProps> = ({
  banner,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(banner);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(banner?.title || '');
  const [description, setDescription] = useState(banner?.description || '');
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl || banner?.imageURL || '');
  const [placement, setPlacement] = useState(banner?.placement || 'HERO_CAROUSEL');
  const [displayOrder, setDisplayOrder] = useState<number>(banner?.displayOrder ?? 0);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'DRAFT'>(banner?.status || 'ACTIVE');

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState<boolean>(
    Boolean(banner?.startAt || banner?.endAt)
  );
  const [startAt, setStartAt] = useState<string>(
    banner?.startAt ? banner.startAt.slice(0, 16) : ''
  );
  const [endAt, setEndAt] = useState<string>(
    banner?.endAt ? banner.endAt.slice(0, 16) : ''
  );

  // Upload and submit states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (banner) {
      setTitle(banner.title || '');
      setDescription(banner.description || '');
      setImageUrl(banner.imageUrl || banner.imageURL || '');
      setPlacement(banner.placement || 'HERO_CAROUSEL');
      setDisplayOrder(banner.displayOrder ?? 0);
      setStatus(banner.status || 'ACTIVE');
      const hasDates = Boolean(banner.startAt || banner.endAt);
      setIsScheduled(hasDates);
      setStartAt(banner.startAt ? banner.startAt.slice(0, 16) : '');
      setEndAt(banner.endAt ? banner.endAt.slice(0, 16) : '');
    }
  }, [banner]);

  // Image Upload Handler
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files (PNG, JPG, WEBP, GIF, SVG) are allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size exceeds 10MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiClient.post('/admin/banners/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data?.success && res.data.data?.url) {
        setImageUrl(res.data.data.url);
      } else {
        setUploadError(res.data?.message || 'Failed to upload image.');
      }
    } catch (err: any) {
      console.error('Banner image upload failed:', err);
      setUploadError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to upload image. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      setError('Banner image is required.');
      return;
    }

    if (isScheduled && startAt && endAt && new Date(startAt) > new Date(endAt)) {
      setError('Start schedule date cannot be after End schedule date.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      title: title.trim() || null,
      description: description.trim() || null,
      imageUrl: imageUrl.trim(),
      imageURL: imageUrl.trim(),
      placement,
      displayOrder: Number(displayOrder) || 0,
      status,
      startAt: isScheduled && startAt ? new Date(startAt).toISOString() : null,
      endAt: isScheduled && endAt ? new Date(endAt).toISOString() : null,
    };

    try {
      if (isEdit && banner) {
        await apiClient.put(`/admin/banners/${banner.bannerId}`, payload);
      } else {
        await apiClient.post('/admin/banners', payload);
      }
      onSuccess();
    } catch (err: any) {
      console.error('Submit banner failed:', err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to save banner. Please check the values and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to format full image URL for preview
  const getFullImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:7000';
    return `${apiBase.replace(/\/api\/v1\/?$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const currentPlacementConfig =
    BANNER_PLACEMENTS.find((p) => p.value === placement) || BANNER_PLACEMENTS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl my-8 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {isEdit ? 'Edit Promotional Banner' : 'Create New Banner'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? `Update placement, graphics, and campaign schedule for banner #${banner?.bannerId}`
                  : 'Upload banner graphics, select storefront placement slot, and configure schedule'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {/* Banner Placement Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Storefront Placement Slot <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {BANNER_PLACEMENTS.map((p) => {
                  const isSelected = placement === p.value;
                  return (
                    <div
                      key={p.value}
                      onClick={() => setPlacement(p.value)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{p.label}</span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                            ✓
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{p.description}</p>
                      <span className="inline-block mt-2 text-[10px] font-mono text-slate-400">
                        Size: {p.recommendedSize}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Banner Graphic Upload & Live Preview */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Banner Graphic Image <span className="text-rose-500">*</span>
              </label>

              {/* Upload Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-indigo-400 bg-slate-50/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileInputChange}
                  className="hidden"
                />

                {isUploading ? (
                  <div className="py-4 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <span className="text-xs font-medium text-slate-600">
                      Uploading banner graphic to server...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold text-indigo-600 hover:underline">
                        Click to upload
                      </span>{' '}
                      or drag and drop banner file
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Recommended for {currentPlacementConfig.label}: {currentPlacementConfig.recommendedSize} (Max 10MB)
                    </p>
                  </div>
                )}
              </div>

              {uploadError && (
                <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {uploadError}
                </p>
              )}

              {/* External Image URL input fallback */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-500">
                    Graphic Resource Path / Image URL
                  </label>
                  {imageUrl && (
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Graphic attached
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste URL or upload image above (e.g. /uploads/banner-images/... or https://...)"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Live Aspect Ratio Preview Box */}
              {imageUrl && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      Live Storefront Simulation ({currentPlacementConfig.label})
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Graphic
                    </button>
                  </div>
                  <div
                    className={`relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center ${currentPlacementConfig.aspect}`}
                  >
                    <img
                      src={getFullImageUrl(imageUrl)}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://placehold.co/1200x400?text=Invalid+Image+URL';
                      }}
                    />
                    {(title || description) && (
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent p-6 flex flex-col justify-center text-white">
                        {title && (
                          <h4 className="text-base sm:text-xl font-black tracking-tight drop-shadow-md">
                            {title}
                          </h4>
                        )}
                        {description && (
                          <p className="text-xs sm:text-sm text-slate-200 max-w-md mt-1 drop-shadow-sm">
                            {description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Title & Description (Copy / Overlay) */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Banner Title <span className="text-slate-400 font-normal">(Optional Display Heading)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer Mega Electronics Festival"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Banner Subtitle / Description{' '}
                  <span className="text-slate-400 font-normal">(Optional Marketing Subtext)</span>
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Up to 40% OFF on premium headphones, watches, and accessories."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* Display Order and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Display Order */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Sequence / Order
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Order of appearance in carousel or slot (lower numbers show first, 0 = top)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 font-mono">0, 1, 2, 3...</span>
                </div>
              </div>

              {/* Status Select */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Banner Status
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="ACTIVE"
                      checked={status === 'ACTIVE'}
                      onChange={() => setStatus('ACTIVE')}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      Active
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="DRAFT"
                      checked={status === 'DRAFT'}
                      onChange={() => setStatus('DRAFT')}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      Draft
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="INACTIVE"
                      checked={status === 'INACTIVE'}
                      onChange={() => setStatus('INACTIVE')}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                      Inactive
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Campaign Scheduling (StartAt & EndAt) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Campaign Schedule (Auto-Expiry)
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!isScheduled}
                    onChange={(e) => setIsScheduled(!e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Always Live (No schedule limit)</span>
                </label>
              </div>

              {isScheduled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Go-Live Date & Time (StartAt)
                    </label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Auto-Expire Date & Time (EndAt)
                    </label>
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isUploading}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-sm shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Banner Changes' : 'Create Banner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
