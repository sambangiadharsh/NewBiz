import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../lib/axios.js';
import { ApiResponse } from '../../types/auth.js';
import { DataTable, ColumnDef } from '../../components/common/DataTable.js';
import { usePagination } from '../../hooks/usePagination.js';
import {
  Search,
  RefreshCw,
  Truck,
  CheckCircle2,
  Box,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  Eye,
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal.js';

export interface FulfillmentItem {
  orderItemId: string;
  sellerProductId: string;
  productName: string;
  productCode?: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface FulfillmentOrder {
  fulfillmentId: string;
  orderId: string;
  orderNumber: string;
  sellerId: string;
  warehouseId: string;
  status: 'PENDING_PICKUP' | 'PACKING' | 'PACKED' | 'DISPATCHED' | 'DELIVERED';
  createdAt: string;
  updatedAt?: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  shippingAddress: {
    recipientName: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  invoice?: {
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    status: string;
  };
  shipment?: {
    carrier?: string;
    trackingNumber?: string;
    shippedAt?: string;
  };
  items: FulfillmentItem[];
}

export const FulfillmentsPage: React.FC = () => {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expanded row state
  const [expandedFulfillmentId, setExpandedFulfillmentId] = useState<string | null>(null);

  // Dispatch modal
  const [dispatchModalOrder, setDispatchModalOrder] = useState<FulfillmentOrder | null>(null);
  const [carrierInput, setCarrierInput] = useState<string>('Standard Delivery');
  const [trackingInput, setTrackingInput] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Invoice modal
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<FulfillmentOrder | null>(null);

  const fetchOrders = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await apiClient.get<ApiResponse<FulfillmentOrder[]>>(
        '/warehouses/my-warehouse/fulfillments'
      );
      if (res.data.success && res.data.data) {
        setOrders(res.data.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle status update
  const handleUpdateStatus = async (
    order: FulfillmentOrder,
    nextStatus: 'PACKING' | 'PACKED' | 'DISPATCHED' | 'DELIVERED',
    extra?: { carrier?: string; trackingNumber?: string }
  ) => {
    setActionLoadingId(order.fulfillmentId);
    try {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/warehouses/my-warehouse/fulfillments/${order.fulfillmentId}/status`,
        {
          status: nextStatus,
          carrier: extra?.carrier,
          trackingNumber: extra?.trackingNumber,
        }
      );

      if (res.data.success) {
        await fetchOrders(true);
        if (dispatchModalOrder) {
          setDispatchModalOrder(null);
        }
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not update status. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open invoice preview modal
  const handleOpenInvoiceModal = (order: FulfillmentOrder) => {
    setInvoiceModalOrder(order);
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (activeTab !== 'ALL' && ord.status !== activeTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchOrder = ord.orderNumber.toLowerCase().includes(q);
        const matchCustomer = `${ord.customer.firstName} ${ord.customer.lastName}`.toLowerCase().includes(q);
        const matchCity = ord.shippingAddress.city.toLowerCase().includes(q);
        const matchItem = ord.items.some(
          (it) => it.productName.toLowerCase().includes(q) || (it.sku && it.sku.toLowerCase().includes(q))
        );
        return matchOrder || matchCustomer || matchCity || matchItem;
      }
      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Reusable Pagination Hook integration
  const pagination = usePagination<FulfillmentOrder>({
    data: filteredOrders,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  });

  // KPI Counters
  const counts = useMemo(
    () => ({
      ALL: orders.length,
      PENDING_PICKUP: orders.filter((o) => o.status === 'PENDING_PICKUP').length,
      PACKING: orders.filter((o) => o.status === 'PACKING').length,
      PACKED: orders.filter((o) => o.status === 'PACKED').length,
      DISPATCHED: orders.filter((o) => o.status === 'DISPATCHED').length,
      DELIVERED: orders.filter((o) => o.status === 'DELIVERED').length,
    }),
    [orders]
  );

  // Table Columns Definition
  const columns: ColumnDef<FulfillmentOrder>[] = useMemo(
    () => [
      {
        header: 'Order Number',
        width: '180px',
        cell: (row) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-xs">{row.orderNumber}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedFulfillmentId(
                    expandedFulfillmentId === row.fulfillmentId ? null : row.fulfillmentId
                  );
                }}
                className="text-slate-400 hover:text-[#0C6E7E] transition-colors p-0.5 rounded"
                title="Toggle items view"
              >
                {expandedFulfillmentId === row.fulfillmentId ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
              <span>#{row.fulfillmentId}</span>
              <span>•</span>
              <span>
                {new Date(row.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ),
      },
      {
        header: 'Customer & Location',
        width: '220px',
        cell: (row) => (
          <div>
            <p className="font-semibold text-slate-800 text-xs truncate">
              {row.shippingAddress.recipientName}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              {row.shippingAddress.city}, {row.shippingAddress.state}
            </p>
          </div>
        ),
      },
      {
        header: 'Items to Pick',
        width: '160px',
        cell: (row) => {
          const totalUnits = row.items.reduce((sum, it) => sum + it.quantity, 0);
          return (
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                <Box className="w-3 h-3 text-slate-500" />
                {totalUnits} {totalUnits === 1 ? 'unit' : 'units'} ({row.items.length} SKU)
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                {row.items[0]?.productName}
                {row.items.length > 1 ? ` +${row.items.length - 1} more` : ''}
              </p>
            </div>
          );
        },
      },
      {
        header: 'Total Amount',
        width: '120px',
        align: 'right',
        cell: (row) => {
          const orderTotal = row.items.reduce((sum, it) => sum + it.totalAmount, 0);
          return (
            <div className="text-right">
              <span className="font-bold text-slate-900 text-xs">
                ₹{orderTotal.toLocaleString('en-IN')}
              </span>
              {row.invoice && (
                <span className="block text-[10px] text-teal-600 font-medium">
                  {row.invoice.invoiceNumber}
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: 'Status',
        width: '140px',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        header: 'Action',
        width: '210px',
        align: 'right',
        cell: (row) => {
          const isProcessing = actionLoadingId === row.fulfillmentId;

          return (
            <div className="flex items-center justify-end gap-1.5">
              {/* Step 1: Pending -> Packing */}
              {row.status === 'PENDING_PICKUP' && (
                <button
                  onClick={() => handleUpdateStatus(row, 'PACKING')}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#0C6E7E] hover:bg-[#095764] transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Box className="w-3 h-3" />
                  Start Packing
                </button>
              )}

              {/* Step 2: Packing -> Packed */}
              {row.status === 'PACKING' && (
                <button
                  onClick={() => handleUpdateStatus(row, 'PACKED')}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Mark as Packed
                </button>
              )}

              {/* Step 3: Packed -> Dispatch */}
              {row.status === 'PACKED' && (
                <>
                  <button
                    onClick={() => handleOpenInvoiceModal(row)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-[#0C6E7E] hover:bg-teal-50 border border-slate-200 transition"
                    title="View Invoice"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setDispatchModalOrder(row);
                      setTrackingInput(`TRK-${Date.now().toString().slice(-7)}`);
                    }}
                    disabled={isProcessing}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Truck className="w-3 h-3" />
                    Dispatch
                  </button>
                </>
              )}

              {/* Step 4: Dispatched -> Delivered */}
              {row.status === 'DISPATCHED' && (
                <>
                  <button
                    onClick={() => handleOpenInvoiceModal(row)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-[#0C6E7E] hover:bg-teal-50 border border-slate-200 transition"
                    title="View Invoice"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(row, 'DELIVERED')}
                    disabled={isProcessing}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Mark Delivered
                  </button>
                </>
              )}

              {/* Step 5: Delivered */}
              {row.status === 'DELIVERED' && (
                <button
                  onClick={() => handleOpenInvoiceModal(row)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-[#0C6E7E] hover:bg-teal-50 border border-slate-200 transition inline-flex items-center gap-1.5"
                  title="View Invoice"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Invoice
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [expandedFulfillmentId, actionLoadingId]
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-3.5">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Orders</h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {orders.length}
          </span>
        </div>

        <button
          onClick={() => fetchOrders(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Stats Bar (Readable Only) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Need Picking
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{counts.PENDING_PICKUP}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">New to pick</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              Packing Now
            </span>
            <Box className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{counts.PACKING}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Items being boxed</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              Ready to Ship
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{counts.PACKED}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Packed & ready</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
              Dispatched
            </span>
            <Truck className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{counts.DISPATCHED}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">With courier</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Delivered
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{counts.DELIVERED}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Completed</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { key: 'ALL', label: 'All', count: counts.ALL },
            { key: 'PENDING_PICKUP', label: 'Need Picking', count: counts.PENDING_PICKUP },
            { key: 'PACKING', label: 'Packing', count: counts.PACKING },
            { key: 'PACKED', label: 'Ready to Ship', count: counts.PACKED },
            { key: 'DISPATCHED', label: 'Dispatched', count: counts.DISPATCHED },
            { key: 'DELIVERED', label: 'Delivered', count: counts.DELIVERED },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-[#0C6E7E] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order #, customer, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0C6E7E]/20 focus:border-[#0C6E7E] transition"
          />
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchOrders(true)}
            className="px-3 py-1 bg-white border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Mature Enterprise DataTable */}
      <DataTable<FulfillmentOrder>
        columns={columns}
        data={pagination.paginatedData}
        isLoading={isLoading}
        emptyTitle="No orders found"
        emptyDescription={
          searchQuery
            ? 'No orders match your search criteria. Try a different keyword.'
            : 'There are currently no orders assigned to this warehouse under this status.'
        }
        paginationProps={pagination.paginationProps}
        keyExtractor={(row) => row.fulfillmentId}
        expandedRowId={expandedFulfillmentId}
        expandedRowRender={(row) => (
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Pick List Details for {row.orderNumber}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Delivery Address: {row.shippingAddress.addressLine1}
                  {row.shippingAddress.addressLine2 ? `, ${row.shippingAddress.addressLine2}` : ''},{' '}
                  {row.shippingAddress.city}, {row.shippingAddress.state} -{' '}
                  {row.shippingAddress.postalCode}
                  {row.shippingAddress.phone ? ` • Phone: ${row.shippingAddress.phone}` : ''}
                </p>
              </div>

              {row.invoice && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Tax Invoice: {row.invoice.invoiceNumber}
                  </span>
                  <button
                    onClick={() => handleOpenInvoiceModal(row)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[#0C6E7E] bg-white border border-teal-200 rounded-lg hover:bg-teal-50 transition shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Invoice
                  </button>
                </div>
              )}
            </div>

            {/* Sub-table of line items to pick with row and column division */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                    <th className="py-2.5 px-3 border-r border-slate-200">Item / SKU</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-200">Quantity to Pick</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {row.items.map((item) => (
                    <tr key={item.orderItemId} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <p className="font-semibold text-slate-800">{item.productName}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.sku ? `SKU: ${item.sku}` : 'SKU: Standard'}
                          {item.variantName ? ` • ${item.variantName}` : ''}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-teal-50 text-[#0C6E7E] font-bold text-xs border border-teal-200/60">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 border-r border-slate-200">
                        ₹{item.unitPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        ₹{item.totalAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      />

      {/* Dispatch Modal */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Truck className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Dispatch {dispatchModalOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Confirming dispatch permanently deducts physical stock from your warehouse and marks the
              order as Shipped.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Courier / Logistics Partner
                </label>
                <input
                  type="text"
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  placeholder="e.g. Bluedart, Delhivery, Internal Van"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tracking Number / Reference
                </label>
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="e.g. TRK-987654"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleUpdateStatus(dispatchModalOrder, 'DISPATCHED', {
                    carrier: carrierInput,
                    trackingNumber: trackingInput,
                  })
                }
                disabled={actionLoadingId === dispatchModalOrder.fulfillmentId}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Truck className="w-3.5 h-3.5" />
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Invoice Modal with Download */}
      <InvoiceModal
        isOpen={!!invoiceModalOrder}
        onClose={() => setInvoiceModalOrder(null)}
        fulfillmentId={invoiceModalOrder?.fulfillmentId || null}
        orderNumber={invoiceModalOrder?.orderNumber || null}
        invoiceNumber={invoiceModalOrder?.invoice?.invoiceNumber || null}
      />
    </div>
  );
};

function StatusBadge({ status }: { status: FulfillmentOrder['status'] }) {
  switch (status) {
    case 'PENDING_PICKUP':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Need Picking
        </span>
      );
    case 'PACKING':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Packing
        </span>
      );
    case 'PACKED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          Ready to Ship
        </span>
      );
    case 'DISPATCHED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          Dispatched
        </span>
      );
    case 'DELIVERED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Delivered
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
          {status}
        </span>
      );
  }
}
