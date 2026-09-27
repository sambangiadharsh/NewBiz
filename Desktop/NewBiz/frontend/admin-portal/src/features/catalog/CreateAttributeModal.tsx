import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  RefreshCw,
  AlertCircle,
  Type,
  Binary,
  ToggleLeft,
  ListFilter,
  Check,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface CreateAttributeModalProps {
  attribute?: {
    attributeId: number;
    attributeName: string;
    dataType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'OPTIONS';
    status: 'ACTIVE' | 'INACTIVE';
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateAttributeModal: React.FC<CreateAttributeModalProps> = ({
  attribute,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(attribute);
  const [attributeName, setAttributeName] = useState(attribute?.attributeName || '');
  const [dataType, setDataType] = useState<'STRING' | 'NUMBER' | 'BOOLEAN' | 'OPTIONS'>(
    attribute?.dataType || 'OPTIONS'
  );
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(attribute?.status || 'ACTIVE');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attribute) {
      setAttributeName(attribute.attributeName);
      setDataType(attribute.dataType);
      setStatus(attribute.status);
    }
  }, [attribute]);

  const dataTypes = [
    {
      type: 'OPTIONS' as const,
      label: 'Standardized Options',
      icon: ListFilter,
      desc: 'Multiple selectable options with fixed codes (e.g. Colors, Sizes, Storage). Required for variant defining specs.',
      badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
    },
    {
      type: 'STRING' as const,
      label: 'Free Text',
      icon: Type,
      desc: 'Arbitrary text values entered per product (e.g. Model Code, Warranty Details, Material finish).',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      type: 'NUMBER' as const,
      label: 'Numeric Value',
      icon: Binary,
      desc: 'Pure numbers without unit calculations (e.g. Number of Ports, Pieces per Pack).',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      type: 'BOOLEAN' as const,
      label: 'Yes / No Flag',
      icon: ToggleLeft,
      desc: 'True/false compliance features (e.g. Induction Compatible, BPA Free, Waterproof).',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attributeName.trim()) {
      setError('Attribute name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && attribute) {
        await apiClient.put(`/admin/catalog/attributes/${attribute.attributeId}`, {
          attributeName: attributeName.trim(),
          dataType,
          status,
        });
      } else {
        await apiClient.post('/admin/catalog/attributes', {
          attributeName: attributeName.trim(),
          dataType,
          status,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save attribute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {isEdit ? 'Edit Specification Attribute' : 'Define New Specification Attribute'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Specification metadata used across product categories and variants
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-7 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Attribute Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Attribute Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Color, Storage Capacity, Material, Power Rating"
              value={attributeName}
              onChange={(e) => setAttributeName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              autoFocus
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Clear, seller-friendly name shown on catalog product forms.
            </span>
          </div>

          {/* Data Type Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Specification Data Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dataTypes.map((dt) => {
                const Icon = dt.icon;
                const isSelected = dataType === dt.type;
                return (
                  <div
                    key={dt.type}
                    onClick={() => setDataType(dt.type)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-violet-600 bg-violet-50/50 shadow-sm shadow-violet-600/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">{dt.label}</span>
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{dt.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Operational Status</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStatus('ACTIVE')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 border border-transparent'
                }`}
              >
                ACTIVE (Available for Categories)
              </button>
              <button
                type="button"
                onClick={() => setStatus('INACTIVE')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  status === 'INACTIVE'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 border border-transparent'
                }`}
              >
                INACTIVE (Hidden)
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !attributeName.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-600/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isEdit ? (
                'Save Changes'
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Create Attribute
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
