import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  ShieldCheck,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wrench,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { NoResults } from '../../components/common/NoResults.js';

interface ReturnPolicy {
  policyId: number;
  policyCode: string;
  policyName: string;
  isReturnable: boolean;
  isReplaceable: boolean;
  returnWindowDays: number;
  replacementWindowDays: number;
  requiresTechnicianCheck: boolean;
  conditionsSummary?: string | null;
  termsAndConditions?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  categoriesCount?: number;
  productsCount?: number;
}

interface WarrantyPolicy {
  warrantyPolicyId: number;
  policyCode: string;
  policyName: string;
  warrantyType: 'BRAND' | 'SELLER' | 'NONE';
  durationMonths: number;
  serviceType: 'CARRY_IN' | 'ON_SITE' | 'PICKUP_DROP' | 'NONE';
  coveredSummary?: string | null;
  notCoveredSummary?: string | null;
  termsAndConditions?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  categoriesCount?: number;
  productsCount?: number;
}

export const PoliciesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'returns' | 'warranties'>('returns');

  // Return Policies State
  const [returnPolicies, setReturnPolicies] = useState<ReturnPolicy[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [returnSearch, setReturnSearch] = useState('');
  const [returnStatusFilter, setReturnStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Warranty Policies State
  const [warrantyPolicies, setWarrantyPolicies] = useState<WarrantyPolicy[]>([]);
  const [loadingWarranties, setLoadingWarranties] = useState(false);
  const [warrantySearch, setWarrantySearch] = useState('');
  const [warrantyStatusFilter, setWarrantyStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [warrantyTypeFilter, setWarrantyTypeFilter] = useState<'ALL' | 'BRAND' | 'SELLER' | 'NONE'>('ALL');

  // Modal States
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState<ReturnPolicy | null>(null);
  const [returnForm, setReturnForm] = useState({
    policyCode: '',
    policyName: '',
    isReturnable: true,
    isReplaceable: true,
    returnWindowDays: 7,
    replacementWindowDays: 7,
    requiresTechnicianCheck: false,
    conditionsSummary: '',
    termsAndConditions: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false);
  const [editingWarranty, setEditingWarranty] = useState<WarrantyPolicy | null>(null);
  const [warrantyForm, setWarrantyForm] = useState({
    policyCode: '',
    policyName: '',
    warrantyType: 'BRAND' as 'BRAND' | 'SELLER' | 'NONE',
    durationMonths: 12,
    serviceType: 'CARRY_IN' as 'CARRY_IN' | 'ON_SITE' | 'PICKUP_DROP' | 'NONE',
    coveredSummary: '',
    notCoveredSummary: '',
    termsAndConditions: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch Return Policies
  const fetchReturnPolicies = async () => {
    setLoadingReturns(true);
    try {
      const params: any = {};
      if (returnStatusFilter !== 'ALL') params.status = returnStatusFilter;
      if (returnSearch.trim()) params.search = returnSearch.trim();
      const res = await apiClient.get('/admin/policies/returns', { params });
      if (res.data?.success) {
        setReturnPolicies(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load return policies', err);
    } finally {
      setLoadingReturns(false);
    }
  };

  // Fetch Warranty Policies
  const fetchWarrantyPolicies = async () => {
    setLoadingWarranties(true);
    try {
      const params: any = {};
      if (warrantyStatusFilter !== 'ALL') params.status = warrantyStatusFilter;
      if (warrantySearch.trim()) params.search = warrantySearch.trim();
      const res = await apiClient.get('/admin/policies/warranties', { params });
      if (res.data?.success) {
        setWarrantyPolicies(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load warranty policies', err);
    } finally {
      setLoadingWarranties(false);
    }
  };

  useEffect(() => {
    fetchReturnPolicies();
    fetchWarrantyPolicies();
  }, [returnStatusFilter, warrantyStatusFilter]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Toggle Return Status
  const handleToggleReturnStatus = async (policy: ReturnPolicy) => {
    try {
      const res = await apiClient.patch(`/admin/policies/returns/${policy.policyId}/status`);
      if (res.data?.success) {
        showNotification('success', `Policy '${policy.policyCode}' status updated`);
        fetchReturnPolicies();
      }
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to update status');
    }
  };

  // Toggle Warranty Status
  const handleToggleWarrantyStatus = async (policy: WarrantyPolicy) => {
    try {
      const res = await apiClient.patch(`/admin/policies/warranties/${policy.warrantyPolicyId}/status`);
      if (res.data?.success) {
        showNotification('success', `Warranty '${policy.policyCode}' status updated`);
        fetchWarrantyPolicies();
      }
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to update status');
    }
  };

  // Open Return Modal
  const openReturnModal = (policy?: ReturnPolicy) => {
    if (policy) {
      setEditingReturn(policy);
      setReturnForm({
        policyCode: policy.policyCode,
        policyName: policy.policyName,
        isReturnable: policy.isReturnable,
        isReplaceable: policy.isReplaceable,
        returnWindowDays: policy.returnWindowDays,
        replacementWindowDays: policy.replacementWindowDays,
        requiresTechnicianCheck: policy.requiresTechnicianCheck,
        conditionsSummary: policy.conditionsSummary || '',
        termsAndConditions: policy.termsAndConditions || '',
        status: policy.status,
      });
    } else {
      setEditingReturn(null);
      setReturnForm({
        policyCode: '',
        policyName: '',
        isReturnable: true,
        isReplaceable: true,
        returnWindowDays: 7,
        replacementWindowDays: 7,
        requiresTechnicianCheck: false,
        conditionsSummary: '',
        termsAndConditions: '',
        status: 'ACTIVE',
      });
    }
    setReturnModalOpen(true);
  };

  // Save Return Policy
  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingReturn) {
        await apiClient.put(`/admin/policies/returns/${editingReturn.policyId}`, returnForm);
        showNotification('success', 'Return policy updated successfully');
      } else {
        await apiClient.post('/admin/policies/returns', returnForm);
        showNotification('success', 'Return policy created successfully');
      }
      setReturnModalOpen(false);
      fetchReturnPolicies();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to save return policy');
    } finally {
      setSaving(false);
    }
  };

  // Open Warranty Modal
  const openWarrantyModal = (policy?: WarrantyPolicy) => {
    if (policy) {
      setEditingWarranty(policy);
      setWarrantyForm({
        policyCode: policy.policyCode,
        policyName: policy.policyName,
        warrantyType: policy.warrantyType,
        durationMonths: policy.durationMonths,
        serviceType: policy.serviceType,
        coveredSummary: policy.coveredSummary || '',
        notCoveredSummary: policy.notCoveredSummary || '',
        termsAndConditions: policy.termsAndConditions || '',
        status: policy.status,
      });
    } else {
      setEditingWarranty(null);
      setWarrantyForm({
        policyCode: '',
        policyName: '',
        warrantyType: 'BRAND',
        durationMonths: 12,
        serviceType: 'CARRY_IN',
        coveredSummary: '',
        notCoveredSummary: '',
        termsAndConditions: '',
        status: 'ACTIVE',
      });
    }
    setWarrantyModalOpen(true);
  };

  // Save Warranty Policy
  const handleSaveWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingWarranty) {
        await apiClient.put(`/admin/policies/warranties/${editingWarranty.warrantyPolicyId}`, warrantyForm);
        showNotification('success', 'Warranty policy updated successfully');
      } else {
        await apiClient.post('/admin/policies/warranties', warrantyForm);
        showNotification('success', 'Warranty policy created successfully');
      }
      setWarrantyModalOpen(false);
      fetchWarrantyPolicies();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to save warranty policy');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Warranties
  const filteredWarranties = warrantyPolicies.filter((w) => {
    if (warrantyTypeFilter !== 'ALL' && w.warrantyType !== warrantyTypeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Alert */}
      {actionMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-2 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all transform animate-bounce ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Policies & Warranty Master
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Configure standardized customer return/replacement windows and brand warranty programs across the catalog.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-3">
          {activeTab === 'returns' ? (
            <button
              onClick={() => openReturnModal()}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Return Policy</span>
            </button>
          ) : (
            <button
              onClick={() => openWarrantyModal()}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Warranty Policy</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs (Pill Container) */}
      <div className="flex items-center space-x-2 p-1.5 bg-slate-100/90 rounded-2xl w-fit border border-slate-200/60">
        <button
          onClick={() => setActiveTab('returns')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'returns'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Return & Replacement Policies</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'returns' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'bg-slate-200/70 text-slate-600'
            }`}
          >
            {returnPolicies.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('warranties')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'warranties'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Warranty Policies</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'warranties' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'bg-slate-200/70 text-slate-600'
            }`}
          >
            {warrantyPolicies.length}
          </span>
        </button>
      </div>

      {/* TAB 1: RETURN POLICIES */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search policy name or code..."
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReturnPolicies()}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <select
                value={returnStatusFilter}
                onChange={(e) => setReturnStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <button
                onClick={fetchReturnPolicies}
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors cursor-pointer"
                title="Refresh return policies"
              >
                <RefreshCw className={`w-4 h-4 ${loadingReturns ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold tracking-wider uppercase">
                    <th className="px-6 py-4">Policy Code & Name</th>
                    <th className="px-6 py-4">Return Window</th>
                    <th className="px-6 py-4">Replacement Window</th>
                    <th className="px-6 py-4">Technician Visit</th>
                    <th className="px-6 py-4">Categories Linked</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReturns ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading return policies...
                      </td>
                    </tr>
                  ) : returnPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-6">
                        <NoResults
                          title="No Return Policies Found"
                          description="Click 'New Return Policy' to create your first policy."
                          className="py-4"
                        />
                      </td>
                    </tr>
                  ) : (
                    returnPolicies.map((pol) => (
                      <tr key={pol.policyId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm">{pol.policyName}</div>
                          <div className="font-mono text-[11px] text-indigo-600 font-semibold mt-0.5">
                            {pol.policyCode}
                          </div>
                          {pol.conditionsSummary && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 max-w-sm">
                              {pol.conditionsSummary}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {pol.isReturnable ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                              <Check className="w-3.5 h-3.5" />
                              {pol.returnWindowDays} Days (Refund)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold text-[11px]">
                              <X className="w-3 h-3" />
                              No Returns
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {pol.isReplaceable ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px]">
                              <Check className="w-3.5 h-3.5" />
                              {pol.replacementWindowDays} Days (Unit)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold text-[11px]">
                              <X className="w-3 h-3" />
                              No Replacement
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {pol.requiresTechnicianCheck ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold text-[11px]">
                              <Wrench className="w-3 h-3" />
                              Required
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">Standard</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg text-xs">
                            {pol.categoriesCount || 0} Categories
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                              pol.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {pol.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openReturnModal(pol)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit policy"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleReturnStatus(pol)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                pol.status === 'ACTIVE'
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={pol.status === 'ACTIVE' ? 'Deactivate policy' : 'Activate policy'}
                            >
                              {pol.status === 'ACTIVE' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WARRANTY POLICIES */}
      {activeTab === 'warranties' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search warranty name or code..."
                value={warrantySearch}
                onChange={(e) => setWarrantySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchWarrantyPolicies()}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <select
                value={warrantyTypeFilter}
                onChange={(e) => setWarrantyTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="BRAND">Brand Warranty</option>
                <option value="SELLER">Seller Warranty</option>
                <option value="NONE">No Warranty</option>
              </select>

              <select
                value={warrantyStatusFilter}
                onChange={(e) => setWarrantyStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <button
                onClick={fetchWarrantyPolicies}
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors cursor-pointer"
                title="Refresh warranties"
              >
                <RefreshCw className={`w-4 h-4 ${loadingWarranties ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold tracking-wider uppercase">
                    <th className="px-6 py-4">Warranty Code & Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4">Service Type</th>
                    <th className="px-6 py-4">Coverage Preview</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingWarranties ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
                        Loading warranty policies...
                      </td>
                    </tr>
                  ) : filteredWarranties.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-6">
                        <NoResults
                          title="No Warranty Policies Found"
                          description="Click 'New Warranty Policy' to create your first policy."
                          className="py-4"
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredWarranties.map((war) => (
                      <tr key={war.warrantyPolicyId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm">{war.policyName}</div>
                          <div className="font-mono text-[11px] text-indigo-600 font-semibold mt-0.5">
                            {war.policyCode}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                              war.warrantyType === 'BRAND'
                                ? 'bg-indigo-50 text-indigo-700'
                                : war.warrantyType === 'SELLER'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {war.warrantyType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {war.durationMonths > 0 ? (
                            <span className="font-bold text-slate-800 text-xs">
                              {war.durationMonths >= 12
                                ? `${war.durationMonths / 12} Year${war.durationMonths > 12 ? 's' : ''}`
                                : `${war.durationMonths} Months`}
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-700">
                            {war.serviceType === 'CARRY_IN' && 'Carry-In (Service Center)'}
                            {war.serviceType === 'ON_SITE' && 'Doorstep / On-Site'}
                            {war.serviceType === 'PICKUP_DROP' && 'Pickup & Return'}
                            {war.serviceType === 'NONE' && 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          {war.coveredSummary ? (
                            <p className="text-[11px] text-slate-600 line-clamp-1" title={war.coveredSummary}>
                              {war.coveredSummary}
                            </p>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No specific terms</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                              war.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {war.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openWarrantyModal(war)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit warranty"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleWarrantyStatus(war)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                war.status === 'ACTIVE'
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={war.status === 'ACTIVE' ? 'Deactivate warranty' : 'Activate warranty'}
                            >
                              {war.status === 'ACTIVE' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: RETURN POLICY (CREATE / EDIT) */}
      {/* ==================================================== */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingReturn ? 'Edit Return Policy' : 'Create Return & Replacement Policy'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure return rules, allowable windows, and customer terms.
                </p>
              </div>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveReturn} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Policy Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingReturn}
                    placeholder="e.g. RET_14D_BOTH"
                    value={returnForm.policyCode}
                    onChange={(e) => setReturnForm({ ...returnForm, policyCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-primary-500/20 focus:outline-none uppercase disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Policy Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 14-Day Return & Replacement"
                    value={returnForm.policyName}
                    onChange={(e) => setReturnForm({ ...returnForm, policyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Booleans & Windows */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Eligible for Return (Refund)</span>
                    <span className="text-slate-500 text-[11px]">Can customer return for monetary refund?</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={returnForm.isReturnable}
                    onChange={(e) => setReturnForm({ ...returnForm, isReturnable: e.target.checked })}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {returnForm.isReturnable && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Return Window (Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={returnForm.returnWindowDays}
                      onChange={(e) => setReturnForm({ ...returnForm, returnWindowDays: Number(e.target.value) })}
                      className="w-32 px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Eligible for Replacement (Exchange)</span>
                    <span className="text-slate-500 text-[11px]">Can customer exchange size or damaged unit?</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={returnForm.isReplaceable}
                    onChange={(e) => setReturnForm({ ...returnForm, isReplaceable: e.target.checked })}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {returnForm.isReplaceable && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Replacement Window (Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={returnForm.replacementWindowDays}
                      onChange={(e) => setReturnForm({ ...returnForm, replacementWindowDays: Number(e.target.value) })}
                      className="w-32 px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Requires Technician Inspection</span>
                    <span className="text-slate-500 text-[11px]">Appliance/TV must be inspected at doorstep before return</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={returnForm.requiresTechnicianCheck}
                    onChange={(e) => setReturnForm({ ...returnForm, requiresTechnicianCheck: e.target.checked })}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Conditions Summary */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Conditions Summary (Shown on Product Page)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Return for refund within 7 days with original tags intact."
                  value={returnForm.conditionsSummary}
                  onChange={(e) => setReturnForm({ ...returnForm, conditionsSummary: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>

              {/* Full Terms */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Terms & Fine Print
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed guidelines, unworn requirements, hygiene disclaimers..."
                  value={returnForm.termsAndConditions}
                  onChange={(e) => setReturnForm({ ...returnForm, termsAndConditions: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={returnForm.status}
                  onChange={(e) => setReturnForm({ ...returnForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-all flex items-center space-x-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingReturn ? 'Update Policy' : 'Create Policy'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: WARRANTY POLICY (CREATE / EDIT) */}
      {/* ==================================================== */}
      {warrantyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingWarranty ? 'Edit Warranty Policy' : 'Create Warranty Policy'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define manufacturer / seller warranty duration, service type, and coverage.
                </p>
              </div>
              <button
                onClick={() => setWarrantyModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveWarranty} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Warranty Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingWarranty}
                    placeholder="e.g. WAR_BRAND_3Y"
                    value={warrantyForm.policyCode}
                    onChange={(e) => setWarrantyForm({ ...warrantyForm, policyCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-primary-500/20 focus:outline-none uppercase disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Policy Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3-Year Brand Domestic Warranty"
                    value={warrantyForm.policyName}
                    onChange={(e) => setWarrantyForm({ ...warrantyForm, policyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Warranty Specs */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Warranty Type</label>
                  <select
                    value={warrantyForm.warrantyType}
                    onChange={(e) => setWarrantyForm({ ...warrantyForm, warrantyType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-xs focus:outline-none"
                  >
                    <option value="BRAND">BRAND (Manufacturer)</option>
                    <option value="SELLER">SELLER (Merchant)</option>
                    <option value="NONE">NONE (No Warranty)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Months)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={warrantyForm.durationMonths}
                    onChange={(e) => setWarrantyForm({ ...warrantyForm, durationMonths: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Type</label>
                  <select
                    value={warrantyForm.serviceType}
                    onChange={(e) => setWarrantyForm({ ...warrantyForm, serviceType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-xs focus:outline-none"
                  >
                    <option value="CARRY_IN">Carry-In (Hub)</option>
                    <option value="ON_SITE">On-Site (Doorstep)</option>
                    <option value="PICKUP_DROP">Pickup & Drop</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
              </div>

              {/* Coverage Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">What is Covered</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Manufacturing defects, internal electronic boards..."
                    value={warrantyForm.coveredSummary}
                    onChange={(e) => setWarrantyForm({ ...warrantyForm, coveredSummary: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">What is NOT Covered</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Physical drops, water ingress, lightning..."
                    value={warrantyForm.notCoveredSummary}
                    onChange={(e) => setWarrantyForm({ ...warrantyForm, notCoveredSummary: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Full Terms */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Claim Procedure & Legal Terms
                </label>
                <textarea
                  rows={3}
                  placeholder="How customer presents bill at service centers, toll-free number..."
                  value={warrantyForm.termsAndConditions}
                  onChange={(e) => setWarrantyForm({ ...warrantyForm, termsAndConditions: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={warrantyForm.status}
                  onChange={(e) => setWarrantyForm({ ...warrantyForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setWarrantyModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-all flex items-center space-x-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingWarranty ? 'Update Warranty' : 'Create Warranty'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
