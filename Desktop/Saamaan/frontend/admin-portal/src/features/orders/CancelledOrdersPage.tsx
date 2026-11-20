import React, { useState, useEffect } from 'react';
import {
  XCircle,
  Search,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import { OrderStatusBadge } from './OrderStatusBadge.js';
import { AdminOrderDetailModal } from './AdminOrderDetailModal.js';

interface AdminCancelledOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  cancelledAt: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  cancelledBy: string | null;
  reason: string | null;
  refundStatus: string | null;
}

export const CancelledOrdersPage: React.FC = () => {
  const [items, setItems] = useState<AdminCancelledOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
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

  const fetchCancelledOrders = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: pageSize,
      };

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await apiClient.get('/admin/orders/cancelled', { params });
      if (res.data.success) {
        setItems(res.data.data.items || []);
        if (res.data.data.pagination) {
          setTotalCount(res.data.data.pagination.total || 0);
        } else {
          setTotalCount(res.data.data.items?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load cancelled orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCancelledOrders();
  }, [page, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCancelledOrders();
  };

  const columns: ColumnDef<AdminCancelledOrder>[] = [
    {
      header: 'Order #',
      accessorKey: 'orderNumber',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-slate-900 hover:text-primary-600 transition-colors cursor-pointer">
            #{row.orderNumber}
          </span>
          <div className="text-[11px] text-slate-400">
            {row.cancelledAt
              ? `Cancelled ${new Date(row.cancelledAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`
              : new Date(row.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
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
          {row.customerPhone && (
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.customerPhone}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Cancelled By',
      accessorKey: 'cancelledBy',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
          {row.cancelledBy || 'Customer'}
        </span>
      ),
    },
    {
      header: 'Cancellation Reason',
      accessorKey: 'reason',
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 line-clamp-1 max-w-xs" title={row.reason || ''}>
          {row.reason || 'Order cancelled before fulfillment'}
        </span>
      ),
    },
    {
      header: 'Amount',
      accessorKey: 'totalAmount',
      align: 'right',
      cell: ({ row }) => (
        <span className="font-bold text-slate-900 text-xs">
          ₹{row.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Refund Status',
      accessorKey: 'refundStatus',
      cell: ({ row }) => {
        if (row.refundStatus === 'REFUND_PENDING') {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              <RotateCcw className="w-3 h-3 text-amber-600" />
              Refund Pending
            </span>
          );
        }
        return <span className="text-xs text-slate-400">Not Applicable (Unpaid)</span>;
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <OrderStatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Actions',
      align: 'center',
      cell: ({ row }) => (
        <button
          onClick={() => setSelectedOrderId(row.orderId)}
          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
          title="View Details"
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
            <XCircle className="w-6 h-6 text-rose-600" />
            Cancelled & Dropped Orders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit history of cancellations, released stock, checkout TTL expirations, and refund triggers
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
            placeholder="Search Order #, Customer, Reason..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </form>
      </div>

      {/* Cancelled Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(order) => order.orderId}
          loading={loading}
          emptyTitle="No cancelled orders found"
          emptyDescription="Orders cancelled by admins, customers, or timed-out checkout reservations will appear here."
          pagination={{ ...pagination.paginationProps, itemLabel: 'cancelled orders' }}
          onRowClick={(order) => setSelectedOrderId(order.orderId)}
        />
      </div>

      {/* Order Detail Modal */}
      {selectedOrderId && (
        <AdminOrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onOrderUpdated={fetchCancelledOrders}
        />
      )}
    </div>
  );
};
