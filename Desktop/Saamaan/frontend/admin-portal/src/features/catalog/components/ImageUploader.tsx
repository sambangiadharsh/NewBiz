import React, { useState, useRef } from 'react';
import { UploadCloud, Star, Trash2, Loader2, AlertCircle, Video, Film } from 'lucide-react';
import { apiClient } from '../../../lib/axios.js';
import { VariantAssetEntry } from '../../../types/product.js';
import { showSweetToast } from '../../../lib/swal.js';

interface ImageUploaderProps {
  assets: VariantAssetEntry[];
  onChange: (assets: VariantAssetEntry[]) => void;
  maxFiles?: number;
  maxImages?: number;
  maxVideos?: number;
  disabled?: boolean;
  label?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  assets,
  onChange,
  maxFiles,
  maxImages = maxFiles ?? 6,
  maxVideos = 1,
  disabled = false,
  label = 'Variant Media',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageCount = assets.filter((a) => a.assetType !== 'VIDEO').length;
  const videoCount = assets.filter((a) => a.assetType === 'VIDEO').length;

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

  /**
   * Pre-flight image dimension & aspect ratio validation before uploading to save bandwidth
   */
  const validateImagePreflight = (
    file: File
  ): Promise<{ valid: boolean; error?: string; width?: number; height?: number }> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const { width, height } = img;
        if (width < 800 || height < 800) {
          resolve({
            valid: false,
            error: `"${file.name}" resolution is ${width}x${height}px. Minimum required is 800x800px.`,
          });
          return;
        }
        const ratio = width / height;
        if (ratio < 0.5 || ratio > 2.0) {
          resolve({
            valid: false,
            error: `"${file.name}" aspect ratio is ${ratio.toFixed(2)}. Accepted ratio is between 1:2 and 2:1.`,
          });
          return;
        }
        resolve({ valid: true, width, height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Let backend sharp handle validation if client can't decode
        resolve({ valid: true });
      };
      img.src = url;
    });
  };

  const uploadFile = async (
    file: File,
    currentImages: number,
    currentVideos: number
  ): Promise<{ asset: VariantAssetEntry; isVideo: boolean } | null> => {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|quicktime)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);

    if (!isVideo && !isImage) {
      showSweetToast(`"${file.name}" is not a supported image or video format.`, 'warning');
      return null;
    }

    if (isVideo) {
      if (currentVideos >= maxVideos) {
        showSweetToast(`Maximum ${maxVideos} video allowed per variant.`, 'warning');
        return null;
      }
      if (file.size > 50 * 1024 * 1024) {
        showSweetToast(`Video "${file.name}" exceeds 50MB limit.`, 'warning');
        return null;
      }
    } else {
      if (currentImages >= maxImages) {
        showSweetToast(`Maximum ${maxImages} images allowed per variant.`, 'warning');
        return null;
      }
      if (file.size > 10 * 1024 * 1024) {
        showSweetToast(`Image "${file.name}" exceeds 10MB limit.`, 'warning');
        return null;
      }

      // Pre-flight dimension check
      const check = await validateImagePreflight(file);
      if (!check.valid) {
        showSweetToast(check.error || 'Invalid image dimensions', 'warning');
        return null;
      }
    }

    setUploadStatus(`Optimizing & uploading ${file.name}...`);

    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post('/admin/catalog/products/upload-asset', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const data = res.data?.data;
    if (!data?.url) {
      throw new Error('Upload returned invalid response');
    }

    const detectedType = data.assetType || (isVideo ? 'VIDEO' : 'IMAGE');

    const newAsset: VariantAssetEntry = {
      assetUrl: data.url,
      isPrimary: !isVideo && currentImages === 0, // only auto-primary if it's the first image
      displayOrder: assets.length + 1,
      assetType: detectedType,
      altText: file.name.replace(/\.[^/.]+$/, ''),
      _filename: file.name,
      _previewUrl: URL.createObjectURL(file),
    };

    return { asset: newAsset, isVideo };
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;

    setIsUploading(true);
    const newAssets: VariantAssetEntry[] = [];
    let curImages = imageCount;
    let curVideos = videoCount;

    try {
      for (let i = 0; i < files.length; i++) {
        const item = await uploadFile(files[i], curImages, curVideos);
        if (item) {
          newAssets.push(item.asset);
          if (item.isVideo) {
            curVideos++;
          } else {
            curImages++;
          }
        }
      }

      if (newAssets.length > 0) {
        const combined = [...assets, ...newAssets];
        // Ensure there is at least one primary image if images exist
        const hasPrimaryImage = combined.some((a) => a.isPrimary && a.assetType !== 'VIDEO');
        if (!hasPrimaryImage) {
          const firstImg = combined.find((a) => a.assetType !== 'VIDEO');
          if (firstImg) firstImg.isPrimary = true;
        }
        onChange(combined);
        showSweetToast(
          `${newAssets.length} asset${newAssets.length > 1 ? 's' : ''} uploaded and converted to WebP`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Asset upload failed', err);
      showSweetToast(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to upload asset.', 'error');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetPrimary = (index: number) => {
    const target = assets[index];
    if (target.assetType === 'VIDEO') {
      showSweetToast('Videos cannot be designated as primary cover images.', 'info');
      return;
    }
    const updated = assets.map((a, i) => ({
      ...a,
      isPrimary: i === index,
    }));
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const wasPrimary = assets[index]?.isPrimary;
    const updated = assets.filter((_, i) => i !== index);
    // If the removed one was primary, assign primary to the first remaining image
    if (wasPrimary && updated.length > 0) {
      const firstImg = updated.find((a) => a.assetType !== 'VIDEO');
      if (firstImg) firstImg.isPrimary = true;
    }
    onChange(updated);
  };

  const canUploadMore = !disabled && (imageCount < maxImages || videoCount < maxVideos);

  return (
    <div className="space-y-3">
      {/* Media Header Counter */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{label}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {imageCount}/{maxImages} Images
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            {videoCount}/{maxVideos} Video
          </span>
        </div>
        <span className="text-slate-400 text-[11px]">Primary image is shown on cards</span>
      </div>

      {/* Drag & Drop Upload Zone */}
      {canUploadMore && (
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
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-1.5 text-xs text-indigo-600 font-medium py-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span>{uploadStatus || 'Optimizing & converting asset...'}</span>
              <span className="text-[10px] text-slate-400">Converting images to high-efficiency WebP</span>
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
              <p className="text-[10px] text-slate-400">
                Images (JPEG, PNG, WebP ≤ 10MB, min 800×800) • Video (MP4, WebM ≤ 50MB, max 1)
              </p>
            </>
          )}
        </div>
      )}

      {/* Media Grid */}
      {assets.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
          {assets.map((asset, idx) => {
            const isVideo = asset.assetType === 'VIDEO' || /\.(mp4|webm|mov|quicktime)$/i.test(asset.assetUrl);
            const fullUrl =
              asset._previewUrl ||
              getFullAssetUrl(
                asset.assetUrl || (asset as any).url || (asset as any).AssetURL
              );

            return (
              <div
                key={idx}
                className={`group relative rounded-xl overflow-hidden border transition-all aspect-square bg-slate-900 flex items-center justify-center ${
                  asset.isPrimary
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200'
                }`}
              >
                {isVideo ? (
                  <div className="relative w-full h-full bg-slate-900 flex flex-col items-center justify-center p-2 text-center">
                    <video
                      src={fullUrl}
                      className="w-full h-full object-cover opacity-75"
                      muted
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        // Keep on first frame
                        (e.target as HTMLVideoElement).currentTime = 0.1;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                        <Film className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="absolute top-1.5 left-1.5 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 z-10">
                      <Video className="w-2.5 h-2.5" />
                      Video
                    </div>
                  </div>
                ) : (
                  <>
                    <img
                      src={fullUrl}
                      alt={asset.altText || `Asset ${idx + 1}`}
                      className="w-full h-full object-cover bg-white"
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
                  </>
                )}

                {/* Hover Overlay Controls */}
                {!disabled && (
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1 z-20">
                    {!isVideo && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetPrimary(idx);
                        }}
                        title={asset.isPrimary ? 'Primary Image' : 'Set as Primary'}
                        className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
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
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(idx);
                      }}
                      title="Remove Asset"
                      className="p-1.5 rounded-lg bg-red-500/90 text-white hover:bg-red-600 text-xs transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assets.length === 0 && !isUploading && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200/60">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>At least one product image is required for catalog display.</span>
        </div>
      )}
    </div>
  );
};
