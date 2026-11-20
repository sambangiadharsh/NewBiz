import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Camera,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { customSwal } from '../../lib/swal.js';
import { getFullAssetUrl } from '../../lib/image.js';

export interface WarehouseReturnItem {
  returnRequestId: string;
  requestNumber: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  productName: string;
  variantSku: string;
  sellerSku: string;
  sellerName: string;
  quantity: number;
  requestType: 'RETURN' | 'REPLACEMENT';
  reasonCategory: string;
  reasonDescription: string | null;
  resolutionType: string;
  status: string;
  destinationType: string;
  destinationId: string;
  qcStatus: string;
  qcNotes: string | null;
  qcGrade: string | null;
  restockedInventory: boolean;
  adminComments: string | null;
  pickupAddress: any;
  trackingNumber: string | null;
  policy: {
    policyCode: string;
    policyName: string;
    requiresTechnicianCheck: boolean;
  };
  assets: string[];
  createdAt: string;
  updatedAt: string | null;
}

interface WarehouseQCInspectionModalProps {
  item: WarehouseReturnItem;
  onClose: () => void;
  onUpdated: () => void;
}

export const WarehouseQCInspectionModal: React.FC<WarehouseQCInspectionModalProps> = ({
  item,
  onClose,
  onUpdated,
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [qcGrade, setQcGrade] = useState<string>(item.qcGrade || 'GRADE_A_RESTOCKABLE');
  const [qcNotes, setQcNotes] = useState<string>(item.qcNotes || '');
  const [restockStock, setRestockStock] = useState<boolean>(item.restockedInventory ?? true);
  const [trackingNumber, setTrackingNumber] = useState<string>(item.trackingNumber || '');

  // Physical checklist verification
  const [skuMatch, setSkuMatch] = useState<boolean>(true);
  const [boxIntact, setBoxIntact] = useState<boolean>(true);
  const [accessoriesPresent, setAccessoriesPresent] = useState<boolean>(true);

  // Warehouse unboxing evidence photos
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState<boolean>(false);

  const getSimpleStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          Incoming
        </span>
      );
    }
    if (s === 'RECEIVED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
          Received at Dock · Ready for QC
        </span>
      );
    }
    if (s === 'QC_PASSED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
          QC Passed (Restocked)
        </span>
      );
    }
    if (s === 'QC_FAILED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          QC Failed
        </span>
      );
    }
    if (s === 'REFUNDED' || s === 'REPLACED' || s === 'RESOLVED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          REFUNDED / REPLACED
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {s.replace(/_/g, ' ')}
      </span>
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }

    try {
      setUploadingPhotos(true);
      const res = await apiClient.post('/warehouse/returns/upload-proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data.data?.urls) {
        setUploadedPhotos((prev) => [...prev, ...res.data.data.urls]);
      }
    } catch (err: any) {
      console.error('Failed to upload QC photos:', err);
      customSwal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: err.response?.data?.message || 'Failed to upload dock photos.',
      });
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleMarkReceived = async () => {
    try {
      setSubmitting(true);
      await apiClient.post(`/warehouse/returns/${item.returnRequestId}/receive`, {
        trackingNumber: trackingNumber.trim() || undefined,
        receiverNotes: qcNotes.trim() || undefined,
      });

      customSwal.fire({
        icon: 'success',
        title: 'Dock Received',
        text: `Return parcel #${item.requestNumber} is now marked as RECEIVED at warehouse dock.`,
        timer: 2000,
        showConfirmButton: false,
      });

      onUpdated();
    } catch (err: any) {
      customSwal.fire({
        icon: 'error',
        title: 'Receiving Failed',
        text: err.response?.data?.message || err.message || 'Failed to mark as received.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQC = async (decision: 'PASSED' | 'FAILED') => {
    if (!qcNotes.trim()) {
      customSwal.fire({
        icon: 'warning',
        title: 'Inspection Notes Required',
        text: 'Please write down physical inspection observations before submitting QC.',
      });
      return;
    }

    const confirmRes = await customSwal.fire({
      title: decision === 'PASSED' ? 'Pass QC Inspection?' : 'Fail QC Inspection?',
      text: decision === 'PASSED'
        ? `Mark return #${item.requestNumber} as QC Passed? ${restockStock ? 'Item quantity will be restocked into inventory.' : ''}`
        : `Mark return #${item.requestNumber} as QC Failed? This will reject the customer claim.`,
      icon: decision === 'PASSED' ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: decision === 'PASSED' ? 'Yes, Pass & Restock' : 'Yes, Fail QC',
      cancelButtonText: 'Cancel',
      confirmButtonColor: decision === 'PASSED' ? '#0d9488' : '#e11d48',
      reverseButtons: true,
    });

    if (!confirmRes.isConfirmed) return;

    try {
      setSubmitting(true);
      await apiClient.post(`/warehouse/returns/${item.returnRequestId}/qc`, {
        qcDecision: decision,
        qcGrade: decision === 'PASSED' ? qcGrade : 'DAMAGED_SCRAP',
        qcNotes: qcNotes.trim(),
        warehousePhotos: uploadedPhotos,
        restockInventory: decision === 'PASSED' ? restockStock : false,
      });

      customSwal.fire({
        icon: 'success',
        title: decision === 'PASSED' ? 'QC Passed' : 'QC Failed',
        text: `Inspection recorded for ticket #${item.requestNumber}.`,
        timer: 2000,
        showConfirmButton: false,
      });

      onUpdated();
    } catch (err: any) {
      customSwal.fire({
        icon: 'error',
        title: 'QC Submission Error',
        text: err.response?.data?.message || err.message || 'Failed to submit QC.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-slate-50/90 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 font-mono">
                  QC Station: #{item.requestNumber}
                </h3>
                {getSimpleStatusBadge(item.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Order #{item.orderNumber} · Customer: {item.customerName} · Seller: {item.sellerName}
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
        <div className="overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block">Product Item</span>
              <p className="font-bold text-slate-900 truncate" title={item.productName}>
                {item.productName}
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                SKU: {item.variantSku} | Qty: {item.quantity}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block">Claim Request</span>
              <p className="font-bold text-indigo-700">{item.requestType} ({item.resolutionType})</p>
              <p className="text-[11px] text-slate-500">
                Reason: {item.reasonCategory.replace(/_/g, ' ')}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block">Warehouse Routing</span>
              <p className="font-bold text-slate-800">🏢 Fulfillment Center Dock</p>
              <p className="text-[11px] text-slate-500">
                Waybill: {item.trackingNumber || 'Manual Handover'}
              </p>
            </div>
          </div>

          {/* Customer Stated Reason & UGC Photos */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
            <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Customer Stated Reason: "{item.reasonDescription || 'No description provided.'}"
            </span>

            {item.assets && item.assets.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-amber-900 block mb-1.5">
                  Customer Uploaded Evidence Photos:
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {item.assets.map((imgUrl, i) => {
                    const fullUrl = getFullAssetUrl(imgUrl);
                    return (
                      <a
                        key={i}
                        href={fullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative w-16 h-16 rounded-xl overflow-hidden border border-amber-200 bg-white"
                      >
                        <img
                          src={fullUrl}
                          alt={`Customer UGC ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* QC Inspection Station Panel */}
          <div className="p-5 rounded-2xl bg-teal-50/40 border border-teal-200/80 space-y-4">
            <h4 className="font-bold text-teal-950 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Physical QC Verification Desk
            </h4>

            {/* Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-3 rounded-xl bg-white border border-teal-100 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={skuMatch}
                  onChange={(e) => setSkuMatch(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>SKU / Barcode Matches Item</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-white border border-teal-100 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={boxIntact}
                  onChange={(e) => setBoxIntact(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Original Packaging / Box</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-white border border-teal-100 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={accessoriesPresent}
                  onChange={(e) => setAccessoriesPresent(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Parts & Accessories Present</span>
              </label>
            </div>

            {/* Restock Grade & Inventory Action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Product Condition Grading
                </label>
                <select
                  value={qcGrade}
                  onChange={(e) => setQcGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-teal-500"
                >
                  <option value="GRADE_A_RESTOCKABLE">Grade A: Like New (Put Back on Shelf)</option>
                  <option value="GRADE_B_LIQUIDATE">Grade B: Open Box / Minor Scratch (Discount/B-Stock)</option>
                  <option value="DEFECTIVE_RTV">Grade C: Faulty / Defective (Return to Seller)</option>
                  <option value="DAMAGED_SCRAP">Grade D: Broken / Customer Damaged (Total Loss / Scrap)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Warehouse Sellable Stock Action
                </label>
                <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold cursor-pointer mt-0.5">
                  <input
                    type="checkbox"
                    checked={restockStock}
                    onChange={(e) => setRestockStock(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Auto-increment warehouse inventory bin upon QC Pass</span>
                </label>
              </div>
            </div>

            {/* Warehouse Proof Upload */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                QC Station Dock Evidence Photos (Optional)
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-dashed border-teal-300 hover:border-teal-500 text-teal-700 font-bold text-xs cursor-pointer transition-colors">
                  <Camera className={`w-4 h-4 ${uploadingPhotos ? 'animate-spin' : ''}`} />
                  <span>{uploadingPhotos ? 'Uploading...' : 'Take / Upload Photo'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhotos}
                    className="hidden"
                  />
                </label>

                {uploadedPhotos.map((url, i) => {
                  const fullUrl = getFullAssetUrl(url);
                  return (
                    <div key={i} className="relative w-12 h-12 rounded-xl overflow-hidden border border-teal-200">
                      <img
                        src={fullUrl}
                        alt={`Evidence ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setUploadedPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-slate-900/60 opacity-0 hover:opacity-100 flex items-center justify-center text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Waybill / Tracking # */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Courier Tracking / Waybill #
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. DLV-REV-84920"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-teal-500"
              />
            </div>

            {/* Inspection Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                QC Inspector Observations & Notes *
              </label>
              <textarea
                rows={2}
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder="e.g. Unboxed at station 4. Verified original seal intact. Passed electrical power test."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-slate-50/90 px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            Current Status: <strong>{item.status}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* If parcel not yet marked received at dock */}
            {item.status === 'APPROVED' && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleMarkReceived}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Received at Dock
              </button>
            )}

            {/* If parcel is at dock -> Perform QC */}
            {(item.status === 'RECEIVED' || item.status === 'APPROVED') && (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitQC('FAILED')}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                >
                  Fail QC (Damaged / Tampered)
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitQC('PASSED')}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pass QC & Put on Shelf
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
