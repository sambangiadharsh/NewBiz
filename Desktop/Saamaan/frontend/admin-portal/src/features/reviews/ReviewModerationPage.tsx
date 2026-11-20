import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  Check,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import { getFullAssetUrl } from '../../lib/image.js';
import { showSweetToast, confirmProceed } from '../../lib/swal.js';

interface AdminReviewItem {
  reviewId: string;
  productId: string;
  productName: string;
  productThumbnail: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  helpfulVotesCount: number;
  photos: string[];
  createdAt: string;
}

interface ReviewSummaryMetrics {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
  averageRating: number;
}

export const ReviewModerationPage: React.FC = () => {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('PENDING_APPROVAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [totalItems, setTotalItems] = useState<number>(0);

  const [summary, setSummary] = useState<ReviewSummaryMetrics>({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0,
    averageRating: 0,
  });

  const pagination = usePagination({
    totalItems,
    initialPage: page,
    initialPageSize: pageSize,
    onPageChange: (newPage) => setPage(newPage),
    onPageSizeChange: (newPageSize) => {
      setPageSize(newPageSize);
      setPage(1);
    },
  });

  const fetchSummary = async () => {
    try {
      const res = await apiClient.get('/reviews/admin/summary');
      if (res.data?.data) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch review summary metrics:', err);
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        limit: pageSize,
      };

      if (activeTab !== 'ALL') {
        params.status = activeTab;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await apiClient.get('/reviews/admin', { params });
      const data = res.data?.data;
      const items: AdminReviewItem[] = data?.items || [];
      const total: number = data?.meta?.totalCount ?? res.data?.pagination?.total ?? 0;

      // Filter by rating locally if selected
      const filteredItems = ratingFilter === 'ALL'
        ? items
        : items.filter((r) => r.rating === parseInt(ratingFilter, 10));

      setReviews(filteredItems);
      setTotalItems(total);
    } catch (err: any) {
      console.error('Failed to load reviews:', err);
      showSweetToast(err.response?.data?.message || 'Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [page, pageSize, activeTab, ratingFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReviews();
  };

  const handleUpdateStatus = async (
    review: AdminReviewItem,
    newStatus: 'APPROVED' | 'REJECTED'
  ) => {
    const isApprove = newStatus === 'APPROVED';
    const confirmed = await confirmProceed({
      title: isApprove ? 'Approve Customer Review?' : 'Reject Customer Review?',
      text: isApprove
        ? `This review for "${review.productName}" will be published publicly on the product page.`
        : `This review for "${review.productName}" will be rejected and hidden from the store.`,
      icon: isApprove ? 'question' : 'warning',
      confirmButtonText: isApprove ? 'Yes, Approve' : 'Yes, Reject',
    });

    if (!confirmed) return;

    try {
      setProcessingId(review.reviewId);
      await apiClient.patch(`/reviews/admin/${review.reviewId}/status`, {
        status: newStatus,
      });

      showSweetToast(
        isApprove ? 'Review approved and published' : 'Review rejected successfully',
        'success'
      );
      fetchSummary();
      fetchReviews();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      showSweetToast(err.response?.data?.message || 'Failed to update review status', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const columns: ColumnDef<AdminReviewItem>[] = [
    {
      header: 'Product',
      accessorKey: 'productName',
      cell: ({ row }) => {
        const fullImg = row.productThumbnail ? getFullAssetUrl(row.productThumbnail) : null;
        return (
          <div className="flex items-center gap-3 max-w-xs">
            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
              {fullImg ? (
                <img src={fullImg} alt={row.productName} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate" title={row.productName}>
                {row.productName}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">ID: {row.productId}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Reviewer',
      accessorKey: 'customerName',
      cell: ({ row }) => (
        <div>
          <p className="text-xs font-bold text-slate-900">{row.customerName}</p>
          <p className="text-[11px] text-slate-500 font-mono truncate max-w-[150px]" title={row.customerEmail}>
            {row.customerEmail}
          </p>
        </div>
      ),
    },
    {
      header: 'Rating & Feedback',
      accessorKey: 'rating',
      cell: ({ row }) => (
        <div className="max-w-md space-y-1.5 py-1">
          {/* Star Rating Badge */}
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                row.rating >= 4
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : row.rating === 3
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>{row.rating}.0</span>
            </span>

            {row.title && (
              <span className="text-xs font-bold text-slate-800 truncate" title={row.title}>
                {row.title}
              </span>
            )}
          </div>

          {/* Comment text */}
          {row.comment && (
            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" title={row.comment}>
              {row.comment}
            </p>
          )}

          {/* Customer Photo Attachments */}
          {row.photos && row.photos.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              {row.photos.map((photoUrl: string, idx: number) => {
                const fullPhoto = getFullAssetUrl(photoUrl);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPhotoPreview(fullPhoto)}
                    className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer bg-slate-100"
                    title="Click to inspect uploaded photo"
                  >
                    <img src={fullPhoto} alt={`review-photo-${idx}`} className="w-full h-full object-cover" />
                  </button>
                );
              })}
              <span className="text-[10px] text-slate-400 font-medium ml-1">
                ({row.photos.length} {row.photos.length === 1 ? 'photo' : 'photos'})
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Submitted',
      accessorKey: 'createdAt',
      cell: ({ row }) => (
        <div className="text-xs text-slate-500">
          <p className="font-medium text-slate-700">
            {new Date(row.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <p className="text-[10px] text-slate-400">
            {new Date(row.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        if (row.status === 'PENDING_APPROVAL') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
              Needs Review
            </span>
          );
        }
        if (row.status === 'APPROVED') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Published
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessorKey: 'reviewId',
      cell: ({ row }) => {
        const isApproved = row.status === 'APPROVED';
        const isRejected = row.status === 'REJECTED';
        const isProcessing = processingId === row.reviewId;

        return (
          <div className="flex items-center gap-1.5">
            {/* Approve Button */}
            {(!isApproved || isRejected) && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleUpdateStatus(row, 'APPROVED')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                title="Approve and publish review"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
            )}

            {/* Reject Button */}
            {(!isRejected || isApproved) && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleUpdateStatus(row, 'REJECTED')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                title="Reject and hide review"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-indigo-600" />
            <span>Manage Reviews</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review, verify, and approve user-submitted product ratings and customer photos before public display.
          </p>
        </div>
      </div>

      {/* ── KPI Aggregate Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Approval */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Moderation
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {summary.pendingCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-amber-600">Awaiting Decision</span>
          </div>
        </div>

        {/* Total Approved */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Live Approved
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {summary.approvedCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-emerald-600">Published on PDP</span>
          </div>
        </div>

        {/* Total Rejected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Rejected
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {summary.rejectedCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-rose-600">Spam or Inappropriate</span>
          </div>
        </div>

        {/* Average Rating Score */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Approved Avg Rating
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Star className="w-4 h-4 fill-indigo-500 text-indigo-600" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '0.0'}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Across {summary.approvedCount} approved</span>
          </div>
        </div>
      </div>

      {/* ── Status Tabs & Search Filters ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'PENDING_APPROVAL', label: 'Pending Moderation', count: summary.pendingCount },
                { id: 'APPROVED', label: 'Approved', count: summary.approvedCount },
                { id: 'REJECTED', label: 'Rejected', count: summary.rejectedCount },
                { id: 'ALL', label: 'All Reviews', count: summary.totalCount },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white shadow-md shadow-indigo-500/20'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Star Rating Filter & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Star Rating Select */}
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Stars (1-5)</option>
              <option value="5">5 Stars only</option>
              <option value="4">4 Stars only</option>
              <option value="3">3 Stars only</option>
              <option value="2">2 Stars only</option>
              <option value="1">1 Star only</option>
            </select>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reviews..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </form>
          </div>
        </div>
      </div>

      {/* ── Reviews Data Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <DataTable
          columns={columns as ColumnDef<any>[]}
          data={reviews}
          keyExtractor={(r: AdminReviewItem) => r.reviewId}
          loading={loading}
          emptyTitle="No customer reviews found"
          emptyDescription="No customer reviews match your active filter criteria."
          pagination={{ ...pagination.paginationProps, itemLabel: 'reviews' }}
        />
      </div>

      {/* ── Photo Lightbox Modal ────────────────────────────────────── */}
      {selectedPhotoPreview && (
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[99999] bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-150"
          style={{ margin: 0, padding: '1rem', width: '100vw', height: '100vh', top: 0, left: 0 }}
          onClick={() => setSelectedPhotoPreview(null)}
        >
          <div
            className="relative bg-white rounded-3xl p-4 max-w-lg w-full shadow-2xl border border-slate-200 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-900">Customer Uploaded Photo Inspection</h4>
              <button
                type="button"
                onClick={() => setSelectedPhotoPreview(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center">
              <img
                src={selectedPhotoPreview}
                alt="Inspected review photo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSelectedPhotoPreview(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
