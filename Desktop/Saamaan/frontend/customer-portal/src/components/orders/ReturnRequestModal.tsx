import React, { useState, useRef } from 'react';
import {
  X,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wrench,
  Ban,
  Package,
  Building,
  Upload,
  Camera,
  Trash2,
  Plus,
  Image as ImageIcon,
  Link as LinkIcon,
} from 'lucide-react';
import { CustomerOrder, CustomerOrderItem, ordersApi } from '../../lib/ordersApi';
import { getImageUrl } from '../../lib/productsApi';

interface ReturnRequestModalProps {
  order: CustomerOrder;
  item: CustomerOrderItem;
  onClose: () => void;
  onSuccess: (requestNumber: string) => void;
}

const REASON_CATEGORIES = [
  { value: 'DEFECTIVE_DAMAGED', label: 'Item arrived defective, damaged, or broken' },
  { value: 'WRONG_ITEM', label: 'Received wrong item, wrong size, or incorrect color' },
  { value: 'QUALITY_ISSUE', label: 'Product quality is not satisfactory or different from website' },
  { value: 'MISSING_PARTS', label: 'Missing accessories, parts, or manuals' },
  { value: 'PERFORMANCE_ISSUE', label: 'Item is not functioning as described' },
  { value: 'OTHER', label: 'Other issue / No longer required' },
];

export const ReturnRequestModal: React.FC<ReturnRequestModalProps> = ({
  order,
  item,
  onClose,
  onSuccess,
}) => {
  const policy = item.returnPolicy;
  const canReturn = policy?.isReturnable ?? true;
  const canReplace = policy?.isReplaceable ?? true;

  // Initial request type determination
  const defaultType: 'RETURN' | 'REPLACEMENT' = canReturn ? 'RETURN' : 'REPLACEMENT';
  const [requestType, setRequestType] = useState<'RETURN' | 'REPLACEMENT'>(defaultType);
  const [reasonCategory, setReasonCategory] = useState<string>(REASON_CATEGORIES[0].value);
  const [reasonDescription, setReasonDescription] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [uploadingProof, setUploadingProof] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>('');
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refund details for COD
  const isCod = (order.payment?.modeCode || 'COD').toUpperCase() === 'COD';
  const [refundMethod, setRefundMethod] = useState<'UPI' | 'BANK_ACCOUNT'>('UPI');
  const [upiId, setUpiId] = useState<string>('');
  const [accountHolderName, setAccountHolderName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (proofImages.length + files.length > 5) {
      setErrorMessage('You can upload a maximum of 5 proof photos.');
      return;
    }

    // Validate size (10MB max each)
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 10 * 1024 * 1024) {
        setErrorMessage(`File "${f.name}" exceeds the 10MB limit.`);
        return;
      }
      validFiles.push(f);
    }

    try {
      setUploadingProof(true);
      setErrorMessage(null);
      const uploadedUrls = await ordersApi.uploadReturnProof(validFiles);
      setProofImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      console.error('Failed to upload proof photos:', err);
      setErrorMessage(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingProof(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setProofImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (proofImages.length >= 5) {
      setErrorMessage('Maximum of 5 proof images reached.');
      return;
    }
    setProofImages((prev) => [...prev, trimmed]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reasonCategory) {
      setErrorMessage('Please select a reason for the request.');
      return;
    }

    if (!reasonDescription.trim() || reasonDescription.trim().length < 10) {
      setErrorMessage('Please provide a short explanation (at least 10 characters).');
      return;
    }

    // COD refund details validation
    if (requestType === 'RETURN' && isCod) {
      if (refundMethod === 'UPI' && (!upiId.trim() || !upiId.includes('@'))) {
        setErrorMessage('Please provide a valid UPI ID (e.g., name@okaxis, mobile@ybl).');
        return;
      }
      if (refundMethod === 'BANK_ACCOUNT') {
        if (!accountHolderName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
          setErrorMessage('Please fill in complete bank account details for the refund payout.');
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const res = await ordersApi.submitReturnRequest({
        orderItemId: item.orderItemId,
        requestType,
        reasonCategory,
        reasonDescription: reasonDescription.trim(),
        quantity,
        resolutionType: requestType === 'RETURN' ? 'REFUND' : 'REPLACEMENT',
        refundMethod: requestType === 'RETURN' ? (isCod ? refundMethod : 'ORIGINAL_PAYMENT') : undefined,
        refundDetails:
          requestType === 'RETURN' && isCod
            ? refundMethod === 'UPI'
              ? { upiId: upiId.trim() }
              : {
                  accountHolderName: accountHolderName.trim(),
                  accountNumber: accountNumber.trim(),
                  ifscCode: ifscCode.trim().toUpperCase(),
                }
            : undefined,
        images: proofImages.length > 0 ? proofImages : undefined,
      });

      onSuccess(res.requestNumber);
    } catch (err: any) {
      console.error('Failed to submit return request:', err);
      setErrorMessage(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-stone-50/90 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-100/70 text-primary-700">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Return or Replace Item
              </h3>
              <p className="text-xs text-slate-500 font-mono">Order #{order.orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium text-xs leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Product Summary Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3.5">
            {item.thumbnail ? (
              <img
                src={getImageUrl(item.thumbnail)}
                alt={item.productName}
                className="w-14 h-14 rounded-xl object-cover bg-white border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                <Package className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">
                {item.productName}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Purchased Qty: <strong className="text-slate-800">{item.quantity}</strong> · ₹
                {item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              {policy && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{policy.policyName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Technician Inspection Notice */}
          {policy?.requiresTechnicianCheck && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 flex items-start gap-2.5">
              <Wrench className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">Technician Inspection Required</p>
                <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                  A brand authorized technician will visit your delivery address to inspect and verify the reported defect before pickup and refund/replacement approval.
                </p>
              </div>
            </div>
          )}

          {/* Request Type Selector (Refund vs Replacement) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block">
              What resolution would you prefer?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!canReturn}
                onClick={() => setRequestType('RETURN')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  requestType === 'RETURN'
                    ? 'border-primary-600 bg-primary-50/50 text-primary-900 shadow-2xs'
                    : canReturn
                    ? 'border-stone-200 bg-white hover:border-stone-300 text-slate-700'
                    : 'border-stone-200 bg-stone-50 text-slate-400 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                    Return for Refund
                  </span>
                  {requestType === 'RETURN' && (
                    <span className="w-2 h-2 rounded-full bg-primary-600"></span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {canReturn ? 'Item picked up & payment refunded' : 'Not eligible for returns'}
                </span>
              </button>

              <button
                type="button"
                disabled={!canReplace}
                onClick={() => setRequestType('REPLACEMENT')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  requestType === 'REPLACEMENT'
                    ? 'border-primary-600 bg-primary-50/50 text-primary-900 shadow-2xs'
                    : canReplace
                    ? 'border-stone-200 bg-white hover:border-stone-300 text-slate-700'
                    : 'border-stone-200 bg-stone-50 text-slate-400 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-amber-500" />
                    Replacement
                  </span>
                  {requestType === 'REPLACEMENT' && (
                    <span className="w-2 h-2 rounded-full bg-primary-600"></span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {canReplace ? 'Exchange for new replacement unit' : 'Replacement not available'}
                </span>
              </button>
            </div>
          </div>

          {/* Quantity to Return/Replace (if multi-quantity order) */}
          {item.quantity > 1 && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-900 block">
                Quantity to {requestType === 'RETURN' ? 'Return' : 'Replace'}
              </label>
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full sm:w-56 px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-slate-900 text-xs font-semibold focus:outline-hidden focus:border-primary-600 transition-colors"
              >
                {Array.from({ length: item.quantity }, (_, i) => i + 1).map((qty) => (
                  <option key={qty} value={qty}>
                    {qty} {qty === 1 ? 'unit' : 'units'} (of {item.quantity} purchased)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reason Category Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block">
              Reason for {requestType === 'RETURN' ? 'Return' : 'Replacement'} <span className="text-rose-500">*</span>
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-slate-900 text-xs font-medium focus:outline-hidden focus:border-primary-600 transition-colors"
            >
              {REASON_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Detailed Reason Explanation */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block">
              Please explain the issue in detail <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reasonDescription}
              onChange={(e) => setReasonDescription(e.target.value)}
              placeholder="Provide specific details about any damage, defect, or missing item..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-slate-900 text-xs font-medium focus:outline-hidden focus:border-primary-600 transition-colors placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Photo / Proof Attachment (Upload or Link) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 block">
                Photo / Proof Attachment (Optional)
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {proofImages.length}/5 uploaded
              </span>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              className="hidden"
            />

            {/* Thumbnail Gallery (if photos already uploaded) */}
            {proofImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-1">
                {proofImages.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-2xs"
                  >
                    <img
                      src={getImageUrl(imgUrl)}
                      alt={`Proof photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      title="Remove photo"
                      className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900/70 text-white">
                      #{idx + 1}
                    </span>
                  </div>
                ))}

                {proofImages.length < 5 && (
                  <button
                    type="button"
                    disabled={uploadingProof}
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-stone-200 hover:border-primary-500 hover:bg-primary-50/30 flex flex-col items-center justify-center text-slate-400 hover:text-primary-600 transition-all cursor-pointer"
                  >
                    {uploadingProof ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mb-0.5" />
                        <span className="text-[10px] font-bold">Add More</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Primary Upload Dropzone / Button (when 0 uploaded) */}
            {proofImages.length === 0 && (
              <div
                onClick={() => !uploadingProof && fileInputRef.current?.click()}
                className={`p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2 ${
                  uploadingProof
                    ? 'border-primary-300 bg-primary-50/30 cursor-wait'
                    : 'border-stone-200 hover:border-primary-500 hover:bg-stone-50/70 bg-white'
                }`}
              >
                {uploadingProof ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                    <span className="font-bold text-xs text-primary-700">
                      Uploading and optimizing proof photos...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="p-2.5 rounded-full bg-primary-50 text-primary-600">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-800">
                        Click to select or take photo
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Supports JPEG, PNG, WEBP (Up to 5 photos, max 10MB each)
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Optional URL input toggle */}
            <div className="pt-0.5">
              {!showUrlInput ? (
                <button
                  type="button"
                  onClick={() => setShowUrlInput(true)}
                  className="text-[11px] text-primary-600 hover:text-primary-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>Or attach via image URL</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste direct image link (e.g. https://...)..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-slate-900 text-xs font-medium focus:outline-hidden focus:border-primary-600 transition-colors placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUrlInput(false);
                      setUrlInput('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Clear photos of product label, packaging, and damage expedite ticket approval.
            </p>
          </div>

          {/* COD Payout Destination (Only if Refund + COD order) */}
          {requestType === 'RETURN' && isCod && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-700" />
                <h5 className="font-bold text-slate-900 text-xs">
                  COD Refund Details (Direct Payout)
                </h5>
              </div>
              <p className="text-[11px] text-slate-600">
                Since this order was paid in cash on delivery, where would you like your refund credited?
              </p>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
                  <input
                    type="radio"
                    name="refundMethod"
                    value="UPI"
                    checked={refundMethod === 'UPI'}
                    onChange={() => setRefundMethod('UPI')}
                    className="accent-primary-600"
                  />
                  <span>UPI ID</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
                  <input
                    type="radio"
                    name="refundMethod"
                    value="BANK_ACCOUNT"
                    checked={refundMethod === 'BANK_ACCOUNT'}
                    onChange={() => setRefundMethod('BANK_ACCOUNT')}
                    className="accent-primary-600"
                  />
                  <span>Bank Account (NEFT/IMPS)</span>
                </label>
              </div>

              {refundMethod === 'UPI' ? (
                <div className="pt-1">
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="Enter UPI ID (e.g. 9876543210@paytm, user@okaxis)"
                    className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-primary-600"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="Account Holder Name"
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-primary-600"
                  />
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account Number"
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-primary-600"
                  />
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="IFSC Code (e.g. HDFC0001234)"
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-primary-600 uppercase"
                  />
                </div>
              )}
            </div>
          )}

          {/* Prepaid Refund Notice */}
          {requestType === 'RETURN' && !isCod && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-[11px] leading-relaxed">
              ✨ <strong>Original Payment Source Refund:</strong> Your refund of ₹
              {item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} will be credited back directly to your original payment method ({order.payment.modeName}) within 3-5 business days after inspection.
            </div>
          )}

          {/* Pickup Address Summary */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1 text-slate-600 text-[11px]">
            <span className="font-bold text-slate-800 block text-xs">Pickup Address:</span>
            <p>
              {order.shippingAddress.recipientName} ({order.shippingAddress.phoneNumber})
            </p>
            <p>
              {order.shippingAddress.addressLine1}
              {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}
              , {order.shippingAddress.city}, {order.shippingAddress.state} -{' '}
              {order.shippingAddress.postalCode}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Confirm {requestType === 'RETURN' ? 'Return' : 'Replacement'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

