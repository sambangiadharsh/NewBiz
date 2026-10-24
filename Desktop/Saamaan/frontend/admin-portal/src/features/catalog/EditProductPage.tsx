import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Layers,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  PackagePlus,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { showSweetToast, confirmProceed } from '../../lib/swal.js';
import { useAuthStore } from '../../store/authStore.js';
import {
  AdminProductListItem,
  Brand,
  ResolvedAttributes,
  VariantEntry,
  UOM,
  VariantAssetEntry,
} from '../../types/product.js';
import { FeatureTagInput } from './components/FeatureTagInput.js';
import { ImageUploader } from './components/ImageUploader.js';
import { VariantDrawer } from './components/VariantDrawer.js';

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

export const EditProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Loading & Product Data
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<AdminProductListItem | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [resolvedAttributes, setResolvedAttributes] = useState<ResolvedAttributes | null>(null);
  const [uoms, setUoms] = useState<UOM[]>([]);

  // Active Tab: 'master' | 'specs' | 'variants'
  const [activeTab, setActiveTab] = useState<'master' | 'specs' | 'variants'>('master');

  // Dirty State Tracking (Senior Dev Approach)
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const dirtyPushedRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const [isSaving, setIsSaving] = useState(false);

  // Form State: Product Master
  const [productName, setProductName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [baseModelCode, setBaseModelCode] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState<number | ''>('');
  const [status, setStatus] = useState('ACTIVE');
  const [description, setDescription] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);

  // Form State: Category Specifications (attrId -> { attributeValueId?, attributeValue })
  const [specValues, setSpecValues] = useState<
    Record<string, { attributeValueId?: string; attributeValue: string }>
  >({});

  // Form State: Variants (variantId -> specs & assets)
  const [variantsState, setVariantsState] = useState<
    Record<
      string,
      {
        variantModelCode: string;
        gtin: string;
        length: number | '';
        width: number | '';
        height: number | '';
        weight: number | '';
        netWeight: number | '';
        grossWeight: number | '';
        shippingWeight: number | '';
        status: string;
        assets: VariantAssetEntry[];
      }
    >
  >({});

  // Add Variant Modal State
  const [isAddingVariant, setIsAddingVariant] = useState(false);

  // 1. Fetch Brands & UOMs
  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
      try {
        const [brandRes, uomRes] = await Promise.all([
          apiClient.get('/catalog/brands'),
          apiClient.get('/catalog/uoms'),
        ]);
        if (isMounted) {
          if (brandRes.data?.success) setBrands(brandRes.data.data || []);
          if (uomRes.data?.success) setUoms(uomRes.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load metadata', err);
      }
    };
    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Full Product Details
  const fetchProductDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/catalog/products/${id}`);
      if (res.data?.success && res.data.data) {
        const p: AdminProductListItem = res.data.data;
        setProduct(p);

        // Populate Master
        setProductName(p.productName || '');
        setBrandId(p.brand?.brandId || '');
        setBaseModelCode(p.baseModelCode || '');
        setHsnCode(p.hsnCode || '');
        setGstRate(p.gstRate !== null && p.gstRate !== undefined ? Number(p.gstRate) : '');
        setStatus(p.status || 'ACTIVE');
        setDescription(p.description || '');
        setHighlights(Array.isArray(p.highlights) ? [...p.highlights] : []);

        // Populate Variants Map
        const vMap: typeof variantsState = {};
        (p.variants || []).forEach((v) => {
          const rawAssets =
            v.assets && v.assets.length > 0
              ? v.assets
              : (p.assets && p.assets.length > 0 ? p.assets : []);

          const variantKey = String(v.productVariantId);
          vMap[variantKey] = {
            variantModelCode: v.variantModelCode || '',
            gtin: v.gtin || '',
            length: v.dimensions?.length ?? '',
            width: v.dimensions?.width ?? '',
            height: v.dimensions?.height ?? '',
            weight: v.dimensions?.netWeight ?? v.dimensions?.weight ?? '',
            netWeight: v.dimensions?.netWeight ?? v.dimensions?.weight ?? '',
            grossWeight: v.dimensions?.grossWeight ?? '',
            shippingWeight: v.dimensions?.shippingWeight ?? '',
            status: 'ACTIVE',
            assets: rawAssets.map((a: any, idx: number) => ({
              assetUrl: a.assetUrl || a.url || a.AssetURL || '',
              isPrimary: a.isPrimary !== undefined ? Boolean(a.isPrimary) : (idx === 0),
              displayOrder: a.displayOrder || idx + 1,
              assetType: 'IMAGE',
              altText: a.altText || '',
            })),
          };
        });
        setVariantsState(vMap);

        // Populate existing category spec values from variants
        const initialSpecs: typeof specValues = {};
        (p.variants || []).forEach((v) => {
          (v.attributes || []).forEach((attr: any) => {
            if (attr.attributeId && !initialSpecs[attr.attributeId]) {
              initialSpecs[attr.attributeId] = {
                attributeValue: attr.attributeValue || '',
              };
            }
          });
        });
        setSpecValues(initialSpecs);

        // Fetch Category Attributes if category assigned
        if (p.category?.categoryId) {
          try {
            const catRes = await apiClient.get(
              `/catalog/categories/${p.category.categoryId}/attributes`
            );
            if (catRes.data?.success) {
              setResolvedAttributes(catRes.data.data);
            }
          } catch (catErr) {
            console.error('Failed to resolve category attributes', catErr);
          }
        }

        isDirtyRef.current = false;
        dirtyPushedRef.current = false;
        setIsDirty(false);
      } else {
        showSweetToast('Product not found', 'error');
        navigate('/catalog/products');
      }
    } catch (err: any) {
      console.error('Failed to load product details', err);
      showSweetToast(err.response?.data?.message || 'Error loading product', 'error');
      navigate('/catalog/products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

  // Helper to mark dirty
  const markDirty = () => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      setIsDirty(true);
    }
  };

  // Helper for consistent confirmation prompt (Tier A & Tier B guard dialog)
  const confirmDiscardEdits = async (): Promise<boolean> => {
    return confirmProceed({
      title: 'Unsaved Changes',
      text: 'You have modified this product. Leaving now will discard all unsaved edits. Are you sure you want to go back?',
      confirmButtonText: 'Discard & Leave',
      cancelButtonText: 'Cancel',
      icon: 'warning',
    });
  };

  // 3. Senior Dev Tier B Protection: Window beforeunload listener for hard refresh, tab close, external navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue =
          'You have modified this product. Leaving now will discard all unsaved edits. Are you sure you want to go back?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 4. Senior Dev Tier A Protection: Browser Back/Forward (popstate) History Guard
  useEffect(() => {
    if (isDirty && !dirtyPushedRef.current) {
      dirtyPushedRef.current = true;
      window.history.pushState({ dirtyGuard: true }, '', window.location.href);
    } else if (!isDirty && dirtyPushedRef.current) {
      dirtyPushedRef.current = false;
    }
  }, [isDirty]);

  useEffect(() => {
    const handlePopState = async () => {
      if (isDirtyRef.current) {
        const confirmed = await confirmDiscardEdits();
        if (confirmed) {
          dirtyPushedRef.current = false;
          isDirtyRef.current = false;
          setIsDirty(false);
          navigate('/catalog/products');
        } else {
          // If admin clicked Cancel: abort navigation and keep edits intact
          dirtyPushedRef.current = true;
          window.history.pushState({ dirtyGuard: true }, '', window.location.href);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  // 5. Senior Dev Tier A Protection: In-App Navigation (Sidebar <NavLink>, Logo <Link>, <a> tags, and Logout button)
  useEffect(() => {
    const handleDocumentClick = async (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;

      // Check if user clicked Logout button in sidebar
      const logoutBtn = target?.closest('button[title="Logout"]');
      if (logoutBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const confirmed = await confirmDiscardEdits();
        if (confirmed) {
          dirtyPushedRef.current = false;
          isDirtyRef.current = false;
          setIsDirty(false);
          useAuthStore.getState().logout();
          navigate('/login');
        }
        return;
      }

      // Check for navigation links (<NavLink>, <Link>, <a>)
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      // Don't intercept target="_blank" or download links
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) return;

      let destUrl: URL;
      try {
        destUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // If linking to the exact same page path and search query, don't intercept
      if (
        destUrl.pathname === window.location.pathname &&
        destUrl.search === window.location.search
      ) {
        return;
      }

      // Intercept navigation in capture phase before React Router sees it
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const confirmed = await confirmDiscardEdits();
      if (confirmed) {
        dirtyPushedRef.current = false;
        isDirtyRef.current = false;
        setIsDirty(false);

        if (destUrl.origin === window.location.origin) {
          navigate(destUrl.pathname + destUrl.search + destUrl.hash);
        } else {
          window.location.href = anchor.href;
        }
      }
      // If admin clicks Cancel, navigation is completely aborted and edits remain intact!
    };

    // Use capture phase (useCapture: true) to intercept BEFORE React Router's bubbling click handler
    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [navigate]);

  // Handle Safe Navigation Back with confirmation (Top header arrow button)
  const handleSafeBack = async () => {
    if (isDirtyRef.current) {
      const confirmed = await confirmDiscardEdits();
      if (!confirmed) return;
      dirtyPushedRef.current = false;
      isDirtyRef.current = false;
      setIsDirty(false);
    }
    navigate('/catalog/products');
  };

  // 4. Save Product Master & All Modified Variants
  const handleSaveAll = async () => {
    if (!product || !id) return;
    if (!productName.trim()) {
      showSweetToast('Product Title is required', 'warning');
      setActiveTab('master');
      return;
    }

    try {
      setIsSaving(true);

      // Step A: Update Product Master (including category specifications)
      const specsPayload = Object.entries(specValues)
        .filter(([, val]) => val.attributeValue.trim() !== '' || val.attributeValueId)
        .map(([attrId, val]) => ({
          attributeId: attrId,
          attributeValueId: val.attributeValueId || null,
          attributeValue: val.attributeValue,
        }));

      const masterPayload = {
        productName: productName.trim(),
        brandId: brandId || undefined,
        baseModelCode: baseModelCode.trim() || null,
        hsnCode: hsnCode.trim() || null,
        gstRate: gstRate !== '' ? Number(gstRate) : null,
        status,
        description: description.trim() || undefined,
        highlights,
        specifications: specsPayload.length > 0 ? specsPayload : undefined,
      };

      await apiClient.put(`/admin/catalog/products/${id}`, masterPayload);

      // Step B: Update Each Variant (dimensions, barcodes, and assets)
      const variantIds = Object.keys(variantsState);
      for (const vId of variantIds) {
        const vState = variantsState[vId];
        if (!vState) continue;

        const variantPayload = {
          variantModelCode: vState.variantModelCode.trim() || null,
          gtin: vState.gtin.trim() || null,
          length: vState.length !== '' ? Number(vState.length) : null,
          width: vState.width !== '' ? Number(vState.width) : null,
          height: vState.height !== '' ? Number(vState.height) : null,
          weight: vState.netWeight !== '' ? Number(vState.netWeight) : (vState.weight !== '' ? Number(vState.weight) : null),
          netWeight: vState.netWeight !== '' ? Number(vState.netWeight) : (vState.weight !== '' ? Number(vState.weight) : null),
          grossWeight: vState.grossWeight !== '' ? Number(vState.grossWeight) : null,
          shippingWeight: vState.shippingWeight !== '' ? Number(vState.shippingWeight) : null,
          status: vState.status,
          assets: vState.assets.map((a, idx) => ({
            assetUrl: a.assetUrl,
            isPrimary: a.isPrimary,
            displayOrder: idx + 1,
            altText: a.altText || null,
          })),
        };

        await apiClient.put(`/admin/catalog/products/${id}/variants/${vId}`, variantPayload);
      }

      showSweetToast('Product and all variants updated successfully!', 'success');
      dirtyPushedRef.current = false;
      isDirtyRef.current = false;
      setIsDirty(false);
      // Refresh to sync fresh state
      await fetchProductDetails();
    } catch (err: any) {
      console.error('Failed to save product edits', err);
      showSweetToast(err.response?.data?.message || 'Failed to save product changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Add New Variant Handler
  const handleSaveNewVariant = async (variant: VariantEntry) => {
    if (!product) return;
    try {
      const payload = {
        attributeValues: variant.attributeValues.map((av) => ({
          attributeId: av.attributeId,
          attributeValueId: av.attributeValueId,
        })),
        gtin: variant.gtin || undefined,
        variantModelCode: variant.variantModelCode || undefined,
        length: variant.length !== '' ? Number(variant.length) : undefined,
        width: variant.width !== '' ? Number(variant.width) : undefined,
        height: variant.height !== '' ? Number(variant.height) : undefined,
        weight: variant.netWeight !== undefined && variant.netWeight !== '' ? Number(variant.netWeight) : (variant.weight !== '' ? Number(variant.weight) : undefined),
        netWeight: variant.netWeight !== undefined && variant.netWeight !== '' ? Number(variant.netWeight) : (variant.weight !== '' ? Number(variant.weight) : undefined),
        grossWeight: variant.grossWeight !== undefined && variant.grossWeight !== '' ? Number(variant.grossWeight) : undefined,
        shippingWeight: variant.shippingWeight !== undefined && variant.shippingWeight !== '' ? Number(variant.shippingWeight) : undefined,
        uoms: variant.uoms,
        assets: variant.assets.map((a) => ({
          assetType: a.assetType,
          assetUrl: a.assetUrl,
          isPrimary: a.isPrimary,
          altText: a.altText || undefined,
          displayOrder: a.displayOrder,
        })),
        initialStatus: 'ACTIVE',
      };

      const res = await apiClient.post(`/admin/catalog/products/${product.productId}/variants`, payload);
      if (res.data?.success) {
        showSweetToast('New variant added successfully!', 'success');
        setIsAddingVariant(false);
        await fetchProductDetails();
      }
    } catch (err: any) {
      console.error('Failed to add variant', err);
      showSweetToast(err.response?.data?.message || 'Error adding variant', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#635BFF] animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading catalog product studio...</p>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-6 pb-28">
      {/* ── Top Header Studio Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSafeBack}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Back to Products"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-[#635BFF] bg-[#635BFF]/10 px-2.5 py-0.5 rounded-md">
                {product.parentSku}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold text-slate-700">
                {product.brand?.brandName || 'Brand'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">{product.category?.categoryName}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1 line-clamp-1">
              {productName || product.productName}
            </h1>
          </div>
        </div>

        {/* Status Indicator & Live Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-slate-50 border-slate-200 text-slate-700">
            {isDirty ? (
              <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved Edits
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Synced with Catalog
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-slate-200/80 bg-white rounded-t-2xl px-6 gap-8 text-xs font-bold shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('master')}
          className={`py-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'master'
              ? 'border-[#635BFF] text-[#635BFF]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Product Master & India GST</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('specs')}
          className={`py-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'specs'
              ? 'border-[#635BFF] text-[#635BFF]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>
            Category Specifications (
            {resolvedAttributes
              ? resolvedAttributes.requiredSpecs.length + resolvedAttributes.optionalSpecs.length
              : 0}
            )
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('variants')}
          className={`py-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'variants'
              ? 'border-[#635BFF] text-[#635BFF]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Physical Variants & Photos ({product.variants?.length || 0})</span>
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200/90 p-6 shadow-xs">
        {/* ── TAB 1: PRODUCT MASTER & INDIA GST ── */}
        {activeTab === 'master' && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Product Title / Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. Ergonomic Breathable Mesh High-Back Office Chair"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/10 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Brand</label>
                <select
                  value={brandId}
                  onChange={(e) => {
                    setBrandId(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                >
                  <option value="">-- Choose Brand --</option>
                  {brands.map((b) => (
                    <option key={b.brandId} value={b.brandId}>
                      {b.brandName} ({b.brandCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Leaf Category</label>
                <div className="px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 truncate">
                  {product.category?.categoryName || 'Unassigned'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Base Model Code</label>
                <input
                  type="text"
                  value={baseModelCode}
                  onChange={(e) => {
                    setBaseModelCode(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. MOD-OC-889"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  HSN Code (India GST)
                </label>
                <input
                  type="text"
                  value={hsnCode}
                  onChange={(e) => {
                    setHsnCode(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. 940310"
                  maxLength={20}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">GST Slab Rate</label>
                <select
                  value={gstRate}
                  onChange={(e) => {
                    setGstRate(e.target.value === '' ? '' : Number(e.target.value));
                    markDirty();
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                >
                  <option value="">-- Select GST Slab --</option>
                  {GST_SLABS.map((slab) => (
                    <option key={slab.value} value={slab.value}>
                      {slab.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Catalog Status</label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                >
                  {MASTER_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <FeatureTagInput
              tags={highlights}
              onChange={(newTags) => {
                setHighlights(newTags);
                markDirty();
              }}
              maxTags={8}
            />

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Detailed Product Description
              </label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                placeholder="Comprehensive description of product specifications, build quality, materials, and warranty..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF] leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* ── TAB 2: INHERITED CATEGORY SPECIFICATIONS ── */}
        {activeTab === 'specs' && (
          <div className="space-y-6">
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs text-indigo-900">
              <div>
                <span className="font-bold">Strict Leaf Category Specifications: </span>
                <span>
                  These specifications were inherited from {product.category?.categoryName} taxonomy.
                </span>
              </div>
              <span className="font-semibold text-indigo-600 bg-white px-2.5 py-1 rounded-lg border border-indigo-100">
                {resolvedAttributes?.requiredSpecs.length || 0} Required •{' '}
                {resolvedAttributes?.optionalSpecs.length || 0} Optional
              </span>
            </div>

            {resolvedAttributes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[...resolvedAttributes.requiredSpecs, ...resolvedAttributes.optionalSpecs].map((spec) => {
                  const currentValue = specValues[spec.attributeId]?.attributeValue || '';
                  const hasPredefinedValues = spec.values && spec.values.length > 0;
                  const isBoolean =
                    (spec.dataType && spec.dataType.toUpperCase() === 'BOOLEAN') ||
                    (spec.attributeType && spec.attributeType.toUpperCase() === 'BOOLEAN');

                  const isChecked =
                    currentValue === 'true' ||
                    currentValue === 'Yes' ||
                    currentValue === '1' ||
                    currentValue === 'TRUE';

                  return (
                    <div
                      key={spec.attributeId}
                      className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/90 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800">
                          {spec.attributeName}{' '}
                          {spec.isRequired && <span className="text-rose-600">*</span>}
                        </label>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {spec.dataType || 'TEXT'}
                        </span>
                      </div>

                      {isBoolean ? (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-semibold text-slate-700">
                            {isChecked ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Yes / Enabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                                <span className="w-2 h-2 rounded-full bg-slate-300" />
                                No / Disabled
                              </span>
                            )}
                          </span>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={isChecked}
                            onClick={() => {
                              const nextVal = isChecked ? 'false' : 'true';
                              setSpecValues((prev) => ({
                                ...prev,
                                [spec.attributeId]: { attributeValue: nextVal },
                              }));
                              markDirty();
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 ${
                              isChecked ? 'bg-[#635BFF]' : 'bg-slate-300 hover:bg-slate-400'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                isChecked ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      ) : hasPredefinedValues ? (
                        <select
                          value={specValues[spec.attributeId]?.attributeValueId || ''}
                          onChange={(e) => {
                            const valId = e.target.value;
                            const matched = (spec.values || []).find(
                              (v) => String(v.attributeValueId) === valId
                            );
                            setSpecValues((prev) => ({
                              ...prev,
                              [spec.attributeId]: {
                                attributeValueId: valId,
                                attributeValue: matched?.valueName || '',
                              },
                            }));
                            markDirty();
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#635BFF]"
                        >
                          <option value="">-- Select {spec.attributeName} --</option>
                          {spec.values.map((v) => (
                            <option key={v.attributeValueId} value={v.attributeValueId}>
                              {v.valueName}
                            </option>
                          ))}
                        </select>
                      ) : (spec.dataType === 'STRING' || spec.dataType === 'TEXT' || !spec.dataType) &&
                        (spec.attributeName.toLowerCase().includes('care') ||
                          spec.attributeName.toLowerCase().includes('instruction') ||
                          spec.attributeName.toLowerCase().includes('direction') ||
                          spec.attributeName.toLowerCase().includes('maintenance') ||
                          spec.attributeName.toLowerCase().includes('safety') ||
                          spec.attributeName.toLowerCase().includes('warning') ||
                          (typeof currentValue === 'string' && currentValue.includes('\n'))) ? (
                        <FeatureTagInput
                          tags={
                            typeof currentValue === 'string'
                              ? currentValue
                                  .split('\n')
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                              : []
                          }
                          onChange={(newTags) => {
                            setSpecValues((prev) => ({
                              ...prev,
                              [spec.attributeId]: { attributeValue: newTags.join('\n') },
                            }));
                            markDirty();
                          }}
                          maxTags={10}
                          showLabel={false}
                          placeholder={`Type ${spec.attributeName.toLowerCase()} & press Enter (e.g. Hand wash cold)...`}
                          helperText="Type instruction & press Enter or comma to create bullet points."
                        />
                      ) : (
                        <input
                          type={spec.dataType === 'NUMBER' ? 'number' : 'text'}
                          value={currentValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSpecValues((prev) => ({
                              ...prev,
                              [spec.attributeId]: { attributeValue: val },
                            }));
                            markDirty();
                          }}
                          placeholder={`Enter ${spec.attributeName.toLowerCase()}...`}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#635BFF]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: PHYSICAL VARIANTS & PHOTOS (CLEAN CARD LAYOUT - NO MATRIX) ── */}
        {activeTab === 'variants' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Physical Product Variants</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage individual barcodes, dimensions, weights, and high-resolution variant images.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingVariant(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#635BFF]/10 text-[#635BFF] hover:bg-[#635BFF] hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <PackagePlus className="w-4 h-4" />
                <span>+ Add New Variant</span>
              </button>
            </div>

            <div className="space-y-6">
              {(product.variants || []).map((v, index) => {
                const variantKey = String(v.productVariantId);
                const vState = variantsState[variantKey] || variantsState[v.productVariantId] || {
                  variantModelCode: '',
                  gtin: '',
                  length: '',
                  width: '',
                  height: '',
                  weight: '',
                  status: 'ACTIVE',
                  assets: [],
                };

                return (
                  <div
                    key={v.productVariantId}
                    className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5 hover:border-[#635BFF]/30 transition-all"
                  >
                    {/* Variant Card Top Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 font-bold text-xs flex items-center justify-center text-slate-700">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              {v.variantSku}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <div className="flex flex-wrap gap-1.5">
                              {v.attributes?.map((attr, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="text-[11px] bg-indigo-50 text-[#635BFF] px-2 py-0.5 rounded-md font-semibold border border-[#635BFF]/20"
                                >
                                  {attr.attributeName}: {attr.attributeValue}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={vState.status}
                          onChange={(e) => {
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                status: e.target.value,
                              },
                            }));
                            markDirty();
                          }}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        >
                          <option value="ACTIVE">Active for Sale</option>
                          <option value="INACTIVE">Inactive / Delisted</option>
                        </select>
                      </div>
                    </div>

                    {/* Variant Physical Specs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Variant Model Code
                        </label>
                        <input
                          type="text"
                          value={vState.variantModelCode}
                          onChange={(e) => {
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                variantModelCode: e.target.value,
                              },
                            }));
                            markDirty();
                          }}
                          placeholder="e.g. WH-1000XM5-BLK"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          GTIN / EAN / Barcode
                        </label>
                        <input
                          type="text"
                          value={vState.gtin}
                          onChange={(e) => {
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                gtin: e.target.value,
                              },
                            }));
                            markDirty();
                          }}
                          placeholder="e.g. 8901234567890"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Net Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={vState.netWeight}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                netWeight: val,
                                weight: val,
                              },
                            }));
                            markDirty();
                          }}
                          placeholder="e.g. 0.200"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Gross Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={vState.grossWeight}
                          onChange={(e) => {
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                grossWeight: e.target.value === '' ? '' : Number(e.target.value),
                              },
                            }));
                            markDirty();
                          }}
                          placeholder="e.g. 0.450"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Shipping Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={vState.shippingWeight}
                          onChange={(e) => {
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                shippingWeight: e.target.value === '' ? '' : Number(e.target.value),
                              },
                            }));
                            markDirty();
                          }}
                          placeholder="e.g. 0.600"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>
                    </div>

                    {/* Dimensions Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Length (cm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={vState.length}
                          onChange={(e) => {
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                length: e.target.value === '' ? '' : Number(e.target.value),
                              },
                            }));
                            markDirty();
                          }}
                          placeholder="e.g. 25.0"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Width (cm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={vState.width}
                          onChange={(e) => {
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                width: e.target.value === '' ? '' : Number(e.target.value),
                              },
                            }));
                            markDirty();
                          }}
                          placeholder="e.g. 18.0"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Height (cm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={vState.height}
                          onChange={(e) => {
                            setVariantsState((prev) => ({
                              ...prev,
                              [v.productVariantId]: {
                                ...prev[v.productVariantId],
                                height: e.target.value === '' ? '' : Number(e.target.value),
                              },
                            }));
                            markDirty();
                          }}
                          placeholder="e.g. 8.5"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#635BFF]"
                        />
                      </div>
                    </div>

                    {/* Integrated Variant Photo & Asset Studio */}
                    <div className="pt-2">
                      <ImageUploader
                        assets={vState.assets}
                        onChange={(newAssets) => {
                          setVariantsState((prev) => ({
                            ...prev,
                            [v.productVariantId]: {
                              ...prev[v.productVariantId],
                              assets: newAssets,
                            },
                          }));
                          markDirty();
                        }}
                        maxFiles={8}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Senior Dev: Sticky Bottom Action Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-4 shadow-xl flex items-center justify-between sm:pl-72">
        <div className="flex items-center gap-3">
          {isDirty ? (
            <span className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>You have unsaved changes in this product studio</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>All changes are saved</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                const confirmed = await confirmProceed({
                  title: 'Discard Changes?',
                  text: 'Are you sure you want to revert all changes back to the saved catalog state?',
                  confirmButtonText: 'Discard Changes',
                });
                if (confirmed) {
                  dirtyPushedRef.current = false;
                  isDirtyRef.current = false;
                  setIsDirty(false);
                  fetchProductDetails();
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Discard Changes</span>
            </button>
          )}

          <button
            type="button"
            disabled={isSaving || !isDirty}
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#635BFF] hover:bg-[#5249e0] text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-40 transition-all cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving to Catalog...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Variant Modal Drawer */}
      {isAddingVariant && resolvedAttributes && (
        <VariantDrawer
          isOpen={true}
          onClose={() => setIsAddingVariant(false)}
          variant={null}
          onSave={handleSaveNewVariant}
          resolvedAttributes={resolvedAttributes}
          uoms={uoms}
          existingVariants={[]}
        />
      )}
    </div>
  );
};
