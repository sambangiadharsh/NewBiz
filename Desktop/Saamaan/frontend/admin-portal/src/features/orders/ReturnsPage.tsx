import React, { useState, useEffect } from 'react';
import {
  Undo2,
  RefreshCw,
  Search,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  AlertOctagon,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import { AdminReturnDetail, AdminReturnDetailModal } from './AdminReturnDetailModal.js';

type ReturnFilterTab =
  | 'ALL'
  | 'REQUESTED'
  | 'APPROVED'
  | 'RECEIVED'
  | 'QC_PASSED'
  | 'QC_FAILED'
  | 'REFUNDED'
  | 'REPLACED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'RESOLVED';

interface ReturnSummaryCounts {
  total: number;
  requested: number;
  approved: number;
  received: number;
  qcPassed: number;
  qcFailed: number;
  refunded: number;
  replaced: number;
  rejected: number;
  cancelled: number;
  inProgress?: number;
  resolved?: number;
}

export const ReturnsPage: React.FC = () => {
  const [items, setItems] = useState<AdminReturnDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ReturnFilterTab>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedReturn, setSelectedReturn] = useState<AdminReturnDetail | null>(null);

  const [summary, setSummary] = useState<ReturnSummaryCounts>({
    total: 0,
    requested: 0,
    approved: 0,
    received: 0,
    qcPassed: 0,
    qcFailed: 0,
    refunded: 0,
    replaced: 0,
    rejected: 0,
    cancelled: 0,
  });

  const pagination = usePagination({
    totalItems: totalCount,
    initialPage: page,
    initialPageSize: pageSize,
    pageSizeOptions: [10, 20, 50],
    onPageChange: (newPage: number) => setPage(newPage),
    onPageSizeChange: (newSize: number) => {
      setPageSize(newSize);
      setPage(1);
    },
  });

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: pageSize,
      };

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (activeTab !== 'ALL') {
        params.status = activeTab;
      }

      const res = await apiClient.get('/orders/returns', { params });
      if (res.data?.success) {
        setItems(res.data.data || []);
        setTotalCount(res.data.pagination?.total || 0);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load return requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [page, pageSize, activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReturns();
  };

  const getStatusBadge = (status: string) => {
    const s = (status || 'REQUESTED').toUpperCase();
    if (s === 'REQUESTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-500" />
          Pending Review
        </span>
      );
    }
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <CheckCircle2 className="w-3 h-3 text-indigo-600" />
          Approved (Pickup Awaited)
        </span>
      );
    }
    if (s === 'RECEIVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <RotateCcw className="w-3 h-3 text-purple-600" />
          Received at Facility
        </span>
      );
    }
    if (s === 'QC_PASSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
          <CheckCircle2 className="w-3 h-3 text-teal-600" />
          QC Passed
        </span>
      );
    }
    if (s === 'QC_FAILED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" />
          QC Failed
        </span>
      );
    }
    if (s === 'REFUNDED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          Refunded
        </span>
      );
    }
    if (s === 'REPLACED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <RefreshCw className="w-3 h-3 text-emerald-500" />
          Replaced
        </span>
      );
    }
    if (s === 'IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
          <RefreshCw className="w-3 h-3 text-sky-600 animate-spin-slow" />
          In Progress
        </span>
      );
    }
    if (s === 'RESOLVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          Resolved
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
          <AlertOctagon className="w-3 h-3 text-slate-400" />
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3 h-3 text-rose-500" />
        Rejected
      </span>
    );
  };

  const columns: ColumnDef<AdminReturnDetail>[] = [
    {
      header: 'Ticket & Order',
      accessorKey: 'requestNumber',
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-black text-slate-900 text-xs hover:text-[#635BFF] transition-colors">
            #{row.requestNumber}
          </span>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
            Order #{row.orderNumber}
          </div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessorKey: 'customerName',
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-slate-800 text-xs">{row.customerName}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{row.customerPhone || row.customerEmail}</div>
        </div>
      ),
    },
    {
      header: 'Item & Variant',
      accessorKey: 'productName',
      cell: ({ row }) => (
        <div className="max-w-xs">
          <div className="font-semibold text-slate-800 text-xs truncate" title={row.productName}>
            {row.productName}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
            SKU: {row.variantSku} · Qty: {row.quantity}
          </div>
        </div>
      ),
    },
    {
      header: 'Resolution & Policy',
      accessorKey: 'requestType',
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-1 font-bold text-xs text-slate-900">
            {row.requestType === 'REPLACEMENT' ? (
              <span className="text-amber-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Replacement
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                Refund (₹{row.itemTotal.toFixed(2)})
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
            {row.policy.policyName}
          </div>
        </div>
      ),
    },
    {
      header: 'Reason / Issue',
      accessorKey: 'reasonCategory',
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <span className="font-semibold text-slate-800 text-xs capitalize block truncate">
            {row.reasonCategory.replace(/_/g, ' ').toLowerCase()}
          </span>
          <span className="text-[11px] text-slate-500 line-clamp-1 italic">
            "{row.reasonDescription || 'No description'}"
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => getStatusBadge(row.status),
    },
    {
      header: 'Requested Date',
      accessorKey: 'createdAt',
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {new Date(row.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      header: 'Action',
      id: 'actions',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setSelectedReturn(row)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-[#635BFF]" />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Undo2 className="w-6 h-6 text-[#635BFF]" />
            Return & Replacement Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Lean 5-state RMA pipeline: Review requests, manage active processing, and resolve refunds/exchanges
          </p>
        </div>

        <button
          type="button"
          onClick={fetchReturns}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Granular Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => {
            setActiveTab('REQUESTED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'REQUESTED'
              ? 'bg-amber-50/60 border-amber-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">Pending Review</div>
          <div className="text-xl font-black text-amber-600 mt-0.5">{summary.requested}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Awaiting decision</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('APPROVED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'APPROVED'
              ? 'bg-indigo-50/60 border-indigo-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">Approved</div>
          <div className="text-xl font-black text-[#635BFF] mt-0.5">{summary.approved}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pickup/Return ready</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('RECEIVED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'RECEIVED'
              ? 'bg-purple-50/60 border-purple-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">Received</div>
          <div className="text-xl font-black text-purple-600 mt-0.5">{summary.received}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">At warehouse/seller</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('QC_PASSED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'QC_PASSED'
              ? 'bg-teal-50/60 border-teal-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">QC Passed</div>
          <div className="text-xl font-black text-teal-600 mt-0.5">{summary.qcPassed}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Ready for payout</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('REFUNDED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'REFUNDED' || activeTab === 'REPLACED'
              ? 'bg-emerald-50/60 border-emerald-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">Resolved</div>
          <div className="text-xl font-black text-emerald-600 mt-0.5">
            {summary.refunded + summary.replaced + (summary.resolved || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Refunded / Replaced</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('REJECTED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'REJECTED'
              ? 'bg-rose-50/60 border-rose-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">Rejected / Cancelled</div>
          <div className="text-xl font-black text-rose-600 mt-0.5">
            {summary.rejected + summary.cancelled}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {summary.rejected} rejected · {summary.cancelled} cancelled
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ALL');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({summary.total})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REQUESTED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'REQUESTED'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pending Review ({summary.requested})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('APPROVED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'APPROVED'
                ? 'bg-[#635BFF] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Approved ({summary.approved})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('RECEIVED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'RECEIVED'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Received ({summary.received})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('QC_PASSED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'QC_PASSED'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            QC Passed ({summary.qcPassed})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REFUNDED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'REFUNDED'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Refunded ({summary.refunded})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REPLACED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'REPLACED'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Replaced ({summary.replaced})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REJECTED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rejected ({summary.rejected})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('CANCELLED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'CANCELLED'
                ? 'bg-slate-700 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cancelled ({summary.cancelled})
          </button>
        </div>

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Ticket, Order, SKU, Customer..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:border-[#635BFF] transition-colors"
          />
        </form>
      </div>

      {/* Live Returns Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(it) => it.returnRequestId}
          loading={loading}
          pagination={{ ...pagination.paginationProps, itemLabel: 'return tickets' }}
        />
      </div>

      {/* Ticket Details & Action Modal */}
      {selectedReturn && (
        <AdminReturnDetailModal
          item={selectedReturn}
          onClose={() => setSelectedReturn(null)}
          onUpdated={() => {
            setSelectedReturn(null);
            fetchReturns();
          }}
        />
      )}
    </div>
  );
};
