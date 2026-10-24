import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileText,
  Percent,
  Hash,
  Globe,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../../lib/axios.js';
import {
  Brand,
  CreateProductFormState,
  ResolvedAttributes,
  SpecEntry,
  AttributeValue,
} from '../../../types/product.js';
import { CategoryTreePicker } from '../components/CategoryTreePicker.js';
import { FeatureTagInput } from '../components/FeatureTagInput.js';
import { showSweetToast } from '../../../lib/swal.js';

interface Step1ProductInfoProps {
  state: CreateProductFormState;
  setField: <K extends keyof CreateProductFormState>(
    field: K,
    value: CreateProductFormState[K]
  ) => void;
  setResolvedAttributes: (payload: ResolvedAttributes, initialSpecs: SpecEntry[]) => void;
}

const COMMON_GST_RATES = [0, 5, 12, 18, 28];

export const Step1ProductInfo: React.FC<Step1ProductInfoProps> = ({
  state,
  setField,
  setResolvedAttributes,
}) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  // Fetch Brands
  useEffect(() => {
    let isMounted = true;
    const fetchBrands = async () => {
      try {
        setLoadingBrands(true);
        const res = await apiClient.get('/catalog/brands');
        if (res.data?.success && isMounted) {
          setBrands(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load brands', err);
      } finally {
        if (isMounted) setLoadingBrands(false);
      }
    };
    fetchBrands();
    return () => {
      isMounted = false;
    };
  }, []);

  // When Leaf Category is selected in CategoryTreePicker
  const handleCategorySelect = async (categoryId: string) => {
    if (categoryId === state.leafCategoryId && state.resolvedAttributes) {
      return;
    }

    setField('leafCategoryId', categoryId);

    try {
      setLoadingAttributes(true);
      const res = await apiClient.get(`/catalog/categories/${categoryId}/attributes`);
      if (res.data?.success) {
        const resolved: ResolvedAttributes = res.data.data;

        const normalizeValues = (vals: any[] = []): AttributeValue[] =>
          vals.map((v) => ({
            attributeValueId: String(v.attributeValueId || v.valueId || v.AttributeValueID || ''),
            valueName: v.valueName || v.ValueName || '',
            valueCode: v.valueCode || v.ValueCode || '',
          }));

        const normalizedResolved: ResolvedAttributes = {
          ...resolved,
          variantDefining: (resolved.variantDefining || []).map((attr) => ({
            ...attr,
            values: normalizeValues(attr.values),
          })),
          requiredSpecs: (resolved.requiredSpecs || []).map((attr) => ({
            ...attr,
            values: normalizeValues(attr.values),
          })),
          optionalSpecs: (resolved.optionalSpecs || []).map((attr) => ({
            ...attr,
            values: normalizeValues(attr.values),
          })),
        };

        // Build default initial specifications from required and optional specs
        const allSpecs = [
          ...(normalizedResolved.requiredSpecs || []),
          ...(normalizedResolved.optionalSpecs || []),
        ];
        const initialSpecs: SpecEntry[] = allSpecs.map((attr) => ({
          attributeId: attr.attributeId,
          attributeName: attr.attributeName,
          dataType: (attr.dataType || attr.attributeType || 'TEXT') as any,
          attributeType: (attr.dataType || attr.attributeType || 'TEXT') as any,
          attributeValueId: '',
          attributeValue: '',
          isRequired: attr.isRequired || false,
          values: attr.values || [],
        }));

        setResolvedAttributes(normalizedResolved, initialSpecs);
      }
    } catch (err: any) {
      console.error('Failed to resolve category attributes', err);
      showSweetToast(
        err.response?.data?.message || 'Failed to fetch category attributes',
        'error'
      );
    } finally {
      setLoadingAttributes(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Category & Brand Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Brand & Leaf Category</h3>
            <p className="text-xs text-slate-500">
              Select the brand manufacturer and the specific leaf category
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Brand Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Brand</span>
              <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="relative">
              <select
                value={state.brandId}
                onChange={(e) => setField('brandId', e.target.value)}
                disabled={loadingBrands}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800"
              >
                <option value="">
                  {loadingBrands ? 'Loading brands...' : 'Select Brand...'}
                </option>
                {brands.map((b) => (
                  <option key={b.brandId} value={b.brandId}>
                    {b.brandName} {b.brandCode ? `(${b.brandCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400">
              Only active brands authorized on the marketplace are available.
            </p>
          </div>

          {/* Category Tree Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Leaf Category (Product Type)</span>
              <span className="text-red-500 font-bold">*</span>
            </label>
            <CategoryTreePicker
              selectedCategoryId={state.leafCategoryId}
              onSelect={handleCategorySelect}
            />
          </div>
        </div>

        {loadingAttributes && (
          <div className="flex items-center gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-700 font-medium animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Resolving inherited attributes and variant-defining options for selected category...</span>
          </div>
        )}
      </div>

      {/* 2. Basic Product Details */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <FileText className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Product Title & Overview</h3>
            <p className="text-xs text-slate-500">
              Provide customer-facing product information
            </p>
          </div>
        </div>

        {/* Product Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Product Title</span>
            <span className="text-red-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={state.productName}
            onChange={(e) => setField('productName', e.target.value)}
            placeholder="e.g. Nike Air Max 270 Men's Running Shoes"
            className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-900"
          />
          <p className="text-[11px] text-slate-400">
            A clear, descriptive name including brand, model, and key category.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Detailed Description</label>
          <textarea
            rows={4}
            value={state.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Describe the product materials, craftsmanship, benefits, usage instructions..."
            className="w-full text-xs border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800 leading-relaxed"
          />
        </div>

        {/* Highlights */}
        <FeatureTagInput
          tags={state.highlights}
          onChange={(tags) => setField('highlights', tags)}
        />
      </div>

      {/* 3. Tax Classification & Model Family (NEW) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Hash className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Tax Classification &amp; Model Family
            </h3>
            <p className="text-xs text-slate-500">
              Product-family level tax codes and model identifiers (shared across all variants)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Base Model Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <span>Base / Family Model Code</span>
            </label>
            <input
              type="text"
              value={state.baseModelCode}
              onChange={(e) => setField('baseModelCode', e.target.value)}
              placeholder="e.g. AH8050, PRE-PC"
              className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
            />
            <p className="text-[11px] text-slate-400">
              Manufacturer parent model family identifier.
            </p>
          </div>

          {/* HSN Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <span>HSN Code (India GST)</span>
            </label>
            <input
              type="text"
              value={state.hsnCode}
              onChange={(e) => setField('hsnCode', e.target.value)}
              placeholder="e.g. 6404, 76151010"
              className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
            />
            <p className="text-[11px] text-slate-400">
              Harmonized System Nomenclature code for invoicing.
            </p>
          </div>

          {/* GST Rate */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Percent className="w-3 h-3 text-indigo-500" />
              <span>GST Rate %</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                value={
                  COMMON_GST_RATES.includes(Number(state.gstRate))
                    ? state.gstRate
                    : state.gstRate === ''
                    ? ''
                    : 'CUSTOM'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setField('gstRate', state.gstRate || 18);
                  } else {
                    setField('gstRate', val === '' ? '' : Number(val));
                  }
                }}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-medium text-slate-800"
              >
                <option value="">Select Rate...</option>
                {COMMON_GST_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}% GST
                  </option>
                ))}
                <option value="CUSTOM">Custom Rate...</option>
              </select>

              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={state.gstRate}
                  onChange={(e) =>
                    setField('gstRate', e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="Rate %"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 pr-7 font-mono"
                />
                <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-semibold">
                  %
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Applicable tax slab for statutory billing.
            </p>
          </div>

          {/* Country of Origin */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Globe className="w-3 h-3 text-indigo-500" />
              <span>Country of Origin</span>
            </label>
            <select
              value={state.countryOfOrigin || 'India'}
              onChange={(e) => setField('countryOfOrigin', e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-medium text-slate-800"
            >
              <option value="India">India</option>
              <option value="China">China</option>
              <option value="Vietnam">Vietnam</option>
              <option value="Bangladesh">Bangladesh</option>
              <option value="Indonesia">Indonesia</option>
              <option value="United States">United States</option>
              <option value="Germany">Germany</option>
              <option value="Japan">Japan</option>
              <option value="South Korea">South Korea</option>
              <option value="Italy">Italy</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Other">Other</option>
            </select>
            <p className="text-[11px] text-slate-400">
              Mandatory legal declaration for packaged commodities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
