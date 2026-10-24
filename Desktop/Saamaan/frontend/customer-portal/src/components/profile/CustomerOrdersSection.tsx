import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Search,
  Truck,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  MapPin,
  Calendar,
  Loader2,
  X,
  ShoppingBag,
} from 'lucide-react';
import { CustomerOrder, ordersApi } from '../../lib/ordersApi';
import { getImageUrl } from '../../lib/productsApi';

interface CustomerOrdersSectionProps {
  orders: CustomerOrder[];
  loadingOrders: boolean;
  onOpenTrackOrder?: () => void;
}

type FilterTab = 'ALL' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED';

export const CustomerOrdersSection: React.FC<CustomerOrdersSectionProps> = ({
  orders,
  loadingOrders,
  onOpenTrackOrder,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{ id: string; message: string } | null>(null);

  // Static tracking modal state
  const [trackingModalOrder, setTrackingModalOrder] = useState<CustomerOrder | null>(null);

  const handleCopyOrderNumber = (orderNum: string, orderId: string) => {
    navigator.clipboard.writeText(orderNum);
    setCopiedOrderId(orderId);
    setTimeout(() => {
      setCopiedOrderId(null);
    }, 2000);
  };

  const handleDownloadInvoice = async (order: CustomerOrder) => {
    try {
      setDownloadingOrderId(order.orderId);
      setDownloadError(null);
      await ordersApi.downloadInvoicePdf(order.orderId, order.orderNumber);
    } catch (err: any) {
      console.error('Invoice download failed:', err);
      setDownloadError({
        id: order.orderId,
        message: err.message || 'Could not download invoice. Please try again.',
      });
    } finally {
      setDownloadingOrderId(null);
    }
  };

  // Filter & Search Logic
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const statusUpper = (ord.status || 'CONFIRMED').toUpperCase();

      // Tab filtering
      if (activeTab === 'ACTIVE') {
        const isDelivered = statusUpper === 'DELIVERED';
        const isCancelled = statusUpper === 'CANCELLED' || statusUpper === 'RETURNED';
        if (isDelivered || isCancelled) return false;
      } else if (activeTab === 'DELIVERED') {
        if (statusUpper !== 'DELIVERED') return false;
      } else if (activeTab === 'CANCELLED') {
        if (statusUpper !== 'CANCELLED' && statusUpper !== 'RETURNED') return false;
      }

      // Search query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrderNum = ord.orderNumber.toLowerCase().includes(q);
        const matchesItem = ord.items.some(
          (it) =>
            it.productName.toLowerCase().includes(q) ||
            (it.sellerSku && it.sellerSku.toLowerCase().includes(q))
        );
        return matchesOrderNum || matchesItem;
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Tab counts
  const tabCounts = useMemo(() => {
    let active = 0;
    let delivered = 0;
    let cancelled = 0;

    orders.forEach((ord) => {
      const s = (ord.status || 'CONFIRMED').toUpperCase();
      if (s === 'DELIVERED') {
        delivered++;
      } else if (s === 'CANCELLED' || s === 'RETURNED') {
        cancelled++;
      } else {
        active++;
      }
    });

    return { all: orders.length, active, delivered, cancelled };
  }, [orders]);

  const getStatusBadge = (status?: string) => {
    const s = (status || 'CONFIRMED').toUpperCase();
    if (s === 'DELIVERED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Delivered
        </span>
      );
    }
    if (s === 'SHIPPED' || s === 'DISPATCHED' || s === 'IN_TRANSIT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 text-xs font-bold shadow-2xs">
          <Truck className="w-3.5 h-3.5 text-sky-600" />
          On The Way
        </span>
      );
    }
    if (s === 'CANCELLED' || s === 'RETURNED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 text-xs font-bold shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          {s === 'CANCELLED' ? 'Cancelled' : 'Returned'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-xs font-bold shadow-2xs">
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        {status || 'Confirmed'}
      </span>
    );
  };

  return (
    <div id="my-orders-section" className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-card space-y-6">
      {/* ─── Header & Search ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">My Orders</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-extrabold border border-primary-100">
              {orders.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your purchases, download tax invoices, and track parcel deliveries
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order # or item..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100/70'
          }`}
        >
          All Orders
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {tabCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'ACTIVE'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100/70'
          }`}
        >
          Active / In Transit
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'ACTIVE' ? 'bg-primary-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {tabCounts.active}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DELIVERED')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'DELIVERED'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100/70'
          }`}
        >
          Delivered
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'DELIVERED' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {tabCounts.delivered}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CANCELLED')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'CANCELLED'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100/70'
          }`}
        >
          Cancelled
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'CANCELLED' ? 'bg-rose-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {tabCounts.cancelled}
          </span>
        </button>
      </div>

      {/* ─── Loading Skeletons ────────────────────────────────────────────── */}
      {loadingOrders ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 p-5 space-y-4 animate-pulse bg-slate-50/40"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="h-4 bg-slate-200 rounded w-44" />
                <div className="h-6 bg-slate-200 rounded-full w-24" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-200 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                </div>
                <div className="h-4 bg-slate-200 rounded w-16" />
              </div>
              <div className="h-10 bg-slate-200 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        /* ─── Zero Orders Placed Empty State ─────────────────────────────── */
        <div className="py-14 px-4 rounded-3xl border border-dashed border-slate-200 text-center space-y-3.5 bg-slate-50/30">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 mx-auto flex items-center justify-center shadow-xs">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No orders placed yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Looks like you haven't bought anything yet. Explore our latest collection and place your first order today!
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs transition-colors shadow-sm"
          >
            <ShoppingBag className="w-4 h-4" />
            Start Shopping
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        /* ─── Filter Empty State ─────────────────────────────────────────── */
        <div className="py-12 px-4 rounded-2xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/20">
          <p className="text-sm font-bold text-slate-800">No matching orders found</p>
          <p className="text-xs text-slate-400">
            No orders match the selected filter or search term "{searchQuery}".
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ALL');
              setSearchQuery('');
            }}
            className="mt-2 text-xs font-bold text-primary-600 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* ─── Orders List ────────────────────────────────────────────────── */
        <div className="space-y-5">
          {filteredOrders.map((ord) => {
            const formattedDate = new Date(ord.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            const isDelivered = (ord.status || '').toUpperCase() === 'DELIVERED';
            const isDownloading = downloadingOrderId === ord.orderId;
            const hasError = downloadError && downloadError.id === ord.orderId;

            return (
              <div
                key={ord.orderId}
                className="rounded-2xl border border-slate-200/90 overflow-hidden hover:border-slate-300 transition-all shadow-2xs hover:shadow-sm bg-white"
              >
                {/* ── Top Bar: Order ID, Date, Status, Total ── */}
                <div className="bg-slate-50/90 px-4 sm:px-6 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      <span>#{ord.orderNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyOrderNumber(ord.orderNumber, ord.orderId)}
                        title="Copy Order Number"
                        className="text-slate-400 hover:text-slate-600 transition-colors ml-0.5"
                      >
                        {copiedOrderId === ord.orderId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <span className="text-slate-300 hidden sm:inline">•</span>

                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formattedDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(ord.status)}
                    <span className="font-black text-sm sm:text-base text-slate-900">
                      ₹{ord.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* ── Order Line Items ── */}
                <div className="p-4 sm:p-6 divide-y divide-slate-100">
                  {ord.items.map((it) => (
                    <div
                      key={it.orderItemId}
                      className="py-3.5 first:pt-0 last:pb-0 flex items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        {it.thumbnail ? (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            <img
                              src={getImageUrl(it.thumbnail)}
                              alt={it.productName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const container = e.currentTarget.parentElement as HTMLElement;
                                if (container) container.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center flex-shrink-0 text-slate-400">
                            <Package className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {it.productName}
                          </h4>

                          {/* Variant Attributes & SKU Pill */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {it.sellerSku && (
                              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                SKU: {it.sellerSku}
                              </span>
                            )}
                            {it.attributes &&
                              Object.entries(it.attributes).map(([key, val]) => (
                                <span
                                  key={key}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary-50 text-primary-700 capitalize"
                                >
                                  {key}: {String(val)}
                                </span>
                              ))}
                          </div>

                          <p className="text-[11px] text-slate-500 mt-1">
                            Qty: <strong className="text-slate-800">{it.quantity}</strong> · ₹
                            {it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} each
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs sm:text-sm font-black text-slate-900">
                          ₹{it.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        {it.mrp > it.unitPrice && (
                          <p className="text-[10px] text-slate-400 line-through">
                            ₹{(it.mrp * it.quantity).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Error Banner (if invoice failed) ── */}
                {hasError && (
                  <div className="px-4 sm:px-6 py-2 bg-rose-50 border-t border-rose-100 flex items-center justify-between text-xs text-rose-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      {downloadError.message}
                    </span>
                    <button
                      onClick={() => setDownloadError(null)}
                      className="text-rose-500 hover:text-rose-800 font-bold"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* ── Order Footer: Meta & Action Bar ── */}
                <div className="bg-slate-50/70 px-4 sm:px-6 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {/* Left: Shipping Delivery Destination */}
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    {ord.shippingAddress?.city ? (
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Deliver to <strong className="text-slate-800">{ord.shippingAddress.recipientName}</strong> ({ord.shippingAddress.city})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Standard Delivery
                      </span>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Track Order CTA */}
                    <button
                      type="button"
                      onClick={() => setTrackingModalOrder(ord)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors shadow-2xs"
                    >
                      <Truck className="w-3.5 h-3.5 text-primary-600" />
                      Track Details
                    </button>

                    {/* Download Invoice Button: STRICTLY VISIBLE ONLY WHEN DELIVERED (Option B) */}
                    {isDelivered && (
                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => handleDownloadInvoice(ord)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Download Invoice</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Static Track Details Modal ────────────────────────────────────── */}
      {trackingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Shipment Tracking</h3>
                  <p className="text-[11px] font-mono text-slate-400">Order #{trackingModalOrder.orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTrackingModalOrder(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Carrier & Tracking details */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Logistics Partner:</span>
                <span className="font-bold text-slate-800">
                  {trackingModalOrder.shipment?.carrier || 'Delhivery Express'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Tracking Number (AWB):</span>
                <span className="font-mono font-bold text-primary-700">
                  {trackingModalOrder.shipment?.trackingNumber || 'TRK-' + trackingModalOrder.orderNumber.replace(/[^0-9]/g, '').padEnd(8, '0')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {trackingModalOrder.status || 'In Transit'}
                </span>
              </div>
              {trackingModalOrder.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Delivered At:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(trackingModalOrder.deliveredAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Static timeline checklist */}
            <div className="space-y-3 px-1 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Order Confirmed</p>
                  <p className="text-[11px] text-slate-400">Order verified and assigned to fulfillment center</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Package Dispatched</p>
                  <p className="text-[11px] text-slate-400">Handed over to carrier partner with GST tax invoice</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    (trackingModalOrder.status || '').toUpperCase() === 'DELIVERED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    {(trackingModalOrder.status || '').toUpperCase() === 'DELIVERED'
                      ? 'Package Delivered'
                      : 'Out for Delivery / In Transit'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {(trackingModalOrder.status || '').toUpperCase() === 'DELIVERED'
                      ? 'Package successfully handed to recipient'
                      : 'Estimated delivery within 2-3 business days'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setTrackingModalOrder(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
              >
                Close Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
