import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  MapPin,
  CreditCard,
  Truck,
  AlertTriangle,
  Clock,
  User,
  Building2,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { OrderStatusBadge } from './OrderStatusBadge.js';
import { showSweetToast } from '../../lib/swal.js';
import { getFullAssetUrl } from '../../lib/image.js';

interface AdminOrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

export const AdminOrderDetailModal: React.FC<AdminOrderDetailModalProps> = ({
  orderId,
  onClose,
  onOrderUpdated,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/admin/orders/${orderId}`);
        if (res.data.success) {
          setData(res.data.data);
        }
      } catch (err: any) {
        showSweetToast(err.response?.data?.message || 'Failed to fetch order details', 'error');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [orderId]);

  if (!orderId) return null;

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      showSweetToast('Please provide a reason for cancelling this order', 'warning');
      return;
    }

    try {
      setCancelling(true);
      const res = await apiClient.post(`/admin/orders/${orderId}/cancel`, {
        reason: cancelReason.trim(),
      });

      if (res.data.success) {
        showSweetToast('Order cancelled and reserved stock restored', 'success');
        setCancelModalOpen(false);
        setCancelReason('');
        // Refresh details
        const refreshed = await apiClient.get(`/admin/orders/${orderId}`);
        if (refreshed.data.success) {
          setData(refreshed.data.data);
        }
        onOrderUpdated?.();
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.message || 'Failed to cancel order', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const isCancellable =
    data &&
    !['CANCELLED', 'DELIVERED', 'SHIPPED'].includes(data.order.status) &&
    !data.fulfillments?.some((f: any) =>
      ['PACKED', 'SHIPPED', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(f.status)
    );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">
                Order #{data?.order.orderNumber || '...'}
              </h2>
              {data?.order && <OrderStatusBadge status={data.order.status} />}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              Placed on {data?.order ? new Date(data.order.createdAt).toLocaleString() : '...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCancellable && (
              <button
                onClick={() => setCancelModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Cancel Order
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <p className="text-sm font-medium">Loading order details...</p>
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-slate-500">Order not found</div>
          ) : (
            <>
              {/* Customer & Address Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Customer Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    Customer Details
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{data.customer.name}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{data.customer.email}</div>
                    <div className="text-xs font-mono text-slate-600 mt-0.5">
                      Phone: {data.customer.phone || 'N/A'}
                    </div>
                    {data.order.invoiceGstin && (
                      <div className="text-xs text-emerald-700 mt-1 font-mono font-medium">
                        GSTIN: {data.order.invoiceGstin}
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5" />
                    Shipping Address
                  </div>
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold block text-slate-900">
                      {data.shippingAddress.recipientName}
                    </span>
                    {data.shippingAddress.addressLine1}
                    {data.shippingAddress.addressLine2 && `, ${data.shippingAddress.addressLine2}`}
                    <br />
                    {data.shippingAddress.city}, {data.shippingAddress.state} -{' '}
                    {data.shippingAddress.postalCode}
                    <br />
                    Phone: {data.shippingAddress.phone || 'N/A'}
                  </div>
                </div>

                {/* Payment Overview */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <CreditCard className="w-3.5 h-3.5" />
                    Payment Summary
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Method:</span>
                      <span className="font-medium text-slate-800">
                        {data.payments?.[0]?.modeName || 'Online Payment'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Status:</span>
                      <span
                        className={`font-semibold ${
                          data.payments?.[0]?.status === 'SUCCESS'
                            ? 'text-emerald-600'
                            : data.payments?.[0]?.status === 'REFUND_PENDING'
                            ? 'text-amber-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {data.payments?.[0]?.status || 'PENDING'}
                      </span>
                    </div>
                    {data.payments?.[0]?.gatewayReference && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ref ID:</span>
                        <span className="font-mono text-slate-700 truncate max-w-[140px]">
                          {data.payments[0].gatewayReference}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                      <span>Total Paid:</span>
                      <span>₹{data.order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items Table */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary-600" />
                  Line Items ({data.items?.length || 0})
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Seller</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Tax (GST)</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.items?.map((item: any) => (
                        <tr key={item.orderItemId} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              {item.primaryImage ? (
                                <img
                                  src={getFullAssetUrl(item.primaryImage)}
                                  alt={item.productName}
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
                              <div>
                                <div className="font-semibold text-slate-900 max-w-xs truncate">
                                  {item.productName}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>SKU: {item.variantSku}</span>
                                  {item.brandName && (
                                    <>
                                      <span>•</span>
                                      <span>{item.brandName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800">{item.sellerName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{item.sellerCode}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            ₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-900">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="font-medium text-slate-800">
                              ₹{item.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.cgstAmount > 0
                                ? `CGST: ₹${item.cgstAmount} + SGST: ₹${item.sgstAmount}`
                                : `IGST: ₹${item.igstAmount}`}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">
                            ₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t border-slate-200 text-xs">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 text-right text-slate-500">
                          Subtotal:
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-right font-medium text-slate-800">
                          ₹{data.order.subtotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {data.order.discountAmount > 0 && (
                        <tr>
                          <td colSpan={4} className="py-1 px-3 text-right text-slate-500">
                            Promotional Discount:
                          </td>
                          <td colSpan={2} className="py-1 px-3 text-right font-medium text-rose-600">
                            -₹{data.order.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={4} className="py-1 px-3 text-right text-slate-500">
                          Total Taxes (GST):
                        </td>
                        <td colSpan={2} className="py-1 px-3 text-right font-medium text-slate-800">
                          ₹{data.order.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-1 px-3 text-right text-slate-500">
                          Shipping & Handling:
                        </td>
                        <td colSpan={2} className="py-1 px-3 text-right font-medium text-slate-800">
                          {data.order.shippingAmount > 0
                            ? `₹${data.order.shippingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : 'FREE'}
                        </td>
                      </tr>
                      <tr className="border-t border-slate-200 font-bold text-sm">
                        <td colSpan={4} className="py-3 px-3 text-right text-slate-900">
                          Grand Total:
                        </td>
                        <td colSpan={2} className="py-3 px-3 text-right text-primary-700">
                          ₹{data.order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Fulfillments Breakdown */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary-600" />
                  Warehouse Fulfillments ({data.fulfillments?.length || 0})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.fulfillments?.map((ful: any) => (
                    <div
                      key={ful.fulfillmentId}
                      className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-slate-900 text-xs">
                            {ful.warehouse.name} ({ful.warehouse.code})
                          </span>
                        </div>
                        <OrderStatusBadge status={ful.status} size="sm" />
                      </div>
                      <div className="text-[11px] text-slate-600 flex justify-between pt-1 border-t border-slate-100">
                        <span>Merchant: {ful.seller.name}</span>
                        {ful.shipment?.trackingNumber ? (
                          <span className="font-mono text-slate-800 font-medium">
                            {ful.shipment.carrier}: {ful.shipment.trackingNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not dispatched yet</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Timeline Milestone */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary-600" />
                  Order Milestones & History
                </h3>
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="space-y-3">
                    {/* Initial Placed */}
                    <div className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          Order Placed by Customer
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(data.order.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Paid */}
                    {data.payments?.[0]?.paidAt && (
                      <div className="flex items-start gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            Payment Confirmed via {data.payments[0].modeName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(data.payments[0].paidAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Additional History Logs */}
                    {data.history?.map((h: any) => (
                      <div key={h.historyId} className="flex items-start gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                            h.status === 'CANCELLED' ? 'bg-rose-500' : 'bg-purple-500'
                          }`}
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            Status changed to <span className="uppercase">{h.status}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(h.changedAt).toLocaleString()} by {h.changedBy}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>

      {/* Cancel Order Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Cancel Order</h3>
                <p className="text-xs text-slate-500">Order #{data?.order?.orderNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This action will release any reserved inventory back into stock. If the customer has
              already made a payment, it will be marked as <strong className="text-amber-700">Refund Pending</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Cancellation <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested cancellation, out of stock, fraud flag..."
                rows={3}
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={cancelling}
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Go Back
              </button>
              <button
                disabled={cancelling || !cancelReason.trim()}
                onClick={handleCancelOrder}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
