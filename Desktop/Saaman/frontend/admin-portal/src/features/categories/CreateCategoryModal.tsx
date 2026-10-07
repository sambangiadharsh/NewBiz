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

export const PRESET_CATEGORY_IMAGES = [
  {
    name: 'Home',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Kitchen',
    url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Travel',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Electronics',
    url: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Fashion',
    url: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Fitness',
    url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
  },
];

// Helper to render dynamic icon preview
export const DynamicCategoryIcon: React.FC<{ iconName?: string; className?: string }> = ({
  iconName,
  className = 'w-5 h-5',
}) => {
  if (!iconName) return <Layers className={className} />;

  // Check if it's an image/svg url
  if (iconName.startsWith('http://') || iconName.startsWith('https://') || iconName.startsWith('/')) {
    return <img src={iconName} alt="Category Icon" className={`${className} object-contain`} />;
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

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setUploadError(null);
  }, [editingCategory, isOpen]);

  if (!isOpen) return null;

  // Handle direct file upload to backend
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPEG, PNG, WEBP).');
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
      const res = await apiClient.post('/admin/categories/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data?.success && res.data.data?.url) {
        setImageUrl(res.data.data.url);
      } else {
        setUploadError(res.data?.message || 'Failed to upload category image.');
      }
    } catch (err: any) {
      console.error('Category image upload failed:', err);
      setUploadError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to upload image. Please try again or paste an image URL.'
      );
    } finally {
      setIsUploading(false);
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              {editingCategory ? <Edit3 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <p className="text-xs text-slate-500">
                {isRootCategory
                  ? 'Top-level root department with cover image & theme icon'
                  : 'Subcategory taxonomy node & compliance requirements'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('DETAILS')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'DETAILS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            <span>Category Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VISUALS')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'VISUALS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Storefront Visuals (Image & Icon)</span>
            {(imageUrl || iconUrl) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                      ? 'This is a Root Category. Cover image and icon will appear directly in customer navigation and curated pills.'
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
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950">Storefront Visual Identity</h4>
                    <p className="text-[11px] text-indigo-700">
                      {imageUrl || iconUrl
                        ? `Configured: ${iconUrl ? `Icon (${iconUrl})` : 'Default icon'} • ${imageUrl ? 'Custom cover' : 'Default cover'}`
                        : 'Configure custom cover image card and theme icon'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('VISUALS')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  Configure Visuals
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: STOREFRONT VISUALS (IMAGE & ICON) */}
          {activeTab === 'VISUALS' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* SECTION A: Category Cover Image */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-900">
                      Root Category Cover Image
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Displayed on storefront homepage category pills, curated collections, and catalog headers.
                    </p>
                  </div>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {uploadError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Preview & Upload Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left: Live Visual Preview Card */}
                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden aspect-[4/3] flex flex-col items-center justify-center group shadow-xs">
                    {imageUrl ? (
                      <>
                        <img
                          src={getPreviewImageUrl(imageUrl)}
                          alt="Category Cover Preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
                        <div className="absolute bottom-3 left-3 right-3 text-white flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white/90 text-slate-900 flex items-center justify-center shadow-xs">
                              <DynamicCategoryIcon iconName={iconUrl} className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-xs truncate drop-shadow">
                              {categoryName || 'Category Name'}
                            </span>
                          </div>
                          <span className="text-[10px] bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full font-medium">
                            Live Preview
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4 text-slate-400">
                        <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">No Cover Image Selected</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Upload a photo or paste a URL below</p>
                      </div>
                    )}
                  </div>

                  {/* Right: File Upload & URL inputs */}
                  <div className="flex flex-col justify-between space-y-3">
                    {/* Drag-drop upload trigger */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-white hover:bg-indigo-50/30 flex-1 flex flex-col items-center justify-center"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                      />
                      {isUploading ? (
                        <div className="flex flex-col items-center text-indigo-600">
                          <Loader2 className="w-6 h-6 animate-spin mb-1.5" />
                          <span className="text-xs font-bold">Uploading file...</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                            <Upload className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            Upload Cover Photo
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            PNG, JPG or WEBP (Max 10MB)
                          </span>
                        </>
                      )}
                    </div>

                    {/* Direct Image URL input */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Or Paste Direct Image URL:
                      </label>
                      <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    Quick Sample Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_CATEGORY_IMAGES.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setImageUrl(preset.url)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          imageUrl === preset.url
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION B: Category Theme Icon */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-900">
                      Root Category Theme Icon
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Pick a modern Lucide icon displayed in navigation, pills, and department badges.
                    </p>
                  </div>
                  {iconUrl && (
                    <button
                      type="button"
                      onClick={() => setIconUrl('')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                    >
                      Reset to default
                    </button>
                  )}
                </div>

                {/* Selected Icon Status Banner */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                      <DynamicCategoryIcon iconName={iconUrl} className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                        Active Selection
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {iconUrl || 'Layers (Default)'}
                      </span>
                    </div>
                  </div>

                  {/* Custom icon name input */}
                  <div className="w-48">
                    <input
                      type="text"
                      value={iconUrl}
                      onChange={(e) => setIconUrl(e.target.value)}
                      placeholder="Custom icon name..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Icon Grid Selector */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
                  {POPULAR_CATEGORY_ICONS.map((item) => {
                    const IconComponent = item.icon;
                    const isSelected = iconUrl.toLowerCase() === item.name.toLowerCase();
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setIconUrl(item.name)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600'
                        }`}
                        title={item.label}
                      >
                        <IconComponent className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-semibold truncate w-full text-center">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              {isRootCategory ? (
                <span className="text-indigo-600 font-semibold">★ Configuring Top-Level Root Department</span>
              ) : (
                <span>Configuring Subcategory</span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || isUploading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
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
