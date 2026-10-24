import React, { useState, useEffect, useMemo } from 'react';
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
  X,
  Check,
  Layers,
  Tag,
  LayoutGrid,
  LayoutList,
  ZoomIn,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';
import { NoResults } from '../../components/common/NoResults.js';
import { showSweetToast } from '../../lib/swal.js';
import {
  TableContainer,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../../components/common/table/index.js';

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
  variantModelCode?: string | null;
  dimensions?: {
    length: number | null;
    width: number | null;
    height: number | null;
    weight: number | null;
    netWeight?: number | null;
    grossWeight?: number | null;
    shippingWeight?: number | null;
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
  baseModelCode?: string | null;
  hsnCode?: string | null;
  gstRate?: number | null;
  countryOfOrigin?: string | null;
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

const REWORK_PRESETS = [
  'Missing high-resolution pure white background primary image (minimum 1000x1000px).',
  'HSN Code or GST Rate is incorrect or incomplete for this product category.',
  'Missing key technical specifications (dimensions, materials, or care instructions).',
  'Variant SKU or GTIN barcode number format is invalid or duplicate.',
  'Product title does not follow brand naming standard [Brand + Model + Key Feature].',
  'Submitted images contain watermarks, promotional text, or non-product graphics.',
];

export const CatalogQCPage: React.FC = () => {
  const [products, setProducts] = useState<AdminQCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_QC');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('TABLE');
  const [qcCounts, setQcCounts] = useState<{
    pendingQC: number;
    approved: number;
    reworkRequired: number;
    rejected: number;
  }>({
    pendingQC: 0,
    approved: 0,
    reworkRequired: 0,
    rejected: 0,
  });

  // Selected for review modal / drawer
  const [selectedProduct, setSelectedProduct] = useState<AdminQCProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('ALL');
  const [activeAssetUrl, setActiveAssetUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Review decision states
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REWORK_REQUIRED' | 'REJECT' | null>(null);
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
        const items = Array.isArray(raw) ? raw : raw?.items || [];
        setProducts(items);

        if (raw?.counts) {
          setQcCounts({
            pendingQC: Number(raw.counts.pendingQC || 0),
            approved: Number(raw.counts.approved || 0),
            reworkRequired: Number(raw.counts.reworkRequired || 0),
            rejected: Number(raw.counts.rejected || 0),
          });
        } else {
          // Fallback if backend counts not available
          setQcCounts({
            pendingQC: items.filter((p: any) => p.status === 'PENDING_QC').length,
            approved: items.filter((p: any) => p.status === 'APPROVED').length,
            reworkRequired: items.filter((p: any) => p.status === 'REWORK_REQUIRED').length,
            rejected: items.filter((p: any) => p.status === 'REJECTED').length,
          });
        }
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch QC queue', err);
      showSweetToast(err.response?.data?.error?.message || 'Failed to load catalog QC proposals', 'error');
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

  const handleOpenReview = (item: AdminQCProduct) => {
    setSelectedProduct(item);
    setSelectedVariantId('ALL');
    setReviewAction(null);
    setReviewReason(item.rejectionReason || '');
    setReviewError(null);
    const initialImg = item.assets?.find((a) => a.isPrimary)?.url || item.assets?.[0]?.url || null;
    setActiveAssetUrl(initialImg);
  };

  const submitReview = async () => {
    if (!selectedProduct || !reviewAction) return;

    if (
      (reviewAction === 'REWORK_REQUIRED' || reviewAction === 'REJECT') &&
      (!reviewReason.trim() || reviewReason.trim().length < 3)
    ) {
      setReviewError('Please provide detailed, actionable feedback for the seller (minimum 3 characters).');
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewError(null);

      const res = await apiClient.post(
        `/admin/catalog/products/qc/${selectedProduct.productId}/review`,
        {
          action: reviewAction,
          remarks: reviewReason.trim() || undefined,
          reason: reviewReason.trim() || undefined,
        }
      );

      if (res.data?.success) {
        const actionLabel =
          reviewAction === 'APPROVE'
            ? 'approved and published'
            : reviewAction === 'REWORK_REQUIRED'
            ? 'returned for rework'
            : 'rejected';

        showSweetToast(`Product "${selectedProduct.productName}" ${actionLabel} successfully`, 'success');
        setSelectedProduct(null);
        setReviewAction(null);
        setReviewReason('');
        fetchQCQueue();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to submit catalog review decision.';
      setReviewError(msg);
      showSweetToast(msg, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Approved
          </span>
        );
      case 'PENDING_QC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> Pending QC
          </span>
        );
      case 'REWORK_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <AlertCircle className="w-3 h-3 text-purple-600" /> Rework Required
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const productList = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  // Client-side pagination
  const { paginatedData: paginatedProducts, paginationProps } = usePagination({
    data: productList,
    initialPageSize: 10,
  });

  // Assets filtered by selected variant inside review modal
  const modalAssets = useMemo(() => {
    if (!selectedProduct) return [];
    if (selectedVariantId === 'ALL') {
      return selectedProduct.assets && selectedProduct.assets.length > 0
        ? selectedProduct.assets
        : selectedProduct.variants.flatMap((v) => v.assets || []);
    }
    const variant = selectedProduct.variants.find((v) => v.productVariantId === selectedVariantId);
    return variant?.assets || [];
  }, [selectedProduct, selectedVariantId]);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Catalog Governance & Quality Control</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Master Product Quality Control
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium max-w-2xl">
            Audit proposed master products, verify attribute matrices, ensure image quality compliance, and approve SKUs for marketplace-wide availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchQCQueue}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs shadow-xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* ── Metric Stat Cards (Read-only Enterprise Overview) ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending QC */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs transition-shadow hover:shadow-sm cursor-default select-text">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Awaiting QC
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/80">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
              {qcCounts.pendingQC}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
              Action Required
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-medium">
            Proposals awaiting admin verification
          </p>
        </div>

        {/* Card 2: Approved */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs transition-shadow hover:shadow-sm cursor-default select-text">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Approved
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
              {qcCounts.approved}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Marketplace Live
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-medium">
            Verified master catalog products
          </p>
        </div>

        {/* Card 3: Rework Required */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs transition-shadow hover:shadow-sm cursor-default select-text">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rework Required
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
              {qcCounts.reworkRequired}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
              With Sellers
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-medium">
            Returned for catalog or asset revisions
          </p>
        </div>

        {/* Card 4: Rejected */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs transition-shadow hover:shadow-sm cursor-default select-text">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rejected
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/80">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
              {qcCounts.rejected}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
              Declined
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-medium">
            Non-compliant or duplicate proposals
          </p>
        </div>
      </div>

      {/* ── Search & Filter Toolset ────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, GTIN, Name, Brand..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 placeholder-slate-400"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses ({productList.length})</option>
              <option value="PENDING_QC">Pending QC ({qcCounts.pendingQC})</option>
              <option value="APPROVED">Approved ({qcCounts.approved})</option>
              <option value="REWORK_REQUIRED">Rework Required ({qcCounts.reworkRequired})</option>
              <option value="REJECTED">Rejected ({qcCounts.rejected})</option>
            </select>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[200px] truncate"
          >
            <option value="">All Leaf Categories</option>
            {categories.map((c) => (
              <option key={c.CategoryID || c.categoryId} value={c.CategoryID || c.categoryId}>
                {c.CategoryName || c.categoryName}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'GRID' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Cards view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── QC Items Presentation ──────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Loading catalog proposals...</h3>
          <p className="text-xs text-slate-400">Fetching proposals, asset matrices, and compliance records.</p>
        </div>
      ) : productList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
          <NoResults />
        </div>
      ) : viewMode === 'TABLE' ? (
        /* ── ENTERPRISE TABLE VIEW ── */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <TableContainer maxHeight="650px">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 border-b border-slate-200">
                  <TableHead className="w-20">Media</TableHead>
                  <TableHead>Product Master</TableHead>
                  <TableHead>Brand & Taxonomy</TableHead>
                  <TableHead>Variants / SKUs</TableHead>
                  <TableHead>Tax & Compliance</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((item) => {
                  const primaryImage =
                    item.assets?.find((a) => a.isPrimary)?.url ||
                    item.assets?.[0]?.url ||
                    item.variants?.[0]?.assets?.[0]?.url;

                  const totalAssetCount =
                    (item.assets?.length || 0) +
                    item.variants.reduce((sum, v) => sum + (v.assets?.length || 0), 0);

                  return (
                    <TableRow key={item.productId} className="hover:bg-slate-50/70 transition-colors">
                      {/* Media Thumbnail */}
                      <TableCell>
                        <div className="relative w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                          {primaryImage ? (
                            <img
                              src={primaryImage}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                          {totalAssetCount > 0 && (
                            <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                              {totalAssetCount}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Product Name & SKU */}
                      <TableCell>
                        <div className="space-y-1 max-w-xs">
                          <span className="font-bold text-slate-900 text-xs block truncate hover:text-indigo-600 transition-colors">
                            {item.productName}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-700 border border-slate-200">
                              {item.parentSku}
                            </span>
                            {item.baseModelCode && (
                              <span className="text-slate-400">Mod: {item.baseModelCode}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Brand & Category */}
                      <TableCell>
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {item.brand?.brandName || 'Generic / Unbranded'}
                          </span>
                          <span className="text-slate-500 text-[11px] block truncate max-w-[160px]">
                            {item.category?.categoryName || 'Unassigned Category'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Variants */}
                      <TableCell>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800">
                            {item.variants?.length || 0} Variant{(item.variants?.length || 0) === 1 ? '' : 's'}
                          </span>
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {(item.variants || []).slice(0, 2).map((v) => (
                              <span
                                key={v.productVariantId}
                                className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200"
                              >
                                {v.variantSku}
                              </span>
                            ))}
                            {(item.variants?.length || 0) > 2 && (
                              <span className="text-[10px] text-slate-400 font-bold self-center">
                                +{(item.variants?.length || 0) - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Tax & Compliance */}
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <div className="text-[11px] text-slate-600 font-medium">
                            HSN: <strong className="font-mono text-slate-900">{item.hsnCode || 'N/A'}</strong>
                          </div>
                          <div className="text-[11px] text-slate-600 font-medium">
                            GST: <strong className="text-slate-900">{item.gstRate !== null ? `${item.gstRate}%` : 'N/A'}</strong>
                          </div>
                        </div>
                      </TableCell>

                      {/* Submitted By */}
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <span className="font-semibold text-slate-800 block">
                            {item.submittedBy?.name || 'Seller'}
                          </span>
                          <span className="text-slate-400 text-[11px] block">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>{getStatusBadge(item.status)}</TableCell>

                      {/* Action */}
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Audit & Review</span>
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <div className="border-t border-slate-200 p-3">
            <Pagination {...paginationProps} itemLabel="catalog proposals" />
          </div>
        </div>
      ) : (
        /* ── GRID CARDS VIEW ── */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedProducts.map((item) => {
              const primaryImage =
                item.assets?.find((a) => a.isPrimary)?.url ||
                item.assets?.[0]?.url ||
                item.variants?.[0]?.assets?.[0]?.url;

              return (
                <div
                  key={item.productId}
                  className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                        {primaryImage ? (
                          <img
                            src={primaryImage}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-slate-300" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100 uppercase truncate">
                            {item.brand?.brandName || 'Brand'}
                          </span>
                          {getStatusBadge(item.status)}
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 truncate" title={item.productName}>
                          {item.productName}
                        </h4>
                        <span className="font-mono text-[11px] text-slate-400 block truncate">
                          {item.parentSku}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600 border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Category:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                          {item.category?.categoryName || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Variants:</span>
                        <span className="font-bold text-slate-800">{item.variants?.length || 0} SKUs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">HSN / GST:</span>
                        <span className="font-mono text-slate-800">
                          {item.hsnCode || 'N/A'} ({item.gstRate ?? 0}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenReview(item)}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Audit Proposal</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-3">
            <Pagination {...paginationProps} itemLabel="catalog proposals" />
          </div>
        </div>
      )}

      {/* ── ENTERPRISE QC AUDIT & REVIEW STUDIO (2-COLUMN DIALOG) ── */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* 1. Modal Top Ribbon */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                      {selectedProduct.parentSku}
                    </span>
                    {getStatusBadge(selectedProduct.status)}
                    {selectedProduct.brand && (
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        {selectedProduct.brand.brandName}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-900 truncate mt-0.5">
                    {selectedProduct.productName}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/catalog/edit/${selectedProduct.productId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                  title="Open in full catalog editing studio"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Catalog Editor</span>
                </a>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. Modal Body: 2-Column Enterprise Split */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 table-scrollbar">
              {/* ── LEFT COLUMN: Product Dossier & Media Stage (7 Cols) ── */}
              <div className="lg:col-span-7 p-6 space-y-6 overflow-y-auto table-scrollbar">
                {/* A. Interactive Media Showcase */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Product Visual Media Stage ({modalAssets.length})
                      </h4>
                    </div>

                    {/* Filter assets by variant */}
                    {selectedProduct.variants && selectedProduct.variants.length > 1 && (
                      <select
                        value={selectedVariantId}
                        onChange={(e) => {
                          setSelectedVariantId(e.target.value);
                          const targetVariant = selectedProduct.variants.find(
                            (v) => v.productVariantId === e.target.value
                          );
                          const newPrimary =
                            targetVariant?.assets?.[0]?.url || selectedProduct.assets?.[0]?.url || null;
                          setActiveAssetUrl(newPrimary);
                        }}
                        className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-semibold focus:outline-none"
                      >
                        <option value="ALL">All Product Media</option>
                        {selectedProduct.variants.map((v) => (
                          <option key={v.productVariantId} value={v.productVariantId}>
                            {v.variantSku} ({v.assets?.length || 0} photos)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Primary Image Viewer */}
                  {activeAssetUrl ? (
                    <div className="relative group bg-white rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center aspect-video max-h-[280px]">
                      <img
                        src={activeAssetUrl}
                        alt="Primary Asset"
                        className="w-full h-full object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setLightboxOpen(true)}
                          className="p-2.5 bg-white text-slate-900 rounded-xl shadow-lg hover:scale-105 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <ZoomIn className="w-4 h-4" />
                          <span>Full Lightbox</span>
                        </button>
                        <a
                          href={activeAssetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 bg-white text-slate-900 rounded-xl shadow-lg hover:scale-105 transition-all text-xs font-bold flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Raw URL</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                      <Package className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600">No media assets submitted</p>
                      <p className="text-[11px] text-slate-400">
                        This proposal does not have visual assets attached. Consider requesting rework from the seller.
                      </p>
                    </div>
                  )}

                  {/* Filmstrip thumbnails */}
                  {modalAssets.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 table-scrollbar">
                      {modalAssets.map((asset, idx) => {
                        const isSelected = activeAssetUrl === asset.url;
                        return (
                          <button
                            key={asset.assetId || idx}
                            type="button"
                            onClick={() => setActiveAssetUrl(asset.url)}
                            className={`relative w-16 h-16 rounded-xl border overflow-hidden shrink-0 transition-all cursor-pointer bg-white ${
                              isSelected
                                ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-105'
                                : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={asset.url}
                              alt={asset.altText || 'Thumbnail'}
                              className="w-full h-full object-cover"
                            />
                            {asset.isPrimary && (
                              <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[8px] font-black px-1 rounded">
                                P
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* B. Metadata & Compliance Dossier */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold block uppercase">Brand</span>
                    <span className="font-bold text-slate-900 mt-0.5 block truncate">
                      {selectedProduct.brand?.brandName || 'Unbranded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold block uppercase">Tax (HSN)</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                      {selectedProduct.hsnCode || 'Missing'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold block uppercase">GST Bracket</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {selectedProduct.gstRate !== null && selectedProduct.gstRate !== undefined
                        ? `${selectedProduct.gstRate}%`
                        : 'Missing'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold block uppercase">Origin</span>
                    <span className="font-bold text-slate-900 mt-0.5 block truncate">
                      {selectedProduct.countryOfOrigin || 'India'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold block uppercase">Category</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                      {selectedProduct.category?.categoryName || 'General'}
                    </span>
                  </div>
                </div>

                {/* C. Highlights & Description */}
                {selectedProduct.highlights && selectedProduct.highlights.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Key Features & Highlights ({selectedProduct.highlights.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedProduct.highlights.map((h, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{h}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProduct.description && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      Product Description
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {selectedProduct.description}
                    </p>
                  </div>
                )}

                {/* D. Variant Matrix & Physical Specifications */}
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        Variant Matrix & Technical Specifications ({selectedProduct.variants.length} SKUs)
                      </h4>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                      <TableContainer maxHeight="260px">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                              <TableHead>SKU</TableHead>
                              <TableHead>Attributes</TableHead>
                              <TableHead>GTIN / Barcode</TableHead>
                              <TableHead>Dimensions & Weight</TableHead>
                              <TableHead>Photos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedProduct.variants.map((v) => (
                              <TableRow key={v.productVariantId} className="text-xs hover:bg-slate-50/60">
                                <TableCell className="font-mono font-bold text-slate-900">
                                  {v.variantSku}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {(v.attributes || []).map((attr, aIdx) => (
                                      <span
                                        key={aIdx}
                                        className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[10px] font-semibold text-indigo-700"
                                      >
                                        {attr.attributeName}: <strong>{attr.attributeValue}</strong>
                                      </span>
                                    ))}
                                    {(!v.attributes || v.attributes.length === 0) && (
                                      <span className="text-slate-400 italic">No custom specs</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-slate-600 text-[11px]">
                                  {v.gtin || <span className="text-slate-400">None</span>}
                                </TableCell>
                                <TableCell className="text-[11px] text-slate-600">
                                  {v.dimensions?.netWeight ?? v.dimensions?.weight
                                    ? (Number(v.dimensions?.netWeight ?? v.dimensions?.weight) < 1
                                        ? `${Math.round(Number(v.dimensions?.netWeight ?? v.dimensions?.weight) * 1000)} g`
                                        : `${v.dimensions?.netWeight ?? v.dimensions?.weight} kg`)
                                    : '-'}
                                  {v.dimensions?.grossWeight && ` • Gross: ${Number(v.dimensions.grossWeight) < 1 ? `${Math.round(Number(v.dimensions.grossWeight) * 1000)} g` : `${v.dimensions.grossWeight} kg`}`}
                                  {v.dimensions?.length && ` • ${v.dimensions.length}×${v.dimensions.width}×${v.dimensions.height} cm`}
                                </TableCell>
                                <TableCell>
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                                    {v.assets?.length || 0}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* ── RIGHT COLUMN: Decision Console & Compliance Engine (5 Cols) ── */}
              <div className="lg:col-span-5 p-6 space-y-6 bg-slate-50/50 flex flex-col justify-between">
                <div className="space-y-6">
                  {/* A. Automated Pre-Flight Compliance Checks */}
                  <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                      Automated Pre-Flight Audit
                    </span>

                    <div className="space-y-2 text-xs">
                      {/* Check 1: Primary Asset */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                        <span className="text-slate-700">Primary Product Asset</span>
                        {modalAssets.length > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Pass ({modalAssets.length})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Missing
                          </span>
                        )}
                      </div>

                      {/* Check 2: Brand Assigned */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                        <span className="text-slate-700">Brand Authorization</span>
                        {selectedProduct.brand ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {selectedProduct.brand.brandName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Unbranded
                          </span>
                        )}
                      </div>

                      {/* Check 3: HSN & GST */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                        <span className="text-slate-700">Tax Matrix (HSN / GST)</span>
                        {selectedProduct.hsnCode && selectedProduct.gstRate !== null ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Incomplete
                          </span>
                        )}
                      </div>

                      {/* Check 4: Variants configured */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                        <span className="text-slate-700">Sellable SKU Matrix</span>
                        {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Pass ({selectedProduct.variants.length} SKUs)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> 0 Variants
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* B. Decision Actions (3 Major Cards) */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                      Select QC Decision
                    </span>

                    <div className="grid grid-cols-1 gap-2.5">
                      {/* 1. APPROVE */}
                      <button
                        type="button"
                        onClick={() => {
                          setReviewAction('APPROVE');
                          setReviewError(null);
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          reviewAction === 'APPROVE'
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">Approve & Publish Master</span>
                            <span className="text-[11px] text-slate-500">Makes SKUs live for sellers to list inventory</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reviewAction === 'APPROVE' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                          {reviewAction === 'APPROVE' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </button>

                      {/* 2. REWORK REQUIRED */}
                      <button
                        type="button"
                        onClick={() => {
                          setReviewAction('REWORK_REQUIRED');
                          setReviewError(null);
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          reviewAction === 'REWORK_REQUIRED'
                            ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20'
                            : 'bg-white border-slate-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">Request Seller Rework</span>
                            <span className="text-[11px] text-slate-500">Sends proposal back to seller with correction notes</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reviewAction === 'REWORK_REQUIRED' ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'}`}>
                          {reviewAction === 'REWORK_REQUIRED' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </button>

                      {/* 3. REJECT */}
                      <button
                        type="button"
                        onClick={() => {
                          setReviewAction('REJECT');
                          setReviewError(null);
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          reviewAction === 'REJECT'
                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20'
                            : 'bg-white border-slate-200 hover:border-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                            <XCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">Reject Proposal Permanently</span>
                            <span className="text-[11px] text-slate-500">Declines proposal due to policy violations</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reviewAction === 'REJECT' ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300'}`}>
                          {reviewAction === 'REJECT' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* C. Quick-Fill Feedback Presets (Enterprise Feature) */}
                  {(reviewAction === 'REWORK_REQUIRED' || reviewAction === 'REJECT') && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                        Quick-Fill Reason Templates
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {REWORK_PRESETS.map((preset, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => {
                              setReviewReason((prev) => (prev ? `${prev}\n• ${preset}` : `• ${preset}`));
                              setReviewError(null);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 text-left transition-colors cursor-pointer"
                          >
                            + {preset.slice(0, 38)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* D. Feedback Remarks Textarea */}
                  {reviewAction && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-800">
                          {reviewAction === 'APPROVE'
                            ? 'QC Notes (Optional)'
                            : 'Detailed Feedback / Actionable Reason (Required)'}
                        </label>
                        {reviewAction !== 'APPROVE' && (
                          <span className="text-[11px] text-rose-600 font-bold">* Required</span>
                        )}
                      </div>
                      <textarea
                        value={reviewReason}
                        onChange={(e) => {
                          setReviewReason(e.target.value);
                          if (reviewError) setReviewError(null);
                        }}
                        rows={4}
                        placeholder={
                          reviewAction === 'APPROVE'
                            ? 'Optional internal catalog notes regarding this approval...'
                            : 'Provide exact correction guidance for the seller (e.g. Please re-upload white background photo for variant SKU)...'
                        }
                        className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  )}

                  {/* Error Alert */}
                  {reviewError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{reviewError}</span>
                    </div>
                  )}
                </div>

                {/* E. Action Commit Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    disabled={submittingReview}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitReview}
                    disabled={!reviewAction || submittingReview}
                    className={`px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                      reviewAction === 'APPROVE'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                        : reviewAction === 'REWORK_REQUIRED'
                        ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                        : reviewAction === 'REJECT'
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                        : 'bg-indigo-600 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {submittingReview ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting Decision...</span>
                      </>
                    ) : (
                      <span>Commit QC Decision</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FULLSCREEN LIGHTBOX FOR HIGH-RES ASSET INSPECTION ── */}
      {lightboxOpen && activeAssetUrl && (
        <div className="fixed inset-0 bg-slate-950/90 z-60 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={activeAssetUrl}
            alt="Enlarged Asset"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
