import React, { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Building2,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';
import { usePagination } from '../../hooks/usePagination.js';
import { OrderStatusBadge } from './OrderStatusBadge.js';
import { AdminOrderDetailModal } from './AdminOrderDetailModal.js';

interface AdminFulfillment {
  fulfillmentId: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  updatedAt: string | null;
  sellerId: string;
  sellerName: string;
  sellerCode: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  carrier: string | null;
  trackingNumber: string | null;
  shipmentStatus: string | null;
  itemsCount: number;
}

export const FulfillmentsPage: React.FC = () => {
  const [items, setItems] = useState<AdminFulfillment[]>([]);
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

  const fetchFulfillments = async () => {
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

      const res = await apiClient.get('/admin/orders/fulfillments', { params });
      if (res.data.success) {
        setItems(res.data.data.items || []);
        if (res.data.data.pagination) {
          setTotalCount(res.data.data.pagination.total || 0);
        } else {
          setTotalCount(res.data.data.items?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load fulfillments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFulfillments();
  }, [page, pageSize, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchFulfillments();
  };

  const columns: ColumnDef<AdminFulfillment>[] = [
    {
      header: 'Fulfillment ID',
      accessorKey: 'fulfillmentId',
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-semibold text-slate-800 text-xs">
            FUL-{row.fulfillmentId}
          </span>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Order #{row.orderNumber}
          </div>
        </div>
      ),
    },
    {
      header: 'Warehouse Node',
      accessorKey: 'warehouseName',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <div className="font-semibold text-slate-800 text-xs">{row.warehouseName}</div>
            <div className="text-[10px] text-slate-400 font-mono">{row.warehouseCode}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Seller / Merchant',
      accessorKey: 'sellerName',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-slate-800 text-xs">{row.sellerName}</div>
          <div className="text-[10px] text-slate-400 font-mono">{row.sellerCode}</div>
        </div>
      ),
    },
    {
      header: 'Carrier & Tracking',
      accessorKey: 'trackingNumber',
      cell: ({ row }) => {
        if (!row.trackingNumber) {
          return <span className="text-xs text-slate-400 italic">Not dispatched</span>;
        }
        return (
          <div>
            <div className="font-semibold text-xs text-slate-800 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-primary-600" />
              {row.carrier || 'Logistics'}
            </div>
            <div className="text-[11px] font-mono text-slate-600 mt-0.5">{row.trackingNumber}</div>
          </div>
        );
      },
    },
    {
      header: 'Items',
      accessorKey: 'itemsCount',
      align: 'center',
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
          {row.itemsCount} units
        </span>
      ),
    },
    {
      header: 'Fulfillment Status',
      accessorKey: 'fulfillmentStatus',
      cell: ({ row }) => <OrderStatusBadge status={row.fulfillmentStatus} size="sm" />,
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
            <Truck className="w-6 h-6 text-primary-600" />
            Warehouse Fulfillments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time warehouse routing, package dispatch, and courier tracking
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
            placeholder="Search Order #, Tracking, Warehouse..."
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
            <option value="ALL">All Fulfillments</option>
            <option value="PENDING_PICKUP">Ready to Ship</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="PACKED">Packed</option>
            <option value="SHIPPED">Shipped / In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Fulfillments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(item) => item.fulfillmentId}
          loading={loading}
          emptyTitle="No fulfillments found"
          emptyDescription="Adjust your status filter or search parameters."
          pagination={{ ...pagination.paginationProps, itemLabel: 'fulfillments' }}
          onRowClick={(item) => setSelectedOrderId(item.orderId)}
        />
      </div>

      {/* Order Detail Modal */}
      {selectedOrderId && (
        <AdminOrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onOrderUpdated={fetchFulfillments}
        />
      )}
    </div>
  );
};
