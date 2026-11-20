import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building,
  MapPin,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { customSwal } from '../../lib/swal.js';
import { getFullAssetUrl } from '../../lib/image.js';

export interface AdminReturnDetail {
  returnRequestId: string;
  requestNumber: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  orderStatus: string;
  orderTotal: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  productName: string;
  variantSku: string;
  unitPrice: number;
  itemTotal: number;
  quantity: number;
  requestType: 'RETURN' | 'REPLACEMENT';
  reasonCategory: string;
  reasonDescription: string | null;
  resolutionType: string;
  refundMethod: string | null;
  refundDetails: any;
  status: string;
  destinationType?: string | null;
  destinationId?: string | null;
  qcStatus?: string | null;
  qcNotes?: string | null;
  qcGrade?: string | null;
  restockedInventory?: boolean;
  refundTransactionId?: string | null;
  replacementOrderId?: string | null;
  adminComments: string | null;
  pickupAddress: any;
  trackingNumber: string | null;
  policy: {
    policyCode: string;
    policyName: string;
    returnWindowDays: number;
    replacementWindowDays: number;
    requiresTechnicianCheck: boolean;
  };
  assets: string[];
  createdAt: string;
  updatedAt: string | null;
}

interface AdminReturnDetailModalProps {
  item: AdminReturnDetail;
  onClose: () => void;
  onUpdated: () => void;
}

export const AdminReturnDetailModal: React.FC<AdminReturnDetailModalProps> = ({
  item,
  onClose,
  onUpdated,
}) => {
  const [updating, setUpdating] = useState<boolean>(false);
  const [adminNotes, setAdminNotes] = useState<string>(item.adminComments || '');
  const [trackingNumber, setTrackingNumber] = useState<string>(item.trackingNumber || '');
  const [refundTxId, setRefundTxId] = useState<string>(item.refundTransactionId || '');
  const [restockStock, setRestockStock] = useState<boolean>(item.restockedInventory ?? true);

  const handleUpdateStatus = async (
    targetStatus: string,
    actionTitle: string,
    requireNotes: boolean = false,
    extraPayload: Record<string, any> = {}
  ) => {
    if (requireNotes && !adminNotes.trim()) {
      customSwal.fire({
        icon: 'warning',
        title: 'Notes Required',
        text: `Please enter administrative reason/notes before proceeding with ${actionTitle.toLowerCase()}.`,
      });
      return;
    }

    const confirmRes = await customSwal.fire({
      title: `${actionTitle}?`,
      text: `Are you sure you want to transition return ticket #${item.requestNumber} to status ${targetStatus.replace(/_/g, ' ')}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Yes, ${actionTitle}`,
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });

    if (!confirmRes.isConfirmed) return;

    try {
      setUpdating(true);
      await apiClient.patch(`/orders/returns/${item.returnRequestId}/status`, {
        status: targetStatus,
        adminComments: adminNotes.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        refundTransactionId: refundTxId.trim() || undefined,
        restockInventory: restockStock,
        ...extraPayload,
      });

      customSwal.fire({
        icon: 'success',
        title: 'Status Updated',
        text: `Return ticket #${item.requestNumber} is now marked as ${targetStatus.replace(/_/g, ' ')}.`,
        timer: 2000,
        showConfirmButton: false,
      });

      onUpdated();
    } catch (err: any) {
      console.error('Failed to update return ticket status:', err);
      customSwal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: err.response?.data?.message || err.message || 'Unable to update status.',
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (s: string) => {
    const status = (s || 'REQUESTED').toUpperCase();
    if (status === 'REQUESTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
          Pending Review
        </span>
      );
    }
    if (status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
          Approved (Pickup Awaited)
        </span>
      );
    }
    if (status === 'RECEIVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
          Received at Facility
        </span>
      );
    }
    if (status === 'QC_PASSED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold">
          QC Passed
        </span>
      );
    }
    if (status === 'QC_FAILED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
          QC Failed
        </span>
      );
    }
    if (status === 'REFUNDED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
          Refunded
        </span>
      );
    }
    if (status === 'REPLACED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
          Replaced
        </span>
      );
    }
    if (status === 'IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold">
          In Progress
        </span>
      );
    }
    if (status === 'RESOLVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
          Resolved
        </span>
      );
    }
    if (status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
        Rejected
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#635BFF]/10 text-[#635BFF]">
              {item.requestType === 'REPLACEMENT' ? (
                <RefreshCw className="w-5 h-5" />
              ) : (
                <RotateCcw className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 font-mono">
                  #{item.requestNumber}
                </h3>
                {getStatusBadge(item.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Related to Order #{item.orderNumber} · Customer: {item.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {/* Top Info Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block">Item Summary</span>
              <p className="font-bold text-slate-900 truncate" title={item.productName}>
                {item.productName}
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                SKU: {item.variantSku} (Qty: {item.quantity})
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block">Value & Payout</span>
              <p className="font-bold text-slate-900">
                ₹{item.itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-500">
                Mode: {item.requestType} ({item.resolutionType})
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block">Applied Policy</span>
              <p className="font-bold text-emerald-700 truncate">{item.policy.policyName}</p>
              <p className="text-[11px] text-slate-500">
                {item.policy.requiresTechnicianCheck
                  ? '🔧 Technician Check Required'
                  : 'Standard Doorstep Return'}
              </p>
            </div>
          </div>

          {/* Customer Stated Reason & Description */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Return Reason: {item.reasonCategory.replace(/_/g, ' ')}
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(item.createdAt).toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-slate-800 font-medium bg-white p-3 rounded-xl border border-amber-100 leading-relaxed">
              "{item.reasonDescription || 'No description provided by customer.'}"
            </p>
          </div>

          {/* Customer Uploaded Proof Assets */}
          {item.assets && item.assets.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-slate-900 block">Customer UGC Proof Photos:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {item.assets.map((assetUrl, idx) => {
                  const fullUrl = getFullAssetUrl(assetUrl);
                  return (
                    <a
                      key={idx}
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={fullUrl}
                        alt={`Proof ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback if image fails to load
                          (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View Full
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* COD Refund Payout Information */}
          {item.refundDetails && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                <Building className="w-4 h-4 text-slate-600" />
                Refund Payout Target (COD Reversal)
              </span>
              {item.refundDetails.upiId ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-xs text-slate-800">
                  UPI ID: <strong>{item.refundDetails.upiId}</strong>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                  <div>Holder: <strong>{item.refundDetails.accountHolderName}</strong></div>
                  <div>Account: <strong>{item.refundDetails.accountNumber}</strong></div>
                  <div>IFSC: <strong>{item.refundDetails.ifscCode}</strong></div>
                </div>
              )}
            </div>
          )}

          {/* Pickup Address & Return Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {item.pickupAddress && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-slate-600">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  Customer Pickup Address
                </span>
                <p className="font-semibold text-slate-800">
                  {item.pickupAddress.recipientName} ({item.pickupAddress.phoneNumber})
                </p>
                <p>
                  {item.pickupAddress.addressLine1}
                  {item.pickupAddress.addressLine2 ? `, ${item.pickupAddress.addressLine2}` : ''},{' '}
                  {item.pickupAddress.city}, {item.pickupAddress.state} -{' '}
                  {item.pickupAddress.postalCode}
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-slate-600">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                Return Destination Routing
              </span>
              <p className="font-bold text-slate-800 text-sm mt-1">
                {item.destinationType === 'WAREHOUSE'
                  ? '🏢 Platform Warehouse (Fulfillment Dock)'
                  : '🏪 Direct Seller Premises'}
              </p>
              <p className="text-[11px] text-slate-500">
                Destination ID: {item.destinationId || 'Auto-Routed'} · QC Required: Yes
              </p>
              {item.qcStatus && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
                  QC Status: <span className="text-indigo-600">{item.qcStatus}</span> {item.qcGrade ? `(${item.qcGrade})` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Administrative Management Controls */}
          <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-3">
            <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#635BFF]" />
              Operations Notes, Resolution & Reverse Tracking
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Reverse Waybill / Tracking #
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. DLV-REV-9872198"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#635BFF]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Refund Payout / Gateway Ref #
                </label>
                <input
                  type="text"
                  value={refundTxId}
                  onChange={(e) => setRefundTxId(e.target.value)}
                  placeholder="e.g. PG-TXN-49102"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#635BFF]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Internal Operations Notes
                </label>
                <input
                  type="text"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Package inspected, verified authentic"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#635BFF]"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-700">
              <input
                type="checkbox"
                checked={restockStock}
                onChange={(e) => setRestockStock(e.target.checked)}
                className="rounded text-[#635BFF] focus:ring-[#635BFF]"
              />
              <span className="text-xs font-semibold">
                Restock returned item quantity back into active sellable inventory upon QC Pass
              </span>
            </label>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-slate-50/90 px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            Current Status: <strong>{item.status}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Step 1: When ticket is Pending Review */}
            {item.status === 'REQUESTED' && (
              <>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStatus('REJECTED', 'Reject Return Request', true)}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer"
                >
                  Reject Request
                </button>

                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStatus('APPROVED', 'Approve Return Request')}
                  className="px-4 py-2 rounded-xl bg-[#635BFF] hover:bg-[#5349e0] text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Request
                </button>
              </>
            )}

            {/* Step 2: When ticket is Approved (Awaiting delivery to destination) */}
            {item.status === 'APPROVED' && (
              <>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStatus('REJECTED', 'Reject Return', true)}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                >
                  Cancel / Reject
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStatus('RECEIVED', 'Mark as Received at Facility')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark as Received at Facility
                </button>
              </>
            )}

            {/* Step 3: When package has arrived at facility -> Perform QC */}
            {item.status === 'RECEIVED' && (
              <>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() =>
                    handleUpdateStatus('QC_FAILED', 'Mark QC as Failed', true, {
                      qcStatus: 'FAILED',
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                >
                  QC Failed (Defect / Tampered)
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() =>
                    handleUpdateStatus('QC_PASSED', 'Mark QC as Passed', false, {
                      qcStatus: 'PASSED',
                      qcGrade: 'GRADE_A_RESTOCKABLE',
                      restockInventory: restockStock,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  QC Passed (Item Verified)
                </button>
              </>
            )}

            {/* Step 4: When QC Passed -> Complete Refund or Replacement */}
            {item.status === 'QC_PASSED' && (
              <>
                {item.resolutionType === 'REPLACEMENT' ? (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      handleUpdateStatus('REPLACED', 'Mark Replacement as Dispatched')
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Dispatch Replacement Item
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      handleUpdateStatus('REFUNDED', 'Release Refund Payout', false, {
                        refundTransactionId: refundTxId.trim() || undefined,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Release Refund Payout
                  </button>
                )}
              </>
            )}

            {/* Step 5: When QC Failed -> Reject ticket */}
            {item.status === 'QC_FAILED' && (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleUpdateStatus('REJECTED', 'Confirm Final Rejection', true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer"
              >
                Confirm Final Rejection
              </button>
            )}

            {/* Legacy In Progress handling */}
            {item.status === 'IN_PROGRESS' && (
              <>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStatus('REJECTED', 'Reject Claim', true)}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                >
                  Reject Claim
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() =>
                    handleUpdateStatus(
                      'RESOLVED',
                      `Mark as Resolved (${item.requestType === 'REPLACEMENT' ? 'Replacement Dispatched' : 'Refund Issued'})`
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark as Resolved
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

