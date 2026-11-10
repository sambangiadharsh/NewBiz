import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Search,
  RefreshCw,
  FileText,
  Eye,
  Check,
  Send,
  Warehouse,
  MapPin,
  X,
  Boxes,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { showAlert, showSweetToast } from '../../lib/swal.js';
import { StatsCard } from '../../components/common/StatsCard.js';
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
import { InvoicePreviewModal } from './components/InvoicePreviewModal.js';

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

interface OrderDetailData {
  order: any;
  items: any[];
}

export const OrdersToPackPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [stageFilter, setStageFilter] = useState<'ALL' | 'NEEDS_PACKING' | 'IN_PACKING' | 'READY_TO_SHIP'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination hook
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

  // Checklist Drawer & Detail Modal state
  const [checklistDrawerOpen, setChecklistDrawerOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checkedItemIds, setCheckedItemIds] = useState<Record<string, boolean>>({});

  // Invoice Preview Modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceTargetOrder, setInvoiceTargetOrder] = useState<{ id: string; number: string } | null>(null);

  // Dispatch / Handover Modal state
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [targetOrderForDispatch, setTargetOrderForDispatch] = useState<SellerOrder | null>(null);
  const [carrier, setCarrier] = useState('Delhivery');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [packageWeight, setPackageWeight] = useState('0.5');
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  // Status updating indicator
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch orders from backend
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // Map stage filter to backend status query
      let statusParam = 'TO_PACK';
      if (stageFilter === 'NEEDS_PACKING') statusParam = 'CONFIRMED';
      if (stageFilter === 'IN_PACKING') statusParam = 'PACKING';
      if (stageFilter === 'READY_TO_SHIP') statusParam = 'READY_TO_SHIP';

      const res = await apiClient.get('/seller/orders', {
        params: {
          status: statusParam,
          search: searchQuery.trim() || undefined,
          page,
          limit,
        },
      });

      if (res.data?.success && res.data?.data) {
        setOrders(res.data.data.items || []);
        setTotalOrders(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch orders to pack:', err);
    } finally {
      setLoading(false);
    }
  }, [stageFilter, searchQuery, page, limit]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Derived KPI Counts
  const kpiStats = useMemo(() => {
    let needsPacking = 0;
    let inPacking = 0;
    let readyToShip = 0;
    let totalUnits = 0;

    orders.forEach((o) => {
      const st = (o.SellerOrderStatus || '').toUpperCase();
      totalUnits += Number(o.TotalQuantity || 0);
      if (['PENDING', 'CREATED', 'CONFIRMED'].includes(st)) {
        needsPacking += 1;
      } else if (['PROCESSING', 'PACKING'].includes(st)) {
        inPacking += 1;
      } else if (['READY_TO_SHIP', 'PACKED'].includes(st)) {
        readyToShip += 1;
      }
    });

    return {
      totalToPack: totalOrders,
      needsPacking,
      inPacking,
      readyToShip,
      totalUnits,
    };
  }, [orders, totalOrders]);

  // Fetch full details for packing checklist drawer
  const handleOpenChecklist = async (sellerOrderId: string) => {
    setChecklistDrawerOpen(true);
    setDetailLoading(true);
    setCheckedItemIds({});
    try {
      const res = await apiClient.get(`/seller/orders/${sellerOrderId}`);
      if (res.data?.success && res.data?.data) {
        setSelectedOrderDetail(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load order details for packing:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Toggle item checkbox in packing checklist
  const handleToggleItemCheck = (orderItemId: string) => {
    setCheckedItemIds((prev) => ({
      ...prev,
      [orderItemId]: !prev[orderItemId],
    }));
  };

  // Check all items at once
  const handleCheckAllItems = () => {
    if (!selectedOrderDetail?.items) return;
    const allChecked: Record<string, boolean> = {};
    selectedOrderDetail.items.forEach((it) => {
      allChecked[String(it.OrderItemID)] = true;
    });
    setCheckedItemIds(allChecked);
  };

  // Status transitions
  const handleUpdateStatus = async (sellerOrderId: string, nextStatus: string) => {
    setActionLoadingId(sellerOrderId);
    try {
      await apiClient.patch(`/seller/orders/${sellerOrderId}/status`, { status: nextStatus });
      showSweetToast(`Order updated to ${nextStatus}`, 'success');
      await fetchOrders();
      if (selectedOrderDetail && String(selectedOrderDetail.order.SellerOrderID) === String(sellerOrderId)) {
        setSelectedOrderDetail({
          ...selectedOrderDetail,
          order: {
            ...selectedOrderDetail.order,
            SellerOrderStatus: nextStatus,
          },
        });
      }
    } catch (err: any) {
      showAlert('Status Update Failed', err.response?.data?.message || 'Failed to update packing status', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open invoice preview modal
  const handleOpenInvoice = (sellerOrderId: string, orderNumber: string) => {
    setInvoiceTargetOrder({ id: sellerOrderId, number: orderNumber });
    setInvoiceModalOpen(true);
  };

  // Open dispatch modal
  const handleOpenDispatch = (order: SellerOrder) => {
    setTargetOrderForDispatch(order);
    setCarrier('Delhivery');
    setTrackingNumber('');
    setPackageWeight('0.5');
    setDispatchModalOpen(true);
  };

  // Submit dispatch
  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrderForDispatch) return;

    if (!carrier.trim() || !trackingNumber.trim()) {
      showAlert('Input Required', 'Please provide both Carrier and Tracking AWB number.', 'warning');
      return;
    }

    setSubmittingDispatch(true);
    try {
      await apiClient.post(`/seller/orders/${targetOrderForDispatch.SellerOrderID}/shipment`, {
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim(),
        packageWeight: parseFloat(packageWeight) || 0.5,
      });

      showSweetToast('Shipment dispatched successfully', 'success');
      setDispatchModalOpen(false);
      if (checklistDrawerOpen) {
        setChecklistDrawerOpen(false);
      }
      await fetchOrders();
    } catch (err: any) {
      showAlert('Dispatch Failed', err.response?.data?.message || 'Failed to dispatch shipment', 'error');
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const formatStageBadge = (status: string) => {
    const upper = (status || '').toUpperCase();
    if (['PENDING', 'CREATED', 'CONFIRMED'].includes(upper)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          Needs Packing
        </span>
      );
    }
    if (['PROCESSING', 'PACKING'].includes(upper)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 inline-flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-blue-600 animate-bounce" />
          Packing in Progress
        </span>
      );
    }
    if (['READY_TO_SHIP', 'PACKED'].includes(upper)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
          Ready to Ship
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200">
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#401219] text-white rounded-xl shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-900 tracking-tight">Orders to Pack</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Verify line items, generate tax invoices, and prepare customer shipments for pickup.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrders()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatsCard
          label="Orders to Pack"
          value={kpiStats.totalToPack}
          icon={Boxes}
          loading={loading && orders.length === 0}
        />
        <StatsCard
          label="Needs Packing"
          value={kpiStats.needsPacking}
          icon={Clock}
          iconColor="text-amber-700 bg-amber-50 border-amber-200/60"
          loading={loading && orders.length === 0}
        />
        <StatsCard
          label="Packing in Progress"
          value={kpiStats.inPacking}
          icon={Package}
          iconColor="text-blue-700 bg-blue-50 border-blue-200/60"
          loading={loading && orders.length === 0}
        />
        <StatsCard
          label="Ready for Carrier"
          value={kpiStats.readyToShip}
          icon={Truck}
          iconColor="text-indigo-700 bg-indigo-50 border-indigo-200/60"
          loading={loading && orders.length === 0}
        />
      </div>

      {/* Controls: Search and Stage Filter Tabs */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Stage Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All to Pack' },
            { id: 'NEEDS_PACKING', label: 'Needs Packing' },
            { id: 'IN_PACKING', label: 'In Packing' },
            { id: 'READY_TO_SHIP', label: 'Ready to Ship' },
          ].map((tab) => {
            const active = stageFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStageFilter(tab.id as any);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#401219] text-white shadow-xs'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-stone-200/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search Order #, customer, city, SKU..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#401219]/20 focus:border-[#401219] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Orders to Pack Table */}
      <TableContainer>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Order Details</TableHead>
              <TableHead>Customer & Delivery Destination</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Items to Pack</TableHead>
              <TableHead>Packing Stage</TableHead>
              <TableHead align="right">Packing & Dispatch Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <NoResults
                    title="No Orders Awaiting Packing"
                    description={
                      searchQuery
                        ? 'No orders matched your search criteria.'
                        : 'All confirmed orders have been packed and handed over to carriers. Great job!'
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const upperStatus = (order.SellerOrderStatus || '').toUpperCase();
                const isNeedsPacking = ['PENDING', 'CREATED', 'CONFIRMED'].includes(upperStatus);
                const isInPacking = ['PROCESSING', 'PACKING'].includes(upperStatus);
                const isReadyToShip = ['READY_TO_SHIP', 'PACKED'].includes(upperStatus);

                return (
                  <TableRow key={order.SellerOrderID} className="hover:bg-stone-50/70 transition-colors">
                    {/* Order Details */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-xs font-mono">
                            {order.OrderNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.OrderPlacedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </TableCell>

                    {/* Customer & Destination */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-stone-800">
                          {order.CustomerFirstName} {order.CustomerLastName}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span>
                            {order.ShippingCity || 'City'}, {order.ShippingState || ''} ({order.ShippingPostalCode || 'PIN'})
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Fulfillment Warehouse */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-stone-700">
                        <Warehouse className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate max-w-[150px]">
                          {order.WarehouseName || 'Default Warehouse'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Items & Quantity Count */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-stone-900">
                          <Package className="w-3.5 h-3.5 text-stone-500" />
                          {order.TotalQuantity} unit{order.TotalQuantity > 1 ? 's' : ''}
                        </span>
                        <div className="text-[10px] text-stone-400 font-medium">
                          ({order.TotalItemLines} line item{order.TotalItemLines > 1 ? 's' : ''})
                        </div>
                      </div>
                    </TableCell>

                    {/* Packing Stage Badge */}
                    <TableCell>{formatStageBadge(order.SellerOrderStatus)}</TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Open Packing Checklist */}
                        <button
                          onClick={() => handleOpenChecklist(order.SellerOrderID)}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                          title="Open Item Checklist"
                        >
                          <Eye className="w-3.5 h-3.5 text-stone-500" />
                          <span>Pack Order</span>
                        </button>

                        {/* Quick Invoice / Packing Slip Preview */}
                        <button
                          onClick={() => handleOpenInvoice(order.SellerOrderID, order.OrderNumber)}
                          className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-all cursor-pointer"
                          title="Print Packing Slip / Tax Invoice"
                        >
                          <FileText className="w-4 h-4 text-stone-600" />
                        </button>

                        {/* Stage Progression Action Buttons */}
                        {isNeedsPacking && (
                          <button
                            onClick={() => handleUpdateStatus(order.SellerOrderID, 'PACKING')}
                            disabled={actionLoadingId === order.SellerOrderID}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Start Packing</span>
                          </button>
                        )}

                        {isInPacking && (
                          <button
                            onClick={() => handleUpdateStatus(order.SellerOrderID, 'READY_TO_SHIP')}
                            disabled={actionLoadingId === order.SellerOrderID}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Packed</span>
                          </button>
                        )}

                        {isReadyToShip && (
                          <button
                            onClick={() => handleOpenDispatch(order)}
                            className="px-3 py-1.5 bg-[#401219] hover:bg-[#52161E] text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Dispatch</span>
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        {!loading && orders.length > 0 && <Pagination {...paginationProps} />}
      </TableContainer>

      {/* Slide-over Packing Checklist Drawer */}
      {checklistDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#401219] text-white rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">
                    Packing Checklist • {selectedOrderDetail?.order?.OrderNumber}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Verify every physical product before sealing the packaging.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChecklistDrawerOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detailLoading ? (
                <div className="py-16 text-center text-stone-500 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#401219]" />
                  Loading order items...
                </div>
              ) : selectedOrderDetail ? (
                <>
                  {/* Delivery Info Box */}
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                        Ship To Customer
                      </span>
                      {formatStageBadge(selectedOrderDetail.order.SellerOrderStatus)}
                    </div>
                    <div className="text-sm font-bold text-stone-900">
                      {selectedOrderDetail.order.ShippingRecipientName ||
                        `${selectedOrderDetail.order.CustomerFirstName} ${selectedOrderDetail.order.CustomerLastName}`}
                    </div>
                    <div className="text-xs text-stone-600 leading-relaxed">
                      {selectedOrderDetail.order.ShippingAddressLine1}
                      {selectedOrderDetail.order.ShippingAddressLine2 && `, ${selectedOrderDetail.order.ShippingAddressLine2}`}
                      <br />
                      {selectedOrderDetail.order.ShippingCity}, {selectedOrderDetail.order.ShippingState} -{' '}
                      {selectedOrderDetail.order.ShippingPostalCode}
                    </div>
                    {selectedOrderDetail.order.CustomerPhone && (
                      <div className="text-xs text-stone-500">
                        Phone: {selectedOrderDetail.order.CustomerPhone}
                      </div>
                    )}
                  </div>

                  {/* Checklist Items Container */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                          Item Verification Checklist
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
                          {Object.values(checkedItemIds).filter(Boolean).length} /{' '}
                          {selectedOrderDetail.items.length} Packed
                        </span>
                      </div>
                      <button
                        onClick={handleCheckAllItems}
                        className="text-xs font-bold text-[#401219] hover:underline cursor-pointer"
                      >
                        Check All
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 transition-all duration-300"
                        style={{
                          width: `${
                            selectedOrderDetail.items.length > 0
                              ? (Object.values(checkedItemIds).filter(Boolean).length /
                                  selectedOrderDetail.items.length) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    {/* Line Items List */}
                    <div className="space-y-2 pt-1">
                      {selectedOrderDetail.items.map((item) => {
                        const isChecked = !!checkedItemIds[String(item.OrderItemID)];
                        return (
                          <div
                            key={item.OrderItemID}
                            onClick={() => handleToggleItemCheck(String(item.OrderItemID))}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                              isChecked
                                ? 'bg-emerald-50/50 border-emerald-300 text-stone-900'
                                : 'bg-white border-stone-200 hover:border-stone-300 text-stone-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-xs font-bold leading-snug ${isChecked ? 'line-through text-stone-500' : ''}`}>
                                  {item.ProductName || `Product #${item.SellerProductID}`}
                                </span>
                                <span className="text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-lg shrink-0">
                                  Qty: {item.Quantity}
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                                {item.SKU && <span>SKU: {item.SKU}</span>}
                                {item.VariantName && <span>Variant: {item.VariantName}</span>}
                                <span>Unit: ₹{Number(item.UnitPrice).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Footer within Drawer */}
                  <div className="pt-4 border-t border-stone-200 space-y-2">
                    <button
                      onClick={() =>
                        handleOpenInvoice(
                          selectedOrderDetail.order.SellerOrderID,
                          selectedOrderDetail.order.OrderNumber
                        )
                      }
                      className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-stone-200"
                    >
                      <FileText className="w-4 h-4 text-stone-600" />
                      <span>Print Packing Slip & Tax Invoice (PDF)</span>
                    </button>

                    {selectedOrderDetail.order.SellerOrderStatus !== 'READY_TO_SHIP' ? (
                      <button
                        onClick={async () => {
                          await handleUpdateStatus(selectedOrderDetail.order.SellerOrderID, 'READY_TO_SHIP');
                          setChecklistDrawerOpen(false);
                        }}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirm All Items Verified & Mark as Packed</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          handleOpenDispatch(selectedOrderDetail.order as any);
                        }}
                        className="w-full py-2.5 px-4 bg-[#401219] hover:bg-[#52161E] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Ready for Handover • Enter Carrier & Tracking</span>
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Dispatch / Handover Modal */}
      {dispatchModalOpen && targetOrderForDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Dispatch Shipment</h3>
                  <p className="text-xs text-stone-500">
                    Order #{targetOrderForDispatch.OrderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDispatchModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDispatch} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Logistics Carrier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#401219]/20"
                >
                  <option value="Delhivery">Delhivery</option>
                  <option value="BlueDart">Blue Dart Express</option>
                  <option value="DTDC">DTDC Express</option>
                  <option value="FedEx">FedEx India</option>
                  <option value="Ecom Express">Ecom Express</option>
                  <option value="India Post">India Post Speed Post</option>
                  <option value="Xpressbees">Xpressbees</option>
                  <option value="Shadowfax">Shadowfax</option>
                  <option value="Standard Courier">Standard Courier</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tracking / AWB Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. DEL1234567890IN"
                  className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#401219]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Package Weight (Kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={packageWeight}
                  onChange={(e) => setPackageWeight(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#401219]/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispatch}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#401219] hover:bg-[#52161E] rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingDispatch ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Confirm Handover & Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice / Packing Slip Preview Modal */}
      {invoiceModalOpen && invoiceTargetOrder && (
        <InvoicePreviewModal
          isOpen={invoiceModalOpen}
          onClose={() => {
            setInvoiceModalOpen(false);
            setInvoiceTargetOrder(null);
          }}
          sellerOrderId={invoiceTargetOrder.id}
          orderNumber={invoiceTargetOrder.number}
        />
      )}
    </div>
  );
};
