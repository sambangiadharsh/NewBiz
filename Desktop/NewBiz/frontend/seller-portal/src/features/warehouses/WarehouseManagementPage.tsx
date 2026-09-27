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
  ChevronRight,
  ShieldAlert,
  Star,
  Link2,
  RotateCcw,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { apiClient } from '../../lib/axios.js';
import { AddWarehouseModal } from './AddWarehouseModal.js';
import { WarehouseDetailsModal } from './WarehouseDetailsModal.js';
import { Connect3PLModal } from './Connect3PLModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';

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
}

export const WarehouseManagementPage: React.FC = () => {
  const { user } = useAuthStore();
  const currentSeller = user?.sellers?.[0];
  const isSellerActive = currentSeller?.status === 'ACTIVE';

  const [warehouses, setWarehouses] = useState<SellerWarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OWN' | '3PL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING_APPROVAL' | 'REWORK_REQUIRED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConnect3PLModalOpen, setIsConnect3PLModalOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

  const fetchWarehouses = async () => {
    if (!isSellerActive) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/seller/warehouses');
      if (res.data.success) {
        setWarehouses(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [isSellerActive]);

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
        wh.state.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Reusable Pagination for Warehouses
  const { paginatedData: paginatedWarehouses, paginationProps } = usePagination({
    data: filteredWarehouses,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  });

  // Metrics
  const totalCount = warehouses.length;
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
  const primaryWarehouse = warehouses.find((w) => w.isPrimary && w.relationshipStatus === 'ACTIVE');

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider mb-2">
            <Warehouse className="w-4 h-4" />
            Seller Logistics & Fulfillment
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#221C1E]">
            Warehouse Management
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium">
            Register and manage your fulfillment warehouses, 3PL partner hubs, and dispatch origins.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsConnect3PLModalOpen(true)}
            disabled={!isSellerActive}
            className="px-4 py-3 bg-white border border-[#E8E1D7] hover:border-[#7E2532] hover:text-[#7E2532] text-stone-800 text-xs font-bold rounded-2xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            <Link2 className="w-4 h-4 text-[#7E2532]" />
            Connect 3PL Partner
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!isSellerActive}
            className="px-5 py-3 bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-xs font-bold rounded-2xl shadow-lg shadow-[#7E2532]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Warehouse
          </button>
        </div>
      </div>

      {/* Warning banner if seller is not active */}
      {!isSellerActive && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200/80 flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
              Seller Account Verification Required
            </h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Your seller profile status is currently{' '}
              <strong className="font-extrabold">{currentSeller?.status || 'PENDING'}</strong>. Only verified and
              ACTIVE sellers are authorized to register fulfillment hubs. Please complete your onboarding
              application or await marketplace administrator approval.
            </p>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Total Hubs</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">{totalCount}</div>
          <span className="text-[11px] text-stone-400 font-medium">Fulfillment sites</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Active Warehouses</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-950">{activeCount}</div>
          <span className="text-[11px] text-emerald-600 font-medium">Ready for dispatch</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Pending Review</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-950">{pendingCount}</div>
          <span className="text-[11px] text-amber-600 font-medium">Awaiting admin review</span>
        </div>

        <div
          onClick={() => setStatusFilter('REWORK_REQUIRED')}
          className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'REWORK_REQUIRED'
              ? 'border-orange-400 ring-2 ring-orange-400/20 bg-orange-50/20'
              : 'border-[#E8E1D7] hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Rework Required</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-orange-950">{reworkCount}</div>
          <span className="text-[11px] text-orange-600 font-medium">Corrections requested</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Primary Hub</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#7E2532] flex items-center justify-center">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-black text-[#641D26] truncate">
            {primaryWarehouse ? primaryWarehouse.warehouseCode : 'None assigned'}
          </div>
          <span className="text-[11px] text-stone-400 font-medium truncate block">
            {primaryWarehouse ? primaryWarehouse.city : 'Set primary for routing'}
          </span>
        </div>
      </div>

      {/* Rework Alert Banner */}
      {reworkCount > 0 && (
        <div className="p-4 rounded-3xl bg-orange-50 border border-orange-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-orange-950">
                Action Required: {reworkCount} Warehouse Application(s) Need Corrections
              </h4>
              <p className="text-[11px] text-orange-800 mt-0.5">
                Marketplace administrators have requested updates on submitted compliance documents. Please review feedback remarks and resubmit.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('REWORK_REQUIRED')}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-sm"
          >
            View Applications
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-[#E8E1D7] shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Type & Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-[#F3EFEA] p-1 rounded-2xl border border-[#E0D8CD]">
            {(['ALL', 'OWN', '3PL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  typeFilter === t
                    ? 'bg-gradient-to-r from-[#641D26] to-[#7E2532] text-white shadow-md shadow-[#641D26]/20 font-extrabold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                {t === 'ALL' ? 'All Types' : t === 'OWN' ? 'Seller (OWN)' : '3PL Partner'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#F3EFEA] p-1 rounded-2xl border border-[#E0D8CD]">
            {(
              [
                { id: 'ALL', label: 'All Status' },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'PENDING_APPROVAL', label: 'Pending Review' },
                { id: 'REWORK_REQUIRED', label: 'Rework Required' },
                { id: 'REJECTED', label: 'Rejected' },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === filter.id
                    ? 'bg-gradient-to-r from-[#641D26] to-[#7E2532] text-white shadow-md shadow-[#641D26]/20 font-extrabold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative flex-1 lg:max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search hub name, code, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#F3EFEA] border border-[#E0D8CD] rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 font-medium"
          />
        </div>
      </div>

      {/* Warehouse Listing Table */}
      <div className="bg-white rounded-3xl border border-[#E8E1D7] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-[#7E2532]" />
            <span className="text-xs font-semibold">Loading warehouses...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs font-bold">{error}</div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-xs font-medium space-y-2">
            <p>No warehouses found matching your filter criteria.</p>
            {isSellerActive && (
              <div className="flex items-center justify-center gap-3 mt-2">
                <button
                  onClick={() => setIsConnect3PLModalOpen(true)}
                  className="text-purple-700 font-bold hover:underline"
                >
                  Connect 3PL Partner
                </button>
                <span className="text-stone-300">•</span>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-[#7E2532] font-bold hover:underline"
                >
                  Register a new warehouse
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E8E1D7] text-stone-400 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3.5 px-6">Warehouse</th>
                  <th className="py-3.5 px-4">Operating Model</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D7]">
                {paginatedWarehouses.map((wh) => (
                  <tr key={wh.warehouseId} className="hover:bg-[#FDFBF7] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            wh.warehouseType === 'OWN'
                              ? 'bg-rose-50 text-[#7E2532]'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          <Warehouse className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-900 block text-xs">
                              {wh.warehouseName}
                            </span>
                            {wh.isPrimary && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Star className="w-2.5 h-2.5 fill-current" /> Primary
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-stone-400 font-bold block">
                            {wh.warehouseCode}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {wh.warehouseType === 'OWN' ? (
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-[#7E2532] border border-rose-200/60">
                          OWN (Seller-Operated)
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          3PL Partner Warehouse
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-stone-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>
                          {wh.city}, {wh.state}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {wh.contactPersonName ? (
                        <div>
                          <span className="font-semibold text-stone-800 block">
                            {wh.contactPersonName}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {wh.contactPhoneNumber || wh.contactEmail || ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone-300 italic">Marketplace Managed</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {wh.relationshipStatus === 'TERMINATED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                          TERMINATED
                        </span>
                      ) : wh.warehouseType === 'OWN' ? (
                        wh.status === 'ACTIVE' && wh.relationshipStatus === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> ACTIVE
                          </span>
                        ) : wh.status === 'REWORK_REQUIRED' || wh.relationshipStatus === 'REWORK_REQUIRED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            <RotateCcw className="w-3 h-3 text-orange-600" /> REWORK REQUESTED
                          </span>
                        ) : wh.status === 'PENDING_APPROVAL' || wh.relationshipStatus === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> PENDING REVIEW
                          </span>
                        ) : wh.status === 'REJECTED' || wh.relationshipStatus === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3 h-3" /> REJECTED
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                            {wh.status}
                          </span>
                        )
                      ) : (
                        // 3PL Partner warehouse relationship status
                        wh.relationshipStatus === 'ACTIVE' && wh.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> CONNECTED
                          </span>
                        ) : wh.relationshipStatus === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> PENDING LINKAGE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3 h-3" /> {wh.relationshipStatus}
                          </span>
                        )
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedWarehouseId(wh.warehouseId)}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 hover:border-[#7E2532] hover:text-[#7E2532] text-stone-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                      >
                        View Details
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reusable Pagination for Warehouses */}
        <Pagination
          {...paginationProps}
          itemLabel="warehouses"
          themeColor="burgundy"
        />
      </div>

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
