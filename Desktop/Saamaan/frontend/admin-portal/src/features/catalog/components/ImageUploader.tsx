import React, { useState, useRef } from 'react';
import { UploadCloud, Star, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../lib/axios.js';
import { VariantAssetEntry } from '../../../types/product.js';
import { showSweetToast } from '../../../lib/swal.js';

interface ImageUploaderProps {
  assets: VariantAssetEntry[];
  onChange: (assets: VariantAssetEntry[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  assets,
  onChange,
  maxFiles = 6,
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFullAssetUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    const url = rawUrl.replace(/\\/g, '/');
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(
      /\/api\/v1\/?$/,
      ''
    );
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showSweetToast('Only image files (JPEG, PNG, WebP) are allowed.', 'warning');
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      showSweetToast(`File "${file.name}" exceeds 5MB limit.`, 'warning');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post('/admin/catalog/products/upload-asset', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const data = res.data?.data;
    if (!data?.url) {
      throw new Error('Upload returned invalid response');
    }

    const newAsset: VariantAssetEntry = {
      assetUrl: data.url,
      isPrimary: assets.length === 0, // auto primary if first
      displayOrder: assets.length + 1,
      assetType: 'IMAGE',
      altText: file.name.replace(/\.[^/.]+$/, ''),
      _filename: file.name,
      _previewUrl: URL.createObjectURL(file),
    };

    return newAsset;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;

    if (assets.length + files.length > maxFiles) {
      showSweetToast(`Maximum ${maxFiles} images allowed per variant.`, 'warning');
      return;
    }

    setIsUploading(true);
    const newAssets: VariantAssetEntry[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const item = await uploadFile(files[i]);
        if (item) newAssets.push(item);
      }

      if (newAssets.length > 0) {
        // If there were no prior assets, ensure first newly uploaded is primary
        const combined = [...assets, ...newAssets];
        if (!combined.some((a) => a.isPrimary) && combined.length > 0) {
          combined[0].isPrimary = true;
        }
        onChange(combined);
        showSweetToast(
          `${newAssets.length} image${newAssets.length > 1 ? 's' : ''} uploaded`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Image upload failed', err);
      showSweetToast(err.response?.data?.message || 'Failed to upload image.', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetPrimary = (index: number) => {
    const updated = assets.map((a, i) => ({
      ...a,
      isPrimary: i === index,
    }));
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const updated = assets.filter((_, i) => i !== index);
    // If the removed one was primary, assign primary to the first remaining
    if (updated.length > 0 && !updated.some((a) => a.isPrimary)) {
      updated[0].isPrimary = true;
    }
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="font-semibold text-slate-800">Variant Media ({assets.length}/{maxFiles})</span>
        <span className="text-slate-400 text-[11px]">Click star to mark primary photo</span>
      </div>

      {/* Drag & Drop Upload Zone */}
      {!disabled && assets.length < maxFiles && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
              : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/70 bg-white'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {isUploading ? (
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading image asset...</span>
            </div>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-indigo-600 hover:underline">Click to upload</span>
                <span className="text-slate-500"> or drag and drop</span>
              </div>
              <p className="text-[10px] text-slate-400">JPEG, PNG, WebP up to 5MB</p>
            </>
          )}
        </div>
      )}

      {/* Image Gallery Grid */}
      {assets.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {assets.map((asset, idx) => (
            <div
              key={idx}
              className={`group relative rounded-xl overflow-hidden border transition-all aspect-square bg-slate-50 flex items-center justify-center ${
                asset.isPrimary
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200'
              }`}
            >
              <img
                src={
                  asset._previewUrl ||
                  getFullAssetUrl(
                    asset.assetUrl || (asset as any).url || (asset as any).AssetURL
                  )
                }
                alt={asset.altText || `Variant asset ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f8fafc"/><path d="M60 125 L90 95 L115 120 L135 100 L160 130 Z" fill="%23cbd5e1"/><circle cx="85" cy="75" r="10" fill="%23cbd5e1"/><text x="50%" y="85%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="%2394a3b8">Asset Preview</text></svg>';
                }}
              />

              {/* Primary Ribbon */}
              {asset.isPrimary && (
                <div className="absolute top-1.5 left-1.5 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 z-10">
                  <Star className="w-2.5 h-2.5 fill-white" />
                  Primary
                </div>
              )}

              {/* Hover Overlay Controls */}
              {!disabled && (
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1 z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetPrimary(idx);
                    }}
                    title={asset.isPrimary ? 'Primary Image' : 'Set as Primary'}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${
                      asset.isPrimary
                        ? 'bg-amber-400 text-slate-900'
                        : 'bg-white/90 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        asset.isPrimary ? 'fill-current' : ''
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(idx);
                    }}
                    title="Remove Photo"
                    className="p-1.5 rounded-lg bg-red-500/90 text-white hover:bg-red-600 text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && !isUploading && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200/60">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>At least one product image is recommended for each variant.</span>
        </div>
      )}
    </div>
  );
};
