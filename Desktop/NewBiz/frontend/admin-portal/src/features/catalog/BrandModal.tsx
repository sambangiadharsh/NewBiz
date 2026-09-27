import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Star,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

export interface BrandItem {
  brandId: number;
  brandName: string;
  brandCode?: string | null;
  manufacturer?: string | null;
  description?: string | null;
  imageURL?: string | null;
  imageUrl?: string | null;
  isFeatured: boolean;
  displayOrder?: number;
  status: 'ACTIVE' | 'INACTIVE';
  productsCount?: number;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    ProductMaster: number;
  };
}

interface BrandModalProps {
  brand?: BrandItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BrandModal: React.FC<BrandModalProps> = ({
  brand,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(brand);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brandName, setBrandName] = useState(brand?.brandName || '');
  const [brandCode, setBrandCode] = useState(brand?.brandCode || '');
  const [manufacturer, setManufacturer] = useState(brand?.manufacturer || '');
  const [description, setDescription] = useState(brand?.description || '');
  const [imageURL, setImageURL] = useState(brand?.imageURL || '');
  const [isFeatured, setIsFeatured] = useState<boolean>(brand?.isFeatured ?? false);
  const [displayOrder, setDisplayOrder] = useState<number>(brand?.displayOrder ?? 0);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(brand?.status || 'ACTIVE');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (brand) {
      setBrandName(brand.brandName || '');
      setBrandCode(brand.brandCode || '');
      setManufacturer(brand.manufacturer || '');
      setDescription(brand.description || '');
      setImageURL(brand.imageURL || '');
      setIsFeatured(brand.isFeatured ?? false);
      setDisplayOrder(brand.displayOrder ?? 0);
      setStatus(brand.status || 'ACTIVE');
    }
  }, [brand]);

  // Handle image file upload to backend
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files (PNG, JPG, WEBP, SVG) are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size exceeds 5MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiClient.post('/admin/brands/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data?.success && res.data.data?.url) {
        setImageURL(res.data.data.url);
      } else {
        setUploadError(res.data?.message || 'Failed to upload image.');
      }
    } catch (err: any) {
      console.error('Image upload failed:', err);
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
    if (!brandName.trim()) {
      setError('Brand Name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      brandName: brandName.trim(),
      brandCode: brandCode.trim() ? brandCode.trim().toUpperCase() : null,
      manufacturer: manufacturer.trim() || null,
      description: description.trim() || null,
      imageURL: imageURL.trim() || null,
      isFeatured,
      displayOrder: Number(displayOrder) || 0,
      status,
    };

    try {
      if (isEdit && brand) {
        await apiClient.put(`/admin/brands/${brand.brandId}`, payload);
      } else {
        await apiClient.post('/admin/brands', payload);
      }
      onSuccess();
    } catch (err: any) {
      console.error('Submit brand failed:', err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to save brand. Please check the values and try again.'
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
    // Relative path served by backend
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return `${apiBase.replace(/\/api\/v1\/?$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl my-8 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {isEdit ? 'Edit Brand' : 'Create New Brand'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? `Update details, logo, and featured status for ${brand?.brandName}`
                  : 'Add a new brand catalog entry with display image and status'}
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

            {/* Brand Logo Upload Section */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Brand Display Logo / Image
              </label>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Upload Zone */}
                <div className="md:col-span-8">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                        : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50 bg-slate-50/30'
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
                          Uploading image to server...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 py-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="text-xs">
                          <span className="font-semibold text-indigo-600 hover:underline">
                            Click to upload
                          </span>{' '}
                          or drag and drop
                        </div>
                        <p className="text-[11px] text-slate-400">
                          PNG, JPG, WEBP, or SVG (Max 5MB)
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

                  {/* Manual URL Input Option */}
                  <div className="mt-3">
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                      Or paste an external Image URL
                    </label>
                    <input
                      type="text"
                      value={imageURL}
                      onChange={(e) => setImageURL(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Preview Box */}
                <div className="md:col-span-4 flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Live Preview
                  </span>
                  <div className="w-32 h-32 rounded-xl border border-slate-200 bg-white shadow-inner flex flex-col items-center justify-center relative overflow-hidden group">
                    {imageURL ? (
                      <>
                        <img
                          src={getFullImageUrl(imageURL)}
                          alt="Brand Preview"
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://placehold.co/150x150?text=No+Image';
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageURL('');
                          }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-700"
                          title="Remove Image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-slate-300 gap-1 p-2 text-center">
                        <ImageIcon className="w-8 h-8 stroke-1" />
                        <span className="text-[10px] text-slate-400">No logo uploaded</span>
                      </div>
                    )}
                  </div>
                  {imageURL && (
                    <span className="text-[10px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Image attached
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Brand Name & Brand Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Brand Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Sony, Nike, Bosch"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Brand Code <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={brandCode}
                  onChange={(e) => setBrandCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SONY, NIKE, BOSCH"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase"
                />
              </div>
            </div>

            {/* Manufacturer */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Manufacturer / Parent Entity{' '}
                <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g. Sony Group Corporation"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand Description / Overview{' '}
                <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a brief description or marketing highlight for this brand..."
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Settings: isFeatured, Display Order, and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Featured Brand Toggle */}
              <div
                onClick={() => setIsFeatured(!isFeatured)}
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer select-none transition-all ${
                  isFeatured
                    ? 'border-amber-300 bg-amber-50/60 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isFeatured
                        ? 'bg-amber-400 text-amber-950 shadow-sm'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <Star className={`w-5 h-5 ${isFeatured ? 'fill-amber-950' : ''}`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Featured Brand</h4>
                    <p className="text-[11px] text-slate-500">
                      Display on customer homepage & hero carousels
                    </p>
                  </div>
                </div>

                {/* Switch toggle */}
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    isFeatured ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isFeatured ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Display Order */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Priority / Order
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Sorting order in storefront carousels (lower appears first)
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
                  <span className="text-[11px] text-slate-400">
                    (Default: 0 for normal, 1, 2, 3...)
                  </span>
                </div>
              </div>

              {/* Status Select */}
              <div className="md:col-span-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Catalog Status
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Controls whether this brand is active in product catalog selections
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="ACTIVE"
                      checked={status === 'ACTIVE'}
                      onChange={() => setStatus('ACTIVE')}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      Active
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="INACTIVE"
                      checked={status === 'INACTIVE'}
                      onChange={() => setStatus('INACTIVE')}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                      Inactive
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isUploading}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-sm shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Brand Changes' : 'Create Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
