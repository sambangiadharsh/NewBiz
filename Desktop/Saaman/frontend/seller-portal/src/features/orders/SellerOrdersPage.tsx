import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  Search,
  Package,
  Eye,
  Send,
  Warehouse,
  RefreshCw,
  X,
  MapPin,
  Calendar,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { NoResults } from '../../components/common/NoResults.js';
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

interface SellerOrder {
  SellerOrderID: string;
  OrderID: string;
  SellerOrderStatus: string;
  OrderPlacedAt: string;
  OrderUpdatedAt?: string;
  OrderNumber: string;
  MasterOrderStatus: string;
  CustomerID: string;
  CustomerFirstName: string;
  CustomerLastName: string;
  CustomerEmail?: string;
  CustomerPhone?: string;
  ShippingRecipientName?: string;
  ShippingCity?: string;
  ShippingState?: string;
  ShippingPostalCode?: string;
  TotalItemLines: number;
  TotalQuantity: number;
  SellerOrderAmount: number;
  FulfillmentID?: string;
  WarehouseID?: string;
  WarehouseName?: string;
  ShipmentID?: string;
  Carrier?: string;
  TrackingNumber?: string;
  ShipmentStatus?: string;
}

interface OrdersSummary {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
}

interface OrderDetailData {
  order: any;
  items: any[];
}

export const SellerOrdersPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [totalOrders, setTotalOrders] = useState<number>(0);

  const {
    currentPage: page,
    pageSize: limit,
    setPage,
    paginationProps,
  } = usePagination({
    totalItems: totalOrders,
    initialPage: 1,
    initialPageSize: 15,
    pageSizeOptions: [10, 15, 25, 50],
  });

  // Detail Modal / Drawer
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Dispatch Shipment Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [targetOrderForDispatch, setTargetOrderForDispatch] = useState<SellerOrder | null>(null);
  const [carrier, setCarrier] = useState<string>('BlueDart');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [packageWeight, setPackageWeight] = useState<string>('0.5');
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  const fetchSummary = async () => {
    try {
      const res = await apiClient.get('/seller/orders/summary');
      if (res.data?.data) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch orders summary', err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (selectedStatus && selectedStatus !== 'ALL') params.status = selectedStatus;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get('/seller/orders', { params });
      if (res.data?.data) {
        const items = res.data.data.items || [];
        setOrders(items);
        const total =
          res.data.data.total ??
          (res.data.data.totalPages ? res.data.data.totalPages * limit : items.length);
        setTotalOrders(total);
      }
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus, page, limit]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const handleViewDetail = async (order: SellerOrder) => {
    setDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await apiClient.get(`/seller/orders/${order.SellerOrderID}`);
      if (res.data?.data) {
        setSelectedOrderDetail(res.data.data);
      }
    } catch (err) {
      alert('Failed to load order details');
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenDispatch = (order: SellerOrder) => {
    setTargetOrderForDispatch(order);
    setCarrier(order.Carrier || 'BlueDart');
    setTrackingNumber(order.TrackingNumber || '');
    setPackageWeight('0.5');
    setDispatchModalOpen(true);
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrderForDispatch) return;
    if (!trackingNumber.trim()) {
      alert('Please enter a valid tracking number');
      return;
    }

    setSubmittingDispatch(true);
    try {
      await apiClient.post(`/seller/orders/${targetOrderForDispatch.SellerOrderID}/shipment`, {
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim(),
        packageWeight: parseFloat(packageWeight) || 0.5,
      });

      setDispatchModalOpen(false);
      fetchOrders();
      fetchSummary();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch shipment');
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const handleStatusUpdate = async (sellerOrderId: string, nextStatus: string) => {
    try {
      await apiClient.patch(`/seller/orders/${sellerOrderId}/status`, { status: nextStatus });
      fetchOrders();
      fetchSummary();
      if (selectedOrderDetail && selectedOrderDetail.order.SellerOrderID === sellerOrderId) {
        setSelectedOrderDetail({
          ...selectedOrderDetail,
          order: { ...selectedOrderDetail.order, SellerOrderStatus: nextStatus },
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update order status');
    }
  };

  const formatStatusPill = (status: string) => {
    const upper = (status || '').toUpperCase();
    switch (upper) {
      case 'PENDING':
      case 'CREATED':
      case 'CONFIRMED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            {upper}
          </span>
        );
      case 'PROCESSING':
      case 'PACKING':
      case 'READY_TO_SHIP':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
            <Package className="w-3 h-3 text-blue-500" />
            {upper.replace(/_/g, ' ')}
          </span>
        );
      case 'SHIPPED':
      case 'IN_TRANSIT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
            <Truck className="w-3 h-3 text-purple-500" />
            IN TRANSIT
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            DELIVERED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500 border border-stone-200 inline-flex items-center gap-1">
            <X className="w-3 h-3 text-stone-400" />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Clean Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-[#7E2532]" />
            Orders & Customer Shipments
          </h1>
          <p className="text-xs text-stone-500 mt-1 font-medium">
            Manage incoming orders, confirm packing, assign courier tracking numbers, and view customer details.
          </p>
        </div>

        <button
          onClick={() => {
            fetchOrders();
            fetchSummary();
          }}
          className="p-2.5 bg-white border border-[#E8E1D7] hover:bg-[#F3EFEA] text-stone-700 rounded-2xl transition-all shadow-sm self-start sm:self-auto"
          title="Refresh Orders"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-5 rounded-3xl border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-stone-900">
            {summary?.totalOrders ?? '—'}
          </div>
          <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">All-time merchant volume</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Pending Action</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600">
            {summary?.pendingOrders ?? '—'}
          </div>
          <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">Needs packing confirmation</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Ready to Ship</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700">
            {summary?.processingOrders ?? '—'}
          </div>
          <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">Packed in warehouse</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">In Transit</span>
            <Truck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700">
            {summary?.shippedOrders ?? '—'}
          </div>
          <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">Dispatched with tracking</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#E8E1D7] shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">
            {summary?.deliveredOrders ?? '—'}
          </div>
          <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">Fulfilled successfully</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#E8E1D7] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Orders' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'PROCESSING', label: 'Processing' },
            { id: 'SHIPPED', label: 'In Transit' },
            { id: 'DELIVERED', label: 'Delivered' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedStatus(tab.id);
                setPage(1);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-2xl whitespace-nowrap transition-all ${
                selectedStatus === tab.id
                  ? 'bg-[#641D26] text-white shadow-sm'
                  : 'bg-[#FBF9F6] text-stone-600 hover:bg-stone-100 border border-[#E8E1D7]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Order # or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#FBF9F6] border border-[#E8E1D7] focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium"
          />
        </form>
      </div>

      {/* Orders Table Container */}
      <TableContainer
        footer={
          <Pagination
            {...paginationProps}
            itemLabel="orders"
            themeColor="burgundy"
          />
        }
      >
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Order #</TableHead>
              <TableHead>Placed At</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead align="center">SKU Lines</TableHead>
              <TableHead align="center">Units</TableHead>
              <TableHead>Fulfillment Hub</TableHead>
              <TableHead align="right">Order Total</TableHead>
              <TableHead>Carrier / Tracking</TableHead>
              <TableHead align="center">Status</TableHead>
              <TableHead align="right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton columns={11} rows={6} />
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12">
                  <NoResults
                    description="No customer orders found in this view. Orders placed by buyers will be automatically routed here."
                    className="py-6"
                  />
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isPending =
                  order.SellerOrderStatus === 'PENDING' || order.SellerOrderStatus === 'CONFIRMED';
                const isProcessing =
                  order.SellerOrderStatus === 'PROCESSING' ||
                  order.SellerOrderStatus === 'READY_TO_SHIP';
                const placedDate = new Date(order.OrderPlacedAt);

                return (
                  <TableRow key={order.SellerOrderID}>
                    {/* Order Number */}
                    <TableCell>
                      <button
                        onClick={() => handleViewDetail(order)}
                        className="font-bold text-stone-900 hover:text-[#7E2532] font-mono hover:underline text-left block text-xs"
                      >
                        {order.OrderNumber}
                      </button>
                    </TableCell>

                    {/* Placed At (Dedicated Date Column) */}
                    <TableCell>
                      <div className="font-medium text-stone-800 text-[11px] whitespace-nowrap">
                        {placedDate.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <span className="text-[10px] text-stone-400 block font-mono">
                        {placedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </TableCell>

                    {/* Customer Name */}
                    <TableCell>
                      <div className="font-semibold text-stone-900 max-w-[140px] truncate">
                        {order.ShippingRecipientName ||
                          `${order.CustomerFirstName} ${order.CustomerLastName}`}
                      </div>
                    </TableCell>

                    {/* Destination City / State */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-stone-600 text-xs">
                        <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                        <span className="truncate max-w-[120px]">
                          {order.ShippingCity || '—'}
                          {order.ShippingState ? `, ${order.ShippingState}` : ''}
                        </span>
                      </div>
                    </TableCell>

                    {/* SKU Lines */}
                    <TableCell align="center">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-mono text-[11px] font-bold">
                        {order.TotalItemLines}
                      </span>
                    </TableCell>

                    {/* Units */}
                    <TableCell align="center">
                      <span className="font-extrabold text-stone-800 font-mono text-xs">
                        {order.TotalQuantity}
                      </span>
                    </TableCell>

                    {/* Fulfillment Hub */}
                    <TableCell>
                      <div className="font-medium text-stone-700 flex items-center gap-1.5 whitespace-nowrap">
                        <Warehouse className="w-3.5 h-3.5 text-[#7E2532] shrink-0" />
                        <span>{order.WarehouseName || 'Central Hub'}</span>
                      </div>
                    </TableCell>

                    {/* Order Total */}
                    <TableCell align="right">
                      <span className="font-black text-stone-900 font-mono text-xs">
                        ₹{Number(order.SellerOrderAmount || 0).toLocaleString()}
                      </span>
                    </TableCell>

                    {/* Carrier / Tracking */}
                    <TableCell>
                      {order.TrackingNumber ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-stone-800 text-[11px] block">
                            {order.Carrier}
                          </span>
                          <span className="font-mono text-[10px] text-burgundy-800 bg-burgundy-50 px-1.5 py-0.5 rounded border border-burgundy-200 inline-block">
                            {order.TrackingNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">Not Dispatched</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell align="center">
                      {formatStatusPill(order.SellerOrderStatus)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {/* Pack action */}
                        {isPending && (
                          <button
                            onClick={() => handleStatusUpdate(order.SellerOrderID, 'PROCESSING')}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm"
                          >
                            Pack Order
                          </button>
                        )}

                        {/* Dispatch action */}
                        {isProcessing && (
                          <button
                            onClick={() => handleOpenDispatch(order)}
                            className="px-2.5 py-1.5 bg-[#7E2532] hover:bg-[#641D26] text-white rounded-xl text-[11px] font-bold transition-all shadow-sm inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            Dispatch
                          </button>
                        )}

                        {/* View Full Detail Button */}
                        <button
                          onClick={() => handleViewDetail(order)}
                          className="p-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all inline-flex items-center shadow-xs"
                          title="View Order Details & Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* DISPATCH SHIPMENT MODAL */}
      {dispatchModalOpen && targetOrderForDispatch && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Dispatch Order Shipment</h3>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {targetOrderForDispatch.OrderNumber}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDispatchModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="mt-4 space-y-4">
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="text-xs font-semibold text-stone-600">
                  Recipient: <strong>{targetOrderForDispatch.ShippingRecipientName}</strong>
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  Destination: {targetOrderForDispatch.ShippingCity}, {targetOrderForDispatch.ShippingState}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  Package contents: {targetOrderForDispatch.TotalQuantity} item(s)
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Logistics Carrier *
                </label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30"
                >
                  <option value="BlueDart">BlueDart Express</option>
                  <option value="Delhivery">Delhivery</option>
                  <option value="DTDC">DTDC Courier</option>
                  <option value="FedEx">FedEx India</option>
                  <option value="Shadowfax">Shadowfax</option>
                  <option value="Self / Local Courier">Self / Local Courier</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Air Waybill (AWB) / Tracking Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BLU9981249912"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Dead Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={packageWeight}
                  onChange={(e) => setPackageWeight(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispatch}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#7E2532] hover:bg-[#641D26] rounded-xl shadow-md disabled:opacity-50"
                >
                  {submittingDispatch ? 'Confirming...' : 'Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ORDER DETAIL DRAWER */}
      {detailModalOpen && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Order Details
                  </span>
                  <h2 className="text-base font-black text-stone-900 font-mono">
                    {selectedOrderDetail?.order?.OrderNumber || 'Loading...'}
                  </h2>
                </div>
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="text-stone-400 hover:text-stone-600 p-1 font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {loadingDetail ? (
                <div className="py-20 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#7E2532]" />
                  Loading order line items...
                </div>
              ) : selectedOrderDetail ? (
                <div className="mt-4 space-y-5">
                  {/* Status Bar */}
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-500 uppercase font-semibold block">Fulfillment Status</span>
                      <div className="mt-0.5">
                        {formatStatusPill(selectedOrderDetail.order.SellerOrderStatus)}
                      </div>
                    </div>
                    {selectedOrderDetail.order.TrackingNumber && (
                      <div className="text-right">
                        <span className="text-[10px] text-stone-500 uppercase font-semibold block">Tracking</span>
                        <span className="text-xs font-mono font-bold text-purple-700">
                          {selectedOrderDetail.order.Carrier}: {selectedOrderDetail.order.TrackingNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Customer & Address */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                      Delivery Address
                    </span>
                    <div className="p-3.5 bg-white rounded-2xl border border-stone-200/80 text-xs text-stone-600 space-y-1">
                      <div className="font-bold text-stone-900">
                        {selectedOrderDetail.order.ShippingRecipientName}
                      </div>
                      <div>{selectedOrderDetail.order.ShippingAddressLine1}</div>
                      {selectedOrderDetail.order.ShippingAddressLine2 && (
                        <div>{selectedOrderDetail.order.ShippingAddressLine2}</div>
                      )}
                      <div>
                        {selectedOrderDetail.order.ShippingCity}, {selectedOrderDetail.order.ShippingState} - {selectedOrderDetail.order.ShippingPostalCode}
                      </div>
                      <div className="pt-1 text-[11px] text-stone-500">
                        Phone: {selectedOrderDetail.order.ShippingPhone || selectedOrderDetail.order.CustomerPhone || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Itemized Line Items */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                      Ordered Merchandise ({selectedOrderDetail.items.length} item{selectedOrderDetail.items.length > 1 ? 's' : ''})
                    </span>
                    <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-white">
                      {selectedOrderDetail.items.map((item) => (
                        <div key={item.OrderItemID} className="p-3.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-stone-900 max-w-xs truncate">
                              {item.ProductTitle || item.ProductName}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                              SKU: {item.SellerSKU} • Qty: <strong className="text-stone-700">{item.Quantity}</strong>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-stone-900 font-mono">
                              ₹{Number(item.TotalAmount).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              @ ₹{item.UnitPrice} / unit
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs space-y-1.5">
                    <div className="flex justify-between text-stone-500">
                      <span>Order Subtotal</span>
                      <span className="font-mono">₹{selectedOrderDetail.order.SubtotalAmount}</span>
                    </div>
                    {Number(selectedOrderDetail.order.DiscountAmount) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span>
                        <span className="font-mono">-₹{selectedOrderDetail.order.DiscountAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-stone-500">
                      <span>Applicable Tax</span>
                      <span className="font-mono">₹{selectedOrderDetail.order.TaxAmount}</span>
                    </div>
                    <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-sm text-stone-900">
                      <span>Order Net Total</span>
                      <span className="font-mono text-base text-[#7E2532]">₹{selectedOrderDetail.order.TotalAmount}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
