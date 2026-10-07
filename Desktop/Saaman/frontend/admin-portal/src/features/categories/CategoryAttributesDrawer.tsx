import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Tags,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Layers,
  Sparkles,
  CheckCircle2,
  ArrowDownNarrowWide,
  RotateCcw,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { confirmProceed, showSweetToast } from '../../lib/swal.js';

interface AttributeValue {
  attributeValueId: string;
  valueName: string;
  valueCode: string;
}

interface EffectiveCategoryAttribute {
  categoryAttributeId?: number;
  attributeId: string;
  attributeName: string;
  dataType: string;
  isRequired: boolean;
  isVariantDefining: boolean;
  displayOrder: number;
  status: string;
  isInherited: boolean;
  inheritedFrom?: {
    categoryId: number;
    categoryName: string;
    categoryCode?: string | null;
  };
  values: AttributeValue[];
}

interface GlobalAttributeOption {
  attributeId: string;
  attributeName: string;
  dataType: string;
  status: string;
}

interface CategoryAttributesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  category: {
    categoryId: number;
    categoryName: string;
    categoryCode?: string;
    isLeaf: boolean;
    parentCategory?: {
      categoryName: string;
      categoryCode?: string | null;
    } | null;
  } | null;
  onUpdateSuccess: () => void;
}

export const CategoryAttributesDrawer: React.FC<CategoryAttributesDrawerProps> = ({
  isOpen,
  onClose,
  category,
  onUpdateSuccess,
}) => {
  const [attributes, setAttributes] = useState<EffectiveCategoryAttribute[]>([]);
  const [excludedAttributes, setExcludedAttributes] = useState<EffectiveCategoryAttribute[]>([]);
  const [allGlobalAttributes, setAllGlobalAttributes] = useState<GlobalAttributeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New Link Form state
  const [selectedAttributeId, setSelectedAttributeId] = useState<string>('');
  const [isRequired, setIsRequired] = useState<boolean>(false);
  const [isVariantDefining, setIsVariantDefining] = useState<boolean>(false);
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [linking, setLinking] = useState<boolean>(false);

  const fetchAttributes = async () => {
    if (!category) return;
    try {
      setLoading(true);
      setError(null);
      const [catAttrsRes, globalAttrsRes] = await Promise.all([
        apiClient.get(`/admin/categories/${category.categoryId}/attributes`),
        apiClient.get('/admin/catalog/attributes', { params: { status: 'ACTIVE' } }),
      ]);

      if (catAttrsRes.data?.success) {
        const allList: EffectiveCategoryAttribute[] = catAttrsRes.data.data?.all || [];
        const excludedList: EffectiveCategoryAttribute[] = catAttrsRes.data.data?.excluded || [];
        setAttributes(allList);
        setExcludedAttributes(excludedList);
        // Suggest next display order
        const maxOrder = allList.reduce((max, a) => Math.max(max, a.displayOrder), 0);
        setDisplayOrder(maxOrder + 1);
      }

      if (globalAttrsRes.data?.success) {
        setAllGlobalAttributes(globalAttrsRes.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load category attributes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && category) {
      fetchAttributes();
      setSelectedAttributeId('');
      setIsRequired(false);
      setIsVariantDefining(false);
    }
  }, [isOpen, category]);

  if (!isOpen || !category) return null;

  // Filter out attributes that are already active on this category node
  const activeAttributeIds = new Set(attributes.map((a) => a.attributeId));
  const availableGlobalAttributes = allGlobalAttributes.filter(
    (ga) => !activeAttributeIds.has(ga.attributeId)
  );

  const handleLinkAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttributeId) return;

    try {
      setLinking(true);
      setError(null);
      await apiClient.post(`/admin/categories/${category.categoryId}/attributes`, {
        attributeId: selectedAttributeId,
        isRequired,
        isVariantDefining,
        displayOrder: Number(displayOrder) || 1,
        status: 'ACTIVE',
      });
      setSelectedAttributeId('');
      setIsRequired(false);
      setIsVariantDefining(false);
      await fetchAttributes();
      onUpdateSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to link attribute to category');
    } finally {
      setLinking(false);
    }
  };

  const handleToggleRequired = async (attr: EffectiveCategoryAttribute) => {
    try {
      setActionLoadingId(attr.attributeId);
      await apiClient.post(`/admin/categories/${category.categoryId}/attributes`, {
        attributeId: attr.attributeId,
        isRequired: !attr.isRequired,
        isVariantDefining: attr.isVariantDefining,
        displayOrder: attr.displayOrder,
        status: 'ACTIVE',
      });
      await fetchAttributes();
      onUpdateSuccess();
    } catch (err: any) {
      setError('Failed to update required status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleVariantDefining = async (attr: EffectiveCategoryAttribute) => {
    try {
      setActionLoadingId(attr.attributeId);
      await apiClient.post(`/admin/categories/${category.categoryId}/attributes`, {
        attributeId: attr.attributeId,
        isRequired: attr.isRequired,
        isVariantDefining: !attr.isVariantDefining,
        displayOrder: attr.displayOrder,
        status: 'ACTIVE',
      });
      await fetchAttributes();
      onUpdateSuccess();
    } catch (err: any) {
      setError('Failed to update variant-defining status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveAttribute = async (attr: EffectiveCategoryAttribute) => {
    const isInherited = attr.isInherited;
    const ok = await confirmProceed({
      title: isInherited ? 'Exclude Inherited Attribute?' : 'Remove Category Attribute?',
      text: isInherited
        ? `Are you sure you want to exclude "${attr.attributeName}" from "${category.categoryName}"? This attribute will be deactivated for this category and its subcategories.`
        : `Are you sure you want to remove attribute "${attr.attributeName}" from "${category.categoryName}"?`,
      confirmButtonText: isInherited ? 'Yes, Exclude' : 'Yes, Remove',
      cancelButtonText: 'Cancel',
      icon: 'warning',
    });

    if (!ok) return;

    try {
      setActionLoadingId(attr.attributeId);
      setError(null);
      await apiClient.delete(`/admin/categories/${category.categoryId}/attributes/${attr.attributeId}`);
      await fetchAttributes();
      onUpdateSuccess();
      showSweetToast(
        isInherited
          ? `Attribute "${attr.attributeName}" excluded successfully`
          : `Attribute "${attr.attributeName}" removed successfully`,
        'success'
      );
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to remove attribute';
      setError(msg);
      showSweetToast(msg, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRestoreAttribute = async (attr: EffectiveCategoryAttribute) => {
    const ok = await confirmProceed({
      title: 'Restore Attribute?',
      text: `Do you want to re-enable "${attr.attributeName}" for "${category.categoryName}"? It will be restored as an active attribute.`,
      confirmButtonText: 'Yes, Restore',
      cancelButtonText: 'Cancel',
      icon: 'question',
    });

    if (!ok) return;

    try {
      setActionLoadingId(attr.attributeId);
      setError(null);
      await apiClient.delete(
        `/admin/categories/${category.categoryId}/attributes/${attr.attributeId}?restore=true`
      );
      await fetchAttributes();
      onUpdateSuccess();
      showSweetToast(`Attribute "${attr.attributeName}" restored successfully`, 'success');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to restore attribute';
      setError(msg);
      showSweetToast(msg, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const variantDefiningCount = attributes.filter((a) => a.isVariantDefining).length;
  const specCount = attributes.filter((a) => !a.isVariantDefining).length;
  const directCount = attributes.filter((a) => !a.isInherited).length;
  const inheritedCount = attributes.filter((a) => a.isInherited).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-end overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{category.categoryName}</h3>
                {category.categoryCode && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {category.categoryCode}
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    category.isLeaf
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {category.isLeaf ? 'Leaf Category' : 'Branch Node'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure specifications, variant-defining attributes, and deterministic SKU order
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Metric Chips Bar */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Effective
              </span>
              <span className="text-lg font-black text-slate-900">{attributes.length}</span>
            </div>
            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                Variant SKU
              </span>
              <span className="text-lg font-black text-purple-900">{variantDefiningCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                Specifications
              </span>
              <span className="text-lg font-black text-blue-900">{specCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                Direct / Inherited
              </span>
              <span className="text-sm font-black text-emerald-900 mt-1 block">
                {directCount} / {inheritedCount}
              </span>
            </div>
          </div>

          {/* Architecture Explainer Notice */}
          <div className="p-3.5 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 border border-purple-100 rounded-2xl flex items-start gap-2.5 text-xs text-purple-950">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-purple-900">How Hierarchy & SKUs Work</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Attributes marked as <strong className="text-purple-900">Variant-Defining</strong> generate variant dropdowns and append their codes to the <strong className="font-mono text-[10px]">VariantSKU</strong> sorted by <strong className="text-purple-900">Display Order</strong>. Attributes set at root/parent nodes automatically cascade down to children.
              </p>
            </div>
          </div>

          {/* New Attribute Assignment Form */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-600" />
              <span>Link Attribute to {category.categoryName}</span>
            </h4>

            <form onSubmit={handleLinkAttribute} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Attribute Selector */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Select Specification / Attribute *
                  </label>
                  <select
                    value={selectedAttributeId}
                    onChange={(e) => setSelectedAttributeId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Attribute --</option>
                    {availableGlobalAttributes.map((ga) => (
                      <option key={ga.attributeId} value={ga.attributeId}>
                        {ga.attributeName} ({ga.dataType})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Display Order */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <ArrowDownNarrowWide className="w-3 h-3 text-slate-400" />
                    <span>Display Order</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-purple-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={isVariantDefining}
                    onChange={(e) => setIsVariantDefining(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Variant-Defining
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Affects physical inventory & SKU suffix
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-purple-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Mandatory Required
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Seller must fill this in during onboarding
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={linking || !selectedAttributeId}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  {linking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Attach Attribute</span>
                </button>
              </div>
            </form>
          </div>

          {/* Effective Attributes List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Effective Category Attributes ({attributes.length})
              </h4>
              <span className="text-[11px] text-slate-400">
                Ordered by DisplayOrder ASC
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Resolving hierarchy attributes...</p>
              </div>
            ) : attributes.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">No Attributes Assigned</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Link an attribute above or configure on an ancestor category to inherit.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {attributes.map((attr) => (
                  <div
                    key={attr.attributeId}
                    className={`p-4 rounded-2xl border transition-all shadow-sm ${
                      attr.isInherited
                        ? 'border-indigo-100 bg-indigo-50/20 hover:border-indigo-200'
                        : 'border-slate-200 bg-white hover:border-purple-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left Details */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Display Order Pill */}
                          <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-white shadow-xs">
                            #{attr.displayOrder}
                          </span>

                          <h5 className="text-sm font-bold text-slate-900">{attr.attributeName}</h5>

                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {attr.dataType}
                          </span>

                          {/* Inheritance Badge */}
                          {attr.isInherited ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                              Inherited from {attr.inheritedFrom?.categoryName}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              Direct Category Rule
                            </span>
                          )}

                          {/* Variant vs Spec Badge */}
                          {attr.isVariantDefining ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                              <Tags className="w-3 h-3" /> Variant-Defining (SKU)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              Product Specification
                            </span>
                          )}
                        </div>

                        {/* Allowed Predefined Values preview */}
                        {attr.values && attr.values.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-[10px] font-medium text-slate-400">Values:</span>
                            {attr.values.slice(0, 6).map((v) => (
                              <span
                                key={v.attributeValueId}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {v.valueCode ? `${v.valueName} (${v.valueCode})` : v.valueName}
                              </span>
                            ))}
                            {attr.values.length > 6 && (
                              <span className="text-[10px] text-slate-400">
                                +{attr.values.length - 6} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Toggle Required Button */}
                        <button
                          onClick={() => handleToggleRequired(attr)}
                          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-colors ${
                            attr.isRequired
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Toggle whether seller must supply this attribute"
                        >
                          {attr.isRequired ? 'Mandatory' : 'Optional'}
                        </button>

                        {/* Toggle Variant Defining Button */}
                        <button
                          onClick={() => handleToggleVariantDefining(attr)}
                          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-colors ${
                            attr.isVariantDefining
                              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Toggle whether this attribute generates physical variants and SKU codes"
                        >
                          {attr.isVariantDefining ? 'SKU Variant' : 'Spec Only'}
                        </button>

                        {/* Remove / Exclude button (works for both direct and inherited) */}
                        <button
                          onClick={() => handleRemoveAttribute(attr)}
                          disabled={actionLoadingId === attr.attributeId}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                          title={
                            attr.isInherited
                              ? `Exclude inherited attribute from ${category.categoryName}`
                              : `Remove attribute from ${category.categoryName}`
                          }
                        >
                          {actionLoadingId === attr.attributeId ? (
                            <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Excluded Attributes Section */}
            {excludedAttributes.length > 0 && (
              <div className="pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Excluded from this Category ({excludedAttributes.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Deactivated for this category branch
                  </span>
                </div>

                <div className="space-y-2">
                  {excludedAttributes.map((attr) => (
                    <div
                      key={attr.attributeId}
                      className="p-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{attr.attributeName}</span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          {attr.dataType}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          (Excluded)
                        </span>
                      </div>

                      <button
                        onClick={() => handleRestoreAttribute(attr)}
                        disabled={actionLoadingId === attr.attributeId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        title="Restore this attribute so this category inherits it again"
                      >
                        {actionLoadingId === attr.attributeId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                        )}
                        <span>Restore</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Changes take effect immediately for new product proposals
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
