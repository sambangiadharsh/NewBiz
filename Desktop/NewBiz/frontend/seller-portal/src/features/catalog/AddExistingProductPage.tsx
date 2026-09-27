import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Tag,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Sparkles,
  Barcode,
  Package,
  Check,
  RotateCcw,
  ChevronDown,
  X,
  FileCheck2,
  Clock,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { ApiResponse } from '../../types/auth.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';

interface VariantAttribute {
  attributeName: string;
  attributeValue: string;
}

interface CatalogVariant {
  productVariantId: string;
  variantSku: string;
  gtin?: string;
  productModelCode?: string;
  hsnCode?: string;
  gstRate?: number;
  alreadyListed: boolean;
  primaryImage?: string;
  attributes: VariantAttribute[];
}

interface CatalogProduct {
  productId: string;
  parentSku: string;
  productName: string;
  description?: string;
  brand?: { brandId: string; brandName: string; brandCode?: string };
  category?: { categoryId: string; categoryName: string; categoryCode?: string };
  isSellerAuthorized: boolean;
  isCategoryPendingApproval?: boolean;
  variants: CatalogVariant[];
}

interface CategoryOption {
  categoryId: number;
  categoryName: string;
  isLeaf?: boolean;
}

interface BrandOption {
  brandId: string;
  brandName: string;
}

const getImagePreviewUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const AddExistingProductPage: React.FC = () => {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Selected variant for pricing entry
  const [selectedVariant, setSelectedVariant] = useState<{
    product: CatalogProduct;
    variant: CatalogVariant;
  } | null>(null);

  // Commercial form state
  const [sellerSku, setSellerSku] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Category Application Modal State
  const [applyModalData, setApplyModalData] = useState<{
    categoryId: string;
    categoryName: string;
    productName: string;
  } | null>(null);
  const [categoryDocs, setCategoryDocs] = useState<Array<{
    displayName: string;
    code: string;
    isMandatory: boolean;
  }>>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [applyRemarks, setApplyRemarks] = useState('');
  const [isSubmittingApply, setIsSubmittingApply] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Reusable Pagination integration
  const { paginatedData: paginatedResults, paginationProps } = usePagination({
    data: results,
    initialPageSize: 8,
    pageSizeOptions: [8, 16, 32],
  });

  // Load categories & brands for filter dropdowns with correct normalization
  useEffect(() => {
    apiClient
      .get<ApiResponse<any>>('/categories')
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          const items: CategoryOption[] = res.data.data
            .map((c: any) => ({
              categoryId: Number(c.categoryId ?? c.CategoryID),
              categoryName: String(c.categoryName ?? c.CategoryName),
              isLeaf: Boolean(c.isLeaf),
            }))
            .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
          setCategories(items);
        }
      })
      .catch((err) => {
        console.error('Failed to load categories:', err);
      });

    apiClient
      .get<ApiResponse<any>>('/catalog/brands')
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          const items: BrandOption[] = res.data.data
            .map((b: any) => ({
              brandId: String(b.brandId ?? b.BrandID),
              brandName: String(b.brandName ?? b.BrandName),
            }))
            .sort((a, b) => a.brandName.localeCompare(b.brandName));
          setBrands(items);
        }
      })
      .catch((err) => {
        console.error('Failed to load brands:', err);
      });
  }, []);

  // Execute catalog search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await apiClient.get<ApiResponse<{ items: CatalogProduct[] }>>(
        '/seller/catalog/search',
        {
          params: {
            q: query.trim() || undefined,
            categoryId: categoryId || undefined,
            brandId: brandId || undefined,
          },
        }
      );

      if (res.data.success && res.data.data) {
        setResults(res.data.data.items);
      }
    } catch (err: any) {
      console.error('Catalog search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and debounced search on input changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, categoryId, brandId]);

  const handleSelectVariantForListing = (product: CatalogProduct, variant: CatalogVariant) => {
    setSelectedVariant({ product, variant });
    setSellerSku(`${product.brand?.brandCode || 'SKU'}-${variant.variantSku.split('-').slice(-2).join('-')}-${Date.now().toString().slice(-4)}`);
    setMrp('');
    setSellingPrice('');
    setPurchasePrice('');
    setSubmitError(null);
    setPublishSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePublishListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;

    const numMrp = parseFloat(mrp);
    const numSelling = parseFloat(sellingPrice);
    const numPurchase = parseFloat(purchasePrice);

    if (numSelling > numMrp) {
      setSubmitError('Selling Price cannot exceed Maximum Retail Price (MRP)');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiClient.post<ApiResponse<any>>('/seller/catalog/products', {
        productVariantId: selectedVariant.variant.productVariantId,
        sellerSku: sellerSku.trim(),
        mrp: numMrp,
        sellingPrice: numSelling,
        purchasePrice: numPurchase,
      });

      if (res.data.success) {
        setPublishSuccess(`Variant ${selectedVariant.variant.variantSku} successfully listed under ${sellerSku}!`);
        // Update local results so that this variant displays as alreadyListed
        setResults((prev) =>
          prev.map((p) => {
            if (p.productId === selectedVariant.product.productId) {
              return {
                ...p,
                variants: p.variants.map((v) =>
                  v.productVariantId === selectedVariant.variant.productVariantId
                    ? { ...v, alreadyListed: true }
                    : v
                ),
              };
            }
            return p;
          })
        );
        setSelectedVariant(null);
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error?.message || 'Failed to create commercial listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenApplyModal = (product: CatalogProduct) => {
    if (!product.category?.categoryId) return;
    const catId = product.category.categoryId;
    setApplyModalData({
      categoryId: catId,
      categoryName: product.category.categoryName || 'Product Category',
      productName: product.productName,
    });
    setApplyRemarks('');
    setApplyError(null);
    setLoadingDocs(true);

    apiClient
      .get<ApiResponse<any>>(`/categories/${catId}/documents`)
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setCategoryDocs(res.data.data);
        } else {
          setCategoryDocs([]);
        }
      })
      .catch(() => {
        setCategoryDocs([]);
      })
      .finally(() => {
        setLoadingDocs(false);
      });
  };

  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyModalData) return;

    setIsSubmittingApply(true);
    setApplyError(null);

    try {
      const res = await apiClient.post<ApiResponse<any>>(
        `/seller/catalog/categories/${applyModalData.categoryId}/apply`,
        {
          remarks: applyRemarks.trim() || undefined,
        }
      );

      if (res.data.success) {
        setPublishSuccess(res.data.message || `Application for "${applyModalData.categoryName}" submitted! Marketplace QC team will review your authorization.`);
        // Mark all products in this category as pending approval locally
        setResults((prev) =>
          prev.map((p) =>
            p.category?.categoryId === applyModalData.categoryId
              ? { ...p, isCategoryPendingApproval: true }
              : p
          )
        );
        setApplyModalData(null);
      }
    } catch (err: any) {
      setApplyError(err.response?.data?.error?.message || 'Failed to submit category application');
    } finally {
      setIsSubmittingApply(false);
    }
  };

  const sellNum = parseFloat(sellingPrice) || 0;
  const purNum = parseFloat(purchasePrice) || 0;
  const profitMargin = sellNum > 0 ? (((sellNum - purNum) / sellNum) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-8 pb-20">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7E2532] mb-2">
            <Link to="/products" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Products & Pricing
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-stone-600">Add Existing Product</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#221C1E] flex items-center gap-3">
            <span>Sell an Existing Marketplace Product</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
              Zero QC Delay
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-3xl">
            Search pre-approved central catalog items by Product Name, Brand, GTIN barcode, or Model code.
            Set your commercial pricing and start selling immediately with zero catalog delay.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/products/propose')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[#E8E1D7] hover:border-[#641D26] hover:text-[#641D26] text-stone-700 font-bold text-xs shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-[#7E2532]" />
            <span>Propose New Product</span>
          </button>
          <button
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-all"
          >
            <Package className="w-4 h-4" />
            <span>My Listings</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {publishSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3 text-emerald-800">
            <div className="w-8 h-8 rounded-full bg-emerald-200/70 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-bold">{publishSuccess}</p>
              <p className="text-[11px] text-emerald-600">The product is now active in your commercial catalog.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/products')}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all"
            >
              View in My Listings
            </button>
            <button
              onClick={() => setPublishSuccess(null)}
              className="px-3 py-1.5 rounded-xl text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Commercial Terms Entry Card (when a variant is selected) */}
      {selectedVariant && (
        <div className="bg-white border-2 border-[#7E2532]/25 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-900/5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-200 gap-4">
            <div className="flex items-start gap-4">
              {selectedVariant.variant.primaryImage ? (
                <img
                  src={getImagePreviewUrl(selectedVariant.variant.primaryImage)}
                  alt={selectedVariant.product.productName}
                  className="w-16 h-16 rounded-2xl object-cover border border-stone-200 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 font-mono text-xs font-bold shrink-0">
                  <Package className="w-6 h-6 text-stone-400" />
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7E2532] bg-[#FDF2F4] px-2 py-0.5 rounded-md">
                  Step 2: Enter Commercial Terms
                </span>
                <h2 className="text-lg font-bold text-stone-900 mt-1">
                  {selectedVariant.product.productName}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-stone-500 font-mono">
                  <span>Parent SKU: {selectedVariant.product.parentSku}</span>
                  <span>•</span>
                  <span className="text-[#7E2532] font-semibold">
                    Variant SKU: {selectedVariant.variant.variantSku}
                  </span>
                  {selectedVariant.variant.gtin && (
                    <>
                      <span>•</span>
                      <span>GTIN: {selectedVariant.variant.gtin}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedVariant(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 text-xs font-semibold self-start sm:self-center transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Choose Another Variant
            </button>
          </div>

          {submitError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handlePublishListing} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Your Internal Seller SKU *
                </label>
                <input
                  type="text"
                  required
                  value={sellerSku}
                  onChange={(e) => setSellerSku(e.target.value)}
                  placeholder="e.g. SEL-SHIRT-BLU-42"
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Unique reference identifier for your own warehouse, invoices, and accounting.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Variant Attributes Summary
                </label>
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl flex flex-wrap gap-2 min-h-[50px] items-center">
                  {selectedVariant.variant.attributes.length > 0 ? (
                    selectedVariant.variant.attributes.map((a, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 shadow-2xs"
                      >
                        {a.attributeName}: <span className="text-[#7E2532]">{a.attributeValue}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-stone-400">Standard base variant</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Maximum Retail Price (MRP) ₹ *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    placeholder="1299.00"
                    className="w-full pl-8 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all"
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Print price indicated on packaging.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Selling Price ₹ *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="899.00"
                    className="w-full pl-8 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-bold text-[#7E2532] focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all"
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Customer checkout price on marketplace.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Cost / Purchase Price ₹ *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="600.00"
                    className="w-full pl-8 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all"
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Your unit cost for margin tracking.</p>
              </div>
            </div>

            {/* Profit Margin Indicator */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-900">
                <div className="w-8 h-8 rounded-xl bg-amber-200/60 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-amber-800" />
                </div>
                <div>
                  <span className="font-bold block">Estimated Gross Profit Margin</span>
                  <span className="text-[11px] text-amber-700 font-medium">
                    Based on Selling Price ₹{sellNum.toFixed(2)} and Cost ₹{purNum.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-amber-900">{profitMargin}%</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setSelectedVariant(null)}
                className="px-5 py-3 rounded-2xl border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 rounded-2xl bg-gradient-to-r from-[#641D26] to-[#7E2532] hover:from-[#52161E] hover:to-[#641D26] text-white text-xs font-bold shadow-lg shadow-rose-950/20 flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing Listing...</span>
                  </>
                ) : (
                  <>
                    <span>Publish to My Listings</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Card */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className={`w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${query ? 'text-[#7E2532]' : 'text-stone-400'}`} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product name, brand, barcode (GTIN / EAN / UPC), or model code..."
              className={`w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm font-medium transition-all ${
                query
                  ? 'bg-white border-[#7E2532] text-stone-900 ring-2 ring-[#7E2532]/10 shadow-xs'
                  : 'bg-[#FAF8F5] border-[#E0D8CD] hover:border-[#7E2532]/40 text-stone-900 placeholder-stone-400 focus:bg-white focus:ring-2 focus:ring-[#7E2532]/20 focus:border-[#7E2532]'
              }`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter Dropdown with Wine/Burgundy Color Grading */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Tag className={`w-3.5 h-3.5 transition-colors ${categoryId ? 'text-[#7E2532]' : 'text-stone-400'}`} />
              </div>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`pl-9 pr-9 py-3 text-xs font-bold rounded-2xl border transition-all duration-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 ${
                  categoryId
                    ? 'bg-gradient-to-r from-[#FDF2F4] to-[#FAF8F5] border-[#7E2532] text-[#641D26] shadow-sm ring-1 ring-[#7E2532]/20 font-extrabold'
                    : 'bg-[#FAF8F5] border-[#E0D8CD] hover:border-[#7E2532]/50 text-stone-700 hover:bg-white'
                }`}
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName} {!c.isLeaf ? '(Group)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className={`w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${categoryId ? 'text-[#7E2532]' : 'text-stone-400'}`} />
            </div>

            {/* Brand Filter Dropdown with Wine/Burgundy Color Grading */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Sparkles className={`w-3.5 h-3.5 transition-colors ${brandId ? 'text-[#7E2532]' : 'text-stone-400'}`} />
              </div>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className={`pl-9 pr-9 py-3 text-xs font-bold rounded-2xl border transition-all duration-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 ${
                  brandId
                    ? 'bg-gradient-to-r from-[#FDF2F4] to-[#FAF8F5] border-[#7E2532] text-[#641D26] shadow-sm ring-1 ring-[#7E2532]/20 font-extrabold'
                    : 'bg-[#FAF8F5] border-[#E0D8CD] hover:border-[#7E2532]/50 text-stone-700 hover:bg-white'
                }`}
              >
                <option value="">All Brands ({brands.length})</option>
                {brands.map((b) => (
                  <option key={b.brandId} value={b.brandId}>
                    {b.brandName}
                  </option>
                ))}
              </select>
              <ChevronDown className={`w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${brandId ? 'text-[#7E2532]' : 'text-stone-400'}`} />
            </div>

            {(query || categoryId || brandId) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategoryId('');
                  setBrandId('');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-[#7E2532] text-xs font-bold shadow-xs active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-100">
          <div className="flex items-center gap-2">
            <Barcode className="w-3.5 h-3.5 text-stone-400" />
            <span>Search automatically matches Product Name, Parent SKU, Brand, Variant GTIN, and Model Code.</span>
          </div>
          {results.length > 0 && (
            <span className="font-bold text-stone-700">
              Found {results.length} approved product family{results.length === 1 ? '' : 'ies'}
            </span>
          )}
        </div>
      </div>

      {/* Catalog Search Results Grid */}
      <div>
        {isLoading ? (
          <div className="py-24 bg-white rounded-3xl border border-stone-200/80 flex flex-col items-center justify-center gap-3 text-stone-400 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-[#7E2532]" />
            <p className="text-xs font-semibold">Searching verified marketplace catalog...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            {paginatedResults.map((product) => (
              <div
                key={product.productId}
                className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-sm hover:border-stone-300 hover:shadow-md transition-all"
              >
                {/* Product Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-stone-100">
                  <div className="flex items-start gap-4">
                    {product.variants[0]?.primaryImage ? (
                      <img
                        src={getImagePreviewUrl(product.variants[0].primaryImage)}
                        alt={product.productName}
                        className="w-16 h-16 rounded-2xl object-cover border border-stone-200 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 font-bold text-xs shrink-0">
                        NO IMG
                      </div>
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 border border-stone-200">
                          {product.brand?.brandName || 'Brand'}
                        </span>
                        <span className="text-[10px] font-bold text-stone-500">
                          {product.category?.categoryName || 'Category'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-stone-900">{product.productName}</h3>
                      <p className="text-xs font-mono text-stone-400 mt-0.5">
                        Parent SKU: {product.parentSku}
                      </p>
                    </div>
                  </div>

                  {/* Category Authorization Indicator */}
                  {product.isSellerAuthorized ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Category Approved</span>
                    </div>
                  ) : product.isCategoryPendingApproval ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Approval Pending</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold shrink-0">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Category Approval Required</span>
                    </div>
                  )}
                </div>

                {/* Available Variants Section */}
                <div className="pt-4">
                  <span className="text-xs font-bold text-stone-700 block mb-3">
                    Available Pre-Approved Variants ({product.variants.length}):
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {product.variants.map((v) => (
                      <div
                        key={v.productVariantId}
                        className="p-3.5 rounded-2xl border border-stone-100 bg-stone-50/70 hover:bg-stone-50 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-stone-800 truncate">
                            <span>{v.variantSku}</span>
                          </div>
                          {v.gtin && (
                            <p className="text-[10px] font-mono text-stone-400 mt-0.5">
                              GTIN: {v.gtin}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {v.attributes.map((a, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 bg-white border border-stone-200 rounded-md text-stone-600 font-semibold shadow-2xs"
                              >
                                {a.attributeName}: {a.attributeValue}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {v.alreadyListed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded-xl shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            Listed
                          </span>
                        ) : product.isSellerAuthorized ? (
                          <button
                            type="button"
                            onClick={() => handleSelectVariantForListing(product, v)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#7E2532] hover:bg-[#641D26] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Sell this
                          </button>
                        ) : product.isCategoryPendingApproval ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shrink-0">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Under Review
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenApplyModal(product)}
                            className="px-3.5 py-1.5 rounded-xl border border-[#7E2532] bg-rose-50 text-[#7E2532] hover:bg-[#7E2532] hover:text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Apply</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Reusable Pagination for Catalog Products */}
            <div className="bg-white rounded-3xl border border-stone-200/80 overflow-hidden shadow-sm">
              <Pagination
                {...paginationProps}
                itemLabel="approved products"
                themeColor="burgundy"
              />
            </div>
          </div>
        ) : hasSearched ? (
          <div className="py-20 bg-white rounded-3xl border border-stone-200/80 text-center shadow-sm p-8">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-[#7E2532] mx-auto mb-4">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-stone-900">No matching approved catalog products found</h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 mb-6">
              If this brand, product, or variant does not exist on the marketplace yet, you can propose it as a new product family.
            </p>
            <button
              onClick={() => navigate('/products/propose')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold text-xs shadow-md shadow-rose-950/20 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Propose New Product to Central Catalog</span>
            </button>
          </div>
        ) : (
          <div className="py-20 bg-white rounded-3xl border border-stone-200/80 text-center text-stone-400 shadow-sm p-8">
            <Tag className="w-10 h-10 mx-auto mb-3 opacity-50 text-[#7E2532]" />
            <h3 className="text-sm font-bold text-stone-700">Explore Central Catalog</h3>
            <p className="text-xs text-stone-500 mt-1">Type in the search bar above to find catalog items</p>
          </div>
        )}
      </div>

      {/* Category Authorization Application Modal */}
      {applyModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-stone-100 bg-[#FDFBF7] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#641D26] to-[#9E2C3F] flex items-center justify-center text-white shadow-md shadow-rose-950/15">
                  <ShieldCheck className="w-5 h-5 text-rose-100" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Apply for Category Authorization
                  </h3>
                  <p className="text-xs text-stone-500 font-mono">
                    Category: {applyModalData.categoryName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalData(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitApply} className="p-6 space-y-5">
              {applyError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{applyError}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7E2532] block">
                  Product Context
                </span>
                <p className="text-xs font-bold text-stone-800">
                  {applyModalData.productName}
                </p>
                <p className="text-[11px] text-stone-500">
                  Submitting this request notifies the marketplace QC team to authorize your seller account for this category.
                </p>
              </div>

              {/* Required Documents Checklist */}
              <div>
                <span className="text-xs font-bold text-stone-700 block mb-2">
                  Compliance Document Requirements:
                </span>
                {loadingDocs ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-stone-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-[#7E2532]" />
                    <span>Checking document requirements...</span>
                  </div>
                ) : categoryDocs.length > 0 ? (
                  <div className="space-y-2">
                    {categoryDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#7E2532]" />
                          <span className="font-semibold text-stone-800">{doc.displayName}</span>
                        </div>
                        {doc.isMandatory ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                            Required
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                            Optional
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Standard Category — No extra compliance licenses required!</span>
                  </div>
                )}
              </div>

              {/* Remarks or Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Application Remarks / License Details (Optional)
                </label>
                <textarea
                  rows={3}
                  value={applyRemarks}
                  onChange={(e) => setApplyRemarks(e.target.value)}
                  placeholder="e.g. Authorized reseller certificate / Brand NOC on file with KitchenKart..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setApplyModalData(null)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApply}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#641D26] to-[#7E2532] hover:from-[#52161E] hover:to-[#641D26] text-white text-xs font-bold shadow-md shadow-rose-950/20 flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingApply ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Submit Application</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
