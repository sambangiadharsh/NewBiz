import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Image as ImageIcon,
  ExternalLink,
  Calendar,
  X,
  Loader2,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { BannerModal, BannerItem, BANNER_PLACEMENTS } from './BannerModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';
import { NoResults } from '../../components/common/NoResults.js';

export const BannersPage: React.FC = () => {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [placementFilter, setPlacementFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'INACTIVE'>('ALL');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [previewBanner, setPreviewBanner] = useState<BannerItem | null>(null);

  // Delete & Action states
  const [deleteConfirmBanner, setDeleteConfirmBanner] = useState<BannerItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBanners = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (placementFilter !== 'ALL') params.placement = placementFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get('/admin/banners', { params });
      if (res.data?.success) {
        setBanners(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Fetch banners error:', err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to load banners.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, [placementFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBanners();
  };

  // Quick Toggle Status
  const handleToggleStatus = async (banner: BannerItem) => {
    const nextStatus = banner.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiClient.patch(`/admin/banners/${banner.bannerId}/status`, {
        status: nextStatus,
      });

      setBanners((prev) =>
        prev.map((b) => (b.bannerId === banner.bannerId ? { ...b, status: nextStatus } : b))
      );

      setActionMessage({
        type: 'success',
        text: `Banner #${banner.bannerId} status changed to ${nextStatus}.`,
      });
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      console.error('Toggle status failed:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Failed to update status.',
      });
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Confirm delete
  const handleDeleteBanner = async () => {
    if (!deleteConfirmBanner) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/admin/banners/${deleteConfirmBanner.bannerId}`);
      setBanners((prev) => prev.filter((b) => b.bannerId !== deleteConfirmBanner.bannerId));
      setActionMessage({
        type: 'success',
        text: `Banner #${deleteConfirmBanner.bannerId} removed successfully.`,
      });
      setTimeout(() => setActionMessage(null), 3000);
      setDeleteConfirmBanner(null);
    } catch (err: any) {
      console.error('Delete banner failed:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Failed to delete banner.',
      });
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  // KPI Metrics
  const totalCount = banners.length;
  const activeCount = banners.filter((b) => b.status === 'ACTIVE').length;
  const heroCount = banners.filter((b) => b.placement === 'HERO_CAROUSEL').length;
  const scheduledCount = banners.filter((b) => Boolean(b.startAt || b.endAt)).length;

  // Pagination hook
  const {
    paginatedData: paginatedBanners,
    paginationProps,
  } = usePagination<BannerItem>({
    data: banners,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });

  // Helper for image URLs
  const getFullImageUrl = (path: string | null | undefined) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:7000';
    return `${apiBase.replace(/\/api\/v1\/?$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  // Schedule badge helper
  const getScheduleBadge = (banner: BannerItem) => {
    if (!banner.startAt && !banner.endAt) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
          <Clock className="w-3 h-3 text-slate-400" /> Always Active
        </span>
      );
    }

    const now = new Date();
    const start = banner.startAt ? new Date(banner.startAt) : null;
    const end = banner.endAt ? new Date(banner.endAt) : null;

    if (end && now > end) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Expired
        </span>
      );
    }

    if (start && now < start) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          Upcoming
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Live Campaign
      </span>
    );
  };

  const getPlacementBadge = (placement: string) => {
    const config = BANNER_PLACEMENTS.find((p) => p.value === placement);
    const badgeColor = config?.badgeColor || 'bg-slate-50 text-slate-700 border-slate-200';
    return (
      <span
        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}
      >
        {config?.label || placement}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>Storefront Merchandising</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Banner Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage promotional graphics, hero carousels, category headers, and campaign schedules across the marketplace storefront.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchBanners()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh Banners"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            onClick={() => {
              setEditingBanner(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Banner</span>
          </button>
        </div>
      </div>

      {/* Floating Action Notifications */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Banners */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Banners
            </span>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalCount}</h3>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
              Across all placement slots
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <ImageIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Active Banners */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Active Banners
            </span>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">{activeCount}</h3>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
              {totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}% of all banners live
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Hero Carousel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
              Hero Carousels
            </span>
            <h3 className="text-2xl font-black text-purple-700 mt-1">{heroCount}</h3>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
              Homepage header slides
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Scheduled Campaigns */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              Timed Campaigns
            </span>
            <h3 className="text-2xl font-black text-indigo-700 mt-1">{scheduledCount}</h3>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
              Have start or expiry dates
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search banner title, description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Placement Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Slot:</span>
            <select
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Slots</option>
              {BANNER_PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                fetchBanners();
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Banners Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium text-slate-500">Loading banners...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">Error Loading Banners</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={() => fetchBanners()}
              className="mt-4 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : banners.length === 0 ? (
          <NoResults
            title="No Banners Found"
            description={
              searchQuery || placementFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No banners matched your filter criteria. Try adjusting your filters or search.'
                : 'No promotional banners have been created yet. Add your first banner to attract customers.'
            }
            action={{
              label: 'Add Banner',
              onClick: () => {
                setEditingBanner(null);
                setModalOpen(true);
              },
              icon: <Plus className="w-4 h-4" />,
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Banner Graphic</th>
                  <th className="py-3.5 px-4">Placement Slot</th>
                  <th className="py-3.5 px-3 text-center">Order</th>
                  <th className="py-3.5 px-4">Campaign Schedule</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {paginatedBanners.map((banner) => {
                  return (
                    <tr
                      key={banner.bannerId}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Banner Graphic & Copy */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          {/* Thumbnail preview */}
                          <div
                            onClick={() => setPreviewBanner(banner)}
                            className="w-24 h-14 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group/thumb relative shadow-xs"
                            title="Click to view full preview"
                          >
                            <img
                              src={getFullImageUrl(banner.imageUrl || banner.imageURL)}
                              alt={banner.title || 'Banner'}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://placehold.co/120x60?text=No+Image';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>

                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block">
                              {banner.title || <span className="text-slate-400 italic">Untitled Banner</span>}
                            </span>
                            {banner.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 max-w-sm mt-0.5">
                                {banner.description}
                              </p>
                            )}
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              ID: #{banner.bannerId} • Created {new Date(banner.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Placement Slot */}
                      <td className="py-4 px-4">
                        {getPlacementBadge(banner.placement)}
                      </td>

                      {/* Display Order */}
                      <td className="py-4 px-3 text-center">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold"
                          title="Display order (lower appears first)"
                        >
                          #{banner.displayOrder ?? 0}
                        </span>
                      </td>

                      {/* Campaign Schedule */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div>{getScheduleBadge(banner)}</div>
                          {(banner.startAt || banner.endAt) && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {banner.startAt && (
                                <div>Start: {new Date(banner.startAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                              )}
                              {banner.endAt && (
                                <div>End: {new Date(banner.endAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Badge with toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(banner)}
                          title="Click to toggle status"
                          className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                            banner.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : banner.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              banner.status === 'ACTIVE'
                                ? 'bg-emerald-500'
                                : banner.status === 'DRAFT'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {banner.status}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingBanner(banner);
                              setModalOpen(true);
                            }}
                            title="Edit Banner"
                            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmBanner(banner)}
                            title="Delete Banner"
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <Pagination
              {...paginationProps}
              itemLabel="banners"
              themeColor="indigo"
            />
          </div>
        )}
      </div>

      {/* Create / Edit Banner Modal */}
      {modalOpen && (
        <BannerModal
          banner={editingBanner}
          onClose={() => {
            setModalOpen(false);
            setEditingBanner(null);
          }}
          onSuccess={() => {
            setModalOpen(false);
            setEditingBanner(null);
            fetchBanners();
            setActionMessage({
              type: 'success',
              text: editingBanner
                ? 'Banner updated successfully.'
                : 'New banner added successfully.',
            });
            setTimeout(() => setActionMessage(null), 3000);
          }}
        />
      )}

      {/* Full Preview Modal */}
      {previewBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {previewBanner.title || 'Banner Preview'}
                </h3>
                <span className="text-xs text-slate-500">
                  Placement Slot: {previewBanner.placement} • Display Order: #{previewBanner.displayOrder}
                </span>
              </div>
              <button
                onClick={() => setPreviewBanner(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 relative">
              <img
                src={getFullImageUrl(previewBanner.imageUrl || previewBanner.imageURL)}
                alt={previewBanner.title || 'Preview'}
                className="w-full max-h-[60vh] object-contain mx-auto"
              />
              {(previewBanner.title || previewBanner.description) && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end text-white">
                  {previewBanner.title && (
                    <h4 className="text-xl font-black drop-shadow-md">{previewBanner.title}</h4>
                  )}
                  {previewBanner.description && (
                    <p className="text-sm text-slate-200 max-w-xl mt-1 drop-shadow-sm">
                      {previewBanner.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span>Direct URL:</span>
                <a
                  href={getFullImageUrl(previewBanner.imageUrl || previewBanner.imageURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  Open Original <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button
                onClick={() => setPreviewBanner(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Delete Banner #{deleteConfirmBanner.bannerId}?
            </h3>

            <p className="text-xs text-slate-500 mt-2">
              Are you sure you want to permanently remove this promotional banner? This banner will no longer appear on the storefront.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmBanner(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBanner}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-all shadow-sm shadow-rose-200 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
