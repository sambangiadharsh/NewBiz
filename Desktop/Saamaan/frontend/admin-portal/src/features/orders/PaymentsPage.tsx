import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import { AdminOrderDetailModal } from './AdminOrderDetailModal.js';

interface AdminPayment {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  paymentStatus: string;
  gatewayReference: string | null;
  paidAt: string | null;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  paymentModeName: string;
  paymentModeCode: string;
  paymentModeType: string;
}

export const PaymentsPage: React.FC = () => {
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: pageSize,
      };

      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await apiClient.get('/admin/orders/payments', { params });
      if (res.data.success) {
        setItems(res.data.data.items || []);
        if (res.data.data.pagination) {
          setTotalCount(res.data.data.pagination.total || 0);
        } else {
          setTotalCount(res.data.data.items?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, pageSize, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  const columns: ColumnDef<AdminPayment>[] = [
    {
      header: 'Payment ID',
      accessorKey: 'paymentId',
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-semibold text-slate-800 text-xs">
            PAY-{row.paymentId}
          </span>
          <div className="text-[11px] text-slate-500 mt-0.5">
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
          <div className="text-[11px] text-slate-500">{row.customerEmail}</div>
        </div>
      ),
    },
    {
      header: 'Gateway Reference',
      accessorKey: 'gatewayReference',
      cell: ({ row }) => (
        <div>
          <div className="font-mono text-xs text-slate-800">
            {row.gatewayReference || <span className="text-slate-400 italic">N/A</span>}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {row.paymentModeName} ({row.paymentModeCode})
          </div>
        </div>
      ),
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      align: 'right',
      cell: ({ row }) => (
        <span className="font-bold text-slate-900 text-xs">
          ₹{row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'paymentStatus',
      cell: ({ row }) => {
        let badge = 'bg-slate-50 text-slate-700 border-slate-200';
        let dot = 'bg-slate-400';
        let label = row.paymentStatus;

        if (row.paymentStatus === 'SUCCESS') {
          badge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          dot = 'bg-emerald-500';
          label = 'Captured (Success)';
        } else if (row.paymentStatus === 'REFUND_PENDING') {
          badge = 'bg-amber-50 text-amber-800 border-amber-300';
          dot = 'bg-amber-500';
          label = 'Refund Pending';
        } else if (row.paymentStatus === 'PENDING') {
          badge = 'bg-amber-50 text-amber-700 border-amber-200';
          dot = 'bg-amber-500';
          label = 'Pending Gateway';
        } else if (row.paymentStatus === 'FAILED') {
          badge = 'bg-rose-50 text-rose-700 border-rose-200';
          dot = 'bg-rose-500';
          label = 'Declined / Failed';
        }

        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
          </span>
        );
      },
    },
    {
      header: 'Timestamp',
      accessorKey: 'paidAt',
      cell: ({ row }) => (
        <div className="text-xs text-slate-600">
          {row.paidAt
            ? new Date(row.paidAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : new Date(row.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
        </div>
      ),
    },
    {
      header: 'Actions',
      align: 'center',
      cell: ({ row }) => (
        <button
          onClick={() => setSelectedOrderId(row.orderId)}
          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
          title="View Master Order"
        >
          <Eye className="w-4 h-4" />
          <span>View</span>
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
            <CreditCard className="w-6 h-6 text-primary-600" />
            Payments & Transactions
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Payment gateway verification, ledger reconciliations, and transaction audit trails
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Order #, Ref ID, Customer..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="SUCCESS">Captured (Success)</option>
            <option value="REFUND_PENDING">Refund Pending</option>
            <option value="PENDING">Pending Gateway</option>
            <option value="FAILED">Declined / Failed</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(item) => item.paymentId}
          loading={loading}
          emptyTitle="No payment transactions found"
          emptyDescription="Adjust your status filter or search parameters."
          pagination={{ ...pagination.paginationProps, itemLabel: 'payments' }}
          onRowClick={(item) => setSelectedOrderId(item.orderId)}
        />
      </div>

      {/* Order Detail Modal */}
      {selectedOrderId && (
        <AdminOrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onOrderUpdated={fetchPayments}
        />
      )}
    </div>
  );
};
