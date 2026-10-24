import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Search,
  CheckCircle2,
  Edit2,
  Check,
  AlertCircle,
  RefreshCw,
  Hash,
  Tag,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { showSweetToast } from '../../lib/swal.js';

interface AttributeValueItem {
  attributeValueId: number;
  attributeId: number;
  valueName: string;
  valueCode: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
}

interface ManageAttributeValuesModalProps {
  attribute: {
    attributeId: number;
    attributeName: string;
    dataType: string;
    status: string;
  };
  onClose: () => void;
  onUpdated?: () => void;
}

export const ManageAttributeValuesModal: React.FC<ManageAttributeValuesModalProps> = ({
  attribute,
  onClose,
  onUpdated,
}) => {
  const [values, setValues] = useState<AttributeValueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [valueName, setValueName] = useState('');
  const [valueCode, setValueCode] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchValues = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/admin/catalog/attributes/${attribute.attributeId}/values`);
      if (res.data.success) {
        setValues(res.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load attribute values');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValues();
  }, [attribute.attributeId]);

  // Auto-generate a clean uppercase code suggestion if valueCode is blank
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValueName(val);
    if (!valueCode || valueCode === valueName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)) {
      const suggested = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      setValueCode(suggested);
    }
  };

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valueName.trim() || !valueCode.trim()) {
      setError('Please provide both a value name and code');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.post(
        `/admin/catalog/attributes/${attribute.attributeId}/values`,
        {
          valueName: valueName.trim(),
          valueCode: valueCode.trim().toUpperCase(),
          status: 'ACTIVE',
        }
      );

      if (res.data.success) {
        setValueName('');
        setValueCode('');
        setSuccessMessage(`Option "${res.data.data.valueName}" added successfully`);
        setTimeout(() => setSuccessMessage(null), 3500);
        await fetchValues();
        if (onUpdated) onUpdated();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to add option value');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: AttributeValueItem) => {
    setActionLoadingId(item.attributeValueId);
    setError(null);
    try {
      const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await apiClient.put(`/admin/catalog/attribute-values/${item.attributeValueId}`, {
        status: nextStatus,
      });
      setValues((prev) =>
        prev.map((v) =>
          v.attributeValueId === item.attributeValueId ? { ...v, status: nextStatus } : v
        )
      );
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update value status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartEdit = (item: AttributeValueItem) => {
    setEditingId(item.attributeValueId);
    setEditName(item.valueName);
    setEditCode(item.valueCode);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCode('');
  };

  const handleSaveEdit = async (attributeValueId: number) => {
    if (!editName.trim() || !editCode.trim()) {
      setError('Value name and code cannot be empty');
      return;
    }

    setEditSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.put(`/admin/catalog/attribute-values/${attributeValueId}`, {
        valueName: editName.trim(),
        valueCode: editCode.trim().toUpperCase(),
      });

      if (res.data.success) {
        const updatedItem = res.data.data;
        setValues((prev) =>
          prev.map((v) =>
            v.attributeValueId === attributeValueId
              ? {
                  ...v,
                  valueName: updatedItem.valueName,
                  valueCode: updatedItem.valueCode,
                  updatedAt: updatedItem.updatedAt,
                }
              : v
          )
        );
        setEditingId(null);
        showSweetToast('Option value updated successfully', 'success');
        if (onUpdated) onUpdated();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to update option value';
      setError(msg);
      showSweetToast(msg, 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const filteredValues = values.filter((v) => {
    const q = searchTerm.toLowerCase().trim();
    return v.valueName.toLowerCase().includes(q) || v.valueCode.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">Manage Option Values</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-100 text-violet-700 uppercase tracking-wide">
                {attribute.dataType}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Standardized options for specification:{' '}
              <strong className="text-slate-800 font-bold">{attribute.attributeName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-7 overflow-y-auto space-y-6 flex-1 table-scrollbar">
          {/* Alerts */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Add Option Form */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/70">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-violet-600" />
              Add Standardized Option Value
            </h4>
            <form onSubmit={handleAddValue} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Value Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Space Grey, 5 Litres, XL"
                    value={valueName}
                    onChange={handleNameChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Option Code (for SKU generation) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. SPGRY, 5L, XL"
                      value={valueCode}
                      onChange={(e) => setValueCode(e.target.value.toUpperCase())}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 placeholder-slate-400 uppercase focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !valueName.trim() || !valueCode.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Add Option</span>
                </button>
              </div>
            </form>
          </div>

          {/* Listing & Search */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">Configured Options</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-extrabold text-[11px]">
                  {values.length}
                </span>
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-medium"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-violet-600" />
                <span className="text-xs font-semibold">Loading configured options...</span>
              </div>
            ) : filteredValues.length === 0 ? (
              <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">
                  {searchTerm ? 'No options match your filter' : 'No option values defined yet'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Add the standardized variants above (e.g. colors, sizes, or capacities) that sellers can select from.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[280px] overflow-y-auto table-scrollbar">
                {filteredValues.map((v) => {
                  const isActionLoading = actionLoadingId === v.attributeValueId;
                  const isEditingThis = editingId === v.attributeValueId;

                  return (
                    <div
                      key={v.attributeValueId}
                      className={`px-4 py-3 flex items-center justify-between transition-colors ${
                        isEditingThis
                          ? 'bg-violet-50/60 ring-1 ring-inset ring-violet-200'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {isEditingThis ? (
                        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mr-3">
                          <div className="w-full sm:w-36 shrink-0">
                            <input
                              type="text"
                              value={editCode}
                              onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(v.attributeValueId);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              placeholder="CODE"
                              disabled={editSubmitting}
                              className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-800"
                              autoFocus
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(v.attributeValueId);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              placeholder="Option Name"
                              disabled={editSubmitting}
                              className="w-full px-3 py-1 text-xs font-semibold bg-white border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-800"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs font-bold tracking-wider border border-slate-200">
                            {v.valueCode}
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-800 block truncate">
                              {v.valueName}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditingThis ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(v.attributeValueId)}
                              disabled={editSubmitting}
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                              title="Save changes"
                            >
                              {editSubmitting ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={editSubmitting}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                              title="Cancel editing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(v)}
                              disabled={isActionLoading || editingId !== null}
                              className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors p-1 disabled:opacity-50"
                              title="Toggle Active Status"
                            >
                              {v.status === 'ACTIVE' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> ACTIVE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  INACTIVE
                                </span>
                              )}
                              {v.status === 'ACTIVE' ? (
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(v)}
                              disabled={isActionLoading || editingId !== null}
                              className="p-1.5 rounded-xl hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors disabled:opacity-40"
                              title="Edit option"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {values.filter((v) => v.status === 'ACTIVE').length} of {values.length} options active
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
