import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Store,
  Tag,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  ArrowRight,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { ApiResponse } from '../../types/auth.js';

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

interface AddExistingProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const getImagePreviewUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface CategoryOption {
  categoryId: number;
  categoryName: string;
  isLeaf?: boolean;
}

interface BrandOption {
  brandId: string;
  brandName: string;
}

export const AddExistingProductModal: React.FC<AddExistingProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
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

  // Load categories & brands with normalization
  useEffect(() => {
    if (!isOpen) return;

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
      .catch(() => {});

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
      .catch(() => {});
  }, [isOpen]);

  // Execute global search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setHasSearched(true);
    setSelectedVariant(null);

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
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger search when user types or changes category/brand filter
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      handleSearch();
    }, 350);
    return () => clearTimeout(timer);
  }, [query, categoryId, brandId, isOpen]);

  const handleSelectVariantForListing = (product: CatalogProduct, variant: CatalogVariant) => {
    setSelectedVariant({ product, variant });
    setSellerSku(`${product.brand?.brandCode || 'SKU'}-${variant.variantSku.split('-').slice(-2).join('-')}-${Date.now().toString().slice(-4)}`);
    setMrp('');
    setSellingPrice('');
    setPurchasePrice('');
    setSubmitError(null);
  };

  const handlePublishListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;

    const numMrp = parseFloat(mrp);
    const numSelling = parseFloat(sellingPrice);
    const numPurchase = parseFloat(purchasePrice);

    if (numSelling > numMrp) {
      setSubmitError('Selling Price cannot exceed MRP');
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
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error?.message || 'Failed to create commercial listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Margin calculation
  const sellNum = parseFloat(sellingPrice) || 0;
  const purNum = parseFloat(purchasePrice) || 0;
  const profitMargin = sellNum > 0 ? (((sellNum - purNum) / sellNum) * 100).toFixed(1) : '0';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-stone-100 bg-[#FDFBF7] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#641D26] to-[#9E2C3F] flex items-center justify-center text-white shadow-md shadow-rose-950/15">
              <Store className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Sell an Existing Marketplace Product</h2>
              <p className="text-xs text-stone-500">
                Search verified catalog items by Product name, Brand, GTIN barcode, or Model code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-6 border-b border-stone-100 bg-white space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type product name, brand, barcode (GTIN/EAN), or model code..."
              className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532] transition-all"
            />
          </div>

          {/* Optional Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Filter By:
            </span>

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`text-xs font-bold py-2 px-3 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 ${
                categoryId
                  ? 'bg-rose-50 border-[#7E2532] text-[#641D26] ring-1 ring-[#7E2532]/20'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-[#7E2532]/40'
              }`}
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.categoryName} {!c.isLeaf ? '(Group)' : ''}
                </option>
              ))}
            </select>

            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className={`text-xs font-bold py-2 px-3 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 ${
                brandId
                  ? 'bg-rose-50 border-[#7E2532] text-[#641D26] ring-1 ring-[#7E2532]/20'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-[#7E2532]/40'
              }`}
            >
              <option value="">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b.brandId} value={b.brandId}>
                  {b.brandName}
                </option>
              ))}
            </select>

            {(query || categoryId || brandId) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategoryId('');
                  setBrandId('');
                }}
                className="text-xs font-medium text-rose-700 hover:text-rose-900 underline ml-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Content Area: Search Results or Pricing Form */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-stone-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#7E2532]" />
              <p className="text-xs font-medium">Searching verified marketplace catalog...</p>
            </div>
          ) : selectedVariant ? (
            /* Selected Variant Commercial Terms Form */
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7E2532] bg-[#FDF2F4] px-2 py-0.5 rounded-md">
                    Commercial Terms Entry
                  </span>
                  <h3 className="text-base font-bold text-stone-900 mt-1">
                    {selectedVariant.product.productName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 font-mono">
                    <span>Parent: {selectedVariant.product.parentSku}</span>
                    <span>•</span>
                    <span className="text-[#7E2532] font-semibold">
                      Variant: {selectedVariant.variant.variantSku}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVariant(null)}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800 underline"
                >
                  Change Variant
                </button>
              </div>

              {submitError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handlePublishListing} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Your Seller SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={sellerSku}
                    onChange={(e) => setSellerSku(e.target.value)}
                    placeholder="e.g. MYSTORE-TSHIRT-BLK-M"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532]"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">
                    Your internal reference code for this variant. Must be unique across your listings.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Maximum Retail Price (MRP) ₹ *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value)}
                      placeholder="999.00"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Selling Price ₹ *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="699.00"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Purchase / Cost Price ₹ *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="450.00"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532]"
                    />
                  </div>
                </div>

                {/* Profit Margin Indicator */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2 text-amber-900">
                    <TrendingUp className="w-4 h-4 text-amber-700" />
                    <span>Estimated Gross Profit Margin:</span>
                  </div>
                  <span className="text-sm font-extrabold text-amber-900">
                    {profitMargin}%
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setSelectedVariant(null)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-bold transition-all"
                  >
                    Back to Results
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#641D26] to-[#7E2532] hover:from-[#52161E] hover:to-[#641D26] text-white text-xs font-bold shadow-md shadow-rose-950/20 flex items-center gap-2 transition-all disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Publishing Listing...
                      </>
                    ) : (
                      <>
                        Publish to My Listings
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : results.length > 0 ? (
            /* Results Cards */
            <div className="space-y-4">
              {results.map((product) => (
                <div
                  key={product.productId}
                  className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:border-stone-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-stone-100">
                    <div className="flex items-start gap-4">
                      {product.variants[0]?.primaryImage ? (
                        <img
                          src={getImagePreviewUrl(product.variants[0].primaryImage)}
                          alt={product.productName}
                          className="w-16 h-16 rounded-xl object-cover border border-stone-200 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0 font-bold text-xs">
                          NO IMG
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                            {product.brand?.brandName || 'Brand'}
                          </span>
                          <span className="text-[10px] font-semibold text-stone-500">
                            {product.category?.categoryName || 'Category'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-stone-900">{product.productName}</h4>
                        <p className="text-xs font-mono text-stone-400 mt-0.5">
                          Parent SKU: {product.parentSku}
                        </p>
                      </div>
                    </div>

                    {/* Category Authorization Indicator */}
                    {!product.isSellerAuthorized && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold shrink-0">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Category Approval Required</span>
                      </div>
                    )}
                  </div>

                  {/* Available Variants List */}
                  <div className="pt-4">
                    <span className="text-xs font-bold text-stone-700 block mb-2">
                      Available Variants ({product.variants.length}):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {product.variants.map((v) => (
                        <div
                          key={v.productVariantId}
                          className="p-3 rounded-xl border border-stone-100 bg-stone-50 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-stone-800 truncate">
                              <span>{v.variantSku}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {v.attributes.map((a, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-600 font-medium"
                                >
                                  {a.attributeName}: {a.attributeValue}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Action Button */}
                          {v.alreadyListed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              Listed
                            </span>
                          ) : product.isSellerAuthorized ? (
                            <button
                              type="button"
                              onClick={() => handleSelectVariantForListing(product, v)}
                              className="px-3 py-1.5 rounded-lg bg-[#7E2532] hover:bg-[#641D26] text-white text-xs font-bold shadow-sm flex items-center gap-1 shrink-0 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Sell this
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                window.location.href = '/products/add-existing';
                              }}
                              className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all"
                            >
                              Apply
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">No matching approved products found</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                If this item doesn't exist on the marketplace yet, you can propose it as a new product family.
              </p>
            </div>
          ) : (
            <div className="py-16 text-center text-stone-400">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-medium">Type in the search bar above to find catalog items</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
