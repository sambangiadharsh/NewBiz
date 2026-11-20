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
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Star,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { CustomerOrder, CustomerOrderItem, ordersApi } from '../../lib/ordersApi';
import { getImageUrl } from '../../lib/productsApi';
import noOrdersIllustration from '../../assets/no_orders.png';
import { WriteReviewModal } from '../reviews/WriteReviewModal';
import { ReturnRequestModal } from '../orders/ReturnRequestModal';

interface CustomerOrdersSectionProps {
  orders: CustomerOrder[];
  loadingOrders: boolean;
  onOpenTrackOrder?: () => void;
  onRefreshOrders?: () => void;
}

type FilterTab = 'ALL' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED';

export const CustomerOrdersSection: React.FC<CustomerOrdersSectionProps> = ({
  orders,
  loadingOrders,
  onOpenTrackOrder,
  onRefreshOrders,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{ id: string; message: string } | null>(null);

  // Return request modal state
  const [returnModalData, setReturnModalData] = useState<{
    order: CustomerOrder;
    item: CustomerOrderItem;
  } | null>(null);
  const [returnSuccessNotice, setReturnSuccessNotice] = useState<string | null>(null);

  // Static tracking modal state
  const [trackingModalOrder, setTrackingModalOrder] = useState<CustomerOrder | null>(null);

  // Review modal item state
  const [reviewModalItem, setReviewModalItem] = useState<{
    productId: string;
    productName: string;
    productImage?: string;
    variantSku?: string;
  } | null>(null);

  // Pagination & Multi-item Collapsible State (Senior Software Engineering Scaling)
  const ORDERS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

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

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, currentPage, ORDERS_PER_PAGE]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    const element = document.getElementById('my-orders-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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

  const filterItems = [
    {
      key: 'ALL' as FilterTab,
      label: 'All Orders',
      count: tabCounts.all,
    },
    {
      key: 'ACTIVE' as FilterTab,
      label: 'Active / In Transit',
      count: tabCounts.active,
    },
    {
      key: 'DELIVERED' as FilterTab,
      label: 'Delivered',
      count: tabCounts.delivered,
    },
    {
      key: 'CANCELLED' as FilterTab,
      label: 'Cancelled',
      count: tabCounts.cancelled,
    },
  ];

  return (
    <div id="my-orders-section" className="space-y-6">
      {/* ─── Search Bar & Order Counter ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-900 tracking-tight">Order Purchases</span>
          <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-800 text-xs font-bold border border-stone-200/80 shadow-2xs">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Order # or item..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white border border-stone-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── 2-Column Layout: Left Filters Sidebar + Right Orders Content ─── */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left Column: Filter Sidebar */}
        <aside className="w-full md:w-60 lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-stone-200/80 p-3.5 space-y-1.5 md:sticky md:top-24 shadow-xs">
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Filter by Status
            </p>
            <div className="space-y-1">
              {filterItems.map((item) => {
                const isSelected = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setCurrentPage(1);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-stone-50 hover:text-slate-900 border border-transparent hover:border-stone-200/60'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-100 border border-stone-200 text-slate-600'
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Column: Orders Content */}
        <div className="flex-1 min-w-0 w-full space-y-5">
          {/* ─── Loading Skeletons ────────────────────────────────────────────── */}
          {loadingOrders ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-stone-200/80 p-5 space-y-4 animate-pulse bg-white shadow-xs"
                >
                  <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                    <div className="h-4 bg-stone-100 rounded w-44" />
                    <div className="h-6 bg-stone-100 rounded-full w-24" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-stone-100 rounded-xl" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-stone-100 rounded w-2/3" />
                      <div className="h-3 bg-stone-100 rounded w-1/3" />
                    </div>
                    <div className="h-4 bg-stone-100 rounded w-16" />
                  </div>
                  <div className="h-10 bg-stone-100 rounded-xl w-full" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            /* ─── Zero Orders Placed Empty State ─────────────────────────────── */
            <div className="bg-white py-12 px-6 rounded-3xl border border-stone-200/80 text-center space-y-4 shadow-xs">
              <div className="relative max-w-[240px] sm:max-w-[280px] mx-auto">
                <img
                  src={noOrdersIllustration}
                  alt="No Orders Yet"
                  className="w-full h-auto max-h-[200px] object-contain mx-auto select-none pointer-events-none drop-shadow-xs"
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">No orders placed yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Looks like you haven't bought anything yet. Explore our latest collection and place your first order today!
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Start Shopping</span>
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            /* ─── Filter Empty State ─────────────────────────────────────────── */
            <div className="bg-white py-10 px-6 rounded-3xl border border-stone-200/80 text-center space-y-3 shadow-xs">
              <div className="relative max-w-[180px] sm:max-w-[200px] mx-auto opacity-90">
                <img
                  src={noOrdersIllustration}
                  alt="No Matching Orders"
                  className="w-full h-auto max-h-[140px] object-contain mx-auto select-none pointer-events-none drop-shadow-xs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">No orders found</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  No orders match the selected filter or search term "{searchQuery}".
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALL');
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            /* ─── Orders List ────────────────────────────────────────────────── */
            <div className="space-y-5">
              {returnSuccessNotice && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-2xs animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-xs">{returnSuccessNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReturnSuccessNotice(null)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {paginatedOrders.map((ord) => {
                const formattedDate = new Date(ord.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                const isDelivered = (ord.status || '').toUpperCase() === 'DELIVERED';
                const isDownloading = downloadingOrderId === ord.orderId;
                const hasError = downloadError && downloadError.id === ord.orderId;
                const isExpanded = expandedOrderIds.has(ord.orderId);
                const visibleItems = isExpanded ? ord.items : ord.items.slice(0, 2);

                return (
                  <div
                    key={ord.orderId}
                    className="rounded-2xl border border-stone-200/80 overflow-hidden hover:border-stone-300 transition-all shadow-xs hover:shadow-card bg-white"
                  >
                    {/* ── Top Bar: Order ID, Date, Status, Total ── */}
                    <div className="bg-stone-50/80 px-4 sm:px-6 py-3.5 border-b border-stone-200/70 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-stone-200/80 shadow-2xs">
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

                      <div className="flex items-center gap-2.5">
                        {getStatusBadge(ord.status)}
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-bold">
                          {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'}
                        </span>
                        <span className="font-black text-sm sm:text-base text-slate-900">
                          ₹{ord.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* ── Order Line Items (Preview max 2 items by default) ── */}
                    <div className="p-4 sm:p-6 divide-y divide-stone-100 bg-white">
                      {visibleItems.map((it) => (
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

                          {/* Variant Attributes */}
                          {it.attributes && Object.keys(it.attributes).length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {Object.entries(it.attributes).map(([key, val]) => (
                                <span
                                  key={key}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary-50 text-primary-700 capitalize"
                                >
                                  {key}: {String(val)}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className="text-[11px] text-slate-500 mt-1">
                            Qty: <strong className="text-slate-800">{it.quantity}</strong> · ₹
                            {it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} each
                          </p>

                          {isDelivered && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewModalItem({
                                    productId: String(it.productId),
                                    productName: it.productName,
                                    productImage: it.thumbnail ? getImageUrl(it.thumbnail) : undefined,
                                    variantSku: it.variantSku || undefined,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                Rate & Review Product
                              </button>

                              {/* Return / Replacement Status or Action */}
                              {it.returnRequest ? (() => {
                                const s = it.returnRequest.status.toUpperCase();
                                let badgeColor = 'bg-sky-50 border-sky-200 text-sky-800';
                                let statusLabel = it.returnRequest.status.replace(/_/g, ' ').toLowerCase();

                                if (s === 'REQUESTED') {
                                  badgeColor = 'bg-amber-50 border-amber-200 text-amber-800';
                                  statusLabel = 'Under Review';
                                } else if (s === 'APPROVED') {
                                  badgeColor = 'bg-indigo-50 border-indigo-200 text-indigo-800';
                                  statusLabel = 'Approved (Pickup / Handover Awaited)';
                                } else if (s === 'RECEIVED') {
                                  badgeColor = 'bg-purple-50 border-purple-200 text-purple-800';
                                  statusLabel = 'Received at Facility';
                                } else if (s === 'QC_PASSED') {
                                  badgeColor = 'bg-teal-50 border-teal-200 text-teal-800';
                                  statusLabel = 'Quality Check Passed';
                                } else if (s === 'QC_FAILED') {
                                  badgeColor = 'bg-rose-50 border-rose-200 text-rose-800';
                                  statusLabel = 'QC Failed';
                                } else if (s === 'REFUNDED') {
                                  badgeColor = 'bg-emerald-50 border-emerald-200 text-emerald-800';
                                  statusLabel = 'Refund Credited';
                                } else if (s === 'REPLACED') {
                                  badgeColor = 'bg-emerald-50 border-emerald-200 text-emerald-800';
                                  statusLabel = 'Replacement Dispatched';
                                } else if (s === 'REJECTED') {
                                  badgeColor = 'bg-rose-50 border-rose-200 text-rose-800';
                                  statusLabel = 'Rejected';
                                } else if (s === 'CANCELLED') {
                                  badgeColor = 'bg-slate-100 border-slate-200 text-slate-700';
                                  statusLabel = 'Cancelled';
                                }

                                return (
                                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-2xs ${badgeColor}`}>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>
                                      {it.returnRequest.requestType === 'REPLACEMENT' ? 'Replacement' : 'Return'} #{it.returnRequest.requestNumber}:{' '}
                                      <span className="capitalize">{statusLabel}</span>
                                    </span>
                                  </div>
                                );
                              })() : (() => {
                                const rp = it.returnPolicy;
                                if (!rp || (!rp.isReturnable && !rp.isReplaceable)) {
                                  return (
                                    <span className="inline-flex items-center text-[11px] text-slate-400 font-medium px-2 py-1">
                                      Non-Returnable Item
                                    </span>
                                  );
                                }
                                const maxWindow = Math.max(rp.returnWindowDays || 0, rp.replacementWindowDays || 0);
                                const deliveredTime = ord.deliveredAt ? new Date(ord.deliveredAt).getTime() : new Date(ord.createdAt).getTime();
                                const expiryTime = deliveredTime + maxWindow * 24 * 60 * 60 * 1000;
                                const isWindowOpen = Date.now() <= expiryTime;

                                if (isWindowOpen) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setReturnModalData({ order: ord, item: it })}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-slate-800 border border-stone-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-primary-600" />
                                      Return or Replace
                                    </button>
                                  );
                                }

                                const expiryFormatted = new Date(expiryTime).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                });
                                return (
                                  <span className="inline-flex items-center text-[11px] text-slate-400 font-medium px-2 py-1">
                                    Return window closed ({expiryFormatted})
                                  </span>
                                );
                              })()}
                            </div>
                          )}
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

                {/* ── Collapsible Multi-Item Expander Bar ── */}
                {ord.items.length > 2 && (
                  <div className="pt-2.5 px-4 sm:px-6 pb-2.5 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
                    <span className="text-[11px] text-stone-500 font-medium">
                      {isExpanded
                        ? `Showing all ${ord.items.length} items in this order`
                        : `Showing 2 of ${ord.items.length} items`}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleOrderExpand(ord.orderId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-primary-700 hover:text-primary-800 hover:bg-primary-50 transition-colors cursor-pointer"
                    >
                      <span>
                        {isExpanded
                          ? 'Show Less'
                          : `+ View ${ord.items.length - 2} More ${ord.items.length - 2 === 1 ? 'Item' : 'Items'}`}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

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
                <div className="bg-stone-50/80 px-4 sm:px-6 py-3 border-t border-stone-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-slate-700 text-xs font-bold transition-colors shadow-2xs"
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

          {/* ─── Pagination Controls ─── */}
          {totalPages > 1 && (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <div className="text-xs text-stone-500 font-medium text-center sm:text-left">
                Showing <strong className="text-slate-900 font-bold">{(currentPage - 1) * ORDERS_PER_PAGE + 1}</strong> to <strong className="text-slate-900 font-bold">{Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)}</strong> of <strong className="text-slate-900 font-bold">{filteredOrders.length}</strong> orders
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    totalPages > 7 &&
                    page !== 1 &&
                    page !== totalPages &&
                    Math.abs(page - currentPage) > 1
                  ) {
                    if (page === 2 || page === totalPages - 1) {
                      return (
                        <span key={page} className="px-1.5 text-xs text-stone-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }

                  const isCurrent = page === currentPage;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => handlePageChange(page)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-primary-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-stone-100'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>

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

      {/* Write Verified Review Modal */}
      {reviewModalItem && (
        <WriteReviewModal
          isOpen={!!reviewModalItem}
          onClose={() => setReviewModalItem(null)}
          productId={reviewModalItem.productId}
          productName={reviewModalItem.productName}
          productImage={reviewModalItem.productImage}
          variantSku={reviewModalItem.variantSku}
          onReviewSubmitted={() => {
            setReviewModalItem(null);
          }}
        />
      )}

      {/* Return or Replacement Request Modal */}
      {returnModalData && (
        <ReturnRequestModal
          order={returnModalData.order}
          item={returnModalData.item}
          onClose={() => setReturnModalData(null)}
          onSuccess={(reqNum) => {
            setReturnModalData(null);
            setReturnSuccessNotice(
              `Return/Replacement request #${reqNum} has been submitted successfully and is now under review.`
            );
            if (onRefreshOrders) {
              onRefreshOrders();
            }
          }}
        />
      )}
    </div>
  );
};
