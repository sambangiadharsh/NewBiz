import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Package,
  Layers,
  Loader2,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../../lib/axios.js';
import { showSweetToast } from '../../../lib/swal.js';
import { AdminProductListItem, Brand } from '../../../types/product.js';
import { FeatureTagInput } from './FeatureTagInput.js';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: AdminProductListItem | null;
  onSuccess: (updatedProduct?: AdminProductListItem) => void;
}

const GST_SLABS = [
  { label: '0% (Exempt)', value: 0 },
  { label: '5% (Standard Essential)', value: 5 },
  { label: '12% (Standard Lower)', value: 12 },
  { label: '18% (Standard General)', value: 18 },
  { label: '28% (Luxury / Demerit)', value: 28 },
];

const MASTER_STATUSES = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive / Paused', value: 'INACTIVE' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Pending QC', value: 'PENDING_QC' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Rejected', value: 'REJECTED' },
];

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'master' | 'variants'>('master');
  const [brands, setBrands] = useState<Brand[]>([]);

  // Product Master Form State
  const [productName, setProductName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [baseModelCode, setBaseModelCode] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState<number | ''>('');
  const [status, setStatus] = useState('ACTIVE');
  const [description, setDescription] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [isSavingMaster, setIsSavingMaster] = useState(false);

  // Variants Form State (variantId -> field updates)
  const [variantsState, setVariantsState] = useState<
    Record<
      string,
      {
        gtin: string;
        variantModelCode: string;
        length: number | '';
        width: number | '';
        height: number | '';
        weight: number | '';
        status: string;
        isSaving: boolean;
      }
    >
  >({});

  // Fetch Brands for dropdown
  useEffect(() => {
    let isMounted = true;
    const fetchBrands = async () => {
      try {
        const res = await apiClient.get('/catalog/brands');
        if (res.data?.success && isMounted) {
          setBrands(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load brands in EditProductModal', err);
      }
    };
    fetchBrands();
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize state when product changes
  useEffect(() => {
    if (product) {
      setProductName(product.productName || '');
      setBrandId(product.brand?.brandId || '');
      setBaseModelCode(product.baseModelCode || '');
      setHsnCode(product.hsnCode || '');
      setGstRate(
        product.gstRate !== null && product.gstRate !== undefined
          ? Number(product.gstRate)
          : ''
      );
      setStatus(product.status || 'ACTIVE');
      setDescription(product.description || '');
      setHighlights(Array.isArray(product.highlights) ? [...product.highlights] : []);

      // Initialize variants map
      const vMap: typeof variantsState = {};
      (product.variants || []).forEach((v) => {
        vMap[v.productVariantId] = {
          gtin: v.gtin || '',
          variantModelCode: v.variantModelCode || '',
          length: v.dimensions?.length ?? '',
          width: v.dimensions?.width ?? '',
          height: v.dimensions?.height ?? '',
          weight: v.dimensions?.weight ?? '',
          status: 'ACTIVE',
          isSaving: false,
        };
      });
      setVariantsState(vMap);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  // Handle Master Save
  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      showSweetToast('Product title is required', 'error');
      return;
    }

    try {
      setIsSavingMaster(true);
      const payload = {
        productName: productName.trim(),
        brandId: brandId || undefined,
        baseModelCode: baseModelCode.trim() || null,
        hsnCode: hsnCode.trim() || null,
        gstRate: gstRate !== '' ? Number(gstRate) : null,
        status,
        description: description.trim() || undefined,
        highlights,
      };

      const res = await apiClient.put(
        `/admin/catalog/products/${product.productId}`,
        payload
      );

      if (res.data?.success) {
        showSweetToast('Product Master updated successfully!', 'success');
        onSuccess();
      } else {
        showSweetToast(res.data?.message || 'Failed to update product', 'error');
      }
    } catch (err: any) {
      console.error('Failed to update product master', err);
      showSweetToast(
        err.response?.data?.message || 'Error updating product master',
        'error'
      );
    } finally {
      setIsSavingMaster(false);
    }
  };

  // Handle Single Variant Save
  const handleSaveVariant = async (variantId: string) => {
    const vState = variantsState[variantId];
    if (!vState) return;

    try {
      setVariantsState((prev) => ({
        ...prev,
        [variantId]: { ...prev[variantId], isSaving: true },
      }));

      const payload = {
        gtin: vState.gtin.trim() || null,
        variantModelCode: vState.variantModelCode.trim() || null,
        length: vState.length !== '' ? Number(vState.length) : null,
        width: vState.width !== '' ? Number(vState.width) : null,
        height: vState.height !== '' ? Number(vState.height) : null,
        weight: vState.weight !== '' ? Number(vState.weight) : null,
        status: vState.status,
      };

      const res = await apiClient.put(
        `/admin/catalog/products/${product.productId}/variants/${variantId}`,
        payload
      );

      if (res.data?.success) {
        showSweetToast('Variant updated successfully!', 'success');
        onSuccess();
      } else {
        showSweetToast(res.data?.message || 'Failed to update variant', 'error');
      }
    } catch (err: any) {
      console.error('Failed to update variant', err);
      showSweetToast(
        err.response?.data?.message || 'Error updating variant',
        'error'
      );
    } finally {
      setVariantsState((prev) => ({
        ...prev,
        [variantId]: { ...prev[variantId], isSaving: false },
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Edit Catalog Product
                </h2>
                <span className="font-mono text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-semibold">
                  {product.parentSku}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                {product.productName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-6 bg-white gap-8 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('master')}
            className={`py-3.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'master'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Product Master Details</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('variants')}
            className={`py-3.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'variants'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Physical Variants ({product.variants?.length || 0})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {activeTab === 'master' ? (
            <form id="edit-master-form" onSubmit={handleSaveMaster} className="space-y-5">
              {/* Product Title */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Product Name / Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Ergonomic Office Desk Chair with Lumbar Support"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>

              {/* Grid 1: Brand, Category (Read Only), Base Model */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Brand */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Brand
                  </label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">-- Choose Brand --</option>
                    {brands.map((b) => (
                      <option key={b.brandId} value={b.brandId}>
                        {b.brandName} ({b.brandCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category (Display) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Leaf Category
                  </label>
                  <div className="px-3.5 py-2.5 bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 truncate">
                    {product.category?.categoryName || 'Unassigned'}
                  </div>
                </div>

                {/* Base Model Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Base Model Code
                  </label>
                  <input
                    type="text"
                    value={baseModelCode}
                    onChange={(e) => setBaseModelCode(e.target.value)}
                    placeholder="e.g. MOD-OC-889"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Grid 2: HSN Code, GST Slab, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* HSN Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    HSN Code (India GST)
                  </label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="e.g. 940310"
                    maxLength={20}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* GST Slab % */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    GST Slab Rate
                  </label>
                  <select
                    value={gstRate}
                    onChange={(e) =>
                      setGstRate(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">-- Select GST Slab --</option>
                    {GST_SLABS.map((slab) => (
                      <option key={slab.value} value={slab.value}>
                        {slab.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Master Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Catalog Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                  >
                    {MASTER_STATUSES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Highlights & Features */}
              <FeatureTagInput tags={highlights} onChange={setHighlights} maxTags={8} />

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Detailed Product Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive description of product specifications, materials, warranty, and ergonomics..."
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600 leading-relaxed"
                />
              </div>
            </form>
          ) : (
            /* Variants Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Update model codes, physical weights, dimensions, and barcodes for each variant SKU.
                </p>
                <span className="text-[11px] font-semibold text-slate-400">
                  {product.variants?.length || 0} Variant{product.variants?.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-4">
                {(product.variants || []).map((v) => {
                  const state = variantsState[v.productVariantId] || {
                    gtin: '',
                    variantModelCode: '',
                    length: '',
                    width: '',
                    height: '',
                    weight: '',
                    status: 'ACTIVE',
                    isSaving: false,
                  };

                  return (
                    <div
                      key={v.productVariantId}
                      className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-4 hover:border-indigo-200 transition-colors"
                    >
                      {/* Variant Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {v.variantSku}
                            </span>
                            {/* Attribute badges */}
                            <div className="flex flex-wrap gap-1">
                              {v.attributes?.map((attr, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold border border-indigo-100/60"
                                >
                                  {attr.attributeName}: {attr.attributeValue}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={state.isSaving}
                            onClick={() => handleSaveVariant(v.productVariantId)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#635BFF] hover:bg-[#5249e0] text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                          >
                            {state.isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            <span>Save Variant</span>
                          </button>
                        </div>
                      </div>

                      {/* Variant Inputs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {/* Variant Model Code */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Variant Model Code
                          </label>
                          <input
                            type="text"
                            value={state.variantModelCode}
                            onChange={(e) =>
                              setVariantsState((prev) => ({
                                ...prev,
                                [v.productVariantId]: {
                                  ...prev[v.productVariantId],
                                  variantModelCode: e.target.value,
                                },
                              }))
                            }
                            placeholder="e.g. WH-1000XM5-BLK"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                          />
                        </div>

                        {/* GTIN / Barcode */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            GTIN / EAN / Barcode
                          </label>
                          <input
                            type="text"
                            value={state.gtin}
                            onChange={(e) =>
                              setVariantsState((prev) => ({
                                ...prev,
                                [v.productVariantId]: {
                                  ...prev[v.productVariantId],
                                  gtin: e.target.value,
                                },
                              }))
                            }
                            placeholder="e.g. 8901234567890"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                          />
                        </div>

                        {/* Weight in kg */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Weight (kg)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={state.weight}
                            onChange={(e) =>
                              setVariantsState((prev) => ({
                                ...prev,
                                [v.productVariantId]: {
                                  ...prev[v.productVariantId],
                                  weight: e.target.value === '' ? '' : Number(e.target.value),
                                },
                              }))
                            }
                            placeholder="e.g. 0.45"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                          />
                        </div>
                      </div>

                      {/* Dimensions: Length, Width, Height */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Length (cm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={state.length}
                            onChange={(e) =>
                              setVariantsState((prev) => ({
                                ...prev,
                                [v.productVariantId]: {
                                  ...prev[v.productVariantId],
                                  length: e.target.value === '' ? '' : Number(e.target.value),
                                },
                              }))
                            }
                            placeholder="e.g. 25.0"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Width (cm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={state.width}
                            onChange={(e) =>
                              setVariantsState((prev) => ({
                                ...prev,
                                [v.productVariantId]: {
                                  ...prev[v.productVariantId],
                                  width: e.target.value === '' ? '' : Number(e.target.value),
                                },
                              }))
                            }
                            placeholder="e.g. 18.0"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Height (cm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={state.height}
                            onChange={(e) =>
                              setVariantsState((prev) => ({
                                ...prev,
                                [v.productVariantId]: {
                                  ...prev[v.productVariantId],
                                  height: e.target.value === '' ? '' : Number(e.target.value),
                                },
                              }))
                            }
                            placeholder="e.g. 8.5"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-600"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-medium">
            Changes directly update the live marketplace catalog.
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {activeTab === 'master' && (
              <button
                type="submit"
                form="edit-master-form"
                disabled={isSavingMaster}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#635BFF] hover:bg-[#5249e0] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSavingMaster ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Product Master</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
