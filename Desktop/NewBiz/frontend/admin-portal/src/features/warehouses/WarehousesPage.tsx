import React, { useState, useEffect } from 'react';
import {
  Warehouse,
  Plus,
  Search,
  MapPin,
  RefreshCw,
  ChevronRight,
  Package,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { CreateWarehouseModal } from './CreateWarehouseModal.js';
import { WarehouseDetailsModal } from './WarehouseDetailsModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';

interface AssociatedSeller {
  sellerWarehouseId: number;
  sellerId: number;
  sellerCode: string;
  sellerName: string;
  businessName: string;
  email: string;
  phoneNumber?: string;
  relationshipStatus: string;
  isPrimary: boolean;
}

interface WarehouseItem {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: 'OWN' | 'THIRD_PARTY';
  contactPersonName?: string;
  contactEmail?: string;
  contactPhoneNumber?: string;
  city: string;
  state: string;
  postalCode: string;
  status: string;
  activeStaffCount: number;
  connectedSellersCount: number;
  totalProductsCount: number;
  associatedSellers?: AssociatedSeller[];
}

export const WarehousesPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters: All, Pending Applications, OWN, THIRD_PARTY
  const [viewTab, setViewTab] = useState<'ALL' | 'PENDING' | 'OWN' | 'THIRD_PARTY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (viewTab === 'OWN' || viewTab === 'THIRD_PARTY') {
        params.type = viewTab;
      }
      if (viewTab === 'PENDING') {
        params.status = 'PENDING_APPROVAL';
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await apiClient.get('/warehouses', { params });
      if (res.data.success) {
        setWarehouses(res.data.data.items);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [viewTab]);

  // Client-side pagination
  const { paginatedData: paginatedWarehouses, paginationProps } = usePagination({
    data: warehouses,
    initialPageSize: 10,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWarehouses();
  };

  // Compute metrics from current dataset
  const totalCount = warehouses.length;
  const ownCount = warehouses.filter((w) => w.warehouseType === 'OWN').length;
  const thirdPartyCount = warehouses.filter((w) => w.warehouseType === 'THIRD_PARTY').length;
  const pendingCount = warehouses.filter((w) => w.status === 'PENDING_APPROVAL').length;
  const activeCount = warehouses.filter((w) => w.status === 'ACTIVE').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#635BFF] text-xs font-bold uppercase tracking-wider mb-2">
            <Warehouse className="w-3.5 h-3.5" />
            Fulfillment Network & Operations
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Fulfillment Hubs & Warehouses
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Manage marketplace distribution centers, review seller warehouse applications, and assign authorized personnel.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-5 py-3 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#5147FF] hover:to-[#635BFF] text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> Register New Warehouse
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Total Warehouses (Purple) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#7928CA] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-purple-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
              Total Warehouses
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-purple-100/80 shadow-xs flex items-center justify-center text-purple-600">
              <Warehouse className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{totalCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Network total</p>
          </div>
        </div>

        {/* Card 2: Active Warehouses (Emerald) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#059669] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
              Active Warehouses
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-emerald-100/80 shadow-xs flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{activeCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Operational hubs ({ownCount} Own)</p>
          </div>
        </div>

        {/* Card 3: Pending Review (Amber) */}
        <div
          onClick={() => setViewTab('PENDING')}
          className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 hover:border-amber-300 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all cursor-pointer"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
              Pending Review
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-amber-100/80 shadow-xs flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{pendingCount}</div>
            <p className="text-[11px] text-amber-600 font-medium mt-1">Applications awaiting review</p>
          </div>
        </div>

        {/* Card 4: 3PL Partners (Blue) */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0070F3] rounded-l-2xl" />
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-100/60 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
              3PL Partners
            </span>
            <div className="w-10 h-10 rounded-2xl bg-white/90 border border-blue-100/80 shadow-xs flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{thirdPartyCount}</div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Third-party logistics</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-[#F8F9FE] p-1.5 rounded-2xl border border-slate-200/80 w-full sm:w-auto">
          {(
            [
              { id: 'ALL', label: 'All Warehouses' },
              { id: 'PENDING', label: 'Pending Review', count: pendingCount },
              { id: 'OWN', label: 'Platform (OWN)' },
              { id: 'THIRD_PARTY', label: '3PL Partner' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === tab.id
                  ? 'bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'PENDING' && pendingCount > 0 && (
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                    viewTab === 'PENDING'
                      ? 'bg-white text-[#635BFF]'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search warehouse name, code, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 font-medium"
            />
          </div>
          <button
            type="submit"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Search"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Warehouses Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-[#635BFF]" />
            <span className="text-xs font-semibold">Loading warehouses...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs font-bold">{error}</div>
        ) : warehouses.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs font-medium space-y-2">
            <p>No warehouses found matching the criteria.</p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="text-[#635BFF] font-bold hover:underline"
            >
              Register your first warehouse
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F9FE] border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3.5 px-6">Warehouse</th>
                  <th className="py-3.5 px-4">Operating Model</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Station Contact</th>
                  <th className="py-3.5 px-4">Sellers / Staff</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedWarehouses.map((wh) => (
                  <tr key={wh.warehouseId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50/70 text-[#635BFF] flex items-center justify-center shrink-0">
                          <Warehouse className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">{wh.warehouseName}</span>
                          <span className="font-mono text-[10px] text-slate-400 font-bold">{wh.warehouseCode}</span>
                          {wh.associatedSellers?.[0] && (
                            <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 mt-1 inline-block">
                              Seller: {wh.associatedSellers[0].sellerName} ({wh.associatedSellers[0].sellerCode})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          wh.warehouseType === 'OWN'
                            ? 'bg-indigo-50 text-[#635BFF] border border-indigo-100/60'
                            : 'bg-purple-50 text-purple-700 border border-purple-100/60'
                        }`}
                      >
                        {wh.warehouseType === 'OWN' ? 'OWN (Platform)' : 'THIRD_PARTY (3PL)'}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{wh.city}, {wh.state}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {wh.contactPersonName ? (
                        <div>
                          <span className="font-semibold text-slate-800 block">{wh.contactPersonName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{wh.contactPhoneNumber || wh.contactEmail || ''}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-900 block">{wh.connectedSellersCount} Sellers</span>
                        <span className="text-[10px] text-slate-400 font-medium">{wh.activeStaffCount} Staff Assigned</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {wh.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3" /> ACTIVE
                        </span>
                      ) : wh.status === 'PENDING_APPROVAL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> PENDING REVIEW
                        </span>
                      ) : wh.status === 'REJECTED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          REJECTED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {wh.status}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      {wh.status === 'PENDING_APPROVAL' ? (
                        <button
                          onClick={() => setSelectedWarehouseId(wh.warehouseId)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-amber-500/20 transition-all"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Review Application
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedWarehouseId(wh.warehouseId)}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-[#635BFF] hover:text-[#635BFF] text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          Manage & Staff
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Reusable Pagination Controls */}
            <Pagination {...paginationProps} itemLabel="warehouses" />
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateWarehouseModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
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
