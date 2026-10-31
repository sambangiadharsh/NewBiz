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
  Sparkles,
  Image as ImageIcon,
  FileText,
  Tag,
  Loader2,
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

const COMMON_REASONS = [
  'Image resolution is too low or background is not clean white.',
  'HSN Code or GST Rate is missing or incorrect.',
  'Missing key product specifications (dimensions, material, or packaging details).',
  'Product title does not follow standard naming (Brand + Model + Key Feature).',
  'Images contain watermarks, promotional text, or phone numbers.',
  'SKU or GTIN barcode format is invalid.',
];

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';

const getFullAssetUrl = (url?: string | null): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(
    /\/api\/v1\/?$/,
    ''
  );
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
};

type DrawerTab = 'OVERVIEW' | 'VARIANTS' | 'DECISION';

export const CatalogQCPage: React.FC = () => {
  const [products, setProducts] = useState<AdminQCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'PENDING_QC' | 'REWORK_REQUIRED' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING_QC');

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

  // Selected product for the review drawer
  const [selectedProduct, setSelectedProduct] = useState<AdminQCProduct | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('OVERVIEW');
  const [activeAssetUrl, setActiveAssetUrl] = useState<string | null>(null);

  // Decision state
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REWORK_REQUIRED' | 'REJECT' | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Fetch QC queue
  const fetchQCQueue = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

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
      showSweetToast(err.response?.data?.error?.message || 'Failed to load catalog products', 'error');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQCQueue();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQCQueue();
  };

  // Keyboard navigation: Escape key closes the drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedProduct) {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProduct]);

  // Open review drawer
  const handleOpenReview = (item: AdminQCProduct) => {
    setSelectedProduct(item);
    setDrawerTab('OVERVIEW');
    setReviewAction(null);
    setReviewReason(item.rejectionReason || '');
    setReviewError(null);

    // Pick first image
    const firstImg =
      item.assets?.find((a) => a.isPrimary)?.url ||
      item.assets?.[0]?.url ||
      item.variants?.flatMap((v) => v.assets || []).find((a) => a.isPrimary)?.url ||
      item.variants?.flatMap((v) => v.assets || [])[0]?.url ||
      null;
    setActiveAssetUrl(firstImg);
  };

  // Close review drawer
  const handleCloseDrawer = () => {
    setSelectedProduct(null);
    setReviewAction(null);
    setReviewReason('');
    setReviewError(null);
  };

  // Submit review decision
  const submitReview = async () => {
    if (!selectedProduct || !reviewAction) return;

    if (
      (reviewAction === 'REWORK_REQUIRED' || reviewAction === 'REJECT') &&
      (!reviewReason.trim() || reviewReason.trim().length < 3)
    ) {
      setReviewError('Please provide a specific reason or instructions for the seller (at least 3 characters).');
      setDrawerTab('DECISION');
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
            ? 'sent back for changes'
            : 'rejected';

        showSweetToast(`Product "${selectedProduct.productName}" was ${actionLabel}.`, 'success');
        handleCloseDrawer();
        fetchQCQueue();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to submit review decision.';
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved
          </span>
        );
      case 'PENDING_QC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Review
          </span>
        );
      case 'REWORK_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <AlertCircle className="w-3.5 h-3.5 text-purple-600" /> Needs Changes
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // Client-side pagination
  const {
    paginatedData,
    paginationProps,
  } = usePagination<AdminQCProduct>({
    data: products,
    initialPageSize: 15,
  });

  // All collected images for the selected product
  const allImages = useMemo(() => {
    if (!selectedProduct) return [];
    const directAssets = selectedProduct.assets || [];
    const variantAssets = (selectedProduct.variants || []).flatMap((v) => v.assets || []);
    const combined = [...directAssets, ...variantAssets];
    const uniqueMap = new Map<string, VariantAsset>();
    combined.forEach((a) => {
      const cleanUrl = a.url ? a.url.trim() : '';
      if (cleanUrl && !uniqueMap.has(cleanUrl)) {
        uniqueMap.set(cleanUrl, { ...a, url: cleanUrl });
      }
    });
    return Array.from(uniqueMap.values());
  }, [selectedProduct]);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Product Review & Quality Check</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Product Quality Control
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium max-w-2xl">
            Review proposed products submitted by sellers. Check details, verify images, and approve items to make them live on the marketplace.
          </p>
        </div>

        <button
          onClick={fetchQCQueue}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs shadow-xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Status Tabs ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setStatusFilter('PENDING_QC')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statusFilter === 'PENDING_QC'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Review</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            statusFilter === 'PENDING_QC' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {qcCounts.pendingQC}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('REWORK_REQUIRED')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statusFilter === 'REWORK_REQUIRED'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Needs Changes</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            statusFilter === 'REWORK_REQUIRED' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {qcCounts.reworkRequired}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('APPROVED')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statusFilter === 'APPROVED'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Approved</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            statusFilter === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {qcCounts.approved}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('REJECTED')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statusFilter === 'REJECTED'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <XCircle className="w-4 h-4" />
          <span>Rejected</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            statusFilter === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {qcCounts.rejected}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statusFilter === 'ALL'
              ? 'border-slate-800 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>All Products</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-600">
            {products.length}
          </span>
        </button>
      </div>

      {/* ── Search Bar ─────────────────────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Product Name, SKU, Brand, or Barcode..."
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
      </div>

      {/* ── Main Table View ────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Loading products...</h3>
          <p className="text-xs text-slate-400">Please wait while we retrieve the product list.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <NoResults />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category & Brand</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Tax & Origin</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((item: AdminQCProduct) => {
                  const primaryImage =
                    item.assets?.find((a: VariantAsset) => a.isPrimary)?.url ||
                    item.assets?.[0]?.url ||
                    item.variants?.flatMap((v) => v.assets || []).find((a: VariantAsset) => a.isPrimary)?.url ||
                    item.variants?.flatMap((v) => v.assets || [])[0]?.url;

                  const variantCount = item.variants?.length || 0;

                  return (
                    <TableRow
                      key={item.productId}
                      className="text-xs hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Image Thumbnail */}
                      <TableCell>
                        <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                          {primaryImage ? (
                            <img
                              src={getFullAssetUrl(primaryImage)}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.onerror = null;
                                target.src = FALLBACK_IMAGE;
                              }}
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>
                      </TableCell>

                      {/* Product Name & SKU */}
                      <TableCell>
                        <div className="space-y-0.5 max-w-sm">
                          <span
                            className="font-bold text-slate-900 block truncate hover:text-indigo-600 cursor-pointer text-xs"
                            onClick={() => handleOpenReview(item)}
                            title={item.productName}
                          >
                            {item.productName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 block">
                            SKU: {item.parentSku}
                          </span>
                        </div>
                      </TableCell>

                      {/* Category & Brand */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-800 block text-xs">
                            {item.brand?.brandName || 'Unbranded'}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">
                            {item.category?.categoryName || 'General Category'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Variants */}
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {variantCount} {variantCount === 1 ? 'Variant' : 'Variants'}
                        </span>
                      </TableCell>

                      {/* Tax & Origin */}
                      <TableCell>
                        <div className="space-y-0.5 text-[11px]">
                          <span className="text-slate-600 block">
                            HSN: <strong className="font-mono text-slate-900">{item.hsnCode || 'N/A'}</strong>
                          </span>
                          <span className="text-slate-600 block">
                            GST: <strong className="text-slate-900">{item.gstRate !== null && item.gstRate !== undefined ? `${item.gstRate}%` : 'N/A'}</strong>
                          </span>
                        </div>
                      </TableCell>

                      {/* Submitted By & Date */}
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <span className="font-medium text-slate-800 block">
                            {item.submittedBy?.name || 'Seller'}
                          </span>
                          <span className="text-slate-400 text-[11px] block">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
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
                          <span>Review</span>
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <div className="border-t border-slate-200 p-3">
            <Pagination {...paginationProps} itemLabel="products" />
          </div>
        </div>
      )}

      {/* ── Option A: Right-Side Full-Height Slide-Over Drawer ── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={handleCloseDrawer}
          />

          {/* Slide-over Drawer Panel */}
          <div className="relative w-full max-w-2xl sm:max-w-3xl bg-white shadow-2xl flex flex-col border-l border-slate-200 z-10 animate-in slide-in-from-right duration-200">
            {/* 1. Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-white flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {getStatusBadge(selectedProduct.status)}
                  {selectedProduct.brand?.brandName && (
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                      {selectedProduct.brand.brandName}
                    </span>
                  )}
                  <span className="font-mono text-xs text-slate-500">
                    SKU: {selectedProduct.parentSku}
                  </span>
                </div>
                <h2 className="text-base font-black text-slate-900 truncate" title={selectedProduct.productName}>
                  {selectedProduct.productName}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/catalog/edit/${selectedProduct.productId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                  title="Open in full catalog editor"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Edit in Catalog</span>
                </a>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. Drawer Navigation Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-5 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDrawerTab('OVERVIEW')}
                className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  drawerTab === 'OVERVIEW'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Overview & Images</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('VARIANTS')}
                className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  drawerTab === 'VARIANTS'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Variants ({selectedProduct.variants?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('DECISION')}
                className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  drawerTab === 'DECISION'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Review Decision</span>
                {reviewAction && (
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse ml-0.5" />
                )}
              </button>
            </div>

            {/* 3. Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ── TAB 1: OVERVIEW & IMAGES ── */}
              {drawerTab === 'OVERVIEW' && (
                <div className="space-y-6">
                  {/* Image Gallery Stage */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        Product Images ({allImages.length})
                      </span>
                      {activeAssetUrl && (
                        <a
                          href={getFullAssetUrl(activeAssetUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <span>Open full size</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Main Image Display */}
                    {activeAssetUrl ? (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center aspect-video max-h-[300px]">
                        <img
                          src={getFullAssetUrl(activeAssetUrl)}
                          alt="Primary Product"
                          className="w-full h-full object-contain p-3"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.onerror = null;
                            target.src = FALLBACK_IMAGE;
                          }}
                        />
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-1">
                        <Package className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-600">No images provided</p>
                        <p className="text-[11px] text-slate-400">Seller did not upload photos for this proposal.</p>
                      </div>
                    )}

                    {/* Thumbnails Filmstrip */}
                    {allImages.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {allImages.map((img, idx) => {
                          const isSelected = activeAssetUrl === img.url;
                          return (
                            <button
                              key={img.assetId || idx}
                              type="button"
                              onClick={() => setActiveAssetUrl(img.url)}
                              className={`w-14 h-14 rounded-lg border overflow-hidden shrink-0 transition-all cursor-pointer bg-white ${
                                isSelected
                                  ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                                  : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={getFullAssetUrl(img.url)}
                                alt="thumbnail"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = FALLBACK_IMAGE;
                                }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Basic Details & Tax Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold block">Brand</span>
                      <span className="font-bold text-slate-900 mt-0.5 block truncate">
                        {selectedProduct.brand?.brandName || 'Unbranded'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold block">Category</span>
                      <span className="font-bold text-slate-900 mt-0.5 block truncate">
                        {selectedProduct.category?.categoryName || 'General'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold block">HSN Code</span>
                      <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                        {selectedProduct.hsnCode || 'Missing'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold block">GST Rate</span>
                      <span className="font-bold text-slate-900 mt-0.5 block">
                        {selectedProduct.gstRate !== null && selectedProduct.gstRate !== undefined
                          ? `${selectedProduct.gstRate}%`
                          : 'Missing'}
                      </span>
                    </div>
                  </div>

                  {/* Seller Submission Info */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Submitted by</span>
                      <span className="font-bold text-slate-800">
                        {selectedProduct.submittedBy?.name || 'Seller'}
                      </span>
                      {selectedProduct.submittedBy?.email && (
                        <span className="text-slate-500 text-[11px] block">
                          {selectedProduct.submittedBy.email}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Date</span>
                      <span className="font-semibold text-slate-700">
                        {selectedProduct.createdAt ? new Date(selectedProduct.createdAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Highlights / Features */}
                  {selectedProduct.highlights && selectedProduct.highlights.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Key Product Highlights ({selectedProduct.highlights.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProduct.highlights.map((h, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                          >
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{h}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedProduct.description && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-800 block">
                        Product Description
                      </span>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedProduct.description}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: VARIANTS & SPECIFICATIONS ── */}
              {drawerTab === 'VARIANTS' && (
                <div className="space-y-4">
                  {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                      <TableContainer maxHeight="500px">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                              <TableHead>SKU</TableHead>
                              <TableHead>Attributes</TableHead>
                              <TableHead>Barcode (GTIN)</TableHead>
                              <TableHead>Weight & Dimensions</TableHead>
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
                                      <span className="text-slate-400 italic">None</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-slate-600 text-[11px]">
                                  {v.gtin || <span className="text-slate-400">None</span>}
                                </TableCell>
                                <TableCell className="text-[11px] text-slate-600">
                                  {v.dimensions?.netWeight ?? v.dimensions?.weight ? (
                                    <span>
                                      Net:{' '}
                                      <strong>
                                        {Number(v.dimensions?.netWeight ?? v.dimensions?.weight) < 1
                                          ? `${Math.round(Number(v.dimensions?.netWeight ?? v.dimensions?.weight) * 1000)} g`
                                          : `${v.dimensions?.netWeight ?? v.dimensions?.weight} kg`}
                                      </strong>
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                  {v.dimensions?.grossWeight && (
                                    <span className="block text-slate-500">
                                      Gross:{' '}
                                      {Number(v.dimensions.grossWeight) < 1
                                        ? `${Math.round(Number(v.dimensions.grossWeight) * 1000)} g`
                                        : `${v.dimensions.grossWeight} kg`}
                                    </span>
                                  )}
                                  {v.dimensions?.length && (
                                    <span className="block text-slate-400 font-mono">
                                      {v.dimensions.length}×{v.dimensions.width}×{v.dimensions.height} cm
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">No variants defined</p>
                      <p className="text-[11px] text-slate-400 mt-1">This product does not have variant SKUs.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: REVIEW DECISION ── */}
              {drawerTab === 'DECISION' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Choose Review Decision</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select what action you want to take on this proposal.
                    </p>
                  </div>

                  {/* 3 Decision Choice Cards */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* 1. APPROVE */}
                    <button
                      type="button"
                      onClick={() => {
                        setReviewAction('APPROVE');
                        setReviewError(null);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        reviewAction === 'APPROVE'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 block">Approve Product</span>
                          <span className="text-[11px] text-slate-500">Approves and publishes this item to the catalog for sellers</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        reviewAction === 'APPROVE' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                      }`}>
                        {reviewAction === 'APPROVE' && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </button>

                    {/* 2. REQUEST CHANGES */}
                    <button
                      type="button"
                      onClick={() => {
                        setReviewAction('REWORK_REQUIRED');
                        setReviewError(null);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        reviewAction === 'REWORK_REQUIRED'
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20'
                          : 'bg-white border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 block">Request Changes from Seller</span>
                          <span className="text-[11px] text-slate-500">Sends proposal back to seller with your feedback for corrections</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        reviewAction === 'REWORK_REQUIRED' ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'
                      }`}>
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
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        reviewAction === 'REJECT'
                          ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20'
                          : 'bg-white border-slate-200 hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                          <XCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 block">Reject Proposal</span>
                          <span className="text-[11px] text-slate-500">Declines this proposal completely due to policy violations</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        reviewAction === 'REJECT' ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300'
                      }`}>
                        {reviewAction === 'REJECT' && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </button>
                  </div>

                  {/* Common feedback presets (shown when requesting changes or rejecting) */}
                  {(reviewAction === 'REWORK_REQUIRED' || reviewAction === 'REJECT') && (
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-slate-700 block">
                        Quick Feedback Templates (Click to add):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_REASONS.map((preset, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => {
                              setReviewReason((prev) => (prev ? `${prev}\n• ${preset}` : `• ${preset}`));
                              setReviewError(null);
                            }}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 text-left transition-colors cursor-pointer"
                          >
                            + {preset.slice(0, 42)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remarks / Reason textarea */}
                  {reviewAction && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-800">
                          {reviewAction === 'APPROVE'
                            ? 'Approval Notes (Optional)'
                            : 'Feedback for Seller (Required)'}
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
                            ? 'Optional internal notes regarding this approval...'
                            : 'Explain clearly what needs to be fixed before the product can be approved...'
                        }
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  )}

                  {/* Error banner */}
                  {reviewError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{reviewError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Sticky Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleCloseDrawer}
                disabled={submittingReview}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {drawerTab !== 'DECISION' ? (
                  <button
                    type="button"
                    onClick={() => setDrawerTab('DECISION')}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Proceed to Decision</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitReview}
                    disabled={!reviewAction || submittingReview}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      reviewAction === 'APPROVE'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : reviewAction === 'REWORK_REQUIRED'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : reviewAction === 'REJECT'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {submittingReview ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {reviewAction === 'APPROVE'
                            ? 'Approve & Publish'
                            : reviewAction === 'REWORK_REQUIRED'
                            ? 'Submit Changes Request'
                            : reviewAction === 'REJECT'
                            ? 'Confirm Rejection'
                            : 'Select Decision First'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
