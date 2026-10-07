import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Package,
  RefreshCw,
  ExternalLink,
  Eye,
  AlertTriangle,
  X
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';
import { NoResults } from '../../components/common/NoResults.js';

interface VariantAsset {
  assetId: string;
  url: string;
  isPrimary: boolean;
  altText?: string | null;
}

interface VariantAttribute {
  attributeId: string;
  attributeName: string;
  attributeValue: string;
  attributeValueCode?: string;
}

interface VariantUOM {
  uomCode: string;
  uomName: string;
  quantity: number;
}

interface AdminQCVariant {
  productVariantId: string;
  variantSku: string;
  gtin: string | null;
  modelCode: string | null;
  hsnCode?: string | null;
  gstRate?: number | null;
  dimensions?: {
    length: number | null;
    width: number | null;
    height: number | null;
    weight: number | null;
    capacity: number | null;
  };
  assets: VariantAsset[];
  attributes: VariantAttribute[];
  uoms: VariantUOM[];
}

interface AdminQCProduct {
  productId: string;
  parentSku: string;
  productName: string;
  description: string | null;
  highlights?: string[];
  brand: {
    brandId: string;
    brandName: string;
    brandCode?: string;
  } | null;
  category: {
    categoryId: string;
    categoryName: string;
    categoryCode?: string;
  } | null;
  status: 'DRAFT' | 'PENDING_QC' | 'APPROVED' | 'REWORK_REQUIRED' | 'REJECTED';
  rejectionReason?: string | null;
  isVerified: boolean;
  createdAt: string;
  submittedBy?: {
    userId: string;
    name: string;
    email: string;
  } | null;
  assets?: VariantAsset[];
  variants: AdminQCVariant[];
}

export const CatalogQCPage: React.FC = () => {
  const [products, setProducts] = useState<AdminQCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_QC');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<any[]>([]);

  // Selected for review modal
  const [selectedProduct, setSelectedProduct] = useState<AdminQCProduct | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REWORK' | 'REJECT' | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchQCQueue = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (categoryFilter) params.categoryId = categoryFilter;

      const res = await apiClient.get('/admin/catalog/products/qc', { params });
      if (res.data?.success) {
        const raw = res.data.data;
        const items = Array.isArray(raw) ? raw : (raw?.items || []);
        setProducts(items);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('Failed to fetch QC queue', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiClient.get('/categories');
      if (res.data?.success) {
        const raw = res.data.data;
        setCategories(Array.isArray(raw) ? raw : []);
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchQCQueue();
  }, [categoryFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQCQueue();
  };

  const submitReview = async () => {
    if (!selectedProduct || !reviewAction) return;
    if ((reviewAction === 'REWORK' || reviewAction === 'REJECT') && !reviewReason.trim()) {
      setReviewError('Please provide detailed feedback / reason for the seller.');
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewError(null);
      const res = await apiClient.post(`/admin/catalog/products/qc/${selectedProduct.productId}/review`, {
        action: reviewAction,
        reason: reviewReason.trim() || undefined,
      });

      if (res.data?.success) {
        setSelectedProduct(null);
        setReviewAction(null);
        setReviewReason('');
        fetchQCQueue();
      }
    } catch (err: any) {
      setReviewError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to submit catalog review decision.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'PENDING_QC':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending QC
          </span>
        );
      case 'REWORK_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <AlertCircle className="w-3.5 h-3.5" /> Rework Required
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const productList = Array.isArray(products) ? products : [];

  // Client-side pagination
  const { paginatedData: paginatedProducts, paginationProps } = usePagination({
    data: productList,
    initialPageSize: 10,
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Catalog Governance & Quality Control</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Master Product Quality Control
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit proposed master products, verify attribute matrices, and approve SKUs for marketplace-wide listing.
          </p>
        </div>

        <button
          onClick={fetchQCQueue}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* QC Status Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Awaiting QC (Amber) */}
        <div
          onClick={() => setStatusFilter('PENDING_QC')}
          className={`relative overflow-hidden bg-white rounded-2xl border p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'PENDING_QC'
              ? 'border-amber-400 ring-2 ring-amber-400/20'
              : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
              Awaiting QC
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-amber-100/80 shadow-xs flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {productList.filter((p) => p.status === 'PENDING_QC').length}
            </div>
          </div>
        </div>

        {/* Card 2: Approved Masters (Emerald) */}
        <div
          onClick={() => setStatusFilter('APPROVED')}
          className={`relative overflow-hidden bg-white rounded-2xl border p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'APPROVED'
              ? 'border-emerald-400 ring-2 ring-emerald-400/20'
              : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
              Approved Masters
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-emerald-100/80 shadow-xs flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {productList.filter((p) => p.status === 'APPROVED').length}
            </div>
          </div>
        </div>

        {/* Card 3: Rework Dispatched (Purple) */}
        <div
          onClick={() => setStatusFilter('REWORK_REQUIRED')}
          className={`relative overflow-hidden bg-white rounded-2xl border p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'REWORK_REQUIRED'
              ? 'border-purple-400 ring-2 ring-purple-400/20'
              : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-600 rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-purple-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
              Rework Dispatched
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-purple-100/80 shadow-xs flex items-center justify-center text-purple-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {productList.filter((p) => p.status === 'REWORK_REQUIRED').length}
            </div>
          </div>
        </div>

        {/* Card 4: Retired / Rejected (Rose) */}
        <div
          onClick={() => setStatusFilter('REJECTED')}
          className={`relative overflow-hidden bg-white rounded-2xl border p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'REJECTED'
              ? 'border-rose-400 ring-2 ring-rose-400/20'
              : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500 rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-rose-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">
              Retired / Rejected
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-rose-100/80 shadow-xs flex items-center justify-center text-rose-600">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {productList.filter((p) => p.status === 'REJECTED').length}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ParentSKU, VariantSKU, GTIN, Name..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status quick select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_QC">Pending QC</option>
            <option value="APPROVED">Approved</option>
            <option value="REWORK_REQUIRED">Rework Required</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Leaf Categories</option>
            {categories.map((c) => (
              <option key={c.CategoryID || c.categoryId} value={c.CategoryID || c.categoryId}>
                {c.CategoryName || c.categoryName} ({c.CategoryCode || c.categoryCode || ''})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* QC Items Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="inline-block animate-spin text-indigo-600 mb-3">
            <RefreshCw className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium text-slate-500">Loading catalog submissions for review...</p>
        </div>
      ) : productList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <NoResults
            title="No Submissions Found"
            description="There are no product proposals matching the current filter criteria in the catalog quality pipeline."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {paginatedProducts.map((item) => {
              const primaryImage = item.assets?.find((a) => a.isPrimary)?.url || item.assets?.[0]?.url;

            return (
              <div
                key={item.productId}
                className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={item.productName}
                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                        <Package className="w-8 h-8" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.brand && (
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {item.brand.brandName} {item.brand.brandCode ? `(${item.brand.brandCode})` : ''}
                          </span>
                        )}
                        {item.category && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-semibold text-slate-600">
                              {item.category.categoryName} {item.category.categoryCode ? `(${item.category.categoryCode})` : ''}
                            </span>
                          </>
                        )}
                        {item.submittedBy && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs text-slate-500">
                              By: {item.submittedBy.name}
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">{item.productName}</h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                          ParentSKU: {item.parentSku}
                        </span>
                        <span>•</span>
                        <span>Submitted {new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{item.variants?.length || 0} Variants</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(item.status)}
                    <button
                      onClick={() => {
                        setSelectedProduct(item);
                        setReviewAction(null);
                        setReviewReason(item.rejectionReason || '');
                        setReviewError(null);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#5147FF] hover:to-[#6C4BF5] text-white font-semibold text-xs transition-all shadow-md shadow-indigo-500/20"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review Details</span>
                    </button>
                  </div>
                </div>

                {/* Rejection / Rework reason display if any */}
                {item.rejectionReason && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span className="font-bold">Catalog Feedback: </span>
                      <span>{item.rejectionReason}</span>
                    </div>
                  </div>
                )}

                {/* Variant Chips */}
                {item.variants && item.variants.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                    {item.variants.map((v) => {
                      const attrSummary = v.attributes?.map(
                        (a) => `${a.attributeName}: ${a.attributeValue}`
                      ).join(', ');
                      return (
                        <div
                          key={v.productVariantId}
                          className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700"
                        >
                          <span className="font-bold text-slate-900">{v.variantSku}</span>
                          {attrSummary && <span className="text-slate-500 font-sans ml-1">({attrSummary})</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {/* Reusable Pagination Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <Pagination {...paginationProps} itemLabel="catalog proposals" />
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Audit & QC Review: {selectedProduct.parentSku}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedProduct.productName} {selectedProduct.brand ? `• ${selectedProduct.brand.brandName}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1">
              {/* Product Overview Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Brand</span>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {selectedProduct.brand ? `${selectedProduct.brand.brandName} (${selectedProduct.brand.brandCode || 'N/A'})` : 'No Brand'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Leaf Category</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {selectedProduct.category ? `${selectedProduct.category.categoryName} (${selectedProduct.category.categoryCode || 'N/A'})` : 'No Category'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Current Status</span>
                  <div className="mt-1">{getStatusBadge(selectedProduct.status)}</div>
                </div>
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <span className="text-slate-400 font-medium block mb-1">Product Description</span>
                  <p className="text-slate-800 leading-relaxed">{selectedProduct.description}</p>
                </div>
              )}

              {/* Highlights */}
              {selectedProduct.highlights && selectedProduct.highlights.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <span className="text-slate-400 font-medium block mb-2">Key Product Highlights</span>
                  <ul className="space-y-1.5">
                    {selectedProduct.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Assets Gallery */}
              {selectedProduct.assets && selectedProduct.assets.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Submitted Product Assets ({selectedProduct.assets.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedProduct.assets.map((asset, idx) => (
                      <div
                        key={asset.assetId || idx}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square"
                      >
                        <img
                          src={asset.url}
                          alt="Asset"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {asset.isPrimary && (
                          <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                            Primary
                          </span>
                        )}
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Variant Matrix Audit */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Variant Matrix & Specifications ({selectedProduct.variants.length} SKUs)
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Variant SKU</th>
                          <th className="px-4 py-3">Attributes</th>
                          <th className="px-4 py-3">GTIN / EAN</th>
                          <th className="px-4 py-3">Model Code</th>
                          <th className="px-4 py-3">Logistics & Dimensions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium">
                        {selectedProduct.variants.map((v) => {
                          const dim = v.dimensions;
                          return (
                            <tr key={v.productVariantId} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                {v.variantSku}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {v.attributes?.map((attr, idx) => (
                                    <span
                                      key={idx}
                                      className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 text-[11px]"
                                    >
                                      {attr.attributeName}: {attr.attributeValue}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">
                                {v.gtin || <span className="text-slate-400">N/A</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">
                                {v.modelCode || <span className="text-slate-400">N/A</span>}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {dim ? (
                                  <div className="space-y-0.5 text-[11px]">
                                    <div>
                                      Wt: {dim.weight ?? 'N/A'} kg
                                    </div>
                                    <div className="text-slate-400">
                                      Dim: {dim.length ?? '-'}×{dim.width ?? '-'}×{dim.height ?? '-'} cm
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">No dimensions</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Review Decision Form */}
              <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>QC Decision Actions</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewAction('APPROVE')}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      reviewAction === 'APPROVE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Product</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('REWORK')}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      reviewAction === 'REWORK'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                        : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Request Rework</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('REJECT')}
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      reviewAction === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                        : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Permanently</span>
                  </button>
                </div>

                {reviewAction && (
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-bold text-slate-700">
                      {reviewAction === 'APPROVE'
                        ? 'QC Approval Notes (Optional)'
                        : 'Actionable Reason / Specific Missing Info (Required for Seller)'}
                    </label>
                    <textarea
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                      placeholder={
                        reviewAction === 'APPROVE'
                          ? 'Add any internal notes for catalog audit...'
                          : 'Specify which attributes, images, or GTINs need correction...'
                      }
                      rows={3}
                      className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {reviewError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{reviewError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reviewAction || submittingReview}
                onClick={submitReview}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {submittingReview ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Decision...</span>
                  </>
                ) : (
                  <span>Commit QC Decision</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
