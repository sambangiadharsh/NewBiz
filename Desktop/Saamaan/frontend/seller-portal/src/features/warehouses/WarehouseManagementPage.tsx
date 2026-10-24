import React, { useState, useEffect } from 'react';
import {
  Warehouse,
  Plus,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  Star,
  Link2,
  RotateCcw,
  Building2,
  Check,
  X,
  Filter,
  ArrowUpDown,
  Eye,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { apiClient } from '../../lib/axios.js';
import { AddWarehouseModal } from './AddWarehouseModal.js';
import { WarehouseDetailsModal } from './WarehouseDetailsModal.js';
import { Connect3PLModal } from './Connect3PLModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';
import { NoResults } from '../../components/common/NoResults.js';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '../../components/common/Table';
import { StatsCard } from '../../components/common/StatsCard';

interface SellerWarehouseItem {
  sellerWarehouseId: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: 'OWN' | '3PL' | 'THIRD_PARTY';
  contactPersonName?: string;
  contactEmail?: string;
  contactPhoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  status: string;
  relationshipStatus: string;
  isPrimary: boolean;
  createdAt: string;
  rejectionReason?: string;
  totalProductsCount?: number;
  activeStaffCount?: number;
  documentsCount?: number;
  verifiedDocumentsCount?: number;
}

export const WarehouseManagementPage: React.FC = () => {
  const { user } = useAuthStore();
  const currentSeller = user?.sellers?.[0];
  const isSellerActive = currentSeller?.status === 'ACTIVE' || user?.roles?.includes('SELLER_ADMIN');

  const [warehouses, setWarehouses] = useState<SellerWarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OWN' | '3PL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING_APPROVAL' | 'REWORK_REQUIRED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'primary' | 'name' | 'newest'>('primary');

  // Primary Designation State
  const [confirmPrimaryWh, setConfirmPrimaryWh] = useState<SellerWarehouseItem | null>(null);
  const [settingPrimary, setSettingPrimary] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConnect3PLModalOpen, setIsConnect3PLModalOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/seller/warehouses');
      if (res.data.success) {
        const rawList = Array.isArray(res.data.data) ? res.data.data : [];
        const normalized: SellerWarehouseItem[] = rawList.map((item: any) => {
          const wh = item.warehouse || {};
          return {
            sellerWarehouseId: Number(item.sellerWarehouseId ?? item.SellerWarehouseID ?? wh.sellerWarehouseId ?? 0),
            warehouseId: Number(wh.warehouseId ?? item.warehouseId ?? wh.WarehouseID ?? item.WarehouseID ?? 0),
            warehouseName: wh.warehouseName || item.warehouseName || wh.WarehouseName || 'Fulfillment Warehouse',
            warehouseCode: wh.warehouseCode || item.warehouseCode || wh.WarehouseCode || '—',
            warehouseType: (wh.warehouseType || item.warehouseType || wh.WarehouseType || 'OWN') as 'OWN' | '3PL' | 'THIRD_PARTY',
            contactPersonName: wh.contactPersonName || item.contactPersonName || wh.ContactPersonName,
            contactEmail: wh.contactEmail || item.contactEmail || wh.ContactEmail,
            contactPhoneNumber: wh.contactPhoneNumber || item.contactPhoneNumber || wh.ContactPhoneNumber,
            addressLine1: wh.addressLine1 || item.addressLine1 || wh.AddressLine1 || '',
            addressLine2: wh.addressLine2 || item.addressLine2 || wh.AddressLine2 || '',
            city: wh.city || item.city || wh.City || '',
            state: wh.state || item.state || wh.State || '',
            postalCode: wh.postalCode || item.postalCode || wh.PostalCode || '',
            country: wh.country || item.country || wh.Country || 'India',
            status: wh.status || item.status || wh.WarehouseStatus || item.relationshipStatus || 'ACTIVE',
            relationshipStatus: item.relationshipStatus || item.Status || 'ACTIVE',
            isPrimary: Boolean(item.isPrimary ?? item.IsPrimary ?? wh.isPrimary),
            createdAt: item.createdAt || wh.createdAt || item.CreatedAt || new Date().toISOString(),
            rejectionReason: item.rejectionReason || wh.rejectionReason,
            totalProductsCount: Number(wh.totalProductsCount ?? item.totalProductsCount ?? 0),
            activeStaffCount: Number(wh.activeStaffCount ?? item.activeStaffCount ?? 0),
            documentsCount: Number(wh.documentsCount ?? item.documentsCount ?? 0),
            verifiedDocumentsCount: Number(wh.verifiedDocumentsCount ?? item.verifiedDocumentsCount ?? 0),
          };
        });
        setWarehouses(normalized);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch fulfillment warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleSetPrimary = async (wh: SellerWarehouseItem) => {
    if (wh.isPrimary) return;
    setSettingPrimary(true);
    try {
      const res = await apiClient.post(`/seller/warehouses/${wh.warehouseId}/primary`);
      if (res.data.success) {
        setToast({
          type: 'success',
          message: `${wh.warehouseName} (${wh.warehouseCode}) is now your Primary Dispatch Origin.`,
        });
        setConfirmPrimaryWh(null);
        await fetchWarehouses();
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to set primary warehouse',
      });
    } finally {
      setSettingPrimary(false);
    }
  };

  // Client filtering
  const filteredWarehouses = warehouses.filter((wh) => {
    // Type filter
    if (typeFilter === 'OWN' && wh.warehouseType !== 'OWN') return false;
    if (typeFilter === '3PL' && wh.warehouseType === 'OWN') return false;

    // Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE') {
        if (!(wh.status === 'ACTIVE' && wh.relationshipStatus === 'ACTIVE')) return false;
      } else if (statusFilter === 'PENDING_APPROVAL') {
        const isPending =
          (wh.warehouseType === 'OWN'
            ? wh.status === 'PENDING_APPROVAL' || wh.relationshipStatus === 'PENDING'
            : wh.relationshipStatus === 'PENDING') &&
          wh.relationshipStatus !== 'TERMINATED' &&
          wh.status !== 'REJECTED' &&
          wh.relationshipStatus !== 'REJECTED' &&
          wh.status !== 'REWORK_REQUIRED' &&
          wh.relationshipStatus !== 'REWORK_REQUIRED';
        if (!isPending) return false;
      } else if (statusFilter === 'REWORK_REQUIRED') {
        const isRework = wh.status === 'REWORK_REQUIRED' || wh.relationshipStatus === 'REWORK_REQUIRED';
        if (!isRework) return false;
      } else if (statusFilter === 'REJECTED') {
        const isRejectedOrTerminated =
          wh.status === 'REJECTED' ||
          wh.relationshipStatus === 'REJECTED' ||
          wh.relationshipStatus === 'TERMINATED';
        if (!isRejectedOrTerminated) return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        wh.warehouseName.toLowerCase().includes(q) ||
        wh.warehouseCode.toLowerCase().includes(q) ||
        wh.city.toLowerCase().includes(q) ||
        wh.state.toLowerCase().includes(q) ||
        wh.postalCode.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Sort Warehouses
  const sortedWarehouses = [...filteredWarehouses].sort((a, b) => {
    if (sortBy === 'primary') {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'name') {
      return a.warehouseName.localeCompare(b.warehouseName);
    }
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  // Reusable Pagination for Warehouses
  const { paginatedData: paginatedWarehouses, paginationProps } = usePagination({
    data: sortedWarehouses,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  });

  // Metrics & Counts
  const totalCount = warehouses.length;
  const ownCount = warehouses.filter((w) => w.warehouseType === 'OWN').length;
  const threePLCount = warehouses.filter((w) => w.warehouseType !== 'OWN').length;
  const activeCount = warehouses.filter(
    (w) => w.status === 'ACTIVE' && w.relationshipStatus === 'ACTIVE'
  ).length;
  const pendingCount = warehouses.filter(
    (w) =>
      (w.warehouseType === 'OWN'
        ? w.status === 'PENDING_APPROVAL' || w.relationshipStatus === 'PENDING'
        : w.relationshipStatus === 'PENDING') &&
      w.relationshipStatus !== 'TERMINATED' &&
      w.status !== 'REJECTED' &&
      w.relationshipStatus !== 'REJECTED' &&
      w.status !== 'REWORK_REQUIRED' &&
      w.relationshipStatus !== 'REWORK_REQUIRED'
  ).length;
  const reworkCount = warehouses.filter(
    (w) => w.status === 'REWORK_REQUIRED' || w.relationshipStatus === 'REWORK_REQUIRED'
  ).length;

  const hasActiveFilters = searchQuery.trim() !== '' || typeFilter !== 'ALL' || statusFilter !== 'ALL' || sortBy !== 'primary';

  const resetAllFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setSortBy('primary');
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl bg-white border border-[#E8E1D7] transition-all duration-300">
          {toast.type === 'success' ? (
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
          <span className="text-xs font-bold text-stone-800">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Action Links */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <button
          onClick={() => setIsConnect3PLModalOpen(true)}
          className="px-4 py-2.5 bg-white border border-[#E8E1D7] hover:border-[#7E2532] hover:text-[#7E2532] text-stone-800 text-xs font-bold rounded-2xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
        >
          <Link2 className="w-4 h-4 text-purple-700" />
          Connect 3PL Partner
        </button>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-xs font-bold rounded-2xl shadow-lg shadow-[#7E2532]/25 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Register Warehouse
        </button>
      </div>

      {/* Verification notice if not active */}
      {!isSellerActive && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
              Seller Profile Under Verification
            </h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Your merchant account is currently under verification. Once approved by marketplace compliance, you will have full access to register warehouses and bind dispatch origins.
            </p>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Warehouses"
          value={totalCount}
          icon={Warehouse}
          loading={loading}
        />
        <StatsCard
          label="Active & Ready"
          value={activeCount}
          icon={CheckCircle2}
          iconColor="text-emerald-700 bg-emerald-50"
          loading={loading}
        />
        <StatsCard
          label="In Verification"
          value={pendingCount}
          icon={Clock}
          iconColor="text-amber-700 bg-amber-50"
          loading={loading}
        />
        <StatsCard
          label="Action Needed"
          value={reworkCount}
          icon={RotateCcw}
          iconColor="text-orange-600 bg-orange-50"
          loading={loading}
          onClick={() => setStatusFilter(statusFilter === 'REWORK_REQUIRED' ? 'ALL' : 'REWORK_REQUIRED')}
          className={statusFilter === 'REWORK_REQUIRED' ? 'ring-2 ring-orange-400/30 border-orange-400' : ''}
        />
      </div>

      {/* Rework Alert Banner */}
      {reworkCount > 0 && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-orange-950">
                Action Required: {reworkCount} Warehouse Application(s) Need Re-submission
              </h4>
              <p className="text-[11px] text-orange-800 mt-0.5">
                Marketplace administrators have requested updates on submitted compliance documents. Click below to inspect feedback and re-upload proofs.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('REWORK_REQUIRED')}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-sm"
          >
            Review Applications
          </button>
        </div>
      )}

      {/* Operating Model Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8E1D7] pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setTypeFilter('ALL')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 ${
            typeFilter === 'ALL'
              ? 'bg-[#641D26] text-white shadow-md shadow-[#641D26]/20 font-extrabold'
              : 'bg-white text-stone-600 hover:text-stone-900 hover:bg-[#F3EFEA] border border-[#E8E1D7]'
          }`}
        >
          <Warehouse className="w-4 h-4" />
          <span>All Warehouses</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              typeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('OWN')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 ${
            typeFilter === 'OWN'
              ? 'bg-[#641D26] text-white shadow-md shadow-[#641D26]/20 font-extrabold'
              : 'bg-white text-stone-600 hover:text-stone-900 hover:bg-[#F3EFEA] border border-[#E8E1D7]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Seller Warehouses (OWN)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              typeFilter === 'OWN' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {ownCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('3PL')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 ${
            typeFilter === '3PL'
              ? 'bg-[#641D26] text-white shadow-md shadow-[#641D26]/20 font-extrabold'
              : 'bg-white text-stone-600 hover:text-stone-900 hover:bg-[#F3EFEA] border border-[#E8E1D7]'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>3PL Logistics Network</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              typeFilter === '3PL' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {threePLCount}
          </span>
        </button>
      </div>

      {/* Filter and Search Console */}
      <div className="bg-white rounded-xl p-5 border border-[#E8E1D7] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box with Instant Clear Button */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search warehouse name, warehouse code, city, or PIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-[#FAF8F5] border border-[#E0D8CD] rounded-2xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 focus:border-[#7E2532] font-medium transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown Selector */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex items-center">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-2 hidden sm:inline">
                Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E0D8CD] hover:border-[#7E2532]/40 rounded-2xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 cursor-pointer transition-all pr-8 appearance-none"
              >
                <option value="ALL">All Statuses ({totalCount})</option>
                <option value="ACTIVE">● Active & Ready ({activeCount})</option>
                <option value="PENDING_APPROVAL">● In Review ({pendingCount})</option>
                <option value="REWORK_REQUIRED">● Rework Needed ({reworkCount})</option>
                <option value="REJECTED">● Inactive / Terminated</option>
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-3 pointer-events-none text-stone-400" />
            </div>

            {/* Sort Selector */}
            <div className="relative flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E0D8CD] hover:border-[#7E2532]/40 rounded-2xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 cursor-pointer transition-all pr-8 appearance-none"
              >
                <option value="primary">Sort: Primary First</option>
                <option value="name">Sort: Name (A-Z)</option>
                <option value="newest">Sort: Recently Added</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute right-3 pointer-events-none text-stone-400" />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                title="Reset all filters"
                className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Status Chips & Results Summary */}
        <div className="pt-3 border-t border-[#F0EAE1] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">
              Quick Filter:
            </span>
            {[
              { id: 'ALL', label: 'All', count: totalCount, dot: null },
              { id: 'ACTIVE', label: 'Active', count: activeCount, dot: 'bg-emerald-500' },
              { id: 'PENDING_APPROVAL', label: 'In Review', count: pendingCount, dot: 'bg-amber-500' },
              { id: 'REWORK_REQUIRED', label: 'Rework Needed', count: reworkCount, dot: 'bg-orange-500' },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === pill.id
                    ? 'bg-[#641D26] text-white shadow-sm'
                    : 'bg-[#F6F3EE] text-stone-600 hover:text-stone-900 hover:bg-[#EDE8DF]'
                }`}
              >
                {pill.dot && (
                  <span
                    className={`w-2 h-2 rounded-full ${pill.dot} ${
                      statusFilter === pill.id ? 'ring-2 ring-white/50' : ''
                    }`}
                  />
                )}
                <span>{pill.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    statusFilter === pill.id ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          {/* Results Summary Counter */}
          <div className="text-[11px] text-stone-500 font-medium">
            Showing <strong className="text-stone-900 font-bold">{paginatedWarehouses.length}</strong> of{' '}
            <strong className="text-stone-900 font-bold">{filteredWarehouses.length}</strong> warehouses
            {filteredWarehouses.length !== totalCount && (
              <span className="text-stone-400 font-normal"> (filtered from {totalCount})</span>
            )}
          </div>
        </div>

        {/* Active Filter Tags */}
        {hasActiveFilters && (
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Active Filters:
            </span>
            {typeFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FAF6F2] border border-[#E8E1D7] text-stone-700">
                Model: {typeFilter === 'OWN' ? 'Seller Warehouse' : '3PL Network'}
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className="hover:text-stone-900 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FAF6F2] border border-[#E8E1D7] text-stone-700">
                Status: {statusFilter.replace('_', ' ')}
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="hover:text-stone-900 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery.trim() !== '' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FAF6F2] border border-[#E8E1D7] text-stone-700">
                Query: "{searchQuery}"
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-stone-900 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {sortBy !== 'primary' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FAF6F2] border border-[#E8E1D7] text-stone-700">
                Sorted by: {sortBy === 'name' ? 'Name (A-Z)' : 'Newest'}
                <button
                  type="button"
                  onClick={() => setSortBy('primary')}
                  className="hover:text-stone-900 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-[11px] font-bold text-[#7E2532] hover:underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Warehouse Listing Table */}
      {error ? (
        <div className="bg-white rounded-xl border border-[#E8E1D7] p-12 text-center text-rose-600 text-xs font-bold space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
          <p>{error}</p>
          <button
            onClick={fetchWarehouses}
            className="mt-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : !loading && filteredWarehouses.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E1D7] py-10 px-6 text-center space-y-4">
          <NoResults
            description="You haven't connected any dispatch warehouses matching your filters. Connect to a 3PL logistics partner or register your own physical warehouse to enable order dispatch."
            className="py-4"
          />
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsConnect3PLModalOpen(true)}
              className="px-4 py-2 bg-white border border-[#E8E1D7] hover:border-purple-600 text-purple-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <Link2 className="w-4 h-4" />
              Connect 3PL Partner
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#7E2532] hover:bg-[#641D26] text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Register Own Warehouse
            </button>
          </div>
        </div>
      ) : (
        <TableContainer
          footer={
            !loading && (
              <Pagination
                {...paginationProps}
                itemLabel="warehouses"
                themeColor="burgundy"
              />
            )
          }
        >
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Warehouse Name</TableHead>
                <TableHead>Facility Code</TableHead>
                <TableHead>Operating Model</TableHead>
                <TableHead>Dispatch Role</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>PIN Code</TableHead>
                <TableHead>Status & Compliance</TableHead>
                <TableHead align="right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton columns={8} rows={6} />
              ) : (
                paginatedWarehouses.map((wh) => {
                  const isWhActive = wh.status === 'ACTIVE' && wh.relationshipStatus === 'ACTIVE';

                  return (
                    <TableRow key={wh.warehouseId}>
                      {/* Warehouse Name */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                              wh.warehouseType === 'OWN'
                                ? 'bg-rose-50 text-[#7E2532] border border-rose-200/70'
                                : 'bg-purple-50 text-purple-700 border border-purple-200/70'
                            }`}
                          >
                            <Warehouse className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-stone-900 block text-xs">
                                {wh.warehouseName}
                              </span>
                              {wh.isPrimary && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-900 border border-amber-300">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" /> PRIMARY
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Facility Code (Dedicated Column) */}
                      <TableCell>
                        <span className="font-mono text-[11px] text-stone-700 bg-[#FAF7F3] border border-[#ECE5DC] px-2 py-0.5 rounded-md font-bold tracking-tight inline-block">
                          {wh.warehouseCode}
                        </span>
                      </TableCell>

                      {/* Operating Model */}
                      <TableCell>
                        {wh.warehouseType === 'OWN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-50 text-[#7E2532] border border-rose-200/70">
                            <Building2 className="w-3 h-3" />
                            Seller-Operated (OWN)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/70">
                            <Link2 className="w-3 h-3" />
                            3PL Logistics Partner
                          </span>
                        )}
                      </TableCell>

                      {/* Primary Dispatch Routing */}
                      <TableCell>
                        {wh.isPrimary ? (
                          <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                            <span>Primary Dispatch Hub</span>
                          </div>
                        ) : isWhActive ? (
                          <button
                            type="button"
                            onClick={() => setConfirmPrimaryWh(wh)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold text-stone-600 hover:text-amber-900 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 transition-all shadow-sm"
                          >
                            <Star className="w-3 h-3 text-stone-400 hover:text-amber-500" />
                            Make Primary
                          </button>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic">Secondary Hub</span>
                        )}
                      </TableCell>

                      {/* Location City & State */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-stone-700 font-medium text-xs">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>
                            {wh.city ? `${wh.city}, ${wh.state}` : 'Location on file'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Dedicated PIN Code Column */}
                      <TableCell>
                        <span className="font-mono text-xs text-stone-600">
                          {wh.postalCode || '—'}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {wh.relationshipStatus === 'TERMINATED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                            TERMINATED
                          </span>
                        ) : wh.warehouseType === 'OWN' ? (
                          wh.status === 'ACTIVE' && wh.relationshipStatus === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> ACTIVE & READY
                            </span>
                          ) : wh.status === 'REWORK_REQUIRED' || wh.relationshipStatus === 'REWORK_REQUIRED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                              <RotateCcw className="w-3 h-3 text-orange-600" /> REWORK NEEDED
                            </span>
                          ) : wh.status === 'PENDING_APPROVAL' || wh.relationshipStatus === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> UNDER REVIEW
                            </span>
                          ) : wh.status === 'REJECTED' || wh.relationshipStatus === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <ShieldAlert className="w-3 h-3" /> REJECTED
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                              {wh.status}
                            </span>
                          )
                        ) : (
                          // 3PL Partner
                          wh.relationshipStatus === 'ACTIVE' && wh.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> CONNECTED
                            </span>
                          ) : wh.relationshipStatus === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> PENDING LINKAGE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <ShieldAlert className="w-3 h-3" /> {wh.relationshipStatus}
                            </span>
                          )
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right">
                        <button
                          type="button"
                          onClick={() => setSelectedWarehouseId(wh.warehouseId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-burgundy-50 hover:bg-burgundy-100 text-[#641D26] font-bold text-xs border border-burgundy-200/70 transition-all cursor-pointer shadow-xs"
                          title="View warehouse profile and compliance documents"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#7E2532]" />
                          <span>View Profile</span>
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            </Table>
          </TableContainer>
        )}

      {/* Confirm Primary Dispatch Hub Modal */}
      {confirmPrimaryWh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-xl border border-[#E8E1D7] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-stone-900">Designate Primary Dispatch Origin</h3>
                <p className="text-xs text-stone-500">Routing & Logistics Priority</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed bg-[#F8F6F2] p-3.5 rounded-2xl border border-[#E8E1D7]">
              Make <strong className="font-bold text-stone-900">{confirmPrimaryWh.warehouseName}</strong> ({confirmPrimaryWh.warehouseCode}) your primary dispatch location?
              Order fulfillment routing algorithms and customer shipping estimates will prioritize inventory from this warehouse.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPrimaryWh(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={settingPrimary}
                onClick={() => handleSetPrimary(confirmPrimaryWh)}
                className="px-5 py-2 rounded-xl bg-[#7E2532] hover:bg-[#641D26] text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {settingPrimary ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Confirm Primary Origin
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddWarehouseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchWarehouses()}
      />

      <Connect3PLModal
        isOpen={isConnect3PLModalOpen}
        onClose={() => setIsConnect3PLModalOpen(false)}
        onSuccess={() => fetchWarehouses()}
      />

      <WarehouseDetailsModal
        warehouseId={selectedWarehouseId}
        onClose={() => setSelectedWarehouseId(null)}
        onUpdated={() => fetchWarehouses()}
      />
    </div>
  );
};
