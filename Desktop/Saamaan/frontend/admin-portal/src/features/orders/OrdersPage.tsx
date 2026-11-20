import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  CreditCard,
  Truck,
  TrendingUp,
  Package,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import { OrderStatusBadge } from './OrderStatusBadge.js';
import { AdminOrderDetailModal } from './AdminOrderDetailModal.js';
import { getFullAssetUrl } from '../../lib/image.js';
import { useExport } from '../../hooks/useExport.js';
import { ExportExcelButton } from '../../components/common/ExportExcelButton.js';

interface AdminOrder {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  totalAmount: number;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  createdAt: string;
  updatedAt: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  itemsCount: number;
  firstProductImage?: string | null;
  firstProductName?: string | null;
  paymentStatus: string | null;
  paymentModeName: string | null;
  paymentModeCode: string | null;
}

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { downloadXlsx, isExporting } = useExport();

  const handleExportXlsx = () => {
    downloadXlsx(
      '/admin/orders/export-xlsx',
      {
        search: searchTerm || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      },
      `admin_orders_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

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

  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalGmv: 0,
    activeOrders: 0,
    pendingPayments: 0,
  });

  const fetchSummary = async () => {
    try {
      const res = await apiClient.get('/admin/orders/summary');
      if (res.data.success) {
        setSummary(res.data.data);
      }
    } catch {
      // ignore
    }
  };

  const fetchOrders = async () => {
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

      const res = await apiClient.get('/admin/orders', { params });
      if (res.data.success) {
        setOrders(res.data.data.items || []);
        if (res.data.data.pagination) {
          setTotalCount(res.data.data.pagination.total || 0);
        } else {
          setTotalCount(res.data.data.items?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load admin orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [page, pageSize, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const columns: ColumnDef<AdminOrder>[] = [
    {
      header: 'Order #',
      accessorKey: 'orderNumber',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-slate-900 hover:text-primary-600 transition-colors cursor-pointer">
            #{row.orderNumber}
          </span>
          <div className="text-[11px] text-slate-400">
            {new Date(row.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ),
    },
    {
      header: 'Product Preview',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.firstProductImage ? (
            <img
              src={getFullAssetUrl(row.firstProductImage)}
              alt={row.firstProductName || 'Product'}
              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="%2394a3b8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
              <Package className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 max-w-[170px]">
            <div className="text-xs font-semibold text-slate-800 truncate" title={row.firstProductName || ''}>
              {row.firstProductName || 'Ordered Item'}
            </div>
            <div className="text-[11px] text-slate-400">
              {row.itemsCount > 1 ? `+${row.itemsCount - 1} more item${row.itemsCount > 2 ? 's' : ''}` : 'Single item'}
            </div>
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
      header: 'Items',
      accessorKey: 'itemsCount',
      align: 'center',
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
          {row.itemsCount} {row.itemsCount === 1 ? 'item' : 'items'}
        </span>
      ),
    },
    {
      header: 'Total Amount',
      accessorKey: 'totalAmount',
      align: 'right',
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-bold text-slate-900 text-xs">
            ₹{row.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400">
            GST: ₹{row.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      ),
    },
    {
      header: 'Payment',
      accessorKey: 'paymentStatus',
      cell: ({ row }) => {
        const isPaid = row.paymentStatus === 'SUCCESS';
        return (
          <div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                isPaid
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isPaid ? 'Paid' : row.paymentStatus || 'Pending'}
            </span>
            {row.paymentModeName && (
              <div className="text-[10px] text-slate-400 mt-0.5">{row.paymentModeName}</div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Order Status',
      accessorKey: 'orderStatus',
      cell: ({ row }) => <OrderStatusBadge status={row.orderStatus} />,
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
            <ShoppingBag className="w-6 h-6 text-primary-600" />
            All Orders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Platform-wide master orders, transactions, and fulfillment monitoring
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <ExportExcelButton
            onClick={handleExportXlsx}
            isExporting={isExporting}
          />
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total GMV */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Gross Merchandise (GMV)</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              ₹{summary.totalGmv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Lifetime Orders</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {summary.totalOrders.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Active In-Fulfillment</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {summary.activeOrders.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Pending Payments</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {summary.pendingPayments.toLocaleString()}
            </div>
          </div>
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
            placeholder="Search by Order #, Customer, Email..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="PACKED">Packed</option>
            <option value="SHIPPED">In Transit (Shipped)</option>
            <option value="DELIVERED">Delivered</option>
            <option value="PENDING">Pending Payment</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <DataTable
          columns={columns}
          data={orders}
          keyExtractor={(order) => order.orderId}
          loading={loading}
          emptyTitle="No orders found"
          emptyDescription="Try adjusting your status filter or search query."
          pagination={{ ...pagination.paginationProps, itemLabel: 'orders' }}
          onRowClick={(order) => setSelectedOrderId(order.orderId)}
        />
      </div>

      {/* Order Detail Modal */}
      {selectedOrderId && (
        <AdminOrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onOrderUpdated={() => {
            fetchSummary();
            fetchOrders();
          }}
        />
      )}
    </div>
  );
};
