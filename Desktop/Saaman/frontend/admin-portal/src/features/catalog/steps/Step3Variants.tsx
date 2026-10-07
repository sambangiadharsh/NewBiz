import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Barcode,
  Package,
  Ruler,
} from 'lucide-react';
import {
  CreateProductFormState,
  VariantEntry,
  UOM,
} from '../../../types/product.js';
import { VariantDrawer } from '../components/VariantDrawer.js';
import { apiClient } from '../../../lib/axios.js';
import { confirmProceed, showSweetToast } from '../../../lib/swal.js';

interface Step3VariantsProps {
  state: CreateProductFormState;
  setVariants?: (variants: VariantEntry[]) => void;
  addVariant: (variant: VariantEntry) => void;
  updateVariant: (id: string, partial: Partial<VariantEntry>) => void;
  removeVariant: (id: string) => void;
  duplicateVariant: (id: string) => void;
}

export const Step3Variants: React.FC<Step3VariantsProps> = ({
  state,
  setVariants,
  addVariant,
  updateVariant,
  removeVariant,
  duplicateVariant,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantEntry | null>(null);
  const [uoms, setUoms] = useState<UOM[]>([]);

  // Bulk Apply Dimensions & Weight state
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [bulkLength, setBulkLength] = useState<number | ''>('');
  const [bulkWidth, setBulkWidth] = useState<number | ''>('');
  const [bulkHeight, setBulkHeight] = useState<number | ''>('');
  const [bulkWeight, setBulkWeight] = useState<number | ''>('');

  // Fetch UOMs once
  useEffect(() => {
    let isMounted = true;
    const fetchUOMs = async () => {
      try {
        const res = await apiClient.get('/catalog/uoms');
        if (res.data?.success && isMounted) {
          setUoms(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load UOMs', err);
      }
    };
    fetchUOMs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Bulk Apply Dimensions & Weight to all existing variants
  const handleApplyBulkDimensions = () => {
    if (!setVariants || state.variants.length === 0) {
      showSweetToast('No variants to update.', 'warning');
      return;
    }

    const updated = state.variants.map((v) => ({
      ...v,
      length: bulkLength !== '' ? bulkLength : v.length,
      width: bulkWidth !== '' ? bulkWidth : v.width,
      height: bulkHeight !== '' ? bulkHeight : v.height,
      weight: bulkWeight !== '' ? bulkWeight : v.weight,
    }));

    setVariants(updated);
    showSweetToast('Dimensions and weight applied across all variants!', 'success');
  };

  const handleOpenCreate = () => {
    setEditingVariant(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (v: VariantEntry) => {
    setEditingVariant(v);
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string, label: string) => {
    const ok = await confirmProceed({
      title: 'Remove Variant?',
      text: `Are you sure you want to delete variant "${label}"?`,
      confirmButtonText: 'Yes, Delete',
      icon: 'warning',
    });
    if (ok) {
      removeVariant(id);
    }
  };

  const handleDrawerSave = (savedVariant: VariantEntry) => {
    if (editingVariant) {
      updateVariant(editingVariant._id, savedVariant);
    } else {
      addVariant(savedVariant);
    }
  };

  const getFullAssetUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(
      /\/api\/v1\/?$/,
      ''
    );
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Variants Header & Primary Add Action */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            Product Variants ({state.variants.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure sellable SKUs for this product. Click &quot;Add Variant&quot; to define variant options, barcodes, packaging, and photos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:opacity-95 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Variant</span>
        </button>
      </div>

      {/* 2. Optional Bulk Dimensions Tool (when multiple variants exist) */}
      {state.variants.length > 1 && setVariants && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-indigo-500" />
              Bulk Apply Dimensions &amp; Weight to All ({state.variants.length}) Variants
            </span>
            <button
              type="button"
              onClick={() => setShowBulkApply(!showBulkApply)}
              className="text-indigo-600 hover:underline font-medium text-xs cursor-pointer"
            >
              {showBulkApply ? 'Hide' : 'Configure Bulk'}
            </button>
          </div>

          {showBulkApply && (
            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="L (cm)"
                value={bulkLength}
                onChange={(e) =>
                  setBulkLength(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="W (cm)"
                value={bulkWidth}
                onChange={(e) =>
                  setBulkWidth(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="H (cm)"
                value={bulkHeight}
                onChange={(e) =>
                  setBulkHeight(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Weight (kg)"
                value={bulkWeight}
                onChange={(e) =>
                  setBulkWeight(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 font-mono"
              />

              <button
                type="button"
                onClick={handleApplyBulkDimensions}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Apply to All Rows
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Variants Table / Empty State */}
      {state.variants.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">No Variants Added Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add at least one product variant (defining color, size, dimensions, barcodes, and photos).
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:opacity-95 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Variant</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-14">Photo</th>
                  <th className="py-3 px-4">Variant Options</th>
                  <th className="py-3 px-4">Model &amp; Barcode</th>
                  <th className="py-3 px-4">Dimensions / Weight</th>
                  <th className="py-3 px-4">Packaging</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.variants.map((v) => {
                  const primaryImg = v.assets.find((a) => a.isPrimary) || v.assets[0];

                  return (
                    <tr key={v._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Photo Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {primaryImg ? (
                            <img
                              src={primaryImg._previewUrl || getFullAssetUrl(primaryImg.assetUrl)}
                              alt={v._label}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://placehold.co/100x100?text=IMG';
                              }}
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Variant Options Label */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{v._label || 'Default Variant'}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {v.attributeValues.map((av) => (
                            <span
                              key={av.attributeId}
                              className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium"
                            >
                              {av.attributeName ? `${av.attributeName}: ` : ''}
                              {av.valueName}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Model & Barcode */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 font-mono text-[11px]">
                          {v.variantModelCode ? (
                            <div className="text-slate-800">
                              <span className="text-slate-400 font-sans">Model: </span>
                              {v.variantModelCode}
                            </div>
                          ) : (
                            <div className="text-slate-400 italic">No model code</div>
                          )}

                          {v.gtin ? (
                            <div className="text-indigo-600 flex items-center gap-1">
                              <Barcode className="w-3 h-3" />
                              <span>{v.gtin}</span>
                            </div>
                          ) : (
                            <div className="text-slate-400 text-[10px]">No barcode</div>
                          )}
                        </div>
                      </td>

                      {/* Dimensions / Weight */}
                      <td className="py-3 px-4 text-slate-600">
                        {v.length || v.width || v.height ? (
                          <div className="font-mono text-[11px]">
                            {v.length || '0'} × {v.width || '0'} × {v.height || '0'} cm
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                        {v.weight && (
                          <div className="text-[10px] text-slate-500 font-medium">
                            {v.weight} kg
                          </div>
                        )}
                      </td>

                      {/* Packaging / UOM */}
                      <td className="py-3 px-4 text-slate-700">
                        {v.uoms.length > 0 ? (
                          <div className="text-[11px] flex items-center gap-1 font-medium">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span>
                              {v.uoms[0].quantity} Unit
                              {v.uoms[0].quantity > 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Completeness Status */}
                      <td className="py-3 px-4 text-center">
                        {v.assets.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Ready ({v.assets.length} imgs)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            No photo
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(v)}
                            title="Edit variant details & photos"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateVariant(v._id)}
                            title="Duplicate variant"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(v._id, v._label)}
                            title="Delete variant"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      <VariantDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        variant={editingVariant}
        onSave={handleDrawerSave}
        resolvedAttributes={state.resolvedAttributes}
        uoms={uoms}
        existingVariants={state.variants}
      />
    </div>
  );
};
