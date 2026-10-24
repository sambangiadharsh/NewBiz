import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
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
import { DataTable, ColumnDef } from '../../components/common/table/index.js';

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

export const PoliciesPage: React.FC = () => {
  // Return Policies State
  const [returnPolicies, setReturnPolicies] = useState<ReturnPolicy[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [returnSearch, setReturnSearch] = useState('');
  const [returnStatusFilter, setReturnStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
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

  useEffect(() => {
    fetchReturnPolicies();
  }, [returnStatusFilter]);

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

  const returnColumns: ColumnDef<ReturnPolicy>[] = [
    {
      header: 'Policy Code & Name',
      cell: ({ row: pol }) => (
        <div>
          <div className="font-bold text-slate-900 text-sm">{pol.policyName}</div>
          <div className="font-mono text-[11px] text-indigo-600 font-semibold mt-0.5">
            {pol.policyCode}
          </div>
          {pol.conditionsSummary && (
            <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 max-w-sm">
              {pol.conditionsSummary}
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Return Window',
      cell: ({ row: pol }) =>
        pol.isReturnable ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
            <Check className="w-3.5 h-3.5" />
            {pol.returnWindowDays} Days (Refund)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold text-[11px]">
            <X className="w-3.5 h-3.5" />
            No Returns
          </span>
        ),
    },
    {
      header: 'Replacement Window',
      cell: ({ row: pol }) =>
        pol.isReplaceable ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px]">
            <Check className="w-3.5 h-3.5" />
            {pol.replacementWindowDays} Days (Unit)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold text-[11px]">
            <X className="w-3.5 h-3.5" />
            No Replacement
          </span>
        ),
    },
    {
      header: 'Technician Visit',
      cell: ({ row: pol }) =>
        pol.requiresTechnicianCheck ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold text-[11px]">
            <Wrench className="w-3.5 h-3.5" />
            Required
          </span>
        ) : (
          <span className="text-slate-400 font-medium">Standard</span>
        ),
    },
    {
      header: 'Categories Linked',
      cell: ({ row: pol }) => (
        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg text-xs">
          {pol.categoriesCount || 0} Categories
        </span>
      ),
    },
    {
      header: 'Status',
      cell: ({ row: pol }) => (
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
            pol.status === 'ACTIVE'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {pol.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: ({ row: pol }) => (
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
      ),
    },
  ];

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
              <RotateCcw className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Return & Replacement Policies
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Configure standardized customer return windows, replacement eligibility, and inspection conditions across the catalog.
          </p>
        </div>

        {/* Quick Action */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => openReturnModal()}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Return Policy</span>
          </button>
        </div>
      </div>

      {/* Return Policies Table Container */}
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
        <DataTable<ReturnPolicy>
          columns={returnColumns}
          data={returnPolicies}
          loading={loadingReturns}
          bordered={true}
          striped={true}
          maxHeight="600px"
          containerClassName="rounded-3xl shadow-2xs"
          keyExtractor={(pol) => pol.policyId}
          emptyTitle="No Return Policies Found"
          emptyDescription="Click 'New Return Policy' to create your first policy."
          emptyAction={{
            label: 'New Return Policy',
            onClick: () => openReturnModal(),
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      </div>

      {/* ==================================================== */}
      {/* MODAL: RETURN POLICY (CREATE / EDIT) */}
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
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
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
                    placeholder="e.g. RET_7D_EXCHANGE"
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
                    placeholder="e.g. 7 Days Replacement Only"
                    value={returnForm.policyName}
                    onChange={(e) => setReturnForm({ ...returnForm, policyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Switches */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={returnForm.isReturnable}
                    onChange={(e) => setReturnForm({ ...returnForm, isReturnable: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="font-bold text-slate-800">Allow Return (Refund)</div>
                    <div className="text-[10px] text-slate-500">Customer can return item for money</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={returnForm.isReplaceable}
                    onChange={(e) => setReturnForm({ ...returnForm, isReplaceable: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="font-bold text-slate-800">Allow Replacement</div>
                    <div className="text-[10px] text-slate-500">Replace with new piece on defect</div>
                  </div>
                </label>
              </div>

              {/* Windows */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Return Window (Days)</label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    disabled={!returnForm.isReturnable}
                    value={returnForm.returnWindowDays}
                    onChange={(e) => setReturnForm({ ...returnForm, returnWindowDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Replacement Window (Days)</label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    disabled={!returnForm.isReplaceable}
                    value={returnForm.replacementWindowDays}
                    onChange={(e) => setReturnForm({ ...returnForm, replacementWindowDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Tech inspection requirement */}
              <label className="flex items-center space-x-3 p-3 rounded-2xl bg-amber-50/50 border border-amber-200/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={returnForm.requiresTechnicianCheck}
                  onChange={(e) => setReturnForm({ ...returnForm, requiresTechnicianCheck: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded-md border-amber-300 focus:ring-amber-500"
                />
                <div>
                  <div className="font-bold text-amber-900">Requires Technician Verification</div>
                  <div className="text-[10px] text-amber-700">
                    A service technician must visit & approve before pickup / refund.
                  </div>
                </div>
              </label>

              {/* Conditions Summary */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Summary for Customer Display
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 7 days replacement only if brand seal is intact and undamaged..."
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
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
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
    </div>
  );
};
