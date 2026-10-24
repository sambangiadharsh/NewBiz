import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';

interface CreateUOMModalProps {
  uom?: {
    uomId: number;
    uomCode: string;
    uomName: string;
    uomType: string;
    decimalPrecision: number;
    status: 'ACTIVE' | 'INACTIVE';
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateUOMModal: React.FC<CreateUOMModalProps> = ({
  uom,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(uom);
  const [uomCode, setUomCode] = useState(uom?.uomCode || '');
  const [uomName, setUomName] = useState(uom?.uomName || '');
  const [uomType, setUomType] = useState<string>(uom?.uomType || 'WEIGHT');
  const [decimalPrecision, setDecimalPrecision] = useState<number>(uom?.decimalPrecision ?? 2);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(uom?.status || 'ACTIVE');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uom) {
      setUomCode(uom.uomCode);
      setUomName(uom.uomName);
      setUomType(uom.uomType);
      setDecimalPrecision(uom.decimalPrecision);
      setStatus(uom.status);
    }
  }, [uom]);

  const uomTypes = [
    { value: 'WEIGHT', label: 'Weight & Mass (e.g. KG, G, LB)', defaultPrec: 3 },
    { value: 'VOLUME', label: 'Volume & Capacity (e.g. L, ML, GAL)', defaultPrec: 2 },
    { value: 'LENGTH', label: 'Length & Dimensions (e.g. M, CM, MM, IN)', defaultPrec: 2 },
    { value: 'COUNT', label: 'Count & Discrete Items (e.g. PC, SET, PACK)', defaultPrec: 0 },
    { value: 'AREA', label: 'Surface Area (e.g. SQM, SQFT)', defaultPrec: 2 },
    { value: 'DIMENSION', label: 'Packaging Dimensions', defaultPrec: 2 },
  ];

  const handleTypeChange = (newType: string) => {
    setUomType(newType);
    const def = uomTypes.find((t) => t.value === newType);
    if (def && !isEdit) {
      setDecimalPrecision(def.defaultPrec);
    }
  };

  const getSamplePreview = () => {
    const num = 12.34567;
    const formatted = num.toFixed(decimalPrecision);
    return `${formatted} ${uomCode.trim() || 'UNIT'}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uomCode.trim() || !uomName.trim()) {
      setError('UOM code and name are both required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && uom) {
        await apiClient.put(`/admin/catalog/uom/${uom.uomId}`, {
          uomCode: uomCode.trim().toUpperCase(),
          uomName: uomName.trim(),
          uomType,
          decimalPrecision: Number(decimalPrecision),
          status,
        });
      } else {
        await apiClient.post('/admin/catalog/uom', {
          uomCode: uomCode.trim().toUpperCase(),
          uomName: uomName.trim(),
          uomType,
          decimalPrecision: Number(decimalPrecision),
          status,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save Unit of Measure');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {isEdit ? 'Edit Unit of Measure (UOM)' : 'Configure Unit of Measure (UOM)'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Standard measurement definition for catalog packaging and dimensions
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
        <form onSubmit={handleSubmit} className="p-7 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                UOM Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. KG, L, PC, CM"
                value={uomCode}
                onChange={(e) => setUomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                autoFocus
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Short abbreviation</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Unit Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Kilogram, Litre, Piece"
                value={uomName}
                onChange={(e) => setUomName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Human-readable name</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Measurement Classification <span className="text-rose-500">*</span>
            </label>
            <select
              value={uomType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            >
              {uomTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Decimal Precision */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Decimal Precision (Rounding)
              </label>
              <span className="text-xs font-mono font-extrabold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                {decimalPrecision} decimal places
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              value={decimalPrecision}
              onChange={(e) => setDecimalPrecision(Number(e.target.value))}
              className="w-full accent-violet-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0 (Whole integer, e.g. Count)</span>
              <span>2 (Standard)</span>
              <span>5 (High precision)</span>
            </div>
          </div>

          {/* Live Precision Preview Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <div>
                <span className="text-[11px] font-bold text-violet-900 block">
                  Live Formatting Preview
                </span>
                <span className="text-[10px] text-violet-700 font-medium">
                  How numbers in this UOM render on listings & dispatch slips
                </span>
              </div>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-white text-slate-900 font-mono font-black text-xs shadow-xs border border-violet-200">
              {getSamplePreview()}
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
                ACTIVE
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
                INACTIVE
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
              disabled={submitting || !uomCode.trim() || !uomName.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-600/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isEdit ? (
                'Save Changes'
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Create Unit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
