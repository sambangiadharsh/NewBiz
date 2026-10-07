import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Barcode,
  Package,
  Ruler,
  Copy,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  VariantEntry,
  ResolvedAttributes,
  UOM,
  VariantAssetEntry,
  VariantAttributeValue,
  AttributeValue,
} from '../../../types/product.js';
import { ImageUploader } from './ImageUploader.js';
import { showSweetToast } from '../../../lib/swal.js';
import { apiClient } from '../../../lib/axios.js';
import { getResolvedDataType } from '../steps/Step2Specifications.js';

interface VariantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  variant: VariantEntry | null;
  onSave: (variant: VariantEntry) => void;
  resolvedAttributes: ResolvedAttributes | null;
  uoms: UOM[];
  existingVariants: VariantEntry[];
}

export const VariantDrawer: React.FC<VariantDrawerProps> = ({
  isOpen,
  onClose,
  variant,
  onSave,
  resolvedAttributes,
  uoms,
  existingVariants,
}) => {
  // Local drawer state
  const [attributeValues, setAttributeValues] = useState<VariantAttributeValue[]>([]);
  const [gtin, setGtin] = useState('');
  const [variantModelCode, setVariantModelCode] = useState('');
  const [length, setLength] = useState<number | ''>('');
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [selectedUomId, setSelectedUomId] = useState<string>('');
  const [uomQuantity, setUomQuantity] = useState<number>(1);
  const [assets, setAssets] = useState<VariantAssetEntry[]>([]);

  // On-demand cache for variant-defining attribute choices
  const [optionsCache, setOptionsCache] = useState<Record<string, AttributeValue[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  // Fetch option values strictly for attributes of type OPTIONS
  useEffect(() => {
    if (!isOpen) return;

    const vdas = resolvedAttributes?.variantDefining || [];
    vdas.forEach((attr) => {
      const resolvedType = getResolvedDataType(attr.dataType, attr.attributeType);
      // ONLY fetch for OPTIONS! Never fetch for STRING, NUMBER, or BOOLEAN!
      if (resolvedType !== 'OPTIONS') return;

      const hasValues =
        (attr.values && attr.values.length > 0) ||
        (optionsCache[attr.attributeId] && optionsCache[attr.attributeId].length > 0);

      if (!hasValues && !loadingOptions[attr.attributeId]) {
        setLoadingOptions((prev) => ({ ...prev, [attr.attributeId]: true }));
        apiClient
          .get(`/admin/catalog/attributes/${attr.attributeId}/values`)
          .then((res) => {
            if (res.data?.success) {
              const fetched: AttributeValue[] = (res.data.data || []).map((v: any) => ({
                attributeValueId: String(v.attributeValueId || v.valueId || v.AttributeValueID || ''),
                valueName: v.valueName || v.ValueName || '',
                valueCode: v.valueCode || v.ValueCode || '',
              }));
              setOptionsCache((prev) => ({ ...prev, [attr.attributeId]: fetched }));
            }
          })
          .catch((err) => {
            console.error(`Failed to fetch values for attribute ${attr.attributeId}:`, err);
          })
          .finally(() => {
            setLoadingOptions((prev) => ({ ...prev, [attr.attributeId]: false }));
          });
      }
    });
  }, [isOpen, resolvedAttributes]);

  // Initialize form when variant changes or opens
  useEffect(() => {
    if (!isOpen) return;

    if (variant) {
      setAttributeValues(variant.attributeValues || []);
      setGtin(variant.gtin || '');
      setVariantModelCode(variant.variantModelCode || '');
      setLength(variant.length ?? '');
      setWidth(variant.width ?? '');
      setHeight(variant.height ?? '');
      setWeight(variant.weight ?? '');
      setCapacity(variant.capacity ?? '');
      setAssets(variant.assets || []);
      if (variant.uoms && variant.uoms.length > 0) {
        setSelectedUomId(variant.uoms[0].uomId);
        setUomQuantity(variant.uoms[0].quantity || 1);
      } else if (uoms.length > 0) {
        setSelectedUomId(uoms[0].uomId);
        setUomQuantity(1);
      }
    } else {
      // New variant: initialize attribute values with empty
      const initialAttrs: VariantAttributeValue[] = (
        resolvedAttributes?.variantDefining || []
      ).map((attr) => ({
        attributeId: attr.attributeId,
        attributeValueId: '',
        valueName: '',
        attributeName: attr.attributeName,
      }));
      setAttributeValues(initialAttrs);
      setGtin('');
      setVariantModelCode('');
      setLength('');
      setWidth('');
      setHeight('');
      setWeight('');
      setCapacity('');
      setAssets([]);
      setSelectedUomId(uoms[0]?.uomId || '');
      setUomQuantity(1);
    }
  }, [isOpen, variant, resolvedAttributes, uoms]);

  if (!isOpen) return null;

  // Handle Quick Clone from existing variant
  const handleCopyFromExisting = (sourceId: string) => {
    const source = existingVariants.find((v) => v._id === sourceId);
    if (!source) return;

    setLength(source.length);
    setWidth(source.width);
    setHeight(source.height);
    setWeight(source.weight);
    setCapacity(source.capacity);
    if (source.uoms && source.uoms.length > 0) {
      setSelectedUomId(source.uoms[0].uomId);
      setUomQuantity(source.uoms[0].quantity);
    }
    showSweetToast(`Copied dimensions and packaging from ${source._label}`, 'info');
  };

  const handleAttrChange = (
    attributeId: string,
    attributeValueId: string,
    valueName: string,
    attributeName: string
  ) => {
    setAttributeValues((prev) => {
      const idx = prev.findIndex((a) => a.attributeId === attributeId);
      const updatedItem: VariantAttributeValue = {
        attributeId,
        attributeValueId,
        valueName,
        attributeName,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedItem;
        return next;
      }
      return [...prev, updatedItem];
    });
  };

  const handleSave = () => {
    // 1. Validate that all variant defining attributes have been chosen/entered
    const variantDefiningAttrs = resolvedAttributes?.variantDefining || [];
    for (const vda of variantDefiningAttrs) {
      const val = attributeValues.find((av) => av.attributeId === vda.attributeId);
      const isFilled = Boolean(val?.attributeValueId?.trim() || val?.valueName?.trim());
      if (!isFilled) {
        showSweetToast(`Please enter or select a value for "${vda.attributeName}".`, 'warning');
        return;
      }
    }

    // 2. Build human-readable label (e.g. "Black / Size 9")
    const labelParts = attributeValues
      .filter((av) => av.valueName)
      .map((av) => av.valueName);
    const label = labelParts.length > 0 ? labelParts.join(' / ') : 'Standard Variant';

    // 3. Check for duplicates in other variants
    const isDuplicate = existingVariants.some((ev) => {
      if (variant && ev._id === variant._id) return false;
      if (ev.attributeValues.length !== attributeValues.length) return false;
      return ev.attributeValues.every((evAttr) =>
        attributeValues.some(
          (curr) =>
            curr.attributeId === evAttr.attributeId &&
            curr.attributeValueId === evAttr.attributeValueId
        )
      );
    });

    if (isDuplicate) {
      showSweetToast(`A variant with "${label}" already exists.`, 'error');
      return;
    }

    // 4. Construct variant entry
    const savedVariant: VariantEntry = {
      _id: variant?._id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
      attributeValues,
      gtin: gtin.trim(),
      variantModelCode: variantModelCode.trim(),
      length: length !== '' ? Number(length) : '',
      width: width !== '' ? Number(width) : '',
      height: height !== '' ? Number(height) : '',
      weight: weight !== '' ? Number(weight) : '',
      capacity: capacity !== '' ? Number(capacity) : '',
      uoms: selectedUomId ? [{ uomId: selectedUomId, quantity: Number(uomQuantity) || 1 }] : [],
      assets,
      _label: label,
      _completeness: assets.length > 0 ? 'ready' : 'incomplete',
    };

    onSave(savedVariant);
    onClose();
  };

  const variantDefiningAttrs = resolvedAttributes?.variantDefining || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              {variant ? 'Edit Product Variant' : 'Create New Variant'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify defining attributes, manufacturer part codes, measurements & photos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clone Shortcut */}
        {existingVariants.length > 0 && !variant && (
          <div className="px-5 py-2.5 bg-indigo-50/60 border-b border-indigo-100/60 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-indigo-900 font-medium">
              <Copy className="w-3.5 h-3.5 text-indigo-600" />
              Copy specs & dimensions from:
            </span>
            <select
              className="bg-white border border-indigo-200 text-xs rounded-lg px-2 py-1 outline-none text-slate-700 font-medium"
              onChange={(e) => {
                if (e.target.value) handleCopyFromExisting(e.target.value);
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Select variant...
              </option>
              {existingVariants.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev._label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. Variant-Defining Attributes */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Variant Options ({variantDefiningAttrs.length})
            </div>

            {variantDefiningAttrs.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                This category has no variant-defining attributes. A standard variant will be created.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {variantDefiningAttrs.map((attr) => {
                  const resolvedType = getResolvedDataType(attr.dataType, attr.attributeType);
                  const availableValues: AttributeValue[] =
                    (attr.values && attr.values.length > 0
                      ? attr.values
                      : optionsCache[attr.attributeId]) || [];

                  const isLoading = Boolean(loadingOptions[attr.attributeId]);

                  const currentAttrEntry = attributeValues.find(
                    (av) => av.attributeId === attr.attributeId
                  );
                  const currentValId = currentAttrEntry?.attributeValueId || '';
                  const currentValText = currentAttrEntry?.valueName || '';

                  return (
                    <div key={attr.attributeId} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span>{attr.attributeName}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-mono uppercase">
                            {resolvedType}
                          </span>
                          <span className="text-red-500 font-bold">*</span>
                        </div>
                      </label>

                      {/* 1. OPTIONS: Dropdown */}
                      {resolvedType === 'OPTIONS' && (
                        isLoading ? (
                          <div className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-400 font-medium flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                            <span>Loading choices...</span>
                          </div>
                        ) : availableValues.length === 0 ? (
                          <div className="space-y-1">
                            <select
                              disabled
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-400 font-medium cursor-not-allowed"
                            >
                              <option>No options configured for {attr.attributeName}</option>
                            </select>
                            <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>Add options in Catalog &gt; Specification Attributes.</span>
                            </p>
                          </div>
                        ) : (
                          <select
                            value={currentValId || availableValues.find((v) => v.valueName === currentValText)?.attributeValueId || ''}
                            onChange={(e) => {
                              const opt = availableValues.find(
                                (v) =>
                                  String(v.attributeValueId || (v as any).valueId || (v as any).AttributeValueID) ===
                                  e.target.value
                              );
                              handleAttrChange(
                                attr.attributeId,
                                e.target.value,
                                opt?.valueName || (opt as any)?.ValueName || '',
                                attr.attributeName
                              );
                            }}
                            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800 cursor-pointer shadow-xs"
                          >
                            <option value="">Select {attr.attributeName}...</option>
                            {availableValues.map((val) => {
                              const valId = String(
                                val.attributeValueId || (val as any).valueId || (val as any).AttributeValueID || ''
                              );
                              const valName = val.valueName || (val as any).ValueName || '';
                              const valCode = val.valueCode || (val as any).ValueCode || '';
                              return (
                                <option key={valId} value={valId}>
                                  {valName} {valCode ? `(${valCode})` : ''}
                                </option>
                              );
                            })}
                          </select>
                        )
                      )}

                      {/* 2. BOOLEAN: Yes / No Radio */}
                      {resolvedType === 'BOOLEAN' && (
                        <div className="flex items-center gap-3 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                            <input
                              type="radio"
                              name={`var_bool_${attr.attributeId}`}
                              checked={currentValText === 'true' || currentValText === 'Yes'}
                              onChange={() =>
                                handleAttrChange(attr.attributeId, '', 'Yes', attr.attributeName)
                              }
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                            <input
                              type="radio"
                              name={`var_bool_${attr.attributeId}`}
                              checked={currentValText === 'false' || currentValText === 'No'}
                              onChange={() =>
                                handleAttrChange(attr.attributeId, '', 'No', attr.attributeName)
                              }
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      )}

                      {/* 3. NUMBER: Numeric Input */}
                      {resolvedType === 'NUMBER' && (
                        <input
                          type="number"
                          step="any"
                          value={currentValText}
                          onChange={(e) =>
                            handleAttrChange(attr.attributeId, '', e.target.value, attr.attributeName)
                          }
                          placeholder={`Enter numeric ${attr.attributeName}`}
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                        />
                      )}

                      {/* 4. STRING: Freeform Text Input */}
                      {resolvedType === 'STRING' && (
                        <input
                          type="text"
                          value={currentValText}
                          onChange={(e) =>
                            handleAttrChange(attr.attributeId, '', e.target.value, attr.attributeName)
                          }
                          placeholder={`Enter ${attr.attributeName}`}
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Part Codes & Identifiers */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Barcode className="w-3.5 h-3.5 text-indigo-500" />
              Codes & Barcode
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Variant Model Code
                </label>
                <input
                  type="text"
                  value={variantModelCode}
                  onChange={(e) => setVariantModelCode(e.target.value)}
                  placeholder="e.g. AH8050-002"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Manufacturer specific color/variant code
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  GTIN / Barcode (EAN / UPC)
                </label>
                <input
                  type="text"
                  value={gtin}
                  onChange={(e) => setGtin(e.target.value)}
                  placeholder="e.g. 888407481234"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Standard 8, 12, 13, or 14-digit retail barcode
                </span>
              </div>
            </div>
          </div>

          {/* 3. Physical Specs & Dimensions */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Ruler className="w-3.5 h-3.5 text-indigo-500" />
              Dimensions & Weight (Shipping/Logistics)
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Length (cm)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={length}
                  onChange={(e) =>
                    setLength(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.0"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Width (cm)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={width}
                  onChange={(e) =>
                    setWidth(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.0"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Height (cm)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={height}
                  onChange={(e) =>
                    setHeight(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.0"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Weight (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={weight}
                  onChange={(e) =>
                    setWeight(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="e.g. 0.85"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Capacity / Volume (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={capacity}
                  onChange={(e) =>
                    setCapacity(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="e.g. 3.0"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 4. Unit of Measure (UOM) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Package className="w-3.5 h-3.5 text-indigo-500" />
              Packaging Unit (UOM)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Unit Type</label>
                <select
                  value={selectedUomId}
                  onChange={(e) => setSelectedUomId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
                >
                  <option value="">Select UOM...</option>
                  {uoms.map((u) => (
                    <option key={u.uomId} value={u.uomId}>
                      {u.uomName} ({u.uomCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Pack Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={uomQuantity}
                  onChange={(e) => setUomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 5. Variant Images */}
          <div className="pt-2 border-t border-slate-100">
            <ImageUploader assets={assets} onChange={setAssets} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:opacity-90 rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save Variant</span>
          </button>
        </div>
      </div>
    </div>
  );
};
