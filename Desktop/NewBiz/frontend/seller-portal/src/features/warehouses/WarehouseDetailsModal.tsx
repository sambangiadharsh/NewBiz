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
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Send,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal.js';

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

interface WarehouseConsentItem {
  warehouseConsentId: number;
  consentType: string;
  consentVersion: string;
  isGranted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  source?: string;
  createdAt: string;
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
  createdAt: string;
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
  const [disconnecting, setDisconnecting] = useState(false);

  // Resubmit state
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [resubmitRemarks, setResubmitRemarks] = useState('');
  const [resubmitting, setResubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingDocCode, setUploadingDocCode] = useState<string | null>(null);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const [docUploadSuccess, setDocUploadSuccess] = useState<string | null>(null);
  const [previewModalDoc, setPreviewModalDoc] = useState<{ url: string; title: string; code?: string } | null>(null);

  // Staff management state (for OWN facilities)
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
  }, [fetchDetails]);

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) return;
    setResubmitting(true);
    try {
      const res = await apiClient.post(`/seller/warehouses/${warehouseId}/resubmit`, {
        remarks: resubmitRemarks.trim(),
      });
      if (res.data.success) {
        setShowResubmitModal(false);
        setResubmitRemarks('');
        fetchDetails();
        if (onUpdated) onUpdated();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to resubmit warehouse application');
    } finally {
      setResubmitting(false);
    }
  };

  if (!warehouseId) return null;

  const handleDisconnect = async () => {
    if (!warehouse) return;
    const confirmed = window.confirm(
      `Are you sure you want to disconnect your seller account from 3PL warehouse "${warehouse.warehouseName}"? Active inventory and fulfillment routing will be paused.`
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setError(null);
    try {
      // Route is POST /:id/disconnect (not DELETE)
      const res = await apiClient.post(`/seller/warehouses/${warehouse.warehouseId}/disconnect`);
      if (res.data.success) {
        onUpdated?.();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to disconnect from 3PL warehouse');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUploadDoc = async (docCode: string, file: File) => {
    if (!warehouse) return;
    setUploadingDocCode(docCode);
    setDocUploadError(null);
    setDocUploadSuccess(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentTypeCode', docCode);
      const res = await apiClient.post(
        `/seller/warehouses/${warehouse.sellerWarehouseId}/documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data.success) {
        setDocUploadSuccess(`Document ${docCode} uploaded successfully`);
        // Refresh details
        const refreshed = await apiClient.get(`/seller/warehouses/${warehouseId}`);
        if (refreshed.data.success) {
          setWarehouse(refreshed.data.data);
        }
        onUpdated?.();
      }
    } catch (err: any) {
      setDocUploadError(err.response?.data?.error?.message || 'Failed to upload document');
    } finally {
      setUploadingDocCode(null);
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

      const res = await apiClient.post(`/seller/warehouses/${warehouse.warehouseId}/staff`, payload);
      if (res.data.success) {
        const assigned = res.data.data?.assignedUser;
        if (assigned?.isNewUser) {
          setStaffSuccess({
            message: 'New operator account created and assigned to this warehouse!',
            tempPassword: assigned.temporaryPassword || 'Warehouse@123',
            email: assigned.email,
          });
        } else {
          setStaffSuccess({
            message: 'Existing user verified and assigned as warehouse operator successfully!',
          });
        }
        setNewStaffEmail('');
        setNewStaffFirstName('');
        setNewStaffLastName('');
        setNewStaffPhone('');
        setNewStaffTempPassword('');
        setShowStaffMoreFields(false);

        // Refresh details
        const refreshed = await apiClient.get(`/seller/warehouses/${warehouse.warehouseId}`);
        if (refreshed.data.success) {
          setWarehouse(refreshed.data.data);
        }
        onUpdated?.();
      }
    } catch (err: any) {
      setStaffError(err.response?.data?.error?.message || 'Failed to assign warehouse staff member');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (targetUserId: number) => {
    if (!warehouse) return;
    const confirmed = window.confirm('Are you sure you want to revoke this user access to this warehouse?');
    if (!confirmed) return;
    setRemovingStaffId(targetUserId);
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const res = await apiClient.delete(`/seller/warehouses/${warehouse.warehouseId}/staff/${targetUserId}`);
      if (res.data.success) {
        setStaffSuccess({ message: 'Staff member removed successfully' });
        // Refresh details
        const refreshed = await apiClient.get(`/seller/warehouses/${warehouse.warehouseId}`);
        if (refreshed.data.success) {
          setWarehouse(refreshed.data.data);
        }
        onUpdated?.();
      }
    } catch (err: any) {
      setStaffError(err.response?.data?.error?.message || 'Failed to remove staff');
    } finally {
      setRemovingStaffId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#FCFAF7] rounded-3xl border border-[#E8E1D7] shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-[#641D26] px-6 sm:px-8 py-6 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-200/80 text-xs font-bold uppercase tracking-wider mb-1">
              <Warehouse className="w-4 h-4" />
              Fulfillment Location Details
            </div>
            <h2 className="text-xl font-black tracking-tight text-white truncate">
              {warehouse?.warehouseName || 'Warehouse Details'}
            </h2>
            {warehouse && (
              <span className="font-mono text-xs text-rose-200/90 font-bold block mt-0.5">
                {warehouse.warehouseCode}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-stone-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#7E2532]" />
              <span className="text-xs font-semibold">Loading warehouse details...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : warehouse ? (
            <>
              {/* Rejection Notice if rejected */}
              {/* facilityStatus = Warehouses.Status: PENDING_APPROVAL|ACTIVE|REJECTED|REWORK_REQUIRED */}
              {(warehouse.facilityStatus === 'REWORK_REQUIRED' || warehouse.status === 'REWORK_REQUIRED') && (
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-orange-800">
                      <RotateCcw className="w-4 h-4 text-orange-600" />
                      Rework Requested by Administrator
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowResubmitModal(true)}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Resubmit Application
                    </button>
                  </div>
                  <p className="text-orange-800 bg-white/70 p-2.5 rounded-xl border border-orange-200">
                    "{warehouse.latestStatusComment || 'Please review required compliance documents and resubmit updated proof.'}"
                  </p>
                </div>
              )}

              {warehouse.facilityStatus === 'REJECTED' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-800">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Application Rejected by Administrator
                  </div>
                  <p className="text-rose-700">
                    {warehouse.rejectionReason || warehouse.latestStatusComment || 'Warehouse application does not meet marketplace compliance standards.'}
                  </p>
                </div>
              )}

              {/* Status summary pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E1D7] shadow-sm">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Warehouse Status
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {warehouse.facilityStatus === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> ACTIVE
                      </span>
                    ) : warehouse.facilityStatus === 'REWORK_REQUIRED' || warehouse.status === 'REWORK_REQUIRED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                        <RotateCcw className="w-3 h-3 text-orange-600" /> REWORK REQUIRED
                      </span>
                    ) : warehouse.facilityStatus === 'PENDING_APPROVAL' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3 h-3" /> PENDING APPROVAL
                      </span>
                    ) : warehouse.facilityStatus === 'REJECTED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <ShieldAlert className="w-3 h-3" /> REJECTED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-300">
                        {warehouse.facilityStatus || warehouse.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E1D7] shadow-sm">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Operating Model
                  </span>
                  <span className="text-xs font-bold text-stone-800 block mt-1">
                    {warehouse.warehouseType === 'OWN' ? 'OWN (Seller-Owned)' : '3PL Partner'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E1D7] shadow-sm col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Order Routing
                  </span>
                  <span className="text-xs font-bold block mt-1">
                    {warehouse.isPrimary ? (
                      <span className="text-emerald-700 font-extrabold">Primary Location</span>
                    ) : (
                      <span className="text-stone-500 font-medium">Secondary Location</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Physical Location */}
              <div className="bg-white rounded-2xl p-4 border border-[#E8E1D7] shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#641D26] uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-[#7E2532]" />
                  Physical Address
                </div>
                <div className="text-xs text-stone-700 space-y-0.5 pl-6">
                  <p className="font-semibold">{warehouse.addressLine1}</p>
                  {warehouse.addressLine2 && <p>{warehouse.addressLine2}</p>}
                  <p>
                    {warehouse.city}, {warehouse.state} - {warehouse.postalCode}
                  </p>
                  <p className="text-stone-500 font-medium">{warehouse.country}</p>
                  {(warehouse.latitude != null || warehouse.longitude != null) && (
                    <div className="pt-2 mt-2 border-t border-stone-100 flex items-center gap-4 text-[11px] text-stone-600 font-mono">
                      <span>GPS Lat: <strong className="text-stone-800">{warehouse.latitude}</strong></span>
                      <span>Lng: <strong className="text-stone-800">{warehouse.longitude}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white rounded-2xl p-4 border border-[#E8E1D7] shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#641D26] uppercase tracking-wider">
                  <User className="w-4 h-4 text-[#7E2532]" />
                  Station Contact
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Contact Person
                    </span>
                    <span className="text-stone-800 font-semibold block mt-0.5">
                      {warehouse.contactPersonName || 'Not specified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Phone Number
                    </span>
                    <span className="text-stone-800 font-mono font-medium block mt-0.5">
                      {warehouse.contactPhoneNumber || 'Not specified'}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Operational Email
                    </span>
                    <span className="text-stone-800 font-medium block mt-0.5">
                      {warehouse.contactEmail || 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Facility Compliance & Verification Documents */}
              {warehouse.requiredDocuments && warehouse.requiredDocuments.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-[#E8E1D7] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#641D26] uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-[#7E2532]" />
                      Warehouse Compliance Documents
                    </div>
                    <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                      {warehouse.requiredDocuments.filter((r) => r.isRequired).length} Mandatory
                    </span>
                  </div>

                  {docUploadError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{docUploadError}</span>
                    </div>
                  )}

                  {docUploadSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{docUploadSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {warehouse.requiredDocuments.map((req) => {
                      const uploaded = (warehouse.documents || []).find((d) => d.code === req.code);
                      return (
                        <div
                          key={req.code}
                          className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EFE9DF] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-800">{req.displayName}</span>
                              <span className="font-mono text-[10px] text-stone-500 font-semibold">({req.code})</span>
                              {req.isRequired ? (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Required
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                                  Optional
                                </span>
                              )}
                            </div>
                            {uploaded ? (
                              <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                                <span
                                  className={`inline-flex items-center gap-1 font-bold ${
                                    uploaded.verificationStatus === 'VERIFIED'
                                      ? 'text-emerald-700'
                                      : uploaded.verificationStatus === 'REJECTED'
                                      ? 'text-rose-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {uploaded.verificationStatus === 'VERIFIED' && <CheckCircle2 className="w-3 h-3" />}
                                  {uploaded.verificationStatus === 'REJECTED' && <ShieldAlert className="w-3 h-3" />}
                                  {uploaded.verificationStatus === 'PENDING' && <Clock className="w-3 h-3" />}
                                  Status: {uploaded.verificationStatus}
                                </span>
                                {uploaded.documentUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModalDoc({ url: uploaded.documentUrl!, title: req.displayName, code: req.code })}
                                    className="text-[#7E2532] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>View</span>
                                  </button>
                                )}
                                {uploaded.rejectionReason && (
                                  <span className="text-rose-600 font-medium">({uploaded.rejectionReason})</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-stone-400 font-medium">No document uploaded yet</span>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E8E1D7] hover:bg-stone-50 text-stone-700 text-[11px] font-bold shadow-2xs transition-all">
                              {uploadingDocCode === req.code ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-[#7E2532]" />
                              ) : (
                                <Upload className="w-3 h-3 text-[#7E2532]" />
                              )}
                              <span>{uploaded ? 'Re-upload' : 'Upload'}</span>
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
                    })}
                  </div>
                </div>
              )}

              {/* Compliance & Regulatory Consents */}
              {warehouse.consents && warehouse.consents.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-[#E8E1D7] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#641D26] uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4 text-[#7E2532]" />
                      Compliance & Declarations
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {warehouse.consents.length} Recorded
                    </span>
                  </div>
                  <div className="space-y-2">
                    {warehouse.consents.map((consent) => (
                      <div
                        key={consent.warehouseConsentId}
                        className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EFE9DF] text-xs flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-800">
                              {consent.consentType.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-[10px] text-stone-500 font-semibold">
                              ({consent.consentVersion})
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500 font-medium block mt-0.5">
                            Source: {consent.source || 'Digital Acceptance'}
                          </span>
                        </div>
                        <div>
                          {consent.isGranted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> Granted
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

              {/* Warehouse Staff / Operators (Only for Seller-Operated OWN Warehouse) */}
              {warehouse.warehouseType === 'OWN' && (
                <div className="bg-white rounded-2xl p-4 border border-[#E8E1D7] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#641D26] uppercase tracking-wider">
                      <Users className="w-4 h-4 text-[#7E2532]" />
                      Warehouse Operators & Staff
                    </div>
                    <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                      {(warehouse.staffMembers || []).length} Assigned
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Authorize personnel to operate this warehouse. Assigned operators can log in to the{' '}
                    <strong className="text-stone-700 font-semibold">Warehouse Portal</strong> using their credentials to manage inventory receiving, bin stocking, and order picking/dispatch.
                  </p>

                  {/* Add Staff Form */}
                  <form onSubmit={handleAddStaff} className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        required
                        placeholder="Operator email (e.g. staff@company.com)"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[#E8E1D7] text-xs font-medium text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/30 focus:border-[#7E2532]"
                      />
                      <button
                        type="submit"
                        disabled={addingStaff || !newStaffEmail.trim()}
                        className="px-4 py-2 bg-[#641D26] hover:bg-[#7E2532] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
                      >
                        {addingStaff ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span>{addingStaff ? 'Assigning...' : 'Assign Staff'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 px-1">
                      <span>If not registered, an account will be created automatically.</span>
                      <button
                        type="button"
                        onClick={() => setShowStaffMoreFields(!showStaffMoreFields)}
                        className="font-bold text-[#641D26] hover:underline flex items-center gap-1"
                      >
                        {showStaffMoreFields ? (
                          <>
                            Less options <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            More options (Name, Temp Password) <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>

                    {showStaffMoreFields && (
                      <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E1D7] grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs animate-in fade-in duration-200">
                        <div>
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                            First Name
                          </label>
                          <input
                            type="text"
                            placeholder="Operator first name"
                            value={newStaffFirstName}
                            onChange={(e) => setNewStaffFirstName(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E8E1D7] text-xs font-medium focus:outline-none focus:border-[#7E2532]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                            Last Name
                          </label>
                          <input
                            type="text"
                            placeholder="Operator last name"
                            value={newStaffLastName}
                            onChange={(e) => setNewStaffLastName(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E8E1D7] text-xs font-medium focus:outline-none focus:border-[#7E2532]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            placeholder="+91 9876543210"
                            value={newStaffPhone}
                            onChange={(e) => setNewStaffPhone(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E8E1D7] text-xs font-medium focus:outline-none focus:border-[#7E2532]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                            Custom Temp Password
                          </label>
                          <input
                            type="text"
                            placeholder="Default: Warehouse@123"
                            value={newStaffTempPassword}
                            onChange={(e) => setNewStaffTempPassword(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E8E1D7] text-xs font-mono font-medium focus:outline-none focus:border-[#7E2532]"
                          />
                        </div>
                      </div>
                    )}
                  </form>

                  {staffError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{staffError}</span>
                    </div>
                  )}

                  {staffSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{staffSuccess.message}</span>
                      </div>
                      {staffSuccess.tempPassword && (
                        <div className="p-2.5 rounded-lg bg-white border border-emerald-300 flex items-center justify-between gap-3 text-xs shadow-2xs">
                          <div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                              Temporary Login Password
                            </span>
                            <span className="font-mono font-black text-stone-900 text-sm">
                              {staffSuccess.tempPassword}
                            </span>
                            <span className="text-[10px] text-stone-500 block mt-0.5">
                              Login Email: <strong className="text-stone-700">{staffSuccess.email}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `Warehouse Portal Login:\nEmail: ${staffSuccess.email}\nPassword: ${staffSuccess.tempPassword}`
                              );
                              alert('Credentials copied to clipboard!');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Staff List */}
                  <div className="divide-y divide-[#EFE9DF] border border-[#EFE9DF] rounded-xl overflow-hidden bg-[#FAF8F5]">
                    {!warehouse.staffMembers || warehouse.staffMembers.length === 0 ? (
                      <div className="py-6 text-center text-xs text-stone-400">
                        No operators assigned yet. Enter a registered user email above to grant portal access.
                      </div>
                    ) : (
                      warehouse.staffMembers.map((staff) => (
                        <div
                          key={staff.userId}
                          className="p-3 flex items-center justify-between bg-white hover:bg-stone-50/80 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-rose-100 text-[#641D26] flex items-center justify-center font-bold text-xs shrink-0">
                              {(staff.firstName || staff.email)[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-stone-900">
                                  {staff.firstName} {staff.lastName}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ACTIVE
                                </span>
                              </div>
                              <span className="text-[11px] text-stone-500 font-mono block">{staff.email}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStaff(staff.userId)}
                            disabled={removingStaffId === staff.userId}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                            title="Revoke access"
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
              )}

              {/* Status History & Audit Trail Timeline */}
              {warehouse.statusHistory && warehouse.statusHistory.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[#E8E1D7]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-purple-600" />
                      Status History & Verification Timeline
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                      {warehouse.statusHistory.length} Updates
                    </span>
                  </div>

                  <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                    {warehouse.statusHistory.map((h, i) => (
                      <div key={h.historyId || i} className="relative">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center border-purple-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        </div>
                        <div className="p-3 rounded-2xl bg-white border border-[#E8E1D7] text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-stone-800 uppercase tracking-wider text-[10px]">
                              {h.status.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {new Date(h.changedAt).toLocaleString()}
                            </span>
                          </div>
                          {h.comments && (
                            <p className="text-xs text-stone-700 bg-stone-50 p-2 rounded-xl border border-stone-200/60 mt-1">
                              {h.comments}
                            </p>
                          )}
                          <div className="text-[10px] text-stone-400 mt-1">
                            Updated by {h.changedBy.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submission Timestamp */}
              <div className="text-[11px] text-stone-400 text-right">
                Submitted on {new Date(warehouse.createdAt).toLocaleDateString()} at{' '}
                {new Date(warehouse.createdAt).toLocaleTimeString()}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F3EFEA] border-t border-[#E8E1D7] flex items-center justify-between">
          <div>
            {/* status = SellerWarehouses.Status (relationship): PENDING|ACTIVE|TERMINATED */}
            {warehouse && warehouse.warehouseType !== 'OWN' && warehouse.status !== 'TERMINATED' && (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 rounded-2xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {disconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Disconnect 3PL Hub
              </button>
            )}

            {/* Resubmit button if rework is required */}
            {warehouse && (warehouse.facilityStatus === 'REWORK_REQUIRED' || warehouse.status === 'REWORK_REQUIRED') && (
              <button
                onClick={() => setShowResubmitModal(true)}
                className="px-4 py-2 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resubmit Application
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>

        {/* ── Sub-Modal: Resubmit Modal ── */}
        {showResubmitModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-[#FCFAF7] rounded-3xl p-6 border border-[#E8E1D7] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#221C1E]">Resubmit Warehouse Application</h3>
                    <p className="text-[11px] text-stone-500">Notify marketplace administrators of your corrections.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowResubmitModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
                  Resubmission Notes / Remarks
                </label>
                <textarea
                  rows={3}
                  value={resubmitRemarks}
                  onChange={(e) => setResubmitRemarks(e.target.value)}
                  placeholder="e.g. Uploaded revised APOB certificate with clear state seal..."
                  className="w-full p-3 rounded-xl border border-stone-300 text-xs text-[#221C1E] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowResubmitModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-200/50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resubmitting}
                  onClick={handleResubmit}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {resubmitting ? 'Submitting...' : 'Confirm & Resubmit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* In-page Warehouse Document Preview Overlay */}
      <DocumentPreviewModal
        isOpen={!!previewModalDoc}
        onClose={() => setPreviewModalDoc(null)}
        documentUrl={previewModalDoc?.url || null}
        title={previewModalDoc?.title || 'Warehouse Document'}
        code={previewModalDoc?.code}
      />
    </div>
  );
};
