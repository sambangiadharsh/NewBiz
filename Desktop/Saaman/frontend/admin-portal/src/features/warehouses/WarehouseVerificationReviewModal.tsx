import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  Clock,
  User,
  MapPin,
  AlertCircle,
  FileCheck2,
  Send,
  Loader2,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { confirmProceed, showSweetToast } from '../../lib/swal.js';
import {
  DocumentInspectorPane,
  InspectableDocument,
} from '../../components/common/DocumentInspectorPane.js';

interface StatusHistoryItem {
  historyId: number;
  warehouseId: number;
  status: string;
  comments?: string | null;
  changedAt: string;
  changedBy: {
    userId: number;
    name: string;
    email: string;
  };
}

interface WarehouseDocItem {
  sellerWarehouseDocumentId: number;
  documentTypeId: number;
  code: string;
  displayName: string;
  documentNumber?: string;
  documentUrl?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string;
  isMandatory: boolean;
  createdAt: string;
}

interface AssociatedSeller {
  sellerWarehouseId: number;
  sellerId: number;
  sellerCode: string;
  sellerName: string;
  businessName: string;
  email: string;
  phoneNumber?: string;
  relationshipStatus: string;
  isPrimary: boolean;
  documents?: WarehouseDocItem[];
}

interface WarehouseConsentItem {
  warehouseConsentId: number;
  consentType: string;
  consentVersion: string;
  isGranted: boolean;
  grantedAt?: string;
  source?: string;
}

interface WarehouseDetail {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: 'OWN' | '3PL' | 'THIRD_PARTY';
  contactPersonName?: string;
  contactEmail?: string;
  contactPhoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  status: string;
  createdAt: string;
  rejectionReason?: string | null;
  latestStatusComment?: string | null;
  statusHistory?: StatusHistoryItem[];
  associatedSellers?: AssociatedSeller[];
  consents?: WarehouseConsentItem[];
  requiredDocuments?: Array<{
    documentTypeId: number;
    code: string;
    displayName: string;
    isRequired: boolean;
  }>;
}

interface WarehouseVerificationReviewModalProps {
  warehouseId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const REWORK_PRESETS = [
  'APOB / VPOB GST certificate is missing or lacks clear warehouse address endorsement.',
  'Lease agreement or ownership proof has expired or does not show seller company name.',
  'Municipal Trade License / FSSAI certificate is blurry or illegible.',
  'Warehouse address provided in the form does not match the supporting utility bill / lease.',
  'Document format invalid or pages are incomplete — please re-upload complete PDF.',
];

export const WarehouseVerificationReviewModal: React.FC<WarehouseVerificationReviewModalProps> = ({
  warehouseId,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [warehouse, setWarehouse] = useState<WarehouseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-action Modals
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkComment, setReworkComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Document review rejection modal
  const [docToReject, setDocToReject] = useState<WarehouseDocItem | null>(null);
  const [docRejectReason, setDocRejectReason] = useState('');

  // Dynamic Split Document Inspector
  const [inspectingDocId, setInspectingDocId] = useState<number | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/warehouses/${warehouseId}`);
      if (res.data.success) {
        setWarehouse(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch warehouse details');
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    if (isOpen && warehouseId) {
      fetchDetails();
    } else {
      setWarehouse(null);
      setError(null);
      setShowReworkModal(false);
      setShowRejectModal(false);
      setDocToReject(null);
      setInspectingDocId(null);
    }
  }, [isOpen, warehouseId, fetchDetails]);

  if (!isOpen) return null;

  // Flatten documents from associated sellers
  const allDocuments: WarehouseDocItem[] = [];
  warehouse?.associatedSellers?.forEach((seller) => {
    if (seller.documents) {
      allDocuments.push(...seller.documents);
    }
  });

  const primarySeller = warehouse?.associatedSellers?.[0];

  const activeInspectingDoc = inspectingDocId !== null
    ? allDocuments.find((d) => d.sellerWarehouseDocumentId === inspectingDocId) || null
    : null;

  const inspectableDocuments: InspectableDocument[] = allDocuments.map((d) => ({
    id: d.sellerWarehouseDocumentId,
    title: d.displayName,
    code: d.code,
    url: d.documentUrl,
    documentNumber: d.documentNumber,
    isMandatory: d.isMandatory,
    verificationStatus: d.verificationStatus,
  }));

  const activeInspectableDoc: InspectableDocument | null = activeInspectingDoc
    ? {
        id: activeInspectingDoc.sellerWarehouseDocumentId,
        title: activeInspectingDoc.displayName,
        code: activeInspectingDoc.code,
        url: activeInspectingDoc.documentUrl,
        documentNumber: activeInspectingDoc.documentNumber,
        isMandatory: activeInspectingDoc.isMandatory,
        verificationStatus: activeInspectingDoc.verificationStatus,
      }
    : null;

  // Document verification handler
  const handleVerifyDoc = async (docId: number) => {
    setActionLoading(true);
    try {
      await apiClient.patch(`/warehouses/documents/${docId}/review`, {
        decision: 'VERIFY',
      });
      await fetchDetails();
      showSweetToast('Document verified successfully', 'success');
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to verify document', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDoc = async () => {
    if (!docToReject) return;
    if (!docRejectReason.trim()) {
      showSweetToast('Please specify why this document is being rejected', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.patch(`/warehouses/documents/${docToReject.sellerWarehouseDocumentId}/review`, {
        decision: 'REJECT',
        rejectionReason: docRejectReason.trim(),
      });
      setDocToReject(null);
      setDocRejectReason('');
      await fetchDetails();
      showSweetToast('Document rejected', 'info');
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to reject document', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Warehouse lifecycle actions
  const handleApprove = async () => {
    if (!warehouseId) return;
    const ok = await confirmProceed({
      title: 'Approve Warehouse?',
      text: 'Approve and activate this warehouse for order fulfillment?',
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel',
      icon: 'question',
    });
    if (!ok) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/warehouses/${warehouseId}/approve`);
      if (res.data.success) {
        showSweetToast('Warehouse approved successfully', 'success');
        onRefresh();
        onClose();
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to approve warehouse', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestRework = async () => {
    if (!warehouseId) return;
    if (!reworkComment.trim()) {
      showSweetToast('Please provide feedback comments explaining what needs rework', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/warehouses/${warehouseId}/rework`, {
        comments: reworkComment.trim(),
      });
      if (res.data.success) {
        setShowReworkModal(false);
        setReworkComment('');
        showSweetToast('Rework request sent to seller', 'info');
        onRefresh();
        onClose();
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to request rework', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!warehouseId) return;
    if (!rejectionReason.trim()) {
      showSweetToast('Please provide a reason for application rejection', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/warehouses/${warehouseId}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      if (res.data.success) {
        setShowRejectModal(false);
        setRejectionReason('');
        showSweetToast('Warehouse application rejected', 'info');
        onRefresh();
        onClose();
      }
    } catch (err: any) {
      showSweetToast(err.response?.data?.error?.message || 'Failed to reject warehouse', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Warehouse
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Verification
          </span>
        );
      case 'REWORK_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <RotateCcw className="w-3.5 h-3.5 text-orange-600" /> Rework Requested
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Application Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
      <div
        className={`relative w-full ${
          activeInspectingDoc ? 'max-w-[96vw] h-[95vh]' : 'max-w-6xl h-[92vh]'
        } bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-all`}
      >
        
        {/* Header Bar */}
        <div className="px-6 py-5 bg-[#F8F9FE] border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#635BFF] flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {warehouse?.warehouseName || 'Warehouse Review'}
                </h2>
                {warehouse?.warehouseCode && (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {warehouse.warehouseCode}
                  </span>
                )}
                {warehouse && getStatusBadge(warehouse.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Onboarding & Compliance Dossier • Type: <span className="font-bold text-slate-700">{warehouse?.warehouseType || 'OWN'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Loading warehouse dossier & documents...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Failed to load dossier</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md">{error}</p>
            <button
              onClick={fetchDetails}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : warehouse ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-50/50">
            
            {activeInspectingDoc ? (
              /* ── DYNAMIC SPLIT VIEW: ACTIVE INSPECTION MODE ── */
              <>
                {/* Left Column (5 Cols): Pinned checklist & cross-check specs */}
                <div className="lg:col-span-5 border-r border-slate-200 overflow-y-auto p-5 space-y-4 bg-white">
                  
                  {/* Exit Split View Banner */}
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Eye className="w-4 h-4 text-[#635BFF] shrink-0" />
                      <span className="text-xs font-bold text-slate-800 truncate">
                        Inspecting: <span className="text-[#635BFF]">{activeInspectingDoc.displayName}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectingDocId(null)}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-xs transition-colors shrink-0"
                    >
                      Exit Split View
                    </button>
                  </div>

                  {/* Document Quick Switcher & Status List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Compliance Checklist ({allDocuments.filter((d) => d.verificationStatus === 'VERIFIED').length}/{allDocuments.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {allDocuments.map((doc) => {
                        const isCurrent = doc.sellerWarehouseDocumentId === activeInspectingDoc.sellerWarehouseDocumentId;
                        return (
                          <div
                            key={doc.sellerWarehouseDocumentId}
                            onClick={() => setInspectingDocId(doc.sellerWarehouseDocumentId)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              isCurrent
                                ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 truncate">{doc.displayName}</span>
                                {doc.isMandatory && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100">
                                    REQ
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 block truncate">
                                Code: {doc.code} {doc.documentNumber ? `• Ref: ${doc.documentNumber}` : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {doc.verificationStatus === 'VERIFIED' ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Verified
                                </span>
                              ) : doc.verificationStatus === 'REJECTED' ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Rejected
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Physical Address Cross-Verification Card */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Cross-Check Warehouse Address
                    </span>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {warehouse.addressLine1}{warehouse.addressLine2 ? `, ${warehouse.addressLine2}` : ''}<br />
                        {warehouse.city}, {warehouse.state} - {warehouse.postalCode}, {warehouse.country}
                      </span>
                    </p>
                  </div>

                  {/* Registered Seller Summary */}
                  {primarySeller && (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Trade / Signatory Details
                      </span>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Business:</span>
                          <span className="font-bold text-slate-800">{primarySeller.businessName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Signatory:</span>
                          <span className="font-semibold text-slate-800">{primarySeller.sellerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Seller Code:</span>
                          <span className="font-mono text-slate-700">{primarySeller.sellerCode}</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Right Column (7 Cols): Reusable Document Inspector Pane */}
                <div className="lg:col-span-7 h-full p-2 sm:p-3 bg-slate-950 flex flex-col overflow-hidden">
                  {activeInspectableDoc && (
                    <DocumentInspectorPane
                      document={activeInspectableDoc}
                      documentsList={inspectableDocuments}
                      onSelectDocument={(doc) => setInspectingDocId(Number(doc.id))}
                      onClose={() => setInspectingDocId(null)}
                      actionSlot={
                        <div className="flex items-center gap-1.5">
                          {activeInspectingDoc.verificationStatus !== 'VERIFIED' && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleVerifyDoc(activeInspectingDoc.sellerWarehouseDocumentId)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                            </button>
                          )}
                          {activeInspectingDoc.verificationStatus !== 'REJECTED' && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => {
                                setDocToReject(activeInspectingDoc);
                                setDocRejectReason('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}
                        </div>
                      }
                    />
                  )}
                </div>
              </>
            ) : (
              /* ── DEFAULT 2-COLUMN VIEW (NO ACTIVE SPLIT) ── */
              <>
                {/* Left Column: Warehouse Info, Seller Info, Consents & Timeline */}
                <div className="lg:col-span-6 border-r border-slate-200 overflow-y-auto p-6 space-y-6">
                  
                  {/* Rework/Rejection Alert Banner if active */}
                  {warehouse.status === 'REWORK_REQUIRED' && (
                    <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200">
                      <div className="flex items-center gap-2 text-orange-900 font-bold text-xs">
                        <RotateCcw className="w-4 h-4 text-orange-600 shrink-0" />
                        <span>Rework Requested From Seller</span>
                      </div>
                      <p className="text-xs text-orange-800 mt-1 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-orange-100">
                        "{warehouse.latestStatusComment || 'Please update documents according to remarks'}"
                      </p>
                    </div>
                  )}

                  {warehouse.status === 'REJECTED' && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                      <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Warehouse Application Rejected</span>
                      </div>
                      <p className="text-xs text-rose-800 mt-1 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-rose-100">
                        "{warehouse.rejectionReason || warehouse.latestStatusComment || 'Application did not meet marketplace requirements'}"
                      </p>
                    </div>
                  )}

                  {/* Warehouse Details Card */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" /> Warehouse Specifications
                      </h3>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {warehouse.warehouseType === 'OWN' ? 'Seller Operated (OWN)' : 'Third-Party Logistics (3PL)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Warehouse Name</span>
                        <span className="font-semibold text-slate-800">{warehouse.warehouseName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Warehouse Code</span>
                        <span className="font-mono font-bold text-slate-800">{warehouse.warehouseCode}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block mb-0.5">Dispatch & Physical Address</span>
                        <span className="font-medium text-slate-700 flex items-start gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          {warehouse.addressLine1}
                          {warehouse.addressLine2 ? `, ${warehouse.addressLine2}` : ''}
                          <br />
                          {warehouse.city}, {warehouse.state} - {warehouse.postalCode}, {warehouse.country}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Contact Person</span>
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {warehouse.contactPersonName || 'Not specified'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Contact Phone</span>
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {warehouse.contactPhoneNumber || 'N/A'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block mb-0.5">Contact Email</span>
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {warehouse.contactEmail || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Associated Seller Card */}
                  {primarySeller && (
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <User className="w-4 h-4 text-emerald-600" /> Registered Seller
                        </h3>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {primarySeller.sellerCode}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Business Name</span>
                          <span className="font-semibold text-slate-800">{primarySeller.businessName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Authorized Signatory</span>
                          <span className="font-medium text-slate-800">{primarySeller.sellerName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Seller Email</span>
                          <span className="font-medium text-slate-800">{primarySeller.email}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Seller Phone</span>
                          <span className="font-medium text-slate-800">{primarySeller.phoneNumber || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Digital Consents & Declarations */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                      <ShieldCheck className="w-4 h-4 text-blue-600" /> Statutory & Compliance Declarations
                    </h3>
                    {warehouse.consents && warehouse.consents.length > 0 ? (
                      <div className="space-y-2">
                        {warehouse.consents.map((consent) => (
                          <div
                            key={consent.warehouseConsentId}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div>
                                <span className="font-semibold text-slate-800 block">
                                  {consent.consentType.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Version {consent.consentVersion} • Source: {consent.source || 'WEB'}
                                </span>
                              </div>
                            </div>
                            {consent.grantedAt && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                {new Date(consent.grantedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No formal declarations recorded.</p>
                    )}
                  </div>

                  {/* Audit & Status History Timeline */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Clock className="w-4 h-4 text-purple-600" /> Status History & Audit Trail
                    </h3>

                    {warehouse.statusHistory && warehouse.statusHistory.length > 0 ? (
                      <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {warehouse.statusHistory.map((item, idx) => (
                          <div key={item.historyId || idx} className="relative group">
                            {/* Timeline dot */}
                            <div
                              className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                                item.status === 'ACTIVE'
                                  ? 'border-emerald-500'
                                  : item.status === 'REWORK_REQUIRED'
                                  ? 'border-orange-500'
                                  : item.status === 'REJECTED'
                                  ? 'border-rose-500'
                                  : 'border-amber-500'
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.status === 'ACTIVE'
                                    ? 'bg-emerald-500'
                                    : item.status === 'REWORK_REQUIRED'
                                    ? 'bg-orange-500'
                                    : item.status === 'REJECTED'
                                    ? 'bg-rose-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                            </div>

                            <div className="bg-slate-50/70 hover:bg-slate-50 p-3 rounded-xl border border-slate-100 transition-colors">
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    item.status === 'ACTIVE'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.status === 'REWORK_REQUIRED'
                                      ? 'bg-orange-100 text-orange-800'
                                      : item.status === 'REJECTED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {item.status.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {new Date(item.changedAt).toLocaleString()}
                                </span>
                              </div>

                              {item.comments && (
                                <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed bg-white p-2 rounded-lg border border-slate-200/60">
                                  {item.comments}
                                </p>
                              )}

                              <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>Action by: <strong className="text-slate-700">{item.changedBy.name}</strong> ({item.changedBy.email})</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No history records yet.</p>
                    )}
                  </div>

                </div>

                {/* Right Column: Compliance Document Review Dossier */}
                <div className="lg:col-span-6 overflow-y-auto p-6 space-y-6">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <FileCheck2 className="w-4 h-4 text-indigo-600" /> Compliance Documents Checklist
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Verify mandatory proof of occupancy, license, and dispatch authority.
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        {allDocuments.filter((d) => d.verificationStatus === 'VERIFIED').length} / {allDocuments.length} Verified
                      </span>
                    </div>

                    {allDocuments.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-600">No compliance documents uploaded yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Seller must upload required documentation before approval can be granted.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {allDocuments.map((doc) => (
                          <div
                            key={doc.sellerWarehouseDocumentId}
                            className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white transition-all space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-slate-900">{doc.displayName}</h4>
                                  {doc.isMandatory && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100">
                                      MANDATORY
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-mono text-slate-500 mt-0.5 block">
                                  Code: {doc.code} {doc.documentNumber ? `• Ref: ${doc.documentNumber}` : ''}
                                </span>
                              </div>

                              {/* Status Badge */}
                              {doc.verificationStatus === 'VERIFIED' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified
                                </span>
                              ) : doc.verificationStatus === 'REJECTED' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Review
                                </span>
                              )}
                            </div>

                            {/* Rejection remark if any */}
                            {doc.rejectionReason && (
                              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-[11px]">
                                <strong className="font-semibold">Rejection Note:</strong> {doc.rejectionReason}
                              </div>
                            )}

                            {/* Action Bar for this Document */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                              {doc.documentUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setInspectingDocId(doc.sellerWarehouseDocumentId)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#635BFF] border border-indigo-200 text-xs font-bold transition-all shadow-xs"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Inspect Document
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No file attached</span>
                              )}

                              <div className="flex items-center gap-2">
                                {doc.verificationStatus !== 'VERIFIED' && (
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleVerifyDoc(doc.sellerWarehouseDocumentId)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                                  </button>
                                )}

                                {doc.verificationStatus !== 'REJECTED' && (
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => {
                                      setDocToReject(doc);
                                      setDocRejectReason('');
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>
        ) : null}

        {/* Modal Footer Review Actions */}
        {warehouse && (
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Warehouse ID: #{warehouse.warehouseId}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">
                Created: {new Date(warehouse.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
              >
                Close
              </button>

              {/* Lifecycle Actions only if pending or rework */}
              {(warehouse.status === 'PENDING_APPROVAL' || warehouse.status === 'REWORK_REQUIRED') && (
                <>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" /> Reject Warehouse
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setShowReworkModal(true)}
                    className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-600" /> Request Rework
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleApprove}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve & Activate Warehouse
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Sub-Modal: Request Rework Modal ── */}
        {showReworkModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Request Document / Info Rework</h3>
                    <p className="text-[11px] text-slate-500">Seller will receive notifications and instructions to fix issues.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReworkModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Quick Issue Presets:
                </span>
                <div className="space-y-1.5">
                  {REWORK_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReworkComment(preset)}
                      className="w-full text-left p-2 rounded-xl text-xs bg-slate-50 hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 text-slate-700 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom comment input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Detailed Feedback Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reworkComment}
                  onChange={(e) => setReworkComment(e.target.value)}
                  placeholder="Specify clear corrections needed from the seller..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReworkModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !reworkComment.trim()}
                  onClick={handleRequestRework}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-amber-500/20"
                >
                  <Send className="w-3.5 h-3.5" /> Send Rework Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-Modal: Reject Warehouse Modal ── */}
        {showRejectModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Reject Warehouse Application</h3>
                    <p className="text-[11px] text-slate-500">This action permanently rejects this warehouse application.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this warehouse cannot be onboarded..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !rejectionReason.trim()}
                  onClick={handleReject}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-rose-500/20"
                >
                  <XCircle className="w-3.5 h-3.5" /> Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-Modal: Reject Specific Document ── */}
        {docToReject && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reject Document</h3>
                  <p className="text-[11px] text-slate-500">{docToReject.displayName}</p>
                </div>
                <button
                  onClick={() => setDocToReject(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Defect / Issue Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={docRejectReason}
                  onChange={(e) => setDocRejectReason(e.target.value)}
                  placeholder="e.g. Document image is blurry or expired..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDocToReject(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !docRejectReason.trim()}
                  onClick={handleRejectDoc}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  Reject Document
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
