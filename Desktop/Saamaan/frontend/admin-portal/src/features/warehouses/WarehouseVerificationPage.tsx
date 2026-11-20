import React, { useState, useEffect } from 'react';
import {
  Building2,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { WarehouseVerificationReviewModal } from './WarehouseVerificationReviewModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { SearchBar } from '../../components/common/SearchBar.js';

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

  // Global Counts (remain constant across status tab clicks)
  const [statsCounts, setStatsCounts] = useState<{
    total: number;
    pending: number;
    rework: number;
    active: number;
    rejected: number;
  }>({
    total: 0,
    pending: 0,
    rework: 0,
    active: 0,
    rejected: 0,
  });

  // Filters & Pagination
  const [activeTab, setActiveTab] = useState<TabType>('PENDING_APPROVAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OWN' | '3PL'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Selected warehouse modal
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        page,
        limit: pageSize,
      };
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
        if (res.data.data.pagination) {
          setTotalCount(res.data.data.pagination.total || 0);
        }
        if (res.data.data.counts) {
          setStatsCounts(res.data.data.counts);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch warehouses:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch warehouse verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [activeTab, typeFilter, searchQuery, page, pageSize]);

  // Metrics: Always stable from global status aggregations, never fluctuating on tab changes
  const pendingCount = statsCounts.pending;
  const reworkCount = statsCounts.rework;
  const activeCount = statsCounts.active;

  // Server-side pagination
  const pagination = usePagination({
    totalItems: totalCount,
    initialPage: page,
    initialPageSize: pageSize,
    pageSizeOptions: [10, 20, 50],
    onPageChange: (newPage) => setPage(newPage),
    onPageSizeChange: (newSize) => {
      setPageSize(newSize);
      setPage(1);
    },
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

  const columns: ColumnDef<WarehouseItem>[] = [
    {
      header: 'Warehouse & Code',
      cell: ({ row: item }) => (
        <div>
          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
            {item.warehouseName}
          </div>
          <div className="font-mono text-[11px] text-slate-500 mt-0.5">
            {item.warehouseCode}
          </div>
        </div>
      ),
    },
    {
      header: 'Model',
      cell: ({ row: item }) => (
        <span
          className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
            item.warehouseType === 'OWN'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
              : 'bg-purple-50 text-purple-700 border border-purple-100'
          }`}
        >
          {item.warehouseType === 'OWN' ? 'OWN' : '3PL'}
        </span>
      ),
    },
    {
      header: 'Registered Seller',
      cell: ({ row: item }) => {
        const seller = item.associatedSellers?.[0];
        return seller ? (
          <div>
            <div className="font-semibold text-slate-800">{seller.businessName}</div>
            <div className="text-[11px] text-slate-500 font-mono">
              {seller.sellerCode} • {seller.sellerName}
            </div>
          </div>
        ) : (
          <span className="text-slate-400 italic">Platform Admin Created</span>
        );
      },
    },
    {
      header: 'Location',
      cell: ({ row: item }) => (
        <div>
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{item.city}, {item.state}</span>
          </div>
          <span className="text-[11px] text-slate-400 block font-mono mt-0.5">
            PIN: {item.postalCode}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: ({ row: item }) => getStatusBadge(item.status),
    },
    {
      header: 'Submitted At',
      cell: ({ row: item }) => (
        <span className="font-mono text-[11px] text-slate-500">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: ({ row: item }) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedWarehouseId(item.warehouseId);
          }}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 text-xs font-bold transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer"
        >
          <span>Review Warehouse</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
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
      </div>

      {/* KPI Stats Cards (Read-only) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm select-none">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Verification</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{pendingCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting admin compliance inspection</p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm select-none">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rework Requested</span>
            <div className="w-9 h-9 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{reworkCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Under revision with seller</p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm select-none">
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
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
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
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Types</option>
              <option value="OWN">OWN (Seller-Operated)</option>
              <option value="3PL">3PL Partner Hub</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChange={(q) => {
            setSearchQuery(q);
            setPage(1);
          }}
          placeholder="Search by warehouse name, code, city, state, or seller..."
          isLoading={loading}
          className="w-full"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchWarehouses}
            className="px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-xl font-bold hover:bg-rose-100 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table */}
      <DataTable<WarehouseItem>
        columns={columns}
        data={warehouses}
        loading={loading}
        bordered={true}
        striped={true}
        maxHeight="600px"
        containerClassName="rounded-3xl"
        keyExtractor={(item) => item.warehouseId}
        onRowClick={(item) => setSelectedWarehouseId(item.warehouseId)}
        emptyTitle="No Warehouses Found"
        emptyDescription="There are no warehouses matching your current filter tab or search criteria."
        pagination={{ ...pagination.paginationProps, itemLabel: 'warehouses' }}
      />

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
