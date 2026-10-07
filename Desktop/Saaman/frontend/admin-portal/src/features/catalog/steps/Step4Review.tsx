import React from 'react';
import {
  CheckCircle2,
  Building2,
  Hash,
  Percent,
  Layers,
  Sparkles,
  Sliders,
  FileCheck,
  Globe,
  Archive,
} from 'lucide-react';
import { CreateProductFormState } from '../../../types/product.js';

interface Step4ReviewProps {
  state: CreateProductFormState;
  setField: <K extends keyof CreateProductFormState>(
    field: K,
    value: CreateProductFormState[K]
  ) => void;
  brandName?: string;
  categoryPath?: string;
}

export const Step4Review: React.FC<Step4ReviewProps> = ({
  state,
  setField,
  brandName = 'Selected Brand',
  categoryPath = 'Category',
}) => {
  const getFullAssetUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(
      /\/api\/v1\/?$/,
      ''
    );
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const filledSpecs = state.specifications.filter(
    (s) => Boolean(s.attributeValue?.trim() || s.attributeValueId)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Overview Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>{brandName}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">{categoryPath}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{state.productName}</h2>
            {state.description && (
              <p className="text-xs text-slate-600 mt-2 max-w-2xl line-clamp-3 leading-relaxed">
                {state.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 self-start bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>Admin Verified</span>
          </div>
        </div>

        {/* Highlights */}
        {state.highlights.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Key Highlights:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {state.highlights.map((h, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg font-medium"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tax & Model Classification Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Hash className="w-3 h-3 text-slate-400" />
              Base Model Code
            </div>
            <div className="text-xs font-mono font-semibold text-slate-900">
              {state.baseModelCode || <span className="text-slate-400 font-normal">None</span>}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Hash className="w-3 h-3 text-slate-400" />
              HSN Code (GST)
            </div>
            <div className="text-xs font-mono font-semibold text-slate-900">
              {state.hsnCode || <span className="text-slate-400 font-normal">None</span>}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Percent className="w-3 h-3 text-slate-400" />
              GST Tax Rate
            </div>
            <div className="text-xs font-mono font-semibold text-slate-900">
              {state.gstRate !== '' ? `${state.gstRate}%` : <span className="text-slate-400 font-normal">None</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Specifications Summary */}
      {filledSpecs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Technical Specifications ({filledSpecs.length})
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
            {filledSpecs.map((spec) => (
              <div key={spec.attributeId} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] text-slate-500 font-medium">{spec.attributeName}</div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  {spec.attributeValue}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Variants Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Configured Variants ({state.variants.length})
            </h3>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {state.variants.map((v) => {
            const primary = v.assets.find((a) => a.isPrimary) || v.assets[0];
            return (
              <div key={v._id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                    {primary ? (
                      <img
                        src={primary._previewUrl || getFullAssetUrl(primary.assetUrl)}
                        alt={v._label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Layers className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{v._label}</div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-2 mt-0.5">
                      {v.variantModelCode && (
                        <span>Model: <span className="font-mono text-slate-800">{v.variantModelCode}</span></span>
                      )}
                      {v.gtin && (
                        <span>GTIN: <span className="font-mono text-indigo-600">{v.gtin}</span></span>
                      )}
                      {v.weight && <span>Weight: {v.weight}kg</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <span className="text-[11px] text-slate-400">
                    {v.assets.length} image{v.assets.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Ready
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Publishing Status Selection */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <FileCheck className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Initial Publishing Status
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label
            onClick={() => setField('initialStatus', 'ACTIVE')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
              state.initialStatus === 'ACTIVE'
                ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/10'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="initialStatus"
              checked={state.initialStatus === 'ACTIVE'}
              onChange={() => setField('initialStatus', 'ACTIVE')}
              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                <span>Publish Immediately (ACTIVE)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Pre-approved &amp; pre-verified. Product becomes immediately available in catalog search for sellers to bind inventory.
              </p>
            </div>
          </label>

          <label
            onClick={() => setField('initialStatus', 'DRAFT')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
              state.initialStatus === 'DRAFT'
                ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/10'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="initialStatus"
              checked={state.initialStatus === 'DRAFT'}
              onChange={() => setField('initialStatus', 'DRAFT')}
              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5 text-slate-500" />
                <span>Save as Draft (DRAFT)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Stored in catalog master for internal review and further enrichment before releasing to the live marketplace.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
