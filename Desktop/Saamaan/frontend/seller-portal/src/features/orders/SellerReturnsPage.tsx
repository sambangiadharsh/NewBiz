import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  AlertOctagon,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
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
import { Pagination } from '../../components/common/Pagination.js';
import { usePagination } from '../../hooks/usePagination.js';
import { NoResults } from '../../components/common/NoResults.js';
import { SellerReturnDetail, SellerReturnDetailModal } from './SellerReturnDetailModal.js';

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
  | 'CANCELLED';

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
}

export const SellerReturnsPage: React.FC = () => {
  const [items, setItems] = useState<SellerReturnDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ReturnFilterTab>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedReturn, setSelectedReturn] = useState<SellerReturnDetail | null>(null);

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

      const res = await apiClient.get('/seller/orders/returns', { params });
      if (res.data?.success) {
        setItems(res.data.data || []);
        setTotalCount(res.data.pagination?.total || 0);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load seller return requests:', err);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-indigo-600" />
            Customer Returns & Replacements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage return requests, verify customer claims, inspect received items, and process resolutions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchReturns()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Summary Cards */}
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
          <div className="text-[10px] text-slate-400 mt-0.5">Needs action</div>
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
          <div className="text-xl font-black text-indigo-600 mt-0.5">{summary.approved}</div>
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
          <div className="text-[10px] text-slate-400 mt-0.5">Awaiting QC</div>
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
            {summary.refunded + summary.replaced}
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

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
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
                ? 'bg-indigo-600 text-white shadow-2xs'
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

        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ticket, order, customer..."
            className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-indigo-500"
          />
        </form>
      </div>

      {/* Table */}
      <TableContainer className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket & Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Item & SKU</TableHead>
              <TableHead>Reason & Resolution</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton columns={7} rows={5} />
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <NoResults
                    title="No return tickets found"
                    description="There are no returns matching your selected status tab or search filter."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.returnRequestId} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell>
                    <div className="font-mono font-bold text-slate-900 text-xs">
                      #{row.requestNumber}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Order #{row.orderNumber}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(row.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-semibold text-slate-900 text-xs">
                      {row.customerName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                      {row.customerEmail}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-semibold text-slate-900 text-xs truncate max-w-[200px]" title={row.productName}>
                      {row.productName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      SKU: {row.variantSku} (Qty: {row.quantity})
                    </div>
                    <div className="text-[11px] font-bold text-slate-700 mt-0.5">
                      ₹{row.itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-bold text-amber-800 text-xs">
                      {row.reasonCategory.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {row.requestType} · {row.resolutionType}
                    </div>
                    {row.assets && row.assets.length > 0 && (
                      <div className="text-[10px] font-bold text-indigo-600 mt-0.5">
                        📷 {row.assets.length} Proof Photo(s) Attached
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-xs font-semibold text-slate-800">
                      {row.destinationType === 'WAREHOUSE' ? '🏢 Warehouse Dock' : '🏪 Direct Store'}
                    </div>
                    {row.qcStatus && (
                      <div className="text-[10px] font-bold text-slate-500">
                        QC: {row.qcStatus}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    {getStatusBadge(row.status)}
                  </TableCell>

                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedReturn(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review</span>
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalCount > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <Pagination {...pagination.paginationProps} />
          </div>
        )}
      </TableContainer>

      {/* Review & Action Modal */}
      {selectedReturn && (
        <SellerReturnDetailModal
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
