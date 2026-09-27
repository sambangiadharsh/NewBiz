import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  RefreshCw,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { WarehouseVerificationReviewModal } from './WarehouseVerificationReviewModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';

interface AssociatedSeller {
  sellerWarehouseId: number;
  sellerId: number;
  sellerCode: string;
  sellerName: string;
  businessName: string;
  email: string;
  relationshipStatus: string;
  isPrimary: boolean;
}

interface WarehouseItem {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: 'OWN' | '3PL' | 'THIRD_PARTY';
  contactPersonName?: string;
  contactEmail?: string;
  contactPhoneNumber?: string;
  city: string;
  state: string;
  postalCode: string;
  status: string;
  createdAt: string;
  activeStaffCount: number;
  connectedSellersCount: number;
  totalProductsCount: number;
  associatedSellers?: AssociatedSeller[];
}

type TabType = 'ALL' | 'PENDING_APPROVAL' | 'REWORK_REQUIRED' | 'REJECTED' | 'ACTIVE';

export const WarehouseVerificationPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<TabType>('PENDING_APPROVAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OWN' | '3PL'>('ALL');

  // Selected warehouse modal
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (activeTab !== 'ALL') {
        params.status = activeTab;
      }
      if (typeFilter !== 'ALL') {
        params.type = typeFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await apiClient.get('/warehouses', { params });
      if (res.data.success) {
        setWarehouses(res.data.data.items || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch warehouse verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [activeTab, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWarehouses();
  };

  // Metrics calculation
  const pendingCount = warehouses.filter((w) => w.status === 'PENDING_APPROVAL').length;
  const reworkCount = warehouses.filter((w) => w.status === 'REWORK_REQUIRED').length;
  const activeCount = warehouses.filter((w) => w.status === 'ACTIVE').length;

  // Client-side pagination
  const { paginatedData: paginatedWarehouses, paginationProps } = usePagination({
    data: warehouses,
    initialPageSize: 10,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Verification
          </span>
        );
      case 'REWORK_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <RotateCcw className="w-3.5 h-3.5 text-orange-600" /> Rework Requested
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <Building2 className="w-4 h-4" /> Fulfillment Approvals
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Warehouse Approvals
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review onboarding submissions, verify statutory proof of dispatch, and manage warehouse rework cycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWarehouses}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab('PENDING_APPROVAL')}
          className={`p-5 rounded-3xl bg-white border transition-all cursor-pointer shadow-sm ${
            activeTab === 'PENDING_APPROVAL'
              ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Verification</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{pendingCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting admin compliance inspection</p>
        </div>

        <div
          onClick={() => setActiveTab('REWORK_REQUIRED')}
          className={`p-5 rounded-3xl bg-white border transition-all cursor-pointer shadow-sm ${
            activeTab === 'REWORK_REQUIRED'
              ? 'border-orange-400 ring-2 ring-orange-400/20 bg-orange-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rework Requested</span>
            <div className="w-9 h-9 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{reworkCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Under revision with seller</p>
        </div>

        <div
          onClick={() => setActiveTab('ACTIVE')}
          className={`p-5 rounded-3xl bg-white border transition-all cursor-pointer shadow-sm ${
            activeTab === 'ACTIVE'
              ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Warehouses</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{activeCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Operational fulfillment hubs</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(
              [
                { id: 'PENDING_APPROVAL', label: 'Pending Review' },
                { id: 'REWORK_REQUIRED', label: 'Rework Required' },
                { id: 'ACTIVE', label: 'Active Warehouses' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'ALL', label: 'All Warehouses' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Model Filter (OWN vs 3PL) */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-xs text-slate-400 font-medium">Model:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Types</option>
              <option value="OWN">OWN (Seller-Operated)</option>
              <option value="3PL">3PL Partner Hub</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by warehouse name, code, city, state, or seller..."
            className="w-full pl-10 pr-28 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#5147FF] hover:to-[#6C4BF5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
          >
            Search
          </button>
        </form>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold">Loading verification queue...</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-rose-600 text-xs font-semibold">
            {error}
          </div>
        ) : paginatedWarehouses.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No warehouses found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no warehouses matching your current filter tab or search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Warehouse & Code</th>
                  <th className="py-3 px-5">Model</th>
                  <th className="py-3 px-5">Registered Seller</th>
                  <th className="py-3 px-5">Location</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Submitted At</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedWarehouses.map((item: WarehouseItem) => {
                  const seller = item.associatedSellers?.[0];
                  return (
                    <tr
                      key={item.warehouseId}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedWarehouseId(item.warehouseId)}
                    >
                      {/* Warehouse info */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {item.warehouseName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                          {item.warehouseCode}
                        </div>
                      </td>

                      {/* Model badge */}
                      <td className="py-4 px-5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                            item.warehouseType === 'OWN'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : 'bg-purple-50 text-purple-700 border border-purple-100'
                          }`}
                        >
                          {item.warehouseType === 'OWN' ? 'OWN' : '3PL'}
                        </span>
                      </td>

                      {/* Registered Seller */}
                      <td className="py-4 px-5">
                        {seller ? (
                          <div>
                            <div className="font-semibold text-slate-800">{seller.businessName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {seller.sellerCode} • {seller.sellerName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Platform Admin Created</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.city}, {item.state}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 block font-mono mt-0.5">
                          PIN: {item.postalCode}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-5 font-mono text-[11px] text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedWarehouseId(item.warehouseId)}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                        >
                          <span>Review Dossier</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {warehouses.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <Pagination {...paginationProps} />
          </div>
        )}
      </div>

      {/* Review Dossier Modal */}
      <WarehouseVerificationReviewModal
        warehouseId={selectedWarehouseId}
        isOpen={selectedWarehouseId !== null}
        onClose={() => setSelectedWarehouseId(null)}
        onRefresh={fetchWarehouses}
      />
    </div>
  );
};
