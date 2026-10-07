import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertCircle,
  PackagePlus,
  Loader2,
  UploadCloud,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { ApiResponse } from '../../types/auth.js';

interface CategoryItem {
  categoryId: number;
  CategoryID?: number;
  categoryName: string;
  CategoryName?: string;
  categoryCode?: string;
  CategoryCode?: string;
  isLeaf: boolean;
}

interface BrandItem {
  brandId: string;
  brandName: string;
  brandCode: string;
}

interface UOMItem {
  uomId: string;
  uomCode: string;
  uomName: string;
}

interface AttributeValueItem {
  attributeValueId: string;
  valueName: string;
  valueCode: string;
}

interface CategoryAttributeItem {
  attributeId: string;
  attributeName: string;
  dataType: string;
  isRequired: boolean;
  isVariantDefining: boolean;
  displayOrder: number;
  values: AttributeValueItem[];
}

interface CategoryAttributesResponse {
  categoryId: string;
  categoryName: string;
  categoryCode?: string;
  variantDefining: CategoryAttributeItem[];
  requiredSpecs: CategoryAttributeItem[];
  optionalSpecs: CategoryAttributeItem[];
}

const getImagePreviewUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

const getResolvedDataType = (dataType?: string): 'OPTIONS' | 'BOOLEAN' | 'NUMBER' | 'STRING' => {
  const dt = (dataType || '').trim().toUpperCase();
  if (['OPTIONS', 'ENUM', 'SELECT', 'DROPDOWN'].includes(dt)) return 'OPTIONS';
  if (['BOOLEAN', 'BOOL'].includes(dt)) return 'BOOLEAN';
  if (['NUMBER', 'NUMERIC', 'INT', 'DECIMAL', 'FLOAT'].includes(dt)) return 'NUMBER';
  return 'STRING';
};

export const ProposeProductWizard: React.FC = () => {
  const navigate = useNavigate();

  // Wizard Step
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    { number: 1, title: 'Category & Brand' },
    { number: 2, title: 'Master Specifications' },
    { number: 3, title: 'Variant Builder' },
    { number: 4, title: 'Logistics & Media' },
    { number: 5, title: 'Review & Submit' },
  ];

  // Metadata options
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [uoms, setUoms] = useState<UOMItem[]>([]);

  // Step 1: Category & Brand state
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttributesResponse | null>(null);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);

  // Step 2: General details & Specifications
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [highlights, setHighlights] = useState<string[]>(['']);
  const [specificationValues, setSpecificationValues] = useState<Record<string, { attributeValueId?: string; attributeValue: string }>>({});

  const handleAddHighlight = () => {
    if (highlights.length < 10) {
      setHighlights([...highlights, '']);
    }
  };

  const handleUpdateHighlight = (index: number, val: string) => {
    const next = [...highlights];
    next[index] = val;
    setHighlights(next);
  };

  const handleRemoveHighlight = (index: number) => {
    if (highlights.length > 1) {
      setHighlights(highlights.filter((_, i) => i !== index));
    } else {
      setHighlights(['']);
    }
  };

  // Step 3: Variant-defining selections (Map of AttributeID -> array of AttributeValueIDs)
  const [selectedVariantValues, setSelectedVariantValues] = useState<Record<string, string[]>>({});

  // Step 4: Generated Variant Rows
  interface VariantRow {
    id: string;
    attributeValues: Array<{ attributeId: string; attributeValueId: string; valueCode: string; valueName: string }>;
    previewSkuSuffix: string;
    gtin: string;
    productModelCode: string;
    hsnCode: string;
    gstRate: number;
    length: string;
    width: string;
    height: string;
    weight: string;
    capacity: string;
    uomId: string;
    imageUrl: string;
  }
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [uploadingVariantIndex, setUploadingVariantIndex] = useState<number | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load initial dropdowns
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catRes, brandRes, uomRes] = await Promise.all([
          apiClient.get<ApiResponse<any[]>>('/categories'),
          apiClient.get<ApiResponse<BrandItem[]>>('/catalog/brands'),
          apiClient.get<ApiResponse<UOMItem[]>>('/catalog/uoms'),
        ]);

        if (catRes.data.success && catRes.data.data) {
          // Only show leaf categories for strict leaf-level mapping
          const mappedCats: CategoryItem[] = catRes.data.data
            .map((c: any) => ({
              categoryId: Number(c.categoryId ?? c.CategoryID),
              CategoryID: Number(c.categoryId ?? c.CategoryID),
              categoryName: String(c.categoryName ?? c.CategoryName),
              CategoryName: String(c.categoryName ?? c.CategoryName),
              categoryCode: c.categoryCode ?? c.CategoryCode,
              CategoryCode: c.categoryCode ?? c.CategoryCode,
              isLeaf: Boolean(c.isLeaf),
            }))
            .filter((c) => c.isLeaf)
            .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
          setCategories(mappedCats);
        }
        if (brandRes.data.success && brandRes.data.data) {
          setBrands(brandRes.data.data);
        }
        if (uomRes.data.success && uomRes.data.data) {
          setUoms(uomRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load catalog metadata:', err);
      }
    };

    fetchMetadata();
  }, []);

  // Fetch category attributes whenever a leaf category is selected
  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryAttributes(null);
      return;
    }

    const fetchAttributes = async () => {
      try {
        setIsLoadingAttributes(true);
        const res = await apiClient.get<ApiResponse<CategoryAttributesResponse>>(
          `/catalog/categories/${selectedCategoryId}/attributes`
        );
        if (res.data.success && res.data.data) {
          setCategoryAttributes(res.data.data);
          // Initialize specification defaults
          const initialSpecs: Record<string, { attributeValueId?: string; attributeValue: string }> = {};
          res.data.data.requiredSpecs.forEach((s) => {
            initialSpecs[s.attributeId] = { attributeValue: '' };
          });
          setSpecificationValues(initialSpecs);
          setSelectedVariantValues({});
          setVariantRows([]);
        }
      } catch (err: any) {
        console.error('Failed to fetch category attributes:', err);
      } finally {
        setIsLoadingAttributes(false);
      }
    };

    fetchAttributes();
  }, [selectedCategoryId]);

  // Generate Cartesian Product of selected variants
  const computeVariantRows = (selectedMap: Record<string, string[]>): VariantRow[] => {
    if (!categoryAttributes) return [];

    const definingAttrs = categoryAttributes.variantDefining;

    if (definingAttrs.length === 0) {
      return [
        {
          id: 'standard-1',
          attributeValues: [],
          previewSkuSuffix: 'STD',
          gtin: '',
          productModelCode: '',
          hsnCode: '',
          gstRate: 18,
          length: '',
          width: '',
          height: '',
          weight: '',
          capacity: '',
          uomId: uoms[0]?.uomId || '',
          imageUrl: '',
        },
      ];
    }

    const attributeCombinations: Array<Array<{ attributeId: string; attributeValueId: string; valueCode: string; valueName: string }>> = [];

    for (const attr of definingAttrs) {
      const selectedIds = selectedMap[attr.attributeId] || [];
      if (selectedIds.length === 0) continue;

      const valueObjs = selectedIds.map((id) => {
        const valObj = attr.values.find((v) => v.attributeValueId === id);
        return {
          attributeId: attr.attributeId,
          attributeValueId: id,
          valueCode: valObj?.valueCode || 'VAL',
          valueName: valObj?.valueName || 'Value',
        };
      });

      attributeCombinations.push(valueObjs);
    }

    if (attributeCombinations.length === 0) {
      return [];
    }

    const cartesian = (arrays: any[][]): any[][] => {
      return arrays.reduce((acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])), [[]]);
    };

    const combinations = cartesian(attributeCombinations);

    const existingRowMap = new Map<string, VariantRow>();
    variantRows.forEach((r) => existingRowMap.set(r.previewSkuSuffix, r));

    return combinations.map((combo, idx) => {
      const skuSuffix = combo.map((c: any) => c.valueCode).join('-');
      const existing = existingRowMap.get(skuSuffix);
      if (existing) {
        return {
          ...existing,
          id: `variant-${idx + 1}`,
          attributeValues: combo,
          previewSkuSuffix: skuSuffix,
        };
      }
      return {
        id: `variant-${idx + 1}`,
        attributeValues: combo,
        previewSkuSuffix: skuSuffix,
        gtin: '',
        productModelCode: '',
        hsnCode: '',
        gstRate: 18,
        length: '',
        width: '',
        height: '',
        weight: '',
        capacity: '',
        uomId: uoms[0]?.uomId || '',
        imageUrl: '',
      };
    });
  };

  const handleToggleVariantValue = (attributeId: string, valueId: string) => {
    setSelectedVariantValues((prev) => {
      const currentList = prev[attributeId] || [];
      const updated = currentList.includes(valueId)
        ? currentList.filter((id) => id !== valueId)
        : [...currentList, valueId];
      const nextMap = { ...prev, [attributeId]: updated };
      const nextRows = computeVariantRows(nextMap);
      setVariantRows(nextRows);
      return nextMap;
    });
  };

  const generateVariantMatrix = () => {
    const nextRows = computeVariantRows(selectedVariantValues);
    setVariantRows(nextRows);
  };

  const handleUploadVariantImage = async (index: number, file: File) => {
    try {
      setUploadingVariantIndex(index);
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/seller/catalog/upload-asset', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success && res.data.data?.url) {
        updateVariantRow(index, 'imageUrl', res.data.data.url);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to upload image');
    } finally {
      setUploadingVariantIndex(null);
    }
  };

  // Step 4 field updater
  const updateVariantRow = (index: number, field: keyof VariantRow, value: any) => {
    setVariantRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Step 4 copy helper: Copy first variant's details to all subsequent variants
  const handleCopyVariant1ToAll = () => {
    if (variantRows.length <= 1) return;
    const v1 = variantRows[0];
    setVariantRows((prev) =>
      prev.map((r, idx) => {
        if (idx === 0) return r;
        return {
          ...r,
          hsnCode: r.hsnCode.trim() ? r.hsnCode : v1.hsnCode,
          gstRate: r.gstRate ?? v1.gstRate,
          length: r.length || v1.length,
          width: r.width || v1.width,
          height: r.height || v1.height,
          weight: r.weight || v1.weight,
          capacity: r.capacity || v1.capacity,
          uomId: r.uomId || v1.uomId,
          imageUrl: r.imageUrl.trim() ? r.imageUrl : v1.imageUrl,
        };
      })
    );
  };

  // Submission handler
  const handleSubmitProposal = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const selectedBrand = brands.find((b) => b.brandId === selectedBrandId);
    const selectedCategory = categories.find((c) => String(c.categoryId ?? c.CategoryID) === selectedCategoryId);

    if (!selectedBrand || !selectedCategory) {
      setErrorMessage('Please select a valid Brand and Leaf Category');
      setIsSubmitting(false);
      return;
    }

    // Prepare payload
    const payload = {
      brandId: selectedBrandId,
      leafCategoryId: selectedCategoryId,
      productName: productName.trim(),
      description: description.trim() || undefined,
      highlights: highlights.map((h) => h.trim()).filter((h) => h.length > 0),
      specifications: Object.entries(specificationValues)
        .filter(([_, val]) => val.attributeValue.trim().length > 0)
        .map(([attrId, val]) => ({
          attributeId: attrId,
          attributeValueId: val.attributeValueId,
          attributeValue: val.attributeValue,
        })),
      variants: variantRows.map((v) => ({
        attributeValues: v.attributeValues.map((av) => ({
          attributeId: av.attributeId,
          attributeValueId: av.attributeValueId,
        })),
        gtin: v.gtin.trim() || undefined,
        productModelCode: v.productModelCode.trim() || undefined,
        hsnCode: v.hsnCode.trim() || undefined,
        gstRate: v.gstRate,
        length: parseFloat(v.length) || undefined,
        width: parseFloat(v.width) || undefined,
        height: parseFloat(v.height) || undefined,
        weight: parseFloat(v.weight) || undefined,
        capacity: parseFloat(v.capacity) || undefined,
        uoms: v.uomId ? [{ uomId: v.uomId, quantity: 1 }] : [],
        assets: v.imageUrl.trim()
          ? [
              {
                assetType: 'IMAGE' as const,
                assetUrl: v.imageUrl.trim(),
                isPrimary: true,
                displayOrder: 1,
              },
            ]
          : [],
      })),
    };

    try {
      const res = await apiClient.post<ApiResponse<any>>('/seller/catalog/propose', payload);
      if (res.data.success) {
        navigate('/products', {
          state: { proposedSuccess: true, parentSku: res.data.data.parentSku },
        });
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to submit proposal for Catalog QC');
    } finally {
      setIsSubmitting(false);
    }
  };

  const definingAttrs = categoryAttributes?.variantDefining || [];
  const unselectedAttrs = definingAttrs.filter(
    (a) => !selectedVariantValues[a.attributeId] || selectedVariantValues[a.attributeId].length === 0
  );

  const hasAllRequiredSpecs = (categoryAttributes?.requiredSpecs || []).every((s) => {
    const val = specificationValues[s.attributeId]?.attributeValue;
    return typeof val === 'string' && val.trim().length > 0;
  });

  const canProceedStep1 = selectedCategoryId && selectedBrandId;
  const canProceedStep2 = productName.trim().length >= 3 && hasAllRequiredSpecs;
  const canProceedStep3 =
    variantRows.length > 0 &&
    (definingAttrs.length === 0 || unselectedAttrs.length === 0);
  const canProceedStep4 = variantRows.every((v) => v.imageUrl.trim().length > 0 && v.hsnCode.trim().length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Banner & Title */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Products Hub
          </button>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <PackagePlus className="w-7 h-7 text-[#7E2532]" />
            Propose New Product Family
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Create a canonical ProductMaster with variants and submit for Admin Catalog Quality Control
          </p>
        </div>
      </div>

      {/* Wizard Step Indicator */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {steps.map((s, idx) => {
            const isDone = currentStep > s.number;
            const isCurrent = currentStep === s.number;

            return (
              <React.Fragment key={s.number}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                      isDone
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-[#7E2532] text-white shadow-md shadow-rose-950/20'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : s.number}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden md:inline ${
                      isCurrent ? 'text-stone-900 font-bold' : isDone ? 'text-stone-600' : 'text-stone-400'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${
                      isDone ? 'bg-emerald-500' : 'bg-stone-100'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Category & Brand */}
      {currentStep === 1 && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-base font-bold text-stone-900">Step 1: Select Brand & Leaf Category</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Under strict leaf-level mapping, specifications are configured exclusively on specific product-type categories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Brand Dropdown */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                Brand / Manufacturer *
              </label>
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532]"
              >
                <option value="">-- Choose Brand --</option>
                {brands.map((b) => (
                  <option key={b.brandId} value={b.brandId}>
                    {b.brandName} ({b.brandCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Leaf Category Dropdown */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                Leaf Category (Product Type) *
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532]"
              >
                <option value="">-- Choose Leaf Category --</option>
                {categories.map((c) => {
                  const id = c.categoryId ?? c.CategoryID;
                  const name = c.categoryName ?? c.CategoryName;
                  return (
                    <option key={id} value={id}>
                      {name} {c.categoryCode ? `(${c.categoryCode})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Dynamic Attribute Summary Badge */}
          {isLoadingAttributes ? (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center gap-2 text-stone-400 text-xs font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-[#7E2532]" />
              Loading strict leaf-level category attributes...
            </div>
          ) : categoryAttributes ? (
            <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-stone-900 block">
                    Strict Leaf Mapping: {categoryAttributes.categoryName}
                  </span>
                  <span className="text-[11px] text-stone-500">
                    {categoryAttributes.variantDefining.length} Variant-Defining •{' '}
                    {categoryAttributes.requiredSpecs.length} Required Specs •{' '}
                    {categoryAttributes.optionalSpecs.length} Optional Specs
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#7E2532] bg-[#FDF2F4] px-2.5 py-1 rounded-lg">
                <span>SKU Code Prefix: {brands.find((b) => b.brandId === selectedBrandId)?.brandCode || 'BRD'}-{categoryAttributes.categoryCode || categories.find((c) => String(c.categoryId ?? c.CategoryID) === selectedCategoryId)?.categoryCode || 'CAT'}</span>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end pt-4 border-t border-stone-100">
            <button
              type="button"
              disabled={!canProceedStep1}
              onClick={() => setCurrentStep(2)}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#641D26] to-[#7E2532] hover:from-[#52161E] hover:to-[#641D26] text-white text-xs font-bold shadow-md shadow-rose-950/20 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              Continue to Specifications
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Master Specifications */}
      {currentStep === 2 && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-base font-bold text-stone-900">Step 2: Product Name & Category Specifications</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Enter the common product family identity and strict leaf specifications.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Canonical Product Name *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Classic Cotton Crew Neck T-Shirt"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Common Family Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the fabric, features, fit, and highlights of this product family..."
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#7E2532]/25 focus:border-[#7E2532]"
              />
            </div>

            {/* Key Product Highlights (Approach 1) */}
            <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#7E2532]" />
                    Key Product Highlights (Max 10)
                  </label>
                  <p className="text-[11px] text-stone-500">
                    Add bullet-point features shown prominently on the storefront quick view and product detail page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddHighlight}
                  disabled={highlights.length >= 10}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 hover:text-stone-900 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#7E2532]" />
                  Add Bullet ({highlights.length}/10)
                </button>
              </div>

              <div className="space-y-2">
                {highlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-stone-200/70 text-stone-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={highlight}
                      onChange={(e) => handleUpdateHighlight(idx, e.target.value)}
                      placeholder={idx === 0 ? "e.g. Crafted from 100% GOTS-certified organic ring-spun cotton" : idx === 1 ? "e.g. 30-hour uninterrupted battery playtime with fast charging" : "e.g. Premium dual-needle stitching and reinforced seam construction"}
                      className="flex-1 px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-[#7E2532]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveHighlight(idx)}
                      title="Remove highlight"
                      className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Specifications */}
          {categoryAttributes && (
            <div className="space-y-5 pt-4 border-t border-stone-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Leaf Specifications ({categoryAttributes.requiredSpecs.length + categoryAttributes.optionalSpecs.length})
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...categoryAttributes.requiredSpecs, ...categoryAttributes.optionalSpecs].map((spec) => {
                  const currentValue = specificationValues[spec.attributeId]?.attributeValue || '';
                  const resolvedType = getResolvedDataType(spec.dataType);

                  return (
                    <div key={spec.attributeId} className="bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200/80">
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        {spec.attributeName} {spec.isRequired && <span className="text-rose-600">*</span>}
                      </label>

                      {resolvedType === 'OPTIONS' ? (
                        <select
                          value={specificationValues[spec.attributeId]?.attributeValueId || ''}
                          onChange={(e) => {
                            const valId = e.target.value;
                            const matched = (spec.values || []).find((v) => v.attributeValueId === valId);
                            setSpecificationValues((prev) => ({
                              ...prev,
                              [spec.attributeId]: {
                                attributeValueId: valId,
                                attributeValue: matched?.valueName || '',
                              },
                            }));
                          }}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-[#7E2532]"
                        >
                          <option value="">-- Select {spec.attributeName} --</option>
                          {(spec.values || []).map((v) => (
                            <option key={v.attributeValueId} value={v.attributeValueId}>
                              {v.valueName}
                            </option>
                          ))}
                        </select>
                      ) : resolvedType === 'BOOLEAN' ? (
                        <div className="flex items-center gap-4 py-1.5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700">
                            <input
                              type="radio"
                              name={`spec-${spec.attributeId}`}
                              value="true"
                              checked={currentValue === 'true' || currentValue === 'Yes'}
                              onChange={() => {
                                setSpecificationValues((prev) => ({
                                  ...prev,
                                  [spec.attributeId]: { attributeValue: 'true' },
                                }));
                              }}
                              className="text-[#7E2532] focus:ring-[#7E2532]"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700">
                            <input
                              type="radio"
                              name={`spec-${spec.attributeId}`}
                              value="false"
                              checked={currentValue === 'false' || currentValue === 'No'}
                              onChange={() => {
                                setSpecificationValues((prev) => ({
                                  ...prev,
                                  [spec.attributeId]: { attributeValue: 'false' },
                                }));
                              }}
                              className="text-[#7E2532] focus:ring-[#7E2532]"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      ) : (
                        <input
                          type={resolvedType === 'NUMBER' ? 'number' : 'text'}
                          value={currentValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSpecificationValues((prev) => ({
                              ...prev,
                              [spec.attributeId]: { attributeValue: val },
                            }));
                          }}
                          placeholder={`Enter ${spec.attributeName.toLowerCase()}...`}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-[#7E2532]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-stone-100 flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-all cursor-pointer"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              {!canProceedStep2 && (
                <p className="text-[11px] text-amber-700 font-medium">
                  {productName.trim().length < 3
                    ? 'Product name must be at least 3 characters.'
                    : 'Please fill in all mandatory specifications (*).'}
                </p>
              )}
              <button
                type="button"
                disabled={!canProceedStep2}
                onClick={() => {
                  if (categoryAttributes?.variantDefining && categoryAttributes.variantDefining.length === 0) {
                    generateVariantMatrix();
                  }
                  setCurrentStep(3);
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#641D26] to-[#7E2532] hover:from-[#52161E] hover:to-[#641D26] text-white text-xs font-bold shadow-md shadow-rose-950/20 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
              >
                Continue to Variant Matrix
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Variant Matrix Builder */}
      {currentStep === 3 && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-base font-bold text-stone-900">Step 3: Variant Attributes & SKU Matrix</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Select controlled attribute values. The system deterministically computes your VariantSKU matrix.
            </p>
          </div>

          {categoryAttributes?.variantDefining && categoryAttributes.variantDefining.length > 0 ? (
            <div className="space-y-6">
              {categoryAttributes.variantDefining.map((attr) => (
                <div key={attr.attributeId} className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      {attr.attributeName} (Display Order: {attr.displayOrder})
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium">
                      Select all applicable values
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {attr.values.map((val) => {
                      const isSelected = (selectedVariantValues[attr.attributeId] || []).includes(val.attributeValueId);

                      return (
                        <button
                          key={val.attributeValueId}
                          type="button"
                          onClick={() => {
                            handleToggleVariantValue(attr.attributeId, val.attributeValueId);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#7E2532] text-white shadow-sm ring-2 ring-[#7E2532]/20'
                              : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>{val.valueName}</span>
                          <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-white/20' : 'bg-stone-100 text-stone-500'}`}>
                            {val.valueCode}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {unselectedAttrs.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Please choose at least one option for: <strong>{unselectedAttrs.map((a) => a.attributeName).join(', ')}</strong> to complete the variant matrix.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={generateVariantMatrix}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7E2532] to-[#9E2C3F] hover:from-[#641D26] hover:to-[#7E2532] text-white text-xs font-bold transition-all shadow-md shadow-[#7E2532]/20 flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Generate Matrix ({variantRows.length} Variants)
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
              This category has no variant-defining attributes. A standard canonical variant (<code>-STD</code>) will be created.
            </div>
          )}

          {/* Generated Matrix Preview */}
          {variantRows.length > 0 && (
            <div className="border border-stone-200 rounded-2xl overflow-hidden">
              <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 text-xs font-bold text-stone-700 flex items-center justify-between">
                <span>Deterministic VariantSKU Preview Matrix</span>
                <span className="text-[11px] text-[#7E2532] font-semibold">{variantRows.length} SKUs</span>
              </div>
              <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto">
                {variantRows.map((row, idx) => (
                  <div key={row.id} className="px-4 py-3 flex items-center justify-between text-xs bg-white hover:bg-stone-50/50">
                    <div className="flex items-center gap-3">
                      <span className="w-5 font-mono text-[10px] text-stone-400">#{idx + 1}</span>
                      <div className="flex items-center gap-1">
                        {row.attributeValues.map((av, avIdx) => (
                          <span key={avIdx} className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 font-medium text-[11px]">
                            {av.valueName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#7E2532]">
                      [ParentSKU]-{row.previewSkuSuffix}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-all"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!canProceedStep3}
              onClick={() => setCurrentStep(4)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#641D26] to-[#7E2532] hover:from-[#52161E] hover:to-[#641D26] text-white text-xs font-bold shadow-md shadow-rose-950/20 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              Continue to Logistics & Media
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Logistics, Packaging UOM & Media */}
      {currentStep === 4 && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-stone-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900">Step 4: Logistics, Packaging & High-Res Media</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Enter dimensions, HSN code, GST rate, packaging UOM and primary product imagery for each variant.
              </p>
            </div>
            {variantRows.length > 1 && (
              <button
                type="button"
                onClick={handleCopyVariant1ToAll}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                title="Copy HSN code, GST rate, dimensions and primary photo from Variant #1 to all variants"
              >
                <Copy className="w-3.5 h-3.5 text-[#7E2532]" />
                <span>Copy #1 Details to All</span>
              </button>
            )}
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {variantRows.map((v, idx) => (
              <div key={v.id} className="p-4 rounded-2xl border border-stone-200 bg-[#FDFBF7] space-y-3">
                <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#7E2532] text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-xs font-bold text-stone-900">
                      Variant: -{v.previewSkuSuffix}
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      {v.attributeValues.map((av, avIdx) => (
                        <span key={avIdx} className="text-[10px] bg-white border border-stone-200 px-1.5 py-0.5 rounded text-stone-600">
                          {av.valueName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      HSN Code *
                    </label>
                    <input
                      type="text"
                      value={v.hsnCode}
                      onChange={(e) => updateVariantRow(idx, 'hsnCode', e.target.value)}
                      placeholder="e.g. 61091000"
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      GST Rate % *
                    </label>
                    <select
                      value={v.gstRate}
                      onChange={(e) => updateVariantRow(idx, 'gstRate', parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Weight (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={v.weight}
                      onChange={(e) => updateVariantRow(idx, 'weight', e.target.value)}
                      placeholder="0.35"
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Packaging UOM *
                    </label>
                    <select
                      value={v.uomId}
                      onChange={(e) => updateVariantRow(idx, 'uomId', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800"
                    >
                      {uoms.map((u) => (
                        <option key={u.uomId} value={u.uomId}>
                          {u.uomName} ({u.uomCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dimensions L, W, H */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Length (cm)</label>
                    <input
                      type="number"
                      value={v.length}
                      onChange={(e) => updateVariantRow(idx, 'length', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Width (cm)</label>
                    <input
                      type="number"
                      value={v.width}
                      onChange={(e) => updateVariantRow(idx, 'width', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Height (cm)</label>
                    <input
                      type="number"
                      value={v.height}
                      onChange={(e) => updateVariantRow(idx, 'height', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Primary Image Asset Upload & URL */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Primary Image *
                  </label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {v.imageUrl ? (
                      <img
                        src={getImagePreviewUrl(v.imageUrl)}
                        alt="Preview"
                        className="w-12 h-12 rounded-xl object-cover border border-stone-200 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-stone-100 border border-dashed border-stone-300 flex items-center justify-center text-stone-400 shrink-0">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 flex flex-wrap items-center gap-2 w-full">
                      <label className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                        {uploadingVariantIndex === idx ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#7E2532]" />
                        ) : (
                          <UploadCloud className="w-4 h-4 text-[#7E2532]" />
                        )}
                        <span>{uploadingVariantIndex === idx ? 'Uploading...' : v.imageUrl ? 'Change Photo' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={uploadingVariantIndex === idx}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadVariantImage(idx, e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-stone-400 font-semibold uppercase">or URL:</span>
                      <input
                        type="text"
                        value={v.imageUrl}
                        onChange={(e) => updateVariantRow(idx, 'imageUrl', e.target.value)}
                        placeholder="https://... or uploaded image path"
                        className="flex-1 min-w-[200px] px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-stone-100 flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-all cursor-pointer"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              {!canProceedStep4 && (
                <p className="text-[11px] text-amber-700 font-medium bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  Each variant requires an HSN code and Primary Image.
                </p>
              )}
              <button
                type="button"
                disabled={!canProceedStep4}
                onClick={() => setCurrentStep(5)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#641D26] to-[#7E2532] hover:from-[#52161E] hover:to-[#641D26] text-white text-xs font-bold shadow-md shadow-rose-950/20 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
              >
                Review & Submit
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {currentStep === 5 && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-base font-bold text-stone-900">Step 5: Review Catalog Proposal</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Review your proposed product family before submitting to the Marketplace Catalog Quality Control.
            </p>
          </div>

          {/* Proposal Summary Card */}
          <div className="bg-[#FDFBF7] border border-stone-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-200/70">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-stone-200 text-stone-800">
                  {brands.find((b) => b.brandId === selectedBrandId)?.brandName}
                </span>
                <h3 className="text-lg font-black text-stone-900 mt-1">{productName}</h3>
                <span className="text-xs font-medium text-stone-500">
                  Leaf Category: {categories.find((c) => String(c.categoryId ?? c.CategoryID) === selectedCategoryId)?.categoryName || categories.find((c) => String(c.categoryId ?? c.CategoryID) === selectedCategoryId)?.CategoryName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono text-stone-400 block">ParentSKU Rule Preview</span>
                <span className="text-xs font-mono font-bold text-[#7E2532]">
                  {brands.find((b) => b.brandId === selectedBrandId)?.brandCode || 'BRD'}-{categories.find((c) => String(c.categoryId ?? c.CategoryID) === selectedCategoryId)?.categoryCode || 'CAT'}-00000X
                </span>
              </div>
            </div>

            {/* Highlights Review */}
            {highlights.filter((h) => h.trim().length > 0).length > 0 && (
              <div className="pt-2 border-t border-stone-200/70">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#7E2532]" />
                  Key Highlights ({highlights.filter((h) => h.trim().length > 0).length})
                </span>
                <ul className="space-y-1.5">
                  {highlights.filter((h) => h.trim().length > 0).map((h, i) => (
                    <li key={i} className="text-xs text-stone-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7E2532] mt-1.5 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Validation Checklist */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-2">
                Catalog Compliance Checklist
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Strict Leaf Category Mapped</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Permanent ParentSKU Sequence Allocated</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{variantRows.length} ProductVariants Generated</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Controlled Attribute Values Validated</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-all"
            >
              Back
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitProposal}
              className="px-8 py-3 rounded-2xl bg-gradient-to-r from-[#641D26] to-[#7E2532] hover:from-[#52161E] hover:to-[#641D26] text-white text-xs font-bold shadow-lg shadow-rose-950/25 flex items-center gap-2 disabled:opacity-60 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting to Catalog QC...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Submit for Catalog QC Review
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
