import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Warehouse,
  MapPin,
  User,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Upload,
  Users,
  UserPlus,
  Trash2,
  Copy,
  RotateCcw,
  Send,
  Star,
  Building2,
  Link2,
  Phone,
  Mail,
  Check,
  History,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import {
  DocumentInspectorPane,
  InspectableDocument,
} from '../../components/common/DocumentInspectorPane.js';

interface StaffMember {
  warehouseUserId: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  status: string;
  assignedAt: string;
}

interface WarehouseInvitationItem {
  invitationId: number;
  warehouseId: number;
  email: string;
  roleName: string;
  status: string;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  isExpired: boolean;
  createdBy?: string | null;
}

interface WarehouseConsentItem {
  consentId: number;
  type: string;
  version: string;
  isGranted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  source?: string;
  createdAt?: string;
}

interface WarehouseRequirementItem {
  documentTypeId: number;
  code: string;
  displayName: string;
  warehouseType: string;
  isRequired: boolean;
}

interface WarehouseDocumentItem {
  sellerWarehouseDocumentId: number;
  documentTypeId: number;
  code: string;
  displayName: string;
  documentNumber?: string;
  documentUrl?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string;
  isMandatory: boolean;
  createdAt?: string;
}

interface WarehouseDetails {
  sellerWarehouseId: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: 'OWN' | '3PL';
  contactPersonName?: string;
  contactEmail?: string;
  contactPhoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  status: string;
  relationshipStatus?: string;
  facilityStatus?: string;
  isPrimary: boolean;
  createdAt: string;
  rejectionReason?: string;
  consents?: WarehouseConsentItem[];
  requiredDocuments?: WarehouseRequirementItem[];
  documents?: WarehouseDocumentItem[];
  staffMembers?: StaffMember[];
  latestStatusComment?: string | null;
  totalProductsCount?: number;
  statusHistory?: Array<{
    historyId: number;
    status: string;
    comments?: string | null;
    changedAt: string;
    changedBy: {
      userId: number;
      name: string;
      email: string;
    };
  }>;
}

interface WarehouseDetailsModalProps {
  warehouseId: number | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const WarehouseDetailsModal: React.FC<WarehouseDetailsModalProps> = ({
  warehouseId,
  onClose,
  onUpdated,
}) => {
  const [warehouse, setWarehouse] = useState<WarehouseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'staff' | 'history'>('overview');

  // Dynamic Split Document Inspector Mode
  const [inspectingDocId, setInspectingDocId] = useState<number | null>(null);

  // Document Upload State
  const [uploadingDocCode, setUploadingDocCode] = useState<string | null>(null);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  // Resubmit Modal State
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [resubmitRemarks, setResubmitRemarks] = useState('');
  const [resubmitting, setResubmitting] = useState(false);

  // Primary & Disconnect State
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Staff Management & Invitations State
  const [invitations, setInvitations] = useState<WarehouseInvitationItem[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<{ message: string; inviteUrl?: string; email?: string } | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<number | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);

  // Legacy direct add staff state
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffFirstName, setNewStaffFirstName] = useState('');
  const [newStaffLastName, setNewStaffLastName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffTempPassword, setNewStaffTempPassword] = useState('');
  const [showStaffMoreFields, setShowStaffMoreFields] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<{ message: string; tempPassword?: string; email?: string } | null>(null);
  const [removingStaffId, setRemovingStaffId] = useState<number | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!warehouseId) return;
    setLoadingInvites(true);
    try {
      const res = await apiClient.get(`/seller/warehouses/${warehouseId}/invites`);
      if (res.data.success) {
        setInvitations(res.data.data || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingInvites(false);
    }
  }, [warehouseId]);

  const fetchDetails = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/seller/warehouses/${warehouseId}`);
      if (res.data.success) {
        setWarehouse(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load warehouse details');
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    fetchDetails();
    fetchInvitations();
  }, [fetchDetails, fetchInvitations]);

  // Keyboard shortcut to close inspector on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectingDocId !== null) {
          setInspectingDocId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingDocId, onClose]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleCopyCode = () => {
    if (!warehouse) return;
    navigator.clipboard.writeText(warehouse.warehouseCode);
    setCopiedCode(true);
    showToast(`Warehouse code ${warehouse.warehouseCode} copied!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleUploadDoc = async (docCode: string, file: File) => {
    if (!warehouse) return;
    setUploadingDocCode(docCode);
    setDocUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentTypeCode', docCode);

      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.post(
        `/seller/warehouses/${targetId}/documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data.success) {
        showToast(`Document "${docCode}" uploaded successfully!`);
        await fetchDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      setDocUploadError(err.response?.data?.error?.message || 'Failed to upload document');
    } finally {
      setUploadingDocCode(null);
    }
  };

  const handleSetPrimary = async () => {
    if (!warehouse) return;
    setSettingPrimary(true);
    try {
      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.post(`/seller/warehouses/${targetId}/primary`);
      if (res.data.success) {
        showToast('Warehouse designated as primary dispatch hub!');
        await fetchDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to set as primary warehouse');
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouse) return;
    setResubmitting(true);
    try {
      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.post(`/seller/warehouses/${targetId}/resubmit`, {
        remarks: resubmitRemarks.trim(),
      });
      if (res.data.success) {
        setShowResubmitModal(false);
        setResubmitRemarks('');
        showToast('Warehouse resubmitted for verification review!');
        await fetchDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to resubmit warehouse');
    } finally {
      setResubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!warehouse) return;
    const confirmed = window.confirm(
      `Are you sure you want to disconnect from 3PL warehouse "${warehouse.warehouseName}"? Active order routing and inventory will be paused.`
    );
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.post(`/seller/warehouses/${targetId}/disconnect`);
      if (res.data.success) {
        onUpdated?.();
        onClose();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to disconnect 3PL warehouse');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouse || !inviteEmail.trim()) return;
    setSendingInvite(true);
    setStaffError(null);
    setInviteSuccess(null);
    try {
      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.post(`/seller/warehouses/${targetId}/invites`, {
        email: inviteEmail.trim(),
        roleName: 'WAREHOUSE_MANAGER',
      });
      if (res.data.success) {
        setInviteSuccess({
          message: res.data.message || 'Invitation sent successfully!',
          inviteUrl: res.data.data?.inviteUrl,
          email: res.data.data?.email,
        });
        setInviteEmail('');
        await fetchInvitations();
        showToast('Staff invitation dispatched via email');
      }
    } catch (err: any) {
      setStaffError(err.response?.data?.error?.message || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleResendInvite = async (invitationId: number) => {
    if (!warehouse) return;
    setResendingInviteId(invitationId);
    setStaffError(null);
    try {
      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.post(`/seller/warehouses/${targetId}/invites/${invitationId}/resend`);
      if (res.data.success) {
        setInviteSuccess({
          message: 'Invitation resent successfully with a fresh 48-hour link!',
          inviteUrl: res.data.data?.inviteUrl,
          email: res.data.data?.email,
        });
        await fetchInvitations();
        showToast('Fresh invitation email sent');
      }
    } catch (err: any) {
      setStaffError(err.response?.data?.error?.message || 'Failed to resend invitation');
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleRevokeInvite = async (invitationId: number) => {
    if (!warehouse) return;
    const confirmed = window.confirm('Are you sure you want to cancel this pending invitation?');
    if (!confirmed) return;

    setRevokingInviteId(invitationId);
    setStaffError(null);
    try {
      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.delete(`/seller/warehouses/${targetId}/invites/${invitationId}`);
      if (res.data.success) {
        showToast('Invitation cancelled');
        await fetchInvitations();
      }
    } catch (err: any) {
      setStaffError(err.response?.data?.error?.message || 'Failed to cancel invitation');
    } finally {
      setRevokingInviteId(null);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouse || !newStaffEmail.trim()) return;
    setAddingStaff(true);
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const payload: any = {
        email: newStaffEmail.trim(),
      };
      if (newStaffFirstName.trim()) payload.firstName = newStaffFirstName.trim();
      if (newStaffLastName.trim()) payload.lastName = newStaffLastName.trim();
      if (newStaffPhone.trim()) payload.phoneNumber = newStaffPhone.trim();
      if (newStaffTempPassword.trim()) payload.temporaryPassword = newStaffTempPassword.trim();

      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.post(`/seller/warehouses/${targetId}/staff`, payload);
      if (res.data.success) {
        const assigned = res.data.data?.assignedUser;
        if (assigned?.isNewUser) {
          setStaffSuccess({
            message: 'New operator account created and authorized for this warehouse!',
            tempPassword: assigned.temporaryPassword || 'Warehouse@123',
            email: assigned.email,
          });
        } else {
          setStaffSuccess({
            message: 'Existing user authorized as warehouse operator successfully!',
          });
        }
        setNewStaffEmail('');
        setNewStaffFirstName('');
        setNewStaffLastName('');
        setNewStaffPhone('');
        setNewStaffTempPassword('');
        setShowStaffMoreFields(false);
        await fetchDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      setStaffError(err.response?.data?.error?.message || 'Failed to authorize operator');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (targetUserId: number) => {
    if (!warehouse) return;
    const confirmed = window.confirm('Are you sure you want to revoke this operator access to this warehouse?');
    if (!confirmed) return;

    setRemovingStaffId(targetUserId);
    setStaffError(null);
    try {
      const targetId = warehouse.warehouseId || warehouse.sellerWarehouseId;
      const res = await apiClient.delete(`/seller/warehouses/${targetId}/staff/${targetUserId}`);
      if (res.data.success) {
        showToast('Operator authorization revoked');
        await fetchDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      setStaffError(err.response?.data?.error?.message || 'Failed to remove operator');
    } finally {
      setRemovingStaffId(null);
    }
  };

  if (!warehouseId) return null;

  const isWarehouseActive = warehouse && (warehouse.facilityStatus === 'ACTIVE' || warehouse.status === 'ACTIVE');
  const isReworkNeeded = warehouse && (warehouse.facilityStatus === 'REWORK_REQUIRED' || warehouse.status === 'REWORK_REQUIRED');

  // Documents mapped for the Inspector
  const inspectableDocuments: InspectableDocument[] = (warehouse?.documents || []).map((d) => ({
    id: d.sellerWarehouseDocumentId,
    title: d.displayName,
    code: d.code,
    url: d.documentUrl,
    documentNumber: d.documentNumber,
    isMandatory: d.isMandatory,
    verificationStatus: d.verificationStatus,
    rejectionReason: d.rejectionReason,
  }));

  const activeInspectingDoc = inspectingDocId !== null
    ? inspectableDocuments.find((d) => Number(d.id) === inspectingDocId) || null
    : null;

  const verifiedDocsCount = (warehouse?.documents || []).filter(
    (d) => d.verificationStatus === 'VERIFIED'
  ).length;
  const totalRequiredCount = warehouse?.requiredDocuments?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl border border-[#E8E1D7] shadow-2xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ── Executive Light Luxury Header ── */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#E8E1D7] flex items-start justify-between bg-gradient-to-r from-[#FAF8F5] via-white to-rose-50/30 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#641D26] to-[#8E2837] flex items-center justify-center text-white shadow-md shadow-rose-900/20 shrink-0">
              <Warehouse className="w-5 h-5" />
            </div>
            
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight truncate">
                  {warehouse?.warehouseName || 'Warehouse Details'}
                </h2>
                {warehouse && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs text-[#7E2532] bg-rose-50 px-2.5 py-0.5 rounded-lg font-bold border border-rose-200/70">
                      {warehouse.warehouseCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      title="Copy warehouse code"
                      className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {warehouse.isPrimary && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> PRIMARY
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-stone-500 font-medium">
                Warehouse Profile & Documents • {warehouse?.warehouseType === 'OWN' ? 'Seller-Operated Station' : '3PL Partner Network'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-4">
            {warehouse && (
              <span
                className={`hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${
                  isWarehouseActive
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : isReworkNeeded
                    ? 'bg-orange-50 text-orange-800 border-orange-300'
                    : warehouse.facilityStatus === 'PENDING_APPROVAL' || warehouse.status === 'PENDING_APPROVAL'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
              >
                {isWarehouseActive ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE & READY
                  </>
                ) : isReworkNeeded ? (
                  <>
                    <RotateCcw className="w-3 h-3 text-orange-600" /> REWORK REQUIRED
                  </>
                ) : warehouse.facilityStatus === 'PENDING_APPROVAL' || warehouse.status === 'PENDING_APPROVAL' ? (
                  <>
                    <Clock className="w-3 h-3 text-amber-600" /> UNDER VERIFICATION
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3 h-3 text-rose-600" /> {warehouse.facilityStatus || warehouse.status}
                  </>
                )}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Toast Notification ── */}
        {successToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-6 py-2.5 text-xs font-bold flex items-center justify-between animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Navigation Tabs ── */}
        {warehouse && !activeInspectingDoc && (
          <div className="bg-white border-b border-[#E8E1D7] px-6 sm:px-8 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
            {[
              { id: 'overview', label: 'Overview & Location', icon: Warehouse },
              {
                id: 'documents',
                label: 'KYC Compliance Documents',
                icon: FileText,
                badge: `${verifiedDocsCount}/${totalRequiredCount}`,
              },
              ...(warehouse.warehouseType === 'OWN'
                ? [
                    {
                      id: 'staff',
                      label: 'Staff & Operators',
                      icon: Users,
                      badge: warehouse.staffMembers?.length || 0,
                    },
                  ]
                : []),
              {
                id: 'history',
                label: 'Audit Timeline',
                icon: History,
                badge: warehouse.statusHistory?.length || 0,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-3.5 px-3.5 border-b-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-[#641D26] text-[#641D26]'
                      : 'border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                        isActive ? 'bg-[#641D26] text-white' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Modal Body Container ── */}
        <div className={`flex-1 overflow-y-auto ${activeInspectingDoc ? 'p-0 overflow-hidden flex flex-col' : 'p-6 sm:p-8 space-y-6'}`}>
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-stone-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#7E2532]" />
              <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                Loading warehouse profile & documents...
              </span>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          ) : warehouse ? (
            activeInspectingDoc ? (
              /* ══════════════════════════════════════════════════════════════════
                 DYNAMIC SPLIT VIEW: ACTIVE KYC INSPECTION MODE (Matched with admin-portal)
                 ══════════════════════════════════════════════════════════════════ */
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-stone-50/50">
                {/* Left Column (5 cols): Pinned checklist & cross-check details */}
                <div className="lg:col-span-5 border-r border-[#E8E1D7] overflow-y-auto p-5 space-y-4 bg-white">
                  {/* Exit Split View Banner */}
                  <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Eye className="w-4 h-4 text-[#7E2532] shrink-0" />
                      <span className="text-xs font-bold text-stone-800 truncate">
                        Inspecting: <span className="text-[#641D26]">{activeInspectingDoc.title}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectingDocId(null)}
                      className="text-[11px] font-bold text-[#641D26] hover:text-[#52161E] bg-white px-2.5 py-1 rounded-xl border border-rose-200 shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                      Exit Split View
                    </button>
                  </div>

                  {/* Documents List & Switcher */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                        KYC Compliance Documents ({verifiedDocsCount}/{totalRequiredCount} Verified)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {inspectableDocuments.map((doc) => {
                        const isCurrent = Number(doc.id) === inspectingDocId;
                        return (
                          <div
                            key={doc.id}
                            onClick={() => setInspectingDocId(Number(doc.id))}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              isCurrent
                                ? 'bg-rose-50/70 border-rose-300 ring-2 ring-[#7E2532]/20 shadow-xs'
                                : 'bg-[#FAF8F5] hover:bg-stone-100 border-[#E8E1D7]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-stone-900 truncate">{doc.title}</span>
                                {doc.isMandatory && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                    REQ
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-stone-400 block truncate">
                                Code: {doc.code} {doc.documentNumber ? `• Ref: ${doc.documentNumber}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {doc.verificationStatus === 'VERIFIED' ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                                </span>
                              ) : doc.verificationStatus === 'REJECTED' ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1 border border-rose-200">
                                  <ShieldAlert className="w-3 h-3 text-rose-600" /> Rejected
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" /> Pending
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Re-upload / Upload action for currently selected document */}
                  {activeInspectingDoc && activeInspectingDoc.code && (
                    <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E1D7] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                          Upload / Replace Document
                        </span>
                        {activeInspectingDoc.verificationStatus === 'REJECTED' && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                            Rework Required
                          </span>
                        )}
                      </div>

                      {activeInspectingDoc.rejectionReason && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                          <span className="font-bold block mb-0.5">Compliance Remark:</span>
                          <span className="italic">"{activeInspectingDoc.rejectionReason}"</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8E1D7] hover:border-[#7E2532] text-stone-800 text-xs font-bold shadow-sm transition-all">
                          {uploadingDocCode === activeInspectingDoc.code ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7E2532]" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-[#7E2532]" />
                          )}
                          <span>
                            {uploadingDocCode === activeInspectingDoc.code ? 'Uploading Scan...' : 'Select File to Upload'}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            className="hidden"
                            disabled={uploadingDocCode === activeInspectingDoc.code}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && activeInspectingDoc.code) {
                                handleUploadDoc(activeInspectingDoc.code, file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Warehouse Cross-Verification Details Card */}
                  <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E1D7] space-y-2 text-xs">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Cross-Check Warehouse Station
                    </span>
                    <div className="space-y-1.5 text-stone-700">
                      <div className="flex justify-between">
                        <span className="text-stone-400">Warehouse Name:</span>
                        <span className="font-bold text-stone-900">{warehouse.warehouseName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">Warehouse Code:</span>
                        <span className="font-mono font-bold text-[#641D26]">{warehouse.warehouseCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">Operating Model:</span>
                        <span className="font-semibold text-stone-800">
                          {warehouse.warehouseType === 'OWN' ? 'Seller-Operated' : '3PL Partner'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">Dispatch PIN:</span>
                        <span className="font-mono font-bold text-stone-800">{warehouse.postalCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">Contact:</span>
                        <span className="text-stone-800 font-medium">{warehouse.contactPersonName || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (7 cols): Reusable Document Inspector */}
                <div className="lg:col-span-7 h-full p-2 sm:p-3 bg-[#F8F6F1] border-l border-[#E8E1D7] flex flex-col overflow-hidden">
                  <DocumentInspectorPane
                    document={activeInspectingDoc}
                    documentsList={inspectableDocuments}
                    onSelectDocument={(doc) => setInspectingDocId(Number(doc.id))}
                    onClose={() => setInspectingDocId(null)}
                  />
                </div>
              </div>
            ) : (
              /* ══════════════════════════════════════════════════════════════════
                 STANDARD PROFILE VIEW (Tabs: Overview, Documents, Staff, Timeline)
                 ══════════════════════════════════════════════════════════════════ */
              <>
                {/* Rework Alert Banner */}
                {isReworkNeeded && (
                  <div className="p-5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs space-y-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 font-bold text-orange-950">
                        <RotateCcw className="w-4 h-4 text-orange-600 shrink-0" />
                        <span>Rework Requested by Marketplace Compliance</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowResubmitModal(true)}
                        className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 self-start sm:self-auto cursor-pointer"
                      >
                        Resubmit Warehouse
                      </button>
                    </div>
                    <p className="text-orange-900 bg-white/90 p-3.5 rounded-xl border border-orange-200/80 leading-relaxed font-medium">
                      "{warehouse.latestStatusComment || warehouse.rejectionReason || 'Please review required compliance documents, upload missing proofs, and resubmit.'}"
                    </p>
                  </div>
                )}

                {/* TAB 1: OVERVIEW & LOCATION */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Status & Routing Pill Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Warehouse Status */}
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E1D7] shadow-sm">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                          Verification Status
                        </span>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {isWarehouseActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE & READY
                            </span>
                          ) : isReworkNeeded ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
                              <RotateCcw className="w-3 h-3 text-orange-600" /> REWORK NEEDED
                            </span>
                          ) : warehouse.facilityStatus === 'PENDING_APPROVAL' || warehouse.status === 'PENDING_APPROVAL' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" /> UNDER REVIEW
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <ShieldAlert className="w-3 h-3 text-rose-600" /> {warehouse.facilityStatus || warehouse.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Operating Model */}
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E1D7] shadow-sm">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                          Operating Model
                        </span>
                        <span className="text-xs font-bold text-stone-900 block mt-1.5 flex items-center gap-1.5">
                          {warehouse.warehouseType === 'OWN' ? (
                            <>
                              <Building2 className="w-4 h-4 text-[#7E2532]" />
                              <span>Seller-Operated (OWN)</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="w-4 h-4 text-purple-700" />
                              <span>3PL Partner Network</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Order Routing */}
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E1D7] shadow-sm">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                          Order Routing Priority
                        </span>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          {warehouse.isPrimary ? (
                            <span className="text-amber-900 font-extrabold text-xs inline-flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" /> Primary Dispatch
                            </span>
                          ) : (
                            <>
                              <span className="text-stone-500 font-medium text-xs">Secondary Hub</span>
                              {isWarehouseActive && (
                                <button
                                  type="button"
                                  onClick={handleSetPrimary}
                                  disabled={settingPrimary}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg transition-all flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  {settingPrimary ? 'Setting...' : 'Make Primary'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Structured Summary Grid (Matching ApplicationReviewModal) */}
                    <div className="p-6 rounded-3xl bg-white border border-[#E8E1D7] grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
                      {/* Entity Column */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                          Warehouse Identity
                        </span>
                        <p className="text-sm font-black text-stone-900">{warehouse.warehouseName}</p>
                        <p className="text-xs font-bold text-[#641D26] mt-0.5">
                          Code: {warehouse.warehouseCode}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#E8E1D7] text-[10px] font-mono font-bold text-stone-700">
                            {warehouse.warehouseType === 'OWN' ? 'SELF_MANAGED' : 'PARTNER_3PL'}
                          </span>
                          <span className="text-[11px] text-stone-500 font-semibold">
                            {warehouse.totalProductsCount || 0} Products Stored
                          </span>
                        </div>
                      </div>

                      {/* Contact Column */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-2">
                          Station Contact & Operations
                        </span>
                        <p className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{warehouse.contactPersonName || 'Not specified'}</span>
                        </p>
                        <p className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 mt-1.5">
                          <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">{warehouse.contactEmail || 'No email provided'}</span>
                        </p>
                        <p className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 mt-1.5 font-mono">
                          <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{warehouse.contactPhoneNumber || 'No phone provided'}</span>
                        </p>
                      </div>

                      {/* Location Column */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-2">
                          Physical Address
                        </span>
                        <div className="space-y-1 text-xs text-stone-700">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#7E2532] shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-stone-900">{warehouse.addressLine1}</p>
                              {warehouse.addressLine2 && <p className="text-stone-500">{warehouse.addressLine2}</p>}
                              <p className="text-stone-600 font-medium">
                                {warehouse.city}, {warehouse.state} — <span className="font-mono font-bold">{warehouse.postalCode}</span>
                              </p>
                              <p className="text-[11px] text-stone-400 font-medium">{warehouse.country}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: COMPLIANCE DOCUMENTS */}
                {activeTab === 'documents' && (
                  <div className="space-y-6">
                    {docUploadError && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{docUploadError}</span>
                      </div>
                    )}

                    <div className="bg-white rounded-3xl p-6 border border-[#E8E1D7] shadow-sm space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="text-sm font-black text-stone-900">KYC Compliance Documents Checklist</h3>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Legally mandatory proofs (GST, APOB/VPOB, Lease Agreement, NOC) required for warehouse operational authorization.
                          </p>
                        </div>
                        <span className="text-xs font-bold text-stone-800 bg-[#FAF8F5] px-3 py-1 rounded-xl border border-[#E8E1D7] shrink-0">
                          {verifiedDocsCount} of {totalRequiredCount} Verified
                        </span>
                      </div>

                      <div className="space-y-3">
                        {!warehouse.requiredDocuments || warehouse.requiredDocuments.length === 0 ? (
                          <div className="py-8 text-center text-xs text-stone-400">
                            No specific compliance documents configured for this warehouse type.
                          </div>
                        ) : (
                          warehouse.requiredDocuments.map((req) => {
                            const uploaded = (warehouse.documents || []).find((d) => d.code === req.code);
                            return (
                              <div
                                key={req.code}
                                className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFE9DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-[#D8CFBF]"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-stone-900 text-xs">{req.displayName}</span>
                                    <span className="font-mono text-[10px] text-stone-400 font-bold">({req.code})</span>
                                    {req.isRequired ? (
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                        Mandatory
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                                        Optional
                                      </span>
                                    )}
                                  </div>

                                  {uploaded ? (
                                    <div className="flex items-center gap-2 pt-0.5 text-xs flex-wrap">
                                      <span
                                        className={`inline-flex items-center gap-1 font-bold text-xs ${
                                          uploaded.verificationStatus === 'VERIFIED'
                                            ? 'text-emerald-700'
                                            : uploaded.verificationStatus === 'REJECTED'
                                            ? 'text-rose-700'
                                            : 'text-amber-700'
                                        }`}
                                      >
                                        {uploaded.verificationStatus === 'VERIFIED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        {uploaded.verificationStatus === 'REJECTED' && <ShieldAlert className="w-3.5 h-3.5" />}
                                        {uploaded.verificationStatus === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                                        Status: {uploaded.verificationStatus}
                                      </span>

                                      {uploaded.rejectionReason && (
                                        <span className="text-rose-600 font-medium text-[11px] block sm:inline">
                                          (Remark: {uploaded.rejectionReason})
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-stone-400 font-medium block">
                                      No document uploaded yet
                                    </span>
                                  )}
                                </div>

                                <div className="shrink-0 flex items-center gap-2 flex-wrap">
                                  {uploaded && uploaded.documentUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setInspectingDocId(uploaded.sellerWarehouseDocumentId)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-[#641D26] text-xs font-bold shadow-sm transition-all cursor-pointer"
                                      title="Inspect document scan in split view"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-[#7E2532]" />
                                      <span>Inspect</span>
                                    </button>
                                  )}

                                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E8E1D7] hover:bg-stone-50 text-stone-800 text-xs font-bold shadow-sm transition-all">
                                    {uploadingDocCode === req.code ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7E2532]" />
                                    ) : (
                                      <Upload className="w-3.5 h-3.5 text-[#7E2532]" />
                                    )}
                                    <span>{uploaded ? 'Re-upload' : 'Upload Proof'}</span>
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                                      className="hidden"
                                      disabled={uploadingDocCode === req.code}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleUploadDoc(req.code, file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Consents & Declarations */}
                    {warehouse.consents && warehouse.consents.length > 0 && (
                      <div className="bg-white rounded-3xl p-6 border border-[#E8E1D7] shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#641D26] uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4 text-[#7E2532]" />
                            <span>Digital Regulatory Declarations & Consents</span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            {warehouse.consents.length} Confirmed
                          </span>
                        </div>

                        <div className="space-y-2">
                          {warehouse.consents.map((consent) => (
                            <div
                              key={consent.consentId}
                              className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE9DF] text-xs flex items-center justify-between gap-3"
                            >
                              <div>
                                <span className="font-bold text-stone-900">{consent.type.replace(/_/g, ' ')}</span>
                                <span className="text-[11px] text-stone-500 font-medium block mt-0.5">
                                  Source: {consent.source || 'Electronic Signature'} • Version: {consent.version}
                                </span>
                              </div>
                              <div>
                                {consent.isGranted ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    Revoked
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: STAFF & OPERATORS (For OWN Warehouses) */}
                {activeTab === 'staff' && warehouse.warehouseType === 'OWN' && (
                  <div className="space-y-6">
                    {staffError && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{staffError}</span>
                      </div>
                    )}

                    {staffSuccess && (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2.5 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{staffSuccess.message}</span>
                        </div>
                        {staffSuccess.tempPassword && (
                          <div className="p-3.5 rounded-xl bg-white border border-emerald-300 flex items-center justify-between gap-3 text-xs shadow-sm">
                            <div>
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                Temporary Login Password
                              </span>
                              <span className="font-mono font-black text-stone-900 text-base">
                                {staffSuccess.tempPassword}
                              </span>
                              <span className="text-[11px] text-stone-500 block mt-0.5">
                                Login Email: <strong className="text-stone-800">{staffSuccess.email}</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `Warehouse Portal Login:\nEmail: ${staffSuccess.email}\nPassword: ${staffSuccess.tempPassword}`
                                );
                                showToast('Operator credentials copied to clipboard!');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-white rounded-3xl p-6 border border-[#E8E1D7] shadow-sm space-y-4">
                      <div>
                        <h3 className="text-sm font-black text-stone-900">Warehouse Staff & Invitations</h3>
                        <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                          Invite staff to access the <strong>Warehouse Portal</strong> to manage physical receiving, inventory, picking, packing, and dispatch operations.
                        </p>
                      </div>

                      {/* Invite Staff Form */}
                      <form onSubmit={handleSendInvite} className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                              <Mail className="w-4 h-4" />
                            </div>
                            <input
                              type="email"
                              required
                              placeholder="Staff member's email (e.g. staff@company.com)"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E8E1D7] text-xs font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/20 focus:border-[#7E2532]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={sendingInvite || !inviteEmail.trim()}
                            className="px-5 py-2.5 bg-[#641D26] hover:bg-[#7E2532] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                          >
                            {sendingInvite ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            <span>{sendingInvite ? 'Sending Invite...' : 'Send Invitation'}</span>
                          </button>
                        </div>
                        <div className="text-[11px] text-stone-500 px-1 flex items-center justify-between">
                          <span>An invitation email with a secure setup link will be sent to the recipient.</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !showStaffMoreFields;
                              setShowStaffMoreFields(nextState);
                              if (nextState && !newStaffEmail && inviteEmail) {
                                setNewStaffEmail(inviteEmail.trim());
                              }
                            }}
                            className="font-bold text-[#641D26] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            {showStaffMoreFields ? 'Hide Direct Account Option' : 'Direct Account Option'}
                          </button>
                        </div>

                        {showStaffMoreFields && (
                          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E1D7] space-y-3 text-xs animate-in fade-in duration-200">
                            <div>
                              <div className="font-bold text-stone-800">Direct Account Provisioning</div>
                              <p className="text-[11px] text-stone-500 mt-0.5">
                                Immediately create an operator login with a temporary password without waiting for an email invitation.
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                                  Operator Email Address <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                                    <Mail className="w-3.5 h-3.5" />
                                  </div>
                                  <input
                                    type="email"
                                    required
                                    placeholder="operator@company.com"
                                    value={newStaffEmail}
                                    onChange={(e) => setNewStaffEmail(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E8E1D7] text-xs font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#7E2532]"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                                  First Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="First name"
                                  value={newStaffFirstName}
                                  onChange={(e) => setNewStaffFirstName(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E8E1D7] text-xs font-medium focus:outline-none focus:border-[#7E2532]"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                                  Last Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Last name"
                                  value={newStaffLastName}
                                  onChange={(e) => setNewStaffLastName(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E8E1D7] text-xs font-medium focus:outline-none focus:border-[#7E2532]"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                                  Phone Number (Optional)
                                </label>
                                <input
                                  type="tel"
                                  placeholder="+91 9876543210"
                                  value={newStaffPhone}
                                  onChange={(e) => setNewStaffPhone(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E8E1D7] text-xs font-medium focus:outline-none focus:border-[#7E2532]"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                                  Temporary Initial Password
                                </label>
                                <input
                                  type="text"
                                  placeholder="Default: Warehouse@123"
                                  value={newStaffTempPassword}
                                  onChange={(e) => setNewStaffTempPassword(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E8E1D7] text-xs font-mono font-medium focus:outline-none focus:border-[#7E2532]"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddStaff}
                              disabled={addingStaff || !newStaffEmail.trim() || !newStaffFirstName.trim()}
                              className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                            >
                              {addingStaff ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                              <span>{addingStaff ? 'Creating Account...' : 'Create Account Directly'}</span>
                            </button>
                          </div>
                        )}
                      </form>

                      {/* Success Invitation Banner with Copy Link */}
                      {inviteSuccess && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2 animate-in fade-in duration-200">
                          <div className="flex items-center gap-2 font-bold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{inviteSuccess.message}</span>
                          </div>
                          {inviteSuccess.inviteUrl && (
                            <div className="pt-2 border-t border-emerald-200/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                value={inviteSuccess.inviteUrl}
                                className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-[11px] font-mono text-emerald-950 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (inviteSuccess.inviteUrl) {
                                    navigator.clipboard.writeText(inviteSuccess.inviteUrl);
                                    setCopiedInviteUrl(true);
                                    setTimeout(() => setCopiedInviteUrl(false), 2000);
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer shrink-0"
                              >
                                {copiedInviteUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedInviteUrl ? 'Copied Link!' : 'Copy Invite Link'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Active Staff List */}
                      <div className="pt-2 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                            <span>Active Warehouse Operators</span>
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px]">
                              {warehouse.staffMembers?.length || 0}
                            </span>
                          </h4>
                        </div>
                        <div className="divide-y divide-[#EFE9DF] border border-[#EFE9DF] rounded-2xl overflow-hidden bg-white">
                          {!warehouse.staffMembers || warehouse.staffMembers.length === 0 ? (
                            <div className="py-8 text-center text-xs text-stone-400">
                              No operators active yet. Send an invitation above to assign staff.
                            </div>
                          ) : (
                            warehouse.staffMembers.map((staff) => (
                              <div
                                key={staff.userId}
                                className="p-3.5 flex items-center justify-between hover:bg-stone-50/80 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-2xl bg-rose-100 text-[#641D26] flex items-center justify-center font-bold text-xs shrink-0">
                                    {(staff.firstName || staff.email)[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-stone-900">
                                        {staff.firstName} {staff.lastName}
                                      </span>
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        ACTIVE OPERATOR
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-stone-500 font-mono block">{staff.email}</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaff(staff.userId)}
                                  disabled={removingStaffId === staff.userId}
                                  className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                                  title="Revoke operator access"
                                >
                                  {removingStaffId === staff.userId ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Pending & Sent Invitations List */}
                      <div className="pt-2 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                            <span>Pending & Past Invitations</span>
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px]">
                              {invitations.length}
                            </span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => fetchInvitations()}
                            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Refresh invitations"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${loadingInvites ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                        <div className="divide-y divide-[#EFE9DF] border border-[#EFE9DF] rounded-2xl overflow-hidden bg-white">
                          {invitations.length === 0 ? (
                            <div className="py-6 text-center text-xs text-stone-400">
                              No invitations sent yet.
                            </div>
                          ) : (
                            invitations.map((inv) => (
                              <div
                                key={inv.invitationId}
                                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/80 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                                    <Mail className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-stone-900 font-mono">
                                        {inv.email}
                                      </span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border ${
                                          inv.status === 'ACCEPTED'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : inv.status === 'REVOKED'
                                            ? 'bg-slate-50 text-slate-600 border-slate-200'
                                            : inv.isExpired
                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}
                                      >
                                        {inv.isExpired && inv.status === 'PENDING' ? 'EXPIRED' : inv.status}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-2">
                                      <span>Sent: {new Date(inv.createdAt).toLocaleDateString()}</span>
                                      <span>•</span>
                                      <span>
                                        {inv.status === 'ACCEPTED'
                                          ? `Accepted: ${inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleDateString() : 'Yes'}`
                                          : inv.isExpired
                                          ? 'Link Expired'
                                          : `Expires: ${new Date(inv.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${new Date(inv.expiresAt).toLocaleDateString()})`}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {inv.status === 'PENDING' && (
                                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleResendInvite(inv.invitationId)}
                                      disabled={resendingInviteId === inv.invitationId}
                                      className="px-2.5 py-1.5 rounded-xl border border-stone-200 hover:border-stone-300 bg-white text-stone-700 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      title="Resend invitation email"
                                    >
                                      {resendingInviteId === inv.invitationId ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <RotateCcw className="w-3 h-3" />
                                      )}
                                      <span>Resend</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeInvite(inv.invitationId)}
                                      disabled={revokingInviteId === inv.invitationId}
                                      className="p-1.5 rounded-xl border border-stone-200 hover:border-rose-200 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                                      title="Cancel invitation"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* TAB 4: AUDIT TIMELINE */}
                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-[#E8E1D7] shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-stone-900">Verification Timeline & Audit Trail</h3>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Chronological history of warehouse state changes, compliance notes, and reviewer decisions.
                          </p>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-600">
                          {warehouse.statusHistory?.length || 0} Events
                        </span>
                      </div>

                      {!warehouse.statusHistory || warehouse.statusHistory.length === 0 ? (
                        <div className="py-8 text-center text-xs text-stone-400">
                          No state transition events recorded.
                        </div>
                      ) : (
                        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                          {warehouse.statusHistory.map((h, i) => (
                            <div key={h.historyId || i} className="relative">
                              <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center border-[#7E2532]">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#7E2532]" />
                              </div>
                              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFE9DF] text-xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-stone-900 uppercase tracking-wider text-[11px]">
                                    {h.status.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] text-stone-400 font-mono">
                                    {new Date(h.changedAt).toLocaleString()}
                                  </span>
                                </div>
                                {h.comments && (
                                  <p className="text-xs text-stone-800 bg-white p-3 rounded-xl border border-stone-200 leading-relaxed font-medium">
                                    "{h.comments}"
                                  </p>
                                )}
                                <div className="text-[10px] text-stone-500">
                                  Logged by <strong>{h.changedBy?.name || 'Platform Administrator'}</strong> ({h.changedBy?.email || 'System'})
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )
          ) : null}
        </div>

        {/* ── Modal Footer Action Bar ── */}
        {!activeInspectingDoc && (
          <div className="px-6 sm:px-8 py-4 bg-[#F3EFEA] border-t border-[#E8E1D7] flex items-center justify-between gap-3 shrink-0">
            <div>
              {warehouse && warehouse.warehouseType !== 'OWN' && warehouse.status !== 'TERMINATED' && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {disconnecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Disconnect 3PL Warehouse
                </button>
              )}

              {isReworkNeeded && (
                <button
                  type="button"
                  onClick={() => setShowResubmitModal(true)}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Resubmit Warehouse Application
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {isWarehouseActive && warehouse && !warehouse.isPrimary && (
                <button
                  type="button"
                  onClick={handleSetPrimary}
                  disabled={settingPrimary}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  {settingPrimary ? 'Setting...' : 'Set as Primary'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-white border border-[#E8E1D7] text-stone-700 hover:bg-stone-50 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Resubmit Remarks Modal ── */}
        {showResubmitModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md bg-white rounded-3xl border border-[#E8E1D7] shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-orange-950 uppercase tracking-wider">
                  <RotateCcw className="w-4 h-4 text-orange-600" />
                  <span>Resubmit Warehouse for Review</span>
                </div>
                <button
                  onClick={() => setShowResubmitModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
                  Resubmission Remarks / Corrections Note
                </label>
                <textarea
                  rows={3}
                  value={resubmitRemarks}
                  onChange={(e) => setResubmitRemarks(e.target.value)}
                  placeholder="e.g. Uploaded revised GSTIN proof with updated warehouse address..."
                  className="w-full p-3.5 rounded-2xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowResubmitModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resubmitting}
                  onClick={handleResubmit}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {resubmitting ? 'Submitting...' : 'Confirm & Resubmit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
