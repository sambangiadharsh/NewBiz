import React, { useState, useEffect } from 'react';
import { Sliders, CheckCircle2, Asterisk, Loader2, AlertCircle } from 'lucide-react';
import { CreateProductFormState, SpecEntry, AttributeValue } from '../../../types/product.js';
import { apiClient } from '../../../lib/axios.js';
import { FeatureTagInput } from '../components/FeatureTagInput.js';

interface Step2SpecificationsProps {
  state: CreateProductFormState;
  updateSpec: (attributeId: string, partial: Partial<SpecEntry>) => void;
}

/**
 * Normalizes attribute data types strictly into 4 canonical types:
 * - OPTIONS: Fixed choices with predefined values (Dropdown / Select)
 * - BOOLEAN: True / False (Radio buttons)
 * - NUMBER: Numeric values (Number input)
 * - STRING: Freeform text (Text input)
 */
export const getResolvedDataType = (
  dataType?: string,
  attributeType?: string
): 'OPTIONS' | 'BOOLEAN' | 'NUMBER' | 'STRING' => {
  const raw = (dataType || attributeType || 'STRING').toUpperCase().trim();
  if (raw === 'OPTIONS' || raw === 'ENUM' || raw === 'SELECT' || raw === 'DROPDOWN') {
    return 'OPTIONS';
  }
  if (raw === 'BOOLEAN' || raw === 'BOOL') {
    return 'BOOLEAN';
  }
  if (
    raw === 'NUMBER' ||
    raw === 'NUMERIC' ||
    raw === 'INT' ||
    raw === 'DECIMAL' ||
    raw === 'FLOAT'
  ) {
    return 'NUMBER';
  }
  // Default to STRING (Free Text)
  return 'STRING';
};

export const Step2Specifications: React.FC<Step2SpecificationsProps> = ({
  state,
  updateSpec,
}) => {
  const specs = state.specifications;
  const requiredSpecs = specs.filter((s) => s.isRequired);
  const optionalSpecs = specs.filter((s) => !s.isRequired);

  // Fallback cache for attributes strictly of type OPTIONS needing on-demand value fetching
  const [optionsCache, setOptionsCache] = useState<Record<string, AttributeValue[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  // Auto-fetch values ONLY for attributes with resolvedType === 'OPTIONS'
  useEffect(() => {
    specs.forEach((spec) => {
      const resolvedType = getResolvedDataType(spec.dataType, spec.attributeType);

      // Only OPTIONS attributes should fetch option choices; STRING/NUMBER/BOOLEAN must not!
      if (resolvedType !== 'OPTIONS') return;

      const hasValues =
        (spec.values && spec.values.length > 0) ||
        (optionsCache[spec.attributeId] && optionsCache[spec.attributeId].length > 0);

      if (!hasValues && !loadingOptions[spec.attributeId]) {
        setLoadingOptions((prev) => ({ ...prev, [spec.attributeId]: true }));
        apiClient
          .get(`/admin/catalog/attributes/${spec.attributeId}/values`)
          .then((res) => {
            if (res.data?.success) {
              const fetchedValues: AttributeValue[] = (res.data.data || []).map((v: any) => ({
                attributeValueId: String(v.attributeValueId || v.valueId || v.AttributeValueID || ''),
                valueName: v.valueName || v.ValueName || '',
                valueCode: v.valueCode || v.ValueCode || '',
              }));
              setOptionsCache((prev) => ({ ...prev, [spec.attributeId]: fetchedValues }));
              updateSpec(spec.attributeId, { values: fetchedValues });
            }
          })
          .catch((err) => {
            console.error(`Failed to fetch values for attribute ${spec.attributeId}:`, err);
          })
          .finally(() => {
            setLoadingOptions((prev) => ({ ...prev, [spec.attributeId]: false }));
          });
      }
    });
  }, [specs]);

  const renderInput = (spec: SpecEntry) => {
    const resolvedType = getResolvedDataType(spec.dataType, spec.attributeType);

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. OPTIONS: Standardized dropdown selection
    // ─────────────────────────────────────────────────────────────────────────────
    if (resolvedType === 'OPTIONS') {
      const availableValues: AttributeValue[] =
        (spec.values && spec.values.length > 0
          ? spec.values
          : optionsCache[spec.attributeId]) || [];
      const isLoading = Boolean(loadingOptions[spec.attributeId]);

      if (isLoading) {
        return (
          <div className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-400 font-medium flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            <span>Loading choices for {spec.attributeName}...</span>
          </div>
        );
      }

      if (availableValues.length === 0) {
        return (
          <div className="space-y-1">
            <select
              disabled
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-400 font-medium cursor-not-allowed"
            >
              <option>No options configured in catalog</option>
            </select>
            <div className="flex items-center gap-1 text-[10px] text-amber-700">
              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Configure options in Catalog &gt; Specification Attributes &gt; Manage Values.</span>
            </div>
          </div>
        );
      }

      // Match selected option by attributeValueId or valueName
      const currentSelectedId =
        spec.attributeValueId ||
        availableValues.find(
          (v) =>
            v.valueName.toLowerCase() === (spec.attributeValue || '').toLowerCase()
        )?.attributeValueId ||
        '';

      return (
        <select
          value={currentSelectedId}
          onChange={(e) => {
            const valId = e.target.value;
            const chosen = availableValues.find(
              (v) =>
                String(v.attributeValueId || (v as any).valueId || (v as any).AttributeValueID) === valId
            );
            updateSpec(spec.attributeId, {
              attributeValueId: valId,
              attributeValue: chosen?.valueName || '',
            });
          }}
          className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800 cursor-pointer shadow-xs"
        >
          <option value="">Select {spec.attributeName}...</option>
          {availableValues.map((v) => {
            const id = String(v.attributeValueId || (v as any).valueId || (v as any).AttributeValueID || '');
            return (
              <option key={id} value={id}>
                {v.valueName} {v.valueCode ? `(${v.valueCode})` : ''}
              </option>
            );
          })}
        </select>
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. BOOLEAN: Yes / No Radio Buttons
    // ─────────────────────────────────────────────────────────────────────────────
    if (resolvedType === 'BOOLEAN') {
      const isYes =
        spec.attributeValue === 'true' ||
        spec.attributeValue === 'Yes' ||
        spec.attributeValue === '1';
      const isNo =
        spec.attributeValue === 'false' ||
        spec.attributeValue === 'No' ||
        spec.attributeValue === '0';

      return (
        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
            <input
              type="radio"
              name={`bool_${spec.attributeId}`}
              checked={isYes}
              onChange={() =>
                updateSpec(spec.attributeId, {
                  attributeValue: 'true',
                  attributeValueId: undefined,
                })
              }
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span>Yes</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
            <input
              type="radio"
              name={`bool_${spec.attributeId}`}
              checked={isNo}
              onChange={() =>
                updateSpec(spec.attributeId, {
                  attributeValue: 'false',
                  attributeValueId: undefined,
                })
              }
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span>No</span>
          </label>
        </div>
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. NUMBER: Numeric Input
    // ─────────────────────────────────────────────────────────────────────────────
    if (resolvedType === 'NUMBER') {
      return (
        <input
          type="number"
          step="any"
          value={spec.attributeValue || ''}
          onChange={(e) =>
            updateSpec(spec.attributeId, {
              attributeValue: e.target.value,
              attributeValueId: undefined,
            })
          }
          placeholder={`Enter numeric ${spec.attributeName}`}
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs"
        />
      );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. STRING: Freeform Text or Multi-line Textarea
    // ─────────────────────────────────────────────────────────────────────────────
    const isMultiline =
      spec.attributeName.toLowerCase().includes('care') ||
      spec.attributeName.toLowerCase().includes('instruction') ||
      spec.attributeName.toLowerCase().includes('direction') ||
      spec.attributeName.toLowerCase().includes('maintenance') ||
      spec.attributeName.toLowerCase().includes('safety') ||
      spec.attributeName.toLowerCase().includes('warning') ||
      (typeof spec.attributeValue === 'string' && spec.attributeValue.includes('\n'));

    if (isMultiline) {
      const currentTags =
        typeof spec.attributeValue === 'string'
          ? spec.attributeValue
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      return (
        <FeatureTagInput
          tags={currentTags}
          onChange={(newTags) =>
            updateSpec(spec.attributeId, {
              attributeValue: newTags.join('\n'),
              attributeValueId: undefined,
            })
          }
          maxTags={10}
          showLabel={false}
          placeholder={`Type ${spec.attributeName.toLowerCase()} & press Enter (e.g. Machine wash cold)...`}
          helperText="Type instruction & press Enter or comma to create bullet points."
        />
      );
    }

    return (
      <input
        type="text"
        value={spec.attributeValue || ''}
        onChange={(e) =>
          updateSpec(spec.attributeId, {
            attributeValue: e.target.value,
            attributeValueId: undefined,
          })
        }
        placeholder={`Enter ${spec.attributeName}`}
        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs"
      />
    );
  };

  if (specs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">No Master Specifications Required</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          The selected category does not have predefined technical specifications. You can proceed directly to defining variants.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Required Specifications */}
      {requiredSpecs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Mandatory Specifications</h3>
            </div>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {requiredSpecs.length} Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredSpecs.map((spec) => {
              const isFilled = Boolean(spec.attributeValue?.trim() || spec.attributeValueId);
              const resolvedType = getResolvedDataType(spec.dataType, spec.attributeType);

              return (
                <div
                  key={spec.attributeId}
                  className={`p-3.5 rounded-xl border transition-all space-y-1.5 ${
                    isFilled ? 'bg-white border-slate-200' : 'bg-amber-50/30 border-amber-200'
                  }`}
                >
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      {spec.attributeName}
                      <Asterisk className="w-3 h-3 text-red-500" />
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">
                      {resolvedType}
                    </span>
                  </label>
                  {renderInput(spec)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional Specifications */}
      {optionalSpecs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Recommended & Additional Specifications</h3>
            </div>
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {optionalSpecs.length} Optional
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optionalSpecs.map((spec) => {
              const resolvedType = getResolvedDataType(spec.dataType, spec.attributeType);

              return (
                <div key={spec.attributeId} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>{spec.attributeName}</span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">
                      {resolvedType}
                    </span>
                  </label>
                  {renderInput(spec)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
