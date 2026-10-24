import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FolderPlus,
  Edit3,
  Loader2,
  AlertCircle,
  Upload,
  Trash2,
  Image as ImageIcon,
  Home,
  Coffee,
  Compass,
  Laptop,
  Shirt,
  Sparkles,
  Package,
  Layers,
  Utensils,
  Tv,
  BookOpen,
  Heart,
  Camera,
  Watch,
  Headphones,
  Car,
  Smartphone,
  ShoppingBag,
  Dumbbell,
  Baby,
  Footprints,
  Flame,
  Shield,
  Gift,
  HelpCircle,
  Check,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface CategoryItem {
  categoryId: number;
  categoryName: string;
  categoryCode?: string;
  parentCategoryId?: number | null;
  description?: string;
  iconUrl?: string;
  imageUrl?: string;
  status: string;
}

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCategory?: CategoryItem | null;
  allCategories: CategoryItem[];
}

// Visual icon dictionary for interactive root/department icon selection
export const POPULAR_CATEGORY_ICONS = [
  { name: 'Home', icon: Home, label: 'Home & Living' },
  { name: 'Coffee', icon: Coffee, label: 'Kitchen & Dining' },
  { name: 'Compass', icon: Compass, label: 'Travel & Luggage' },
  { name: 'Laptop', icon: Laptop, label: 'Electronics & Computers' },
  { name: 'Smartphone', icon: Smartphone, label: 'Mobiles & Tech' },
  { name: 'Shirt', icon: Shirt, label: 'Fashion & Apparel' },
  { name: 'Footprints', icon: Footprints, label: 'Footwear & Shoes' },
  { name: 'Watch', icon: Watch, label: 'Watches & Jewelry' },
  { name: 'Headphones', icon: Headphones, label: 'Audio & Music' },
  { name: 'Camera', icon: Camera, label: 'Photography & Gear' },
  { name: 'Tv', icon: Tv, label: 'Appliances & Screens' },
  { name: 'Utensils', icon: Utensils, label: 'Dining & Tableware' },
  { name: 'Dumbbell', icon: Dumbbell, label: 'Sports & Fitness' },
  { name: 'Heart', icon: Heart, label: 'Beauty & Wellness' },
  { name: 'Baby', icon: Baby, label: 'Baby & Kids' },
  { name: 'BookOpen', icon: BookOpen, label: 'Books & Stationery' },
  { name: 'Package', icon: Package, label: 'Groceries & Essentials' },
  { name: 'ShoppingBag', icon: ShoppingBag, label: 'Bags & Accessories' },
  { name: 'Car', icon: Car, label: 'Automotive & Motors' },
  { name: 'Flame', icon: Flame, label: 'Deals & Clearance' },
  { name: 'Gift', icon: Gift, label: 'Gifts & Festive' },
  { name: 'Sparkles', icon: Sparkles, label: 'Curated Premium' },
  { name: 'Shield', icon: Shield, label: 'Security & Safety' },
  { name: 'Layers', icon: Layers, label: 'General Catalog' },
];

// Helper to render dynamic icon preview
export const DynamicCategoryIcon: React.FC<{ iconName?: string; className?: string }> = ({
  iconName,
  className = 'w-5 h-5',
}) => {
  if (!iconName) return <Layers className={className} />;

  // Check if it's an image/svg url
  if (iconName.startsWith('http://') || iconName.startsWith('https://') || iconName.startsWith('/')) {
    const baseUrl = (apiClient.defaults.baseURL || 'http://localhost:7000/api/v1').replace('/api/v1', '');
    const fullUrl = iconName.startsWith('/') ? `${baseUrl}${iconName}` : iconName;
    return <img src={fullUrl} alt="Category Icon" className={`${className} object-contain`} />;
  }

  const match = POPULAR_CATEGORY_ICONS.find(
    (i) => i.name.toLowerCase() === iconName.trim().toLowerCase()
  );

  if (match) {
    const IconComponent = match.icon;
    return <IconComponent className={className} />;
  }

  return <Layers className={className} />;
};

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingCategory,
  allCategories,
}) => {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'VISUALS'>('DETAILS');

  // Form Fields
  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Visual Asset Fields (Image & Icon)
  const [imageUrl, setImageUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');

  // Upload states for Cover Banner and Theme Icon
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [iconUploadError, setIconUploadError] = useState<string | null>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRootCategory = !parentCategoryId;

  useEffect(() => {
    if (editingCategory) {
      setCategoryName(editingCategory.categoryName || '');
      setCategoryCode(editingCategory.categoryCode || '');
      setParentCategoryId(editingCategory.parentCategoryId ? String(editingCategory.parentCategoryId) : '');
      setDescription(editingCategory.description || '');
      setStatus((editingCategory.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE');
      setImageUrl(editingCategory.imageUrl || '');
      setIconUrl(editingCategory.iconUrl || '');
    } else {
      setCategoryName('');
      setCategoryCode('');
      setParentCategoryId('');
      setDescription('');
      setStatus('ACTIVE');
      setImageUrl('');
      setIconUrl('');
    }
    setActiveTab('DETAILS');
    setError(null);
    setCoverUploadError(null);
    setIconUploadError(null);
  }, [editingCategory, isOpen]);

  if (!isOpen) return null;

  // Handle direct file upload to backend for cover image or icon
  const handleFileUpload = async (file: File, type: 'cover' | 'icon') => {
    if (!file.type.startsWith('image/') && !file.type.includes('svg')) {
      const msg = 'Please select a valid image/SVG file (PNG, JPG, WEBP, SVG).';
      if (type === 'cover') setCoverUploadError(msg);
      else setIconUploadError(msg);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      const msg = 'File size exceeds 10MB limit.';
      if (type === 'cover') setCoverUploadError(msg);
      else setIconUploadError(msg);
      return;
    }

    if (type === 'cover') {
      setIsUploadingCover(true);
      setCoverUploadError(null);
    } else {
      setIsUploadingIcon(true);
      setIconUploadError(null);
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiClient.post('/admin/categories/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data?.success && res.data.data?.url) {
        if (type === 'cover') {
          setImageUrl(res.data.data.url);
        } else {
          setIconUrl(res.data.data.url);
        }
      } else {
        const msg = res.data?.message || 'Failed to upload asset.';
        if (type === 'cover') setCoverUploadError(msg);
        else setIconUploadError(msg);
      }
    } catch (err: any) {
      console.error('Category asset upload failed:', err);
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to upload asset. Please try again or paste a direct URL.';
      if (type === 'cover') setCoverUploadError(msg);
      else setIconUploadError(msg);
    } finally {
      if (type === 'cover') setIsUploadingCover(false);
      else setIsUploadingIcon(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setError('Category name is required.');
      setActiveTab('DETAILS');
      return;
    }
    if (!categoryCode.trim()) {
      setError('Category code is required (e.g. DRO, APP, FD).');
      setActiveTab('DETAILS');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        categoryName: categoryName.trim(),
        categoryCode: categoryCode.trim().toUpperCase(),
        parentCategoryId: parentCategoryId ? parseInt(parentCategoryId, 10) : null,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        status,
      };

      if (editingCategory) {
        await apiClient.put(`/admin/categories/${editingCategory.categoryId}`, payload);
      } else {
        await apiClient.post('/admin/categories', payload);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  // Prevent circular parent selection
  const validParentCategories = allCategories.filter(
    (c) => !editingCategory || c.categoryId !== editingCategory.categoryId
  );

  // Formatted image URL for preview
  const getPreviewImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
      const baseUrl = (apiClient.defaults.baseURL || 'http://localhost:7000/api/v1').replace('/api/v1', '');
      return `${baseUrl}${url}`;
    }
    return url;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-3xl lg:max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Pinned Sticky Header */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              {editingCategory ? <Edit3 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <p className="text-xs text-slate-500">
                {isRootCategory
                  ? 'Top-level root department with cover visual & theme icon'
                  : 'Subcategory taxonomy node & catalog classification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pinned Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 sm:px-8 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('DETAILS')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'DETAILS'
                ? 'border-indigo-600 text-indigo-600 bg-white/70'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            <span>Category Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VISUALS')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'VISUALS'
                ? 'border-indigo-600 text-indigo-600 bg-white/70'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Storefront Visuals (Cover & Icon)</span>
            {(imageUrl || iconUrl) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </button>
        </div>

        {/* Form Container with Internal Scroll and Pinned Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          
          {/* Scrollable Center Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6 space-y-6">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: DETAILS */}
            {activeTab === 'DETAILS' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g. Home, Kitchen, Travel, Electronics"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Category Code (SKU Prefix) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={categoryCode}
                      onChange={(e) => setCategoryCode(e.target.value.toUpperCase())}
                      placeholder="e.g. HOM, KIT, TRV, ELE"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      ParentSKU format: <code className="font-bold">BRD-{categoryCode || 'CAT'}-000001</code>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Storefront Visibility Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="ACTIVE">ACTIVE (Visible in Storefront)</option>
                      <option value="INACTIVE">INACTIVE (Hidden)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parent Category
                  </label>
                  <select
                    value={parentCategoryId}
                    onChange={(e) => setParentCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="">None (Top-Level / Root Department)</option>
                    {validParentCategories.map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>
                        {c.categoryName} ({c.categoryCode || 'No code'})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>
                      {isRootCategory
                        ? 'This is a Root Category. Cover banner and icon will appear directly in customer navigation and curated pills.'
                        : 'This is a Subcategory nested beneath the selected parent.'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide a concise description of products encompassed by this category..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Callout to Visual Assets */}
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950">Storefront Visual Identity</h4>
                      <p className="text-[11px] text-indigo-700">
                        {imageUrl || iconUrl
                          ? `Configured: ${iconUrl ? 'Custom Icon' : 'Default Icon'} • ${imageUrl ? 'Custom Banner' : 'Default Banner'}`
                          : 'Configure custom cover banner and custom SVG/PNG icon'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('VISUALS')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    Configure Visuals →
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: STOREFRONT VISUALS (COVER BANNER & ICON ASSETS) */}
            {activeTab === 'VISUALS' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                
                {/* 1. REAL-TIME STOREFRONT PREVIEW HERO */}
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white shadow-md relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Live Storefront Preview
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10 text-slate-300">
                      Customer View Simulation
                    </span>
                  </div>

                  <div className="relative rounded-xl overflow-hidden aspect-[21/9] sm:aspect-[24/9] bg-slate-800 border border-slate-700/60 flex items-center justify-center">
                    {imageUrl ? (
                      <img
                        src={getPreviewImageUrl(imageUrl)}
                        alt="Storefront Cover Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80';
                        }}
                      />
                    ) : (
                      <div className="text-center p-4 text-slate-400">
                        <ImageIcon className="w-7 h-7 mx-auto mb-1 text-slate-500 opacity-60" />
                        <p className="text-xs font-semibold text-slate-300">No Cover Banner Configured</p>
                        <p className="text-[10px] text-slate-400">Upload or paste an image URL below</p>
                      </div>
                    )}

                    {/* Gradient Overlay & Badge */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none" />
                    
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white/95 text-slate-900 flex items-center justify-center shadow-lg shrink-0 p-1.5 border border-white/40">
                          <DynamicCategoryIcon iconName={iconUrl} className="w-6 h-6 object-contain" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-sm text-white truncate drop-shadow block leading-tight">
                            {categoryName || 'Category Name'}
                          </span>
                          <span className="text-[10px] text-slate-300 font-mono">
                            {categoryCode ? `Prefix: ${categoryCode}` : 'Root Department'}
                          </span>
                        </div>
                      </div>

                      {imageUrl && iconUrl && (
                        <span className="text-[10px] bg-emerald-500/90 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
                          <Check className="w-3 h-3" /> Fully Configured
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. COVER BANNER UPLOAD & URL SECTION */}
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                        <label className="text-xs font-bold text-slate-900">
                          Category Cover Banner
                        </label>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        High-resolution hero banner for storefront collections, category cards, and catalog headers.
                      </p>
                    </div>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Banner</span>
                      </button>
                    )}
                  </div>

                  {coverUploadError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{coverUploadError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Drag-drop upload */}
                    <div
                      onClick={() => coverFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-3.5 text-center cursor-pointer transition-colors bg-white hover:bg-indigo-50/20 flex flex-col items-center justify-center min-h-[90px]"
                    >
                      <input
                        type="file"
                        ref={coverFileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'cover');
                        }}
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        className="hidden"
                      />
                      {isUploadingCover ? (
                        <div className="flex flex-col items-center text-indigo-600">
                          <Loader2 className="w-5 h-5 animate-spin mb-1" />
                          <span className="text-xs font-bold">Uploading banner...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-indigo-600 mb-1" />
                          <span className="text-xs font-bold text-slate-800">
                            Upload Banner Image
                          </span>
                          <span className="text-[10px] text-slate-400">
                            PNG, JPG or WEBP (Max 10MB)
                          </span>
                        </>
                      )}
                    </div>

                    {/* Direct URL */}
                    <div className="flex flex-col justify-center">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Or Paste Direct Banner Image URL:
                      </label>
                      <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://your-cdn.com/banners/category.jpg"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-1">
                        Hosted on S3, Cloudinary, or external CDN
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. CATEGORY THEME ICON (SVG / PNG / MINI BADGE) */}
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                        <label className="text-xs font-bold text-slate-900">
                          Category Theme Icon (SVG / PNG or URL)
                        </label>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Brand logo or vector symbol displayed in category navigation pills, drawer menus, and mobile tabs.
                      </p>
                    </div>
                    {iconUrl && (
                      <button
                        type="button"
                        onClick={() => setIconUrl('')}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Icon</span>
                      </button>
                    )}
                  </div>

                  {iconUploadError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{iconUploadError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-center">
                    {/* Left: 1:1 Live Icon Preview Tile */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center p-2 shrink-0 shadow-2xs relative">
                        <DynamicCategoryIcon iconName={iconUrl} className="w-9 h-9 object-contain" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                          Icon Preview
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate block">
                          {iconUrl ? (iconUrl.startsWith('http') || iconUrl.startsWith('/') ? 'Custom Image Icon' : iconUrl) : 'Default Icon'}
                        </span>
                        <span className="text-[10px] text-slate-400">1:1 Square Aspect</span>
                      </div>
                    </div>

                    {/* Middle: Upload Icon File */}
                    <div
                      onClick={() => iconFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-3 text-center cursor-pointer transition-colors bg-white hover:bg-indigo-50/20 flex flex-col items-center justify-center h-full min-h-[70px]"
                    >
                      <input
                        type="file"
                        ref={iconFileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'icon');
                        }}
                        accept="image/svg+xml,image/png,image/webp,image/jpeg"
                        className="hidden"
                      />
                      {isUploadingIcon ? (
                        <div className="flex flex-col items-center text-indigo-600">
                          <Loader2 className="w-4 h-4 animate-spin mb-1" />
                          <span className="text-[11px] font-bold">Uploading icon...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-indigo-600 mb-0.5" />
                          <span className="text-xs font-bold text-slate-800">
                            Upload SVG / PNG Icon
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Transparent vector recommended
                          </span>
                        </>
                      )}
                    </div>

                    {/* Right: Direct Icon URL */}
                    <div className="flex flex-col justify-center">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Or Paste Icon Image / SVG URL:
                      </label>
                      <input
                        type="text"
                        value={iconUrl}
                        onChange={(e) => setIconUrl(e.target.value)}
                        placeholder="https://.../icon.svg or 'Home'"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-1">
                        Direct URL or standard name fallback
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Pinned Sticky Footer Actions */}
          <div className="px-6 py-3.5 sm:px-8 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              {isRootCategory ? (
                <span className="inline-flex items-center gap-1.5 text-indigo-700 font-semibold bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Root Department (Storefront Homepage)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-lg">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Subcategory Node
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || isUploadingCover || isUploadingIcon}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <span>{editingCategory ? 'Save & Update Category' : 'Create Category'}</span>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
