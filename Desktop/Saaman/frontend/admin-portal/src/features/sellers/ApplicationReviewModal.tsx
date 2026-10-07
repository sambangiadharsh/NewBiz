import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  Mail,
  Phone,
  AlertTriangle,
  AlertCircle,
  Clock,
  RotateCcw,
  Lock,
  User,
  Calendar,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import {
  DocumentInspectorPane,
  InspectableDocument,
  resolveDocumentUrl,
} from '../../components/common/DocumentInspectorPane.js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DocumentItem {
  documentId: number;
  code: string;
  displayName: string;
  certificateNumber?: string;
  documentUrl?: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  isMandatory?: boolean;
}

interface ConsentItem {
  consentId: number;
  type: string;
  isGranted: boolean;
  grantedAt?: string;
}

interface StatusHistoryItem {
  historyId: number;
  status: string;
  comments?: string;
  changedAt: string;
  changedBy: string;
}

interface ApplicationDetails {
  applicationId: number;
  status: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  seller: {
    sellerId: number;
    sellerCode: string;
    sellerName: string;
    businessName: string;
    email: string;
    phoneNumber: string;
    instagramUrl?: string;
    facebookUrl?: string;
    status: string;
    createdAt: string;
  };
  category: {
    categoryId: number;
    categoryName: string;
  };
  documents: DocumentItem[];
  consents: ConsentItem[];
  statusHistory: StatusHistoryItem[];
}

interface ApplicationReviewModalProps {
  applicationId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const SEND_BACK_PRESETS = [
  'GST certificate is blurry / unreadable — please re-upload.',
  'PAN name does not match the legal business entity name.',
  'BIS certificate has expired or is not valid for this category.',
  'Bank proof account name does not match business name.',
  'Wrong document uploaded — please review requirements.',
];

const DOC_REJECT_PRESETS = [
  'Blurry scan / unreadable',
  'Name does not match legal entity',
  'Certificate expired / invalid',
  'Wrong document uploaded',
  'Missing signature or seal',
  'Document not in acceptable format',
];

const getStatusDisplay = (status: string): { label: string; color: string } => {
  switch (status) {
    case 'APPROVED': return { label: 'Approved & Active', color: 'bg-emerald-100 text-emerald-800' };
    case 'REJECTED': return { label: 'Permanently Rejected', color: 'bg-rose-100 text-rose-800' };
    case 'SUBMITTED': return { label: 'Pending Review', color: 'bg-amber-100 text-amber-800' };
    case 'DRAFT': return { label: 'Sent Back for Correction', color: 'bg-orange-100 text-orange-800' };
    default: return { label: status, color: 'bg-slate-100 text-slate-700' };
  }
};

const fmtDate = (d?: string) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const ApplicationReviewModal: React.FC<ApplicationReviewModalProps> = ({
  applicationId,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [details, setDetails] = useState<ApplicationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Document rejection inline panel ──
  const [rejectingDocId, setRejectingDocId] = useState<number | null>(null);
  const [docRejectReason, setDocRejectReason] = useState<string>('');

  // ── Send back for correction ──
  const [sendingBack, setSendingBack] = useState<boolean>(false);
  const [sendBackNote, setSendBackNote] = useState<string>('');
  const SEND_BACK_MAX = 500;

  // ── Permanent reject ──
  const [rejectingApp, setRejectingApp] = useState<boolean>(false);
  const [appRejectReason, setAppRejectReason] = useState<string>('');

  // ── Approve confirmation ──
  const [confirmingApprove, setConfirmingApprove] = useState<boolean>(false);

  // ── History expand ──
  const [historyExpanded, setHistoryExpanded] = useState<boolean>(false);

  // ── Dynamic Split Document Inspector ──
  const [inspectingDocId, setInspectingDocId] = useState<number | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!applicationId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/admin/sellers/applications/${applicationId}`);
      if (res.data.success) {
        setDetails(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch application details');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (isOpen && applicationId) {
      fetchDetails();
      // Reset all action panels when (re)opening
      setRejectingDocId(null);
      setDocRejectReason('');
      setSendingBack(false);
      setSendBackNote('');
      setRejectingApp(false);
      setAppRejectReason('');
      setConfirmingApprove(false);
      setSuccessMessage(null);
      setError(null);
      setInspectingDocId(null);
    } else {
      setDetails(null);
    }
  }, [isOpen, applicationId, fetchDetails]);

  const activeInspectingDoc = inspectingDocId !== null
    ? (details?.documents || []).find((d) => d.documentId === inspectingDocId) || null
    : null;

  const inspectableDocuments: InspectableDocument[] = (details?.documents || []).map((d) => ({
    id: d.documentId,
    title: d.displayName,
    code: d.code,
    url: d.documentUrl,
    documentNumber: d.certificateNumber,
    isMandatory: d.isMandatory,
    verificationStatus: d.verificationStatus,
  }));

  const activeInspectableDoc: InspectableDocument | null = activeInspectingDoc
    ? {
        id: activeInspectingDoc.documentId,
        title: activeInspectingDoc.displayName,
        code: activeInspectingDoc.code,
        url: activeInspectingDoc.documentUrl,
        documentNumber: activeInspectingDoc.certificateNumber,
        isMandatory: activeInspectingDoc.isMandatory,
        verificationStatus: activeInspectingDoc.verificationStatus,
      }
    : null;

  // ─────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────

  const handleVerifyDocument = async (docId: number, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await apiClient.patch(`/admin/sellers/documents/${docId}/verify`, {
        status,
        rejectionReason: reason,
      });
      if (res.data.success) {
        setSuccessMessage(`Document ${status === 'APPROVED' ? 'approved' : 'rejected'} successfully.`);
        await fetchDetails();
        onRefresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to verify document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplicationDecision = async (decision: 'APPROVE' | 'REJECT', reason?: string) => {
    if (!applicationId) return;
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await apiClient.post(`/admin/sellers/applications/${applicationId}/decision`, {
        decision,
        rejectionReason: reason,
      });
      if (res.data.success) {
        setSuccessMessage(
          decision === 'APPROVE'
            ? 'Seller approved and activated successfully!'
            : 'Application permanently rejected.'
        );
        setRejectingApp(false);
        setAppRejectReason('');
        setConfirmingApprove(false);
        await fetchDetails();
        onRefresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to finalize application decision');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendBack = async () => {
    if (!applicationId) return;
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await apiClient.patch(`/admin/sellers/applications/${applicationId}/reopen`, {
        correctionNote: sendBackNote.trim() || 'Please review and re-upload the flagged documents.',
      });
      if (res.data.success) {
        setSuccessMessage('Application sent back. Seller will see the correction note and must resubmit.');
        setSendingBack(false);
        setSendBackNote('');
        await fetchDetails();
        onRefresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to send back application');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  // ─────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────

  const isLocked = loading || actionLoading;
  const isFinalized = details?.status === 'APPROVED' || details?.status === 'REJECTED';

  const totalDocs = details?.documents.length ?? 0;
  const approvedDocs = details?.documents.filter((d) => d.verificationStatus === 'APPROVED').length ?? 0;
  const pendingMandatoryDocs = details?.documents.filter(
    (d) => d.isMandatory && d.verificationStatus !== 'APPROVED'
  ) ?? [];
  const hasUnverifiedMandatory = pendingMandatoryDocs.length > 0;

  const statusInfo = details ? getStatusDisplay(details.status) : null;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-2 sm:p-4 md:p-6">
      <div
        className={`bg-white rounded-3xl ${
          activeInspectingDoc ? 'max-w-[96vw] h-[95vh]' : 'max-w-4xl max-h-[90vh]'
        } w-full flex flex-col shadow-2xl border border-slate-100 overflow-hidden transition-all duration-200`}
      >

        {/* ── Modal Header ── */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-violet-50/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#635BFF] to-[#7C5CFC] flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Seller KYC Review</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Application #{applicationId}
                {details && ` • ${details.category.categoryName}`}
                {details && statusInfo && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                )}
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

        {/* ── Modal Body ── */}
        <div className={`flex-1 overflow-y-auto ${activeInspectingDoc ? 'p-0 overflow-hidden flex flex-col' : 'p-8 space-y-6'}`}>

          {/* Alerts */}
          {error && (
            <div className="m-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)}>
                <X className="w-4 h-4 text-rose-400 hover:text-rose-700" />
              </button>
            </div>
          )}
          {successMessage && (
            <div className="m-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="flex-1">{successMessage}</span>
              <button type="button" onClick={() => setSuccessMessage(null)}>
                <X className="w-4 h-4 text-emerald-400 hover:text-emerald-700" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 border-4 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading verification dossier...</p>
            </div>
          ) : details ? (
            activeInspectingDoc ? (
              /* ── DYNAMIC SPLIT VIEW: ACTIVE KYC INSPECTION MODE ── */
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-50/50">
                {/* Left Column (5 cols): Pinned checklist & cross-check business details */}
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

                  {/* Documents List & Switcher */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        KYC Documents Checklist ({approvedDocs}/{totalDocs} Verified)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {details.documents.map((doc) => {
                        const isCurrent = doc.documentId === activeInspectingDoc.documentId;
                        return (
                          <div
                            key={doc.documentId}
                            onClick={() => setInspectingDocId(doc.documentId)}
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
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">REQ</span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 block truncate">
                                Code: {doc.code} {doc.certificateNumber ? `• Ref: ${doc.certificateNumber}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {doc.verificationStatus === 'APPROVED' ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Verified
                                </span>
                              ) : doc.verificationStatus === 'REJECTED' ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Rejected
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Business Entity Cross-Verification Card */}
                  <div className="p-4 rounded-2xl bg-[#F8F9FE] border border-slate-200 space-y-2 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Cross-Check Business Details
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Legal Entity:</span>
                        <span className="font-bold text-slate-900">{details.seller.businessName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Brand Name:</span>
                        <span className="font-semibold text-[#635BFF]">{details.seller.sellerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-700">{details.seller.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Seller Code:</span>
                        <span className="font-mono font-bold text-slate-700">{details.seller.sellerCode}</span>
                      </div>
                    </div>
                  </div>

                  {/* Inline Rejection Panel if active for current doc */}
                  {rejectingDocId === activeInspectingDoc.documentId && (
                    <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-2.5 animate-in fade-in">
                      <p className="text-xs font-bold text-rose-900">Select or type rejection reason:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {DOC_REJECT_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDocRejectReason(preset)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors ${
                              docRejectReason === preset
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={docRejectReason}
                        onChange={(e) => setDocRejectReason(e.target.value)}
                        placeholder="Custom rejection note..."
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-rose-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingDocId(null);
                            setDocRejectReason('');
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!docRejectReason.trim() || actionLoading}
                          onClick={() => handleVerifyDocument(activeInspectingDoc.documentId, 'REJECTED', docRejectReason)}
                          className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                {/* Right Column (7 cols): Reusable Document Inspector */}
                <div className="lg:col-span-7 h-full p-2 sm:p-3 bg-slate-950 flex flex-col overflow-hidden">
                  {activeInspectableDoc && (
                    <DocumentInspectorPane
                      document={activeInspectableDoc}
                      documentsList={inspectableDocuments}
                      onSelectDocument={(doc) => setInspectingDocId(Number(doc.id))}
                      onClose={() => setInspectingDocId(null)}
                      actionSlot={
                        <div className="flex items-center gap-1.5">
                          {activeInspectingDoc.verificationStatus !== 'APPROVED' && (
                            <button
                              type="button"
                              disabled={isLocked || isFinalized || actionLoading}
                              onClick={() => handleVerifyDocument(activeInspectingDoc.documentId, 'APPROVED')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                          {activeInspectingDoc.verificationStatus !== 'REJECTED' && (
                            <button
                              type="button"
                              disabled={isLocked || isFinalized || actionLoading}
                              onClick={() => {
                                setRejectingDocId(activeInspectingDoc.documentId);
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
              </div>
            ) : (
              <>
              {/* ── Business Overview ── */}
              <div className="p-6 rounded-2xl bg-[#F8F9FE] border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Legal Business Entity</span>
                  <p className="text-sm font-black text-slate-900">{details.seller.businessName}</p>
                  <p className="text-xs font-bold text-[#635BFF] mt-0.5">Brand: {details.seller.sellerName}</p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-700">
                    {details.seller.sellerCode}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Contact & Representatives</span>
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {details.seller.email}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mt-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {details.seller.phoneNumber}
                  </p>
                  {details.seller.instagramUrl && (
                    <a href={details.seller.instagramUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-[#635BFF] font-medium flex items-center gap-1 mt-1.5 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Brand Link
                    </a>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Timeline</span>
                  <div className="space-y-1.5 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Submitted: <strong>{fmtDate(details.submittedAt)}</strong></span>
                    </div>
                    {details.reviewedAt && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Reviewed by <strong>{details.reviewedBy || '—'}</strong> on {fmtDate(details.reviewedAt)}</span>
                      </div>
                    )}
                    {details.status === 'DRAFT' && details.rejectionReason && (
                      <div className="mt-2 p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-800 font-medium">
                        <span className="font-bold block mb-0.5">Correction Note (visible to seller):</span>
                        <span className="italic">"{details.rejectionReason}"</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Pre-approval warning: unverified mandatory docs ── */}
              {hasUnverifiedMandatory && details.status === 'SUBMITTED' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-900 mb-1">
                      {pendingMandatoryDocs.length} Mandatory Document{pendingMandatoryDocs.length > 1 ? 's' : ''} Not Yet Approved
                    </p>
                    <p className="text-amber-800 mb-2">
                      Approving without verifying all mandatory documents is not recommended.
                      Please verify or reject each document below before making an approval decision.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingMandatoryDocs.map((d) => (
                        <span key={d.documentId} className="px-2 py-0.5 bg-white border border-amber-300 text-amber-900 rounded-lg font-mono text-[10px] font-bold">
                          {d.code} — {d.verificationStatus}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── KYC Documents ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-[#635BFF]" />
                    Uploaded Compliance Documents
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      {approvedDocs} / {totalDocs} Verified
                    </span>
                    {hasUnverifiedMandatory && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                        {pendingMandatoryDocs.length} Mandatory Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {details.documents.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 font-medium">No documents uploaded for this application yet.</p>
                    </div>
                  ) : (
                    details.documents.map((doc) => (
                      <div
                        key={doc.documentId}
                        className={`rounded-2xl border transition-all shadow-sm overflow-hidden ${
                          doc.verificationStatus === 'APPROVED'
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : doc.verificationStatus === 'REJECTED'
                            ? 'border-rose-200 bg-rose-50/20'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                      >
                        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Doc info */}
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-mono font-bold">
                                {doc.code}
                              </span>
                              <span className="text-sm font-bold text-slate-900">{doc.displayName}</span>
                              {doc.isMandatory ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700">Mandatory</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">Optional</span>
                              )}
                              {doc.verificationStatus === 'APPROVED' && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Verified
                                </span>
                              )}
                              {doc.verificationStatus === 'REJECTED' && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Rejected
                                </span>
                              )}
                              {doc.verificationStatus === 'PENDING' && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-mono font-bold text-slate-500">
                              Cert / Doc Number:{' '}
                              <span className="text-slate-900">{doc.certificateNumber || 'N/A'}</span>
                            </p>

                            {doc.verificationStatus === 'REJECTED' && doc.rejectionReason && (
                              <p className="text-xs text-rose-600 font-medium mt-1 flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                Rejection reason: {doc.rejectionReason}
                              </p>
                            )}

                            {doc.verificationStatus === 'APPROVED' && (doc.verifiedBy || doc.verifiedAt) && (
                              <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1.5">
                                <Lock className="w-3 h-3" />
                                Verified{doc.verifiedBy ? ` by ${doc.verifiedBy}` : ''}{doc.verifiedAt ? ` on ${fmtDate(doc.verifiedAt)}` : ''}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                            {doc.documentUrl && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setInspectingDocId(doc.documentId)}
                                  className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#635BFF] text-xs font-bold inline-flex items-center gap-1.5 transition-colors border border-indigo-200 shadow-xs"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Inspect Document
                                </button>
                                <a
                                  href={resolveDocumentUrl(doc.documentUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open raw file in new tab"
                                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}

                            {/* Approve doc button */}
                            <button
                              type="button"
                              disabled={isLocked || doc.verificationStatus === 'APPROVED' || isFinalized}
                              onClick={() => handleVerifyDocument(doc.documentId, 'APPROVED')}
                              className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-40"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>

                            {/* Reject doc button (toggles inline panel) */}
                            <button
                              type="button"
                              disabled={isLocked || doc.verificationStatus === 'REJECTED' || isFinalized}
                              onClick={() => {
                                if (rejectingDocId === doc.documentId) {
                                  setRejectingDocId(null);
                                  setDocRejectReason('');
                                } else {
                                  setRejectingDocId(doc.documentId);
                                  setDocRejectReason('');
                                }
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-40 ${
                                rejectingDocId === doc.documentId
                                  ? 'bg-rose-200 text-rose-900'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {rejectingDocId === doc.documentId ? 'Cancel' : 'Reject'}
                            </button>
                          </div>
                        </div>

                        {/* Inline rejection reason panel */}
                        {rejectingDocId === doc.documentId && (
                          <div className="px-5 pb-5 space-y-3 border-t border-rose-100 pt-4 bg-rose-50/60">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                Specify the correction required for "{doc.displayName}":
                              </span>
                            </div>

                            {/* Preset chips */}
                            <div className="flex flex-wrap gap-1.5">
                              {DOC_REJECT_PRESETS.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDocRejectReason(preset)}
                                  className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                                    docRejectReason === preset
                                      ? 'bg-rose-600 border-rose-600 text-white'
                                      : 'bg-white border-rose-200 text-rose-800 hover:bg-rose-100'
                                  }`}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={docRejectReason}
                                onChange={(e) => setDocRejectReason(e.target.value)}
                                placeholder="Or type a custom reason..."
                                maxLength={300}
                                className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-rose-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
                              />
                              <button
                                type="button"
                                disabled={actionLoading || !docRejectReason.trim()}
                                onClick={() => {
                                  handleVerifyDocument(doc.documentId, 'REJECTED', docRejectReason.trim());
                                  setRejectingDocId(null);
                                  setDocRejectReason('');
                                }}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50 shrink-0"
                              >
                                {actionLoading ? 'Saving...' : 'Confirm Rejection'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Consents ── */}
              {details.consents.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#F8F9FE] border border-slate-100 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-[#635BFF]" /> Seller Consent Record
                  </h4>
                  {details.consents.map((c) => (
                    <div key={c.consentId} className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium">{c.type.replace(/_/g, ' ')}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${c.isGranted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {c.isGranted ? `Granted ${c.grantedAt ? fmtDate(c.grantedAt) : ''}` : 'Not Granted'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Status History ── */}
              {details.statusHistory.length > 0 && (
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setHistoryExpanded((v) => !v)}
                    className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Audit History ({details.statusHistory.length} entries)
                    </span>
                    {historyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {historyExpanded && (
                    <div className="px-5 pb-4 divide-y divide-slate-50 space-y-0">
                      {details.statusHistory.map((h) => (
                        <div key={h.historyId} className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusDisplay(h.status).color}`}>
                              {h.status}
                            </span>
                            {h.comments && (
                              <p className="text-[11px] text-slate-500 mt-1 italic">"{h.comments}"</p>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            by <strong>{h.changedBy}</strong> on {fmtDate(h.changedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        ) : null}
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/70 shrink-0 space-y-4">

          {/* Send Back inline panel */}
          {sendingBack && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-900">
                  Correction note for the seller (they will see this in their portal):
                </p>
                <span className="text-[10px] text-amber-600 font-medium">{sendBackNote.length}/{SEND_BACK_MAX}</span>
              </div>
              {/* Preset suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {SEND_BACK_PRESETS.map((p) => (
                  <button key={p} type="button" onClick={() => setSendBackNote(p)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                      sendBackNote === p ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
              <textarea
                value={sendBackNote}
                onChange={(e) => setSendBackNote(e.target.value.slice(0, SEND_BACK_MAX))}
                placeholder="e.g. GST doc is blurry. PAN name doesn't match business name. Please re-upload clear copies..."
                rows={2}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30 font-medium resize-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => { setSendingBack(false); setSendBackNote(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white">
                  Cancel
                </button>
                <button type="button" disabled={isLocked} onClick={handleSendBack}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm disabled:opacity-50">
                  {actionLoading ? 'Sending...' : 'Confirm — Send Back for Correction'}
                </button>
              </div>
            </div>
          )}

          {/* Permanent reject inline panel */}
          {rejectingApp && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
              <p className="text-xs font-bold text-rose-900">
                Permanent rejection reason (stored in audit log and shown to seller):
              </p>
              <input
                type="text"
                value={appRejectReason}
                onChange={(e) => setAppRejectReason(e.target.value)}
                placeholder="e.g. Fraudulent identity documents detected, duplicate account..."
                maxLength={500}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400/30 font-medium"
              />
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => { setRejectingApp(false); setAppRejectReason(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white">
                  Cancel
                </button>
                <button type="button"
                  disabled={isLocked || !appRejectReason.trim()}
                  onClick={() => handleApplicationDecision('REJECT', appRejectReason.trim())}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-50">
                  {actionLoading ? 'Processing...' : 'Confirm Permanent Rejection'}
                </button>
              </div>
            </div>
          )}

          {/* Approve confirmation panel */}
          {confirmingApprove && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
              {hasUnverifiedMandatory && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    <strong>Warning:</strong> {pendingMandatoryDocs.length} mandatory document{pendingMandatoryDocs.length > 1 ? 's are' : ' is'} not yet approved.
                    Approving now will activate this seller without fully verified compliance documents.
                  </span>
                </div>
              )}
              <p className="text-xs font-bold text-emerald-900">
                Confirm seller approval? This will activate the seller account and grant catalog listing permissions.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setConfirmingApprove(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white">
                  Cancel
                </button>
                <button type="button" disabled={isLocked}
                  onClick={() => handleApplicationDecision('APPROVE')}
                  className="px-5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {actionLoading ? 'Activating...' : 'Yes, Approve & Activate Seller'}
                </button>
              </div>
            </div>
          )}

          {/* Main footer action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400 font-medium">
              {isFinalized
                ? details?.status === 'APPROVED'
                  ? 'This seller is active and approved for catalog operations.'
                  : 'This application has been permanently rejected.'
                : 'Verify all documents, then make a final approval decision.'}
            </p>

            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              {/* Send Back */}
              <button
                type="button"
                disabled={isLocked || isFinalized}
                onClick={() => { setRejectingApp(false); setConfirmingApprove(false); setSendingBack(true); }}
                className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Send Back for Correction
              </button>

              {/* Reject Permanently */}
              <button
                type="button"
                disabled={isLocked || isFinalized}
                onClick={() => { setSendingBack(false); setConfirmingApprove(false); setRejectingApp(true); }}
                className="px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-colors disabled:opacity-40"
              >
                <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Reject Permanently</span>
              </button>

              {/* Approve Seller */}
              <button
                type="button"
                disabled={isLocked || details?.status === 'APPROVED'}
                onClick={() => { setSendingBack(false); setRejectingApp(false); setConfirmingApprove(true); }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#635BFF] via-[#7064FF] to-[#7C5CFC] hover:from-[#5147FF] hover:to-[#635BFF] text-white rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4" />
                {details?.status === 'APPROVED' ? 'Approved ✓' : 'Approve Seller'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
