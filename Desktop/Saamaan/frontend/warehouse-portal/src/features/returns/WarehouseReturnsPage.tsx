import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DataTable, ColumnDef } from '../../components/common/DataTable.js';
import { usePagination } from '../../hooks/usePagination.js';
import { WarehouseReturnItem, WarehouseQCInspectionModal } from './WarehouseQCInspectionModal.js';

type ReturnFilterTab = 'ALL' | 'APPROVED' | 'RECEIVED' | 'QC_PASSED' | 'QC_FAILED' | 'RESOLVED';

interface ReturnSummaryCounts {
  total: number;
  approved: number;
  received: number;
  qcPassed: number;
  qcFailed: number;
  resolved: number;
}

export const WarehouseReturnsPage: React.FC = () => {
  const [items, setItems] = useState<WarehouseReturnItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ReturnFilterTab>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedReturn, setSelectedReturn] = useState<WarehouseReturnItem | null>(null);

  const [summary, setSummary] = useState<ReturnSummaryCounts>({
    total: 0,
    approved: 0,
    received: 0,
    qcPassed: 0,
    qcFailed: 0,
    resolved: 0,
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

      const res = await apiClient.get('/warehouse/returns', { params });
      if (res.data?.success) {
        setItems(res.data.data || []);
        setTotalCount(res.data.pagination?.total || 0);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load warehouse returns:', err);
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
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3 h-3 text-blue-600" />
          Incoming
        </span>
      );
    }
    if (s === 'RECEIVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
          <RotateCcw className="w-3 h-3 text-amber-600" />
          Needs QC Check
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
    if (s === 'REFUNDED' || s === 'REPLACED' || s === 'RESOLVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        REFUNDED / REPLACED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {s.replace(/_/g, ' ')}
      </span>
    );
  };

  const columns: ColumnDef<WarehouseReturnItem>[] = [
    {
      header: 'Ticket & Order',
      cell: (row) => (
        <div>
          <div className="font-mono font-bold text-slate-900 text-xs">
            #{row.requestNumber}
          </div>
          <div className="text-[11px] text-slate-500">
            Order #{row.orderNumber}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Waybill: {row.trackingNumber || 'Manual'}
          </div>
        </div>
      ),
    },
    {
      header: 'Customer',
      cell: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">
            {row.customerName}
          </div>
          <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
            {row.customerEmail}
          </div>
        </div>
      ),
    },
    {
      header: 'Product Item',
      cell: (row) => (
        <div className="max-w-[220px]">
          <div className="font-semibold text-slate-900 text-xs truncate" title={row.productName}>
            {row.productName}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            SKU: {row.variantSku} (Qty: {row.quantity})
          </div>
          <div className="text-[10px] text-indigo-600 font-medium mt-0.5">
            Seller: {row.sellerName}
          </div>
        </div>
      ),
    },
    {
      header: 'Claim & Proof',
      cell: (row) => (
        <div>
          <div className="font-bold text-amber-800 text-xs">
            {row.reasonCategory.replace(/_/g, ' ')}
          </div>
          <div className="text-[11px] text-slate-500">
            {row.requestType} ({row.resolutionType})
          </div>
          {row.assets && row.assets.length > 0 && (
            <div className="text-[10px] font-bold text-indigo-600 mt-0.5">
              📷 {row.assets.length} Photo(s) Attached
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'QC Status',
      cell: (row) => (
        <div>
          {getStatusBadge(row.status)}
          {row.qcGrade && (
            <div className="text-[10px] font-semibold text-slate-500 mt-1">
              Grade: {row.qcGrade}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={() => setSelectedReturn(row)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
            row.status === 'RECEIVED'
              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
              : row.status === 'APPROVED'
              ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>
            {row.status === 'RECEIVED'
              ? 'Start QC'
              : row.status === 'APPROVED'
              ? 'Receive'
              : 'View Details'}
          </span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-teal-600" />
            Reverse Inbound & Returns QC
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Receive customer return shipments at the warehouse dock, inspect physical item condition, and restock verified goods.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => {
            setActiveTab('APPROVED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'APPROVED'
              ? 'bg-blue-50/70 border-blue-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">Incoming</div>
          <div className="text-xl font-black text-blue-600 mt-0.5">{summary.approved}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">On the way to dock</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('RECEIVED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'RECEIVED'
              ? 'bg-amber-50/70 border-amber-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">Needs QC Check</div>
          <div className="text-xl font-black text-amber-600 mt-0.5">{summary.received}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Waiting for inspection</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('QC_PASSED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'QC_PASSED'
              ? 'bg-teal-50/60 border-teal-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">QC Passed</div>
          <div className="text-xl font-black text-teal-600 mt-0.5">{summary.qcPassed}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Restocked to shelf</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('QC_FAILED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'QC_FAILED'
              ? 'bg-rose-50/60 border-rose-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">QC Failed</div>
          <div className="text-xl font-black text-rose-600 mt-0.5">{summary.qcFailed}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Damaged / Rejected</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('RESOLVED');
            setPage(1);
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'RESOLVED'
              ? 'bg-emerald-50/60 border-emerald-300 shadow-sm'
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
          }`}
        >
          <div className="text-[11px] text-slate-500 font-medium">REFUNDED / REPLACED</div>
          <div className="text-xl font-black text-emerald-600 mt-0.5">{summary.resolved}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Refunded / Replaced</div>
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
            All Returns ({summary.total})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('APPROVED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'APPROVED'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Incoming ({summary.approved})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('RECEIVED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'RECEIVED'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Needs QC Check ({summary.received})
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
              setActiveTab('QC_FAILED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'QC_FAILED'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            QC Failed ({summary.qcFailed})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('RESOLVED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'RESOLVED'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
          REFUNDED / REPLACED ({summary.resolved})
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ticket, order, tracking #..."
            className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-teal-500"
          />
        </form>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={items}
        isLoading={loading}
        emptyTitle="No Return Shipments Found"
        emptyDescription="There are no return items matching the selected warehouse queue filter."
        paginationProps={pagination.paginationProps}
        keyExtractor={(row) => row.returnRequestId}
      />

      {/* QC Inspection Modal */}
      {selectedReturn && (
        <WarehouseQCInspectionModal
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
