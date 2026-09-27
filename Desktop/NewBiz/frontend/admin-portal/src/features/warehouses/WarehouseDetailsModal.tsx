import React, { useState, useEffect } from 'react';
import {
  X,
  Warehouse,
  MapPin,
  Mail,
  Phone,
  User,
  Users,
  UserPlus,
  Trash2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Store,
  Star,
  Link2,
  Plus,
  Check,
  FileText,
  ExternalLink,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

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

interface WarehouseDocument {
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
  createdAt: string;
  documents?: WarehouseDocument[];
}

interface WarehouseConsent {
  warehouseConsentId: number;
  consentType: string;
  consentVersion: string;
  isGranted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  source?: string;
  createdAt: string;
}

interface WarehouseRequirement {
  documentTypeId: number;
  code: string;
  displayName: string;
  warehouseType: string;
  isRequired: boolean;
}

interface WarehouseDetails {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: 'OWN' | 'THIRD_PARTY';
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
  rejectionReason?: string;
  staffMembers: StaffMember[];
  associatedSellers?: AssociatedSeller[];
  consents?: WarehouseConsent[];
  requiredDocuments?: WarehouseRequirement[];
  connectedSellersCount: number;
  totalProductsCount: number;
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
  onUpdated: () => void;
}

export const WarehouseDetailsModal: React.FC<WarehouseDetailsModalProps> = ({
  warehouseId,
  onClose,
  onUpdated,
}) => {
  const [warehouse, setWarehouse] = useState<WarehouseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval / Rejection states
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReworkForm, setShowReworkForm] = useState(false);
  const [reworkComments, setReworkComments] = useState('');

  // Add staff state
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [showStaffMoreFields, setShowStaffMoreFields] = useState(false);
  const [newStaffFirstName, setNewStaffFirstName] = useState('');
  const [newStaffLastName, setNewStaffLastName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<{
    message: string;
    tempPassword?: string;
    email?: string;
  } | null>(null);

  // 3PL Multi-Seller Linkage state
  const [linkSellerOpen, setLinkSellerOpen] = useState(false);
  const [activeSellersList, setActiveSellersList] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [isPrimaryLink, setIsPrimaryLink] = useState(false);
  const [linkingSeller, setLinkingSeller] = useState(false);
  const [sellerActionError, setSellerActionError] = useState<string | null>(null);
  const [sellerActionLoading, setSellerActionLoading] = useState<number | null>(null);

  const fetchDetails = async () => {
    if (!warehouseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/warehouses/${warehouseId}`);
      if (res.data.success) {
        setWarehouse(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load warehouse details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [warehouseId]);

  if (!warehouseId) return null;

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail.trim()) return;
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
      if (newStaffPassword.trim()) payload.temporaryPassword = newStaffPassword.trim();

      const res = await apiClient.post(`/warehouses/${warehouseId}/users`, payload);
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
        setNewStaffPassword('');
        setShowStaffMoreFields(false);
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      setStaffError(err.response?.data?.error?.message || 'Failed to assign user');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (targetUserId: number) => {
    if (!confirm('Are you sure you want to revoke this user access to this warehouse?')) return;
    try {
      const res = await apiClient.delete(`/warehouses/${warehouseId}/users/${targetUserId}`);
      if (res.data.success) {
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to remove staff');
    }
  };

  const handleToggleStatus = async () => {
    if (!warehouse) return;
    const newStatus = warehouse.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await apiClient.put(`/warehouses/${warehouseId}`, { status: newStatus });
      if (res.data.success) {
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update status');
    }
  };

  const handleApprove = async () => {
    if (
      !confirm(
        'Are you sure you want to APPROVE this warehouse application? Both the warehouse and seller relationship will become ACTIVE immediately.'
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/warehouses/${warehouseId}/approve`);
      if (res.data.success) {
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to approve warehouse');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejecting this warehouse application.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/warehouses/${warehouseId}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      if (res.data.success) {
        setShowRejectForm(false);
        setRejectionReason('');
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to reject warehouse');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchActiveSellers = async () => {
    setLoadingSellers(true);
    try {
      const res = await apiClient.get('/admin/sellers/applications', {
        params: { status: 'APPROVED', limit: 200 },
      });
      if (res.data.success) {
        setActiveSellersList(res.data.data.items || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSellers(false);
    }
  };

  const handleDirectLinkSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouse || !selectedSellerId) return;
    setLinkingSeller(true);
    setSellerActionError(null);
    try {
      const res = await apiClient.post('/warehouses/link-seller', {
        warehouseId: warehouse.warehouseId,
        sellerId: Number(selectedSellerId),
        isPrimary: isPrimaryLink,
      });
      if (res.data.success) {
        setSelectedSellerId('');
        setIsPrimaryLink(false);
        setLinkSellerOpen(false);
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      setSellerActionError(err.response?.data?.error?.message || 'Failed to link seller');
    } finally {
      setLinkingSeller(false);
    }
  };

  const handleReviewLinkage = async (sellerWarehouseId: number, action: 'APPROVE' | 'REJECT') => {
    setSellerActionLoading(sellerWarehouseId);
    setSellerActionError(null);
    try {
      const res = await apiClient.patch(`/warehouses/seller-warehouses/${sellerWarehouseId}/review`, {
        action,
      });
      if (res.data.success) {
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      setSellerActionError(err.response?.data?.error?.message || `Failed to ${action.toLowerCase()} linkage`);
    } finally {
      setSellerActionLoading(null);
    }
  };

  const handleUnlinkSeller = async (sellerWarehouseId: number, sellerName: string) => {
    if (!confirm(`Are you sure you want to unlink seller "${sellerName}" from this warehouse?`)) return;
    setSellerActionLoading(sellerWarehouseId);
    setSellerActionError(null);
    try {
      const res = await apiClient.delete(`/warehouses/seller-warehouses/${sellerWarehouseId}`);
      if (res.data.success) {
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      setSellerActionError(err.response?.data?.error?.message || 'Failed to unlink seller');
    } finally {
      setSellerActionLoading(null);
    }
  };

  const handleReviewWarehouseDoc = async (docId: number, decision: 'VERIFY' | 'REJECT') => {
    try {
      const res = await apiClient.patch(`/warehouses/documents/${docId}/review`, {
        decision,
      });
      if (res.data.success) {
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || `Failed to ${decision.toLowerCase()} document`);
    }
  };

  const handleRequestRework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reworkComments.trim()) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/warehouses/${warehouseId}/rework`, {
        comments: reworkComments.trim(),
      });
      if (res.data.success) {
        setShowReworkForm(false);
        setReworkComments('');
        fetchDetails();
        onUpdated();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to request rework');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#F8F9FE]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#635BFF]">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">{warehouse?.warehouseName || 'Warehouse Details'}</h2>
                {warehouse && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      warehouse.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : warehouse.status === 'PENDING_APPROVAL'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                        : warehouse.status === 'REWORK_REQUIRED'
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : warehouse.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {warehouse.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono font-medium">{warehouse?.warehouseCode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#635BFF]" />
              <span className="text-xs font-semibold">Loading warehouse details...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {warehouse && !loading && (
            <>
              {/* ADMIN REVIEW BAR: For PENDING_APPROVAL warehouses */}
              {warehouse.status === 'PENDING_APPROVAL' && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Pending Seller Warehouse Application
                      </span>
                      <h3 className="text-sm font-black text-slate-900">
                        Review & Decision Required
                      </h3>
                      {warehouse.associatedSellers?.[0] && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          Submitted by seller{' '}
                          <strong className="font-bold text-slate-900">
                            {warehouse.associatedSellers[0].sellerName}
                          </strong>{' '}
                          ({warehouse.associatedSellers[0].sellerCode})
                        </p>
                      )}
                    </div>

                    {!showRejectForm && !showReworkForm && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setShowRejectForm(true)}
                          disabled={actionLoading}
                          className="px-3.5 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors disabled:opacity-60"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => setShowReworkForm(true)}
                          disabled={actionLoading}
                          className="px-3.5 py-2 rounded-xl border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Rework
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-60 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {actionLoading ? 'Processing...' : 'Approve & Activate'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Rework Form prompt */}
                  {showReworkForm && (
                    <form onSubmit={handleRequestRework} className="pt-3 border-t border-amber-200/80 space-y-3">
                      <label className="text-xs font-bold text-slate-800 block">
                        Feedback / Correction Instructions <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={2}
                        placeholder="State clear instructions on what documents or details need to be corrected..."
                        value={reworkComments}
                        onChange={(e) => setReworkComments(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReworkForm(false)}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={actionLoading || !reworkComments.trim()}
                          className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors disabled:opacity-60"
                        >
                          {actionLoading ? 'Sending...' : 'Send Rework Request'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Reject Form prompt */}
                  {showRejectForm && (
                    <form onSubmit={handleReject} className="pt-3 border-t border-amber-200/80 space-y-3">
                      <label className="text-xs font-bold text-slate-800 block">
                        Reason for Rejection <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={2}
                        placeholder="State clear reasons why this warehouse application is being rejected..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRejectForm(false)}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-60"
                        >
                          {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* REJECTION REASON BANNER if already rejected */}
              {warehouse.status === 'REJECTED' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-800">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Warehouse Application Rejected
                  </div>
                  <p className="text-rose-700">
                    {warehouse.rejectionReason || warehouse.latestStatusComment || 'Warehouse application does not meet compliance standards.'}
                  </p>
                </div>
              )}

              {/* REWORK REQUIRED BANNER */}
              {warehouse.status === 'REWORK_REQUIRED' && (
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-orange-800">
                    <RotateCcw className="w-4 h-4 text-orange-600" />
                    Rework Requested From Seller
                  </div>
                  <p className="text-orange-700">
                    {warehouse.latestStatusComment || 'Seller has been instructed to fix documentation and resubmit.'}
                  </p>
                </div>
              )}

              {/* Warehouse Specs Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-[#F8F9FE] border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Type</span>
                  <span
                    className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                      warehouse.warehouseType === 'OWN'
                        ? 'bg-indigo-50 text-[#635BFF] border border-indigo-100/60'
                        : 'bg-purple-50 text-purple-700 border border-purple-100/60'
                    }`}
                  >
                    {warehouse.warehouseType === 'OWN' ? 'OWN (Marketplace Hub)' : 'THIRD_PARTY (3PL)'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Connected Sellers</span>
                  <span className="text-sm font-black text-slate-900 mt-0.5 block">{warehouse.connectedSellersCount} Sellers</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Staff</span>
                  <span className="text-sm font-black text-slate-900 mt-0.5 block">{warehouse.staffMembers.length} Members</span>
                </div>

                <div className="flex items-end">
                  {warehouse.status !== 'PENDING_APPROVAL' && warehouse.status !== 'REJECTED' && (
                    <button
                      onClick={handleToggleStatus}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
                        warehouse.status === 'ACTIVE'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {warehouse.status === 'ACTIVE' ? 'Set Inactive' : 'Activate Hub'}
                    </button>
                  )}
                </div>
              </div>

              {/* Connected Seller Information Card */}
              {warehouse.warehouseType === 'OWN' ? (
                warehouse.associatedSellers && warehouse.associatedSellers.length > 0 && (
                  <div className="p-4 rounded-2xl border border-slate-100 bg-[#F8F9FE] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#635BFF]" />
                        Associated Seller Entity
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-[#635BFF] border border-indigo-100">
                        Seller-Owned (OWN)
                      </span>
                    </div>
                    {warehouse.associatedSellers.map((seller) => (
                      <div key={seller.sellerId} className="flex items-center justify-between pt-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{seller.sellerName}</span>
                            <span className="font-mono text-[10px] text-slate-400 font-bold">({seller.sellerCode})</span>
                            {seller.isPrimary && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Star className="w-2.5 h-2.5 fill-current" /> Primary
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {seller.businessName} • {seller.email}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          seller.relationshipStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          Relationship: {seller.relationshipStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* 3PL / Multi-Seller Partner Hub */
                <div className="p-5 rounded-2xl border border-slate-100 bg-[#F8F9FE] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-[#635BFF]" />
                        Multi-Seller Linkage Network
                      </span>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Sellers authorized to dispatch orders and hold stock at this 3PL warehouse
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        if (!linkSellerOpen && activeSellersList.length === 0) {
                          fetchActiveSellers();
                        }
                        setLinkSellerOpen(!linkSellerOpen);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#635BFF] hover:text-[#635BFF] text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {linkSellerOpen ? 'Cancel' : 'Authorize / Link Seller'}
                    </button>
                  </div>

                  {sellerActionError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{sellerActionError}</span>
                    </div>
                  )}

                  {/* Inline Link Seller Form */}
                  {linkSellerOpen && (
                    <form onSubmit={handleDirectLinkSeller} className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                      <div className="text-xs font-bold text-slate-900">Authorize Direct Seller Linkage</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Active Seller Entity *</label>
                          <select
                            required
                            value={selectedSellerId}
                            onChange={(e) => setSelectedSellerId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-[#F8F9FE] border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
                          >
                            <option value="">
                              {loadingSellers ? '-- Loading active sellers... --' : '-- Choose active seller --'}
                            </option>
                            {activeSellersList.map((s: any) => (
                              <option key={s.sellerId} value={s.sellerId}>
                                {s.sellerName} ({s.sellerCode}) - {s.businessName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col justify-end">
                          <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer py-2">
                            <input
                              type="checkbox"
                              checked={isPrimaryLink}
                              onChange={(e) => setIsPrimaryLink(e.target.checked)}
                              className="rounded border-slate-300 text-[#635BFF] focus:ring-[#635BFF]"
                            />
                            <span>Set as Primary Warehouse</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setLinkSellerOpen(false)}
                          className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={linkingSeller || !selectedSellerId}
                          className="px-4 py-1.5 rounded-xl bg-[#635BFF] hover:bg-[#5349e0] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm"
                        >
                          {linkingSeller ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Authorize Seller
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Seller list */}
                  {(!warehouse.associatedSellers || warehouse.associatedSellers.length === 0) ? (
                    <div className="p-4 rounded-xl bg-white border border-slate-100 text-center text-xs text-slate-400">
                      No seller entities currently linked to this 3PL warehouse.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {warehouse.associatedSellers.map((seller) => (
                        <div
                          key={seller.sellerWarehouseId}
                          className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{seller.sellerName}</span>
                                <span className="font-mono text-[10px] text-slate-400 font-bold">({seller.sellerCode})</span>
                                {seller.isPrimary && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Star className="w-2.5 h-2.5 fill-current" /> Primary
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                                {seller.businessName} • {seller.email}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  seller.relationshipStatus === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : seller.relationshipStatus === 'PENDING'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : seller.relationshipStatus === 'TERMINATED'
                                    ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {seller.relationshipStatus}
                              </span>

                              {/* Pending actions */}
                              {seller.relationshipStatus === 'PENDING' && (
                                <div className="flex items-center gap-1.5 ml-2">
                                  <button
                                    onClick={() => handleReviewLinkage(seller.sellerWarehouseId, 'APPROVE')}
                                    disabled={sellerActionLoading === seller.sellerWarehouseId}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReviewLinkage(seller.sellerWarehouseId, 'REJECT')}
                                    disabled={sellerActionLoading === seller.sellerWarehouseId}
                                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-all disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}

                              {/* Active actions */}
                              {seller.relationshipStatus === 'ACTIVE' && (
                                <button
                                  onClick={() => handleUnlinkSeller(seller.sellerWarehouseId, seller.sellerName)}
                                  disabled={sellerActionLoading === seller.sellerWarehouseId}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                  title="Unlink Seller"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Seller's Uploaded Warehouse Compliance Documents */}
                          {seller.documents && seller.documents.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                              {seller.documents.map((doc) => (
                                <div
                                  key={doc.sellerWarehouseDocumentId}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] flex items-center gap-2"
                                >
                                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                                  <span className="font-bold text-slate-700">{doc.displayName}</span>
                                  {doc.documentUrl && (
                                    <a
                                      href={doc.documentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#635BFF] hover:underline flex items-center gap-0.5"
                                    >
                                      View <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                  <span
                                    className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                                      doc.verificationStatus === 'VERIFIED'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : doc.verificationStatus === 'REJECTED'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {doc.verificationStatus}
                                  </span>
                                  {doc.verificationStatus === 'PENDING' && (
                                    <div className="flex items-center gap-1 ml-1">
                                      <button
                                        type="button"
                                        onClick={() => handleReviewWarehouseDoc(doc.sellerWarehouseDocumentId, 'VERIFY')}
                                        className="text-emerald-600 hover:text-emerald-800 font-bold"
                                      >
                                        Verify
                                      </button>
                                      <span>•</span>
                                      <button
                                        type="button"
                                        onClick={() => handleReviewWarehouseDoc(doc.sellerWarehouseDocumentId, 'REJECT')}
                                        className="text-rose-600 hover:text-rose-800 font-bold"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Physical Location & Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl border border-slate-100 space-y-2 bg-white">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#635BFF]" /> Full Warehouse Address
                  </span>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">
                    {warehouse.addressLine1}
                    {warehouse.addressLine2 && <br />}
                    {warehouse.addressLine2}
                    <br />
                    {warehouse.city}, {warehouse.state} - {warehouse.postalCode}
                    <br />
                    {warehouse.country}
                  </p>
                  {(warehouse.latitude || warehouse.longitude) && (
                    <span className="text-[10px] font-mono text-slate-400 block pt-1 border-t border-slate-100">
                      Coordinates: {warehouse.latitude?.toFixed(4)}, {warehouse.longitude?.toFixed(4)}
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 space-y-2 bg-white">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[#635BFF]" /> Station Contact Person
                  </span>
                  <p className="text-xs font-black text-slate-900">{warehouse.contactPersonName || 'No contact assigned'}</p>
                  {warehouse.contactEmail && (
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`mailto:${warehouse.contactEmail}`} className="hover:underline hover:text-[#635BFF]">
                        {warehouse.contactEmail}
                      </a>
                    </p>
                  )}
                  {warehouse.contactPhoneNumber && (
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`tel:${warehouse.contactPhoneNumber}`} className="hover:underline hover:text-[#635BFF]">
                        {warehouse.contactPhoneNumber}
                      </a>
                    </p>
                  )}
                </div>
              </div>

              {/* Staff Roster Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#635BFF]" />
                    <h3 className="text-sm font-black text-slate-900">Authorized Warehouse Personnel</h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{warehouse.staffMembers.length} Assigned</span>
                </div>

                {/* Add Staff Form */}
                <form onSubmit={handleAddStaff} className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      required
                      placeholder="Operator email (e.g. staff@company.com)"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#F8F9FE] border border-slate-200/80 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                    />
                    <button
                      type="submit"
                      disabled={addingStaff || !newStaffEmail.trim()}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:from-[#5147FF] hover:to-[#635BFF] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-60 shrink-0"
                    >
                      {addingStaff ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>{addingStaff ? 'Assigning...' : 'Assign Staff'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>If not registered, an account will be created automatically.</span>
                    <button
                      type="button"
                      onClick={() => setShowStaffMoreFields(!showStaffMoreFields)}
                      className="font-bold text-[#635BFF] hover:underline flex items-center gap-1"
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
                    <div className="p-3 rounded-xl bg-[#F8F9FE] border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs animate-in fade-in duration-200">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          placeholder="Operator first name"
                          value={newStaffFirstName}
                          onChange={(e) => setNewStaffFirstName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          placeholder="Operator last name"
                          value={newStaffLastName}
                          onChange={(e) => setNewStaffLastName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          placeholder="+91 9876543210"
                          value={newStaffPhone}
                          onChange={(e) => setNewStaffPhone(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Custom Temp Password
                        </label>
                        <input
                          type="text"
                          placeholder="Default: Warehouse@123"
                          value={newStaffPassword}
                          onChange={(e) => setNewStaffPassword(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:border-[#635BFF]"
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
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Temporary Login Password
                          </span>
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {staffSuccess.tempPassword}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Login Email: <strong className="text-slate-700">{staffSuccess.email}</strong>
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
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
                  {warehouse.staffMembers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No staff assigned to this warehouse yet. Add users by their registered email above.
                    </div>
                  ) : (
                    warehouse.staffMembers.map((staff) => (
                      <div key={staff.userId} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-[#635BFF] flex items-center justify-center font-bold text-xs shrink-0">
                            {staff.firstName[0]}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              {staff.firstName} {staff.lastName}
                            </span>
                            <span className="text-[11px] text-slate-400 block font-mono">{staff.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/60">
                            Authorized Staff
                          </span>
                          <button
                            onClick={() => handleRemoveStaff(staff.userId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Remove staff assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Compliance & Regulatory Declarations */}
              {warehouse.consents && warehouse.consents.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#635BFF]" />
                      <h3 className="text-sm font-black text-slate-900">Regulatory & Operational Consents</h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {warehouse.consents.length} Logged
                    </span>
                  </div>

                  <div className="space-y-2">
                    {warehouse.consents.map((consent) => (
                      <div
                        key={consent.warehouseConsentId}
                        className="p-3 rounded-2xl bg-[#F8F9FE] border border-slate-100 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">
                              {consent.consentType.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 font-bold">
                              ({consent.consentVersion})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                            Recorded: {new Date(consent.createdAt).toLocaleString()} • Source: {consent.source || 'Digital Portal'}
                          </span>
                        </div>

                        <div>
                          {consent.isGranted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Granted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Revoked
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status History & Audit Trail */}
              {warehouse.statusHistory && warehouse.statusHistory.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <h3 className="text-sm font-black text-slate-900">Status History & Audit Trail</h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {warehouse.statusHistory.length} Events
                    </span>
                  </div>

                  <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {warehouse.statusHistory.map((h, i) => (
                      <div key={h.historyId || i} className="relative">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center border-purple-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                              {h.status.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(h.changedAt).toLocaleString()}
                            </span>
                          </div>
                          {h.comments && (
                            <p className="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-200/60 mt-1">
                              {h.comments}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-400 mt-1.5">
                            By {h.changedBy.name} ({h.changedBy.email})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
