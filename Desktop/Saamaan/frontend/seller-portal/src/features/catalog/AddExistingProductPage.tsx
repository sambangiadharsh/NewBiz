import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Package,
  RotateCcw,
  X,
  Clock,
  Warehouse,
  ShieldAlert,
  CheckCircle,
  Check,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { ApiResponse } from '../../types/auth.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';
import { NoResults } from '../../components/common/NoResults.js';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/common/Table';

// ─── Domain Interfaces ─────────────────────────────────────────────────────────

interface VariantAttribute {
  attributeName: string;
  attributeValue: string;
}

interface CatalogVariant {
  productVariantId: string;
  variantSku: string;
  gtin?: string;
  mrp?: number;
  productModelCode?: string;
  hsnCode?: string;
  gstRate?: number;
  alreadyListed: boolean;
  primaryImage?: string;
  attributes: VariantAttribute[];
}

export interface VariantConfig {
  productVariantId: string;
  sellerSku: string;
  mrp: string;
  sellingPrice: string;
  purchasePrice: string;
  allocations: Record<string, number>; // warehouseId -> initialQuantity
  selectedWhIds: Set<string>;
}

interface CatalogProduct {
  productId: string;
  parentSku: string;
  productName: string;
  description?: string;
  highlights?: string[];
  baseModelCode?: string;
  hsnCode?: string;
  gstRate?: number;
  brand?: { brandId: string; brandName: string; brandCode?: string };
  category?: { categoryId: string; categoryName: string; categoryCode?: string };
  isSellerAuthorized: boolean;
  isCategoryPendingApproval?: boolean;
  variants: CatalogVariant[];
}

interface CategoryOption {
  categoryId: number;
  categoryName: string;
  isLeaf?: boolean;
}

interface BrandOption {
  brandId: string;
  brandName: string;
}

interface EligibleWarehouse {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: string;
  city: string;
  state: string;
  addressLine1: string;
  isPrimary: boolean;
  isAssigned: boolean;
  status: string;
}

interface WarehouseAllocationInput {
  warehouseId: string;
  initialQuantity: number;
  poNumber?: string;
  poAmount?: number;
  supplierInvoiceNumber?: string;
  invoiceAmount?: number;
}

const getImagePreviewUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const AddExistingProductPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Wizard Step State ─────────────────────────────────────────────────────
  // 1: Search & Discover
  // 2: Details & Choose Variants (Multi-Select Matrix)
  // 3: Commercial Pricing & Warehouse Allocation Matrix
  // 4: Review & Confirm
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // ── Catalog Search & Filters State ────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<CatalogProduct[]>([]);

  // ── Multi-Variant Selection State ─────────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [variantConfigs, setVariantConfigs] = useState<Record<string, VariantConfig>>({});

  // ── Bulk Fast-Fill State (Step 3) ─────────────────────────────────────────
  const [bulkSellingPrice, setBulkSellingPrice] = useState('');
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
  const [bulkDefaultWarehouseId, setBulkDefaultWarehouseId] = useState('');
  const [bulkDefaultStock, setBulkDefaultStock] = useState('10');
  const [bulkAppliedToast, setBulkAppliedToast] = useState(false);
  const [variantErrors, setVariantErrors] = useState<Record<string, Record<string, string>>>({});

  // ── Warehouse Allocation State ────────────────────────────────────────────
  const [eligibleWarehouses, setEligibleWarehouses] = useState<EligibleWarehouse[]>([]);

  // Optional Logistics info accordion/fields
  const [showAdvancedLogistics, setShowAdvancedLogistics] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [packerName, setPackerName] = useState('');
  const [importerName, setImporterName] = useState('');

  // ── Submission & Celebration State ────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // ── Category Authorization Modal State ────────────────────────────────────
  const [applyModalData, setApplyModalData] = useState<{
    categoryId: string;
    categoryName: string;
    productName: string;
  } | null>(null);
  const [applyRemarks, setApplyRemarks] = useState('');
  const [isSubmittingApply, setIsSubmittingApply] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Pagination for search results
  const { paginatedData: paginatedResults, paginationProps } = usePagination({
    data: results,
    initialPageSize: 6,
    pageSizeOptions: [6, 12, 24],
  });

  // ── Load Categories and Brands ────────────────────────────────────────────
  useEffect(() => {
    apiClient
      .get<ApiResponse<any>>('/categories')
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          const items: CategoryOption[] = res.data.data
            .map((c: any) => ({
              categoryId: Number(c.categoryId ?? c.CategoryID),
              categoryName: String(c.categoryName ?? c.CategoryName),
              isLeaf: Boolean(c.isLeaf),
            }))
            .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
          setCategories(items);
        }
      })
      .catch((err) => console.error('Failed to load categories:', err));

    apiClient
      .get<ApiResponse<any>>('/catalog/brands')
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          const items: BrandOption[] = res.data.data
            .map((b: any) => ({
              brandId: String(b.brandId ?? b.BrandID),
              brandName: String(b.brandName ?? b.BrandName),
            }))
            .sort((a, b) => a.brandName.localeCompare(b.brandName));
          setBrands(items);
        }
      })
      .catch((err) => console.error('Failed to load brands:', err));
  }, []);

  // ── Execute Search ────────────────────────────────────────────────────────
  const executeSearch = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<{ items: CatalogProduct[] }>>(
        '/seller/catalog/search',
        {
          params: {
            q: query.trim() || undefined,
            categoryId: categoryId || undefined,
            brandId: brandId || undefined,
          },
        }
      );

      if (res.data.success && res.data.data) {
        setResults(res.data.data.items || []);
      }
    } catch (err: any) {
      console.error('Catalog search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      executeSearch();
    }, 250);
    return () => clearTimeout(timer);
  }, [query, categoryId, brandId]);

  // ── Load Warehouses ───────────────────────────────────────────────────────
  const fetchEligibleWarehouses = async () => {
    try {
      const res = await apiClient.get<ApiResponse<any[]>>(
        '/seller/catalog/eligible-warehouses'
      );
      if (res.data.success && Array.isArray(res.data.data)) {
        const normalized: EligibleWarehouse[] = res.data.data
          .map((w: any) => ({
            warehouseId: String(w.warehouseId || w.WarehouseID || w.id || ''),
            warehouseName: String(w.warehouseName || w.WarehouseName || w.name || 'Warehouse'),
            warehouseCode: String(w.warehouseCode || w.WarehouseCode || w.code || ''),
            warehouseType: String(w.warehouseType || w.WarehouseType || ''),
            city: String(w.city || w.City || ''),
            state: String(w.state || w.State || ''),
            addressLine1: String(w.addressLine1 || w.AddressLine1 || ''),
            isPrimary: Boolean(w.isPrimary ?? w.IsPrimary),
            isAssigned: Boolean(w.isAssigned ?? w.IsAssigned),
            status: String(w.status || w.Status || 'ACTIVE'),
          }))
          .filter((w) => Boolean(w.warehouseId));

        setEligibleWarehouses(normalized);

        const primary = normalized.find((w) => w.isPrimary) || normalized[0];
        if (primary && !bulkDefaultWarehouseId) {
          setBulkDefaultWarehouseId(primary.warehouseId);
        }
      }
    } catch (err) {
      console.error('Failed to load eligible warehouses:', err);
    }
  };

  // ── Step 1 -> Step 2: Select Master Product ───────────────────────────────
  const handleSelectProduct = (product: CatalogProduct) => {
    setSelectedProduct(product);
    setSelectedVariantIds(new Set());
    setVariantConfigs({});
    fetchEligibleWarehouses();
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Step 2: Multi-Variant Toggles ──────────────────────────────────────────
  const handleToggleVariant = (variantId: string) => {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) {
        next.delete(variantId);
      } else {
        next.add(variantId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (!selectedProduct) return;
    const available = selectedProduct.variants.filter((v) => !v.alreadyListed);
    if (selectedVariantIds.size === available.length && available.length > 0) {
      setSelectedVariantIds(new Set());
    } else {
      setSelectedVariantIds(new Set(available.map((v) => v.productVariantId)));
    }
  };

  // ── Step 2 -> Step 3: Transition to Commercials Matrix ─────────────────────
  const handleProceedToPricing = () => {
    if (!selectedProduct || selectedVariantIds.size === 0) return;

    const brandPrefix = (selectedProduct.brand?.brandCode || selectedProduct.brand?.brandName || 'SKU')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase();

    const primaryWh = eligibleWarehouses.find((w) => w.isPrimary) || eligibleWarehouses[0];
    const defaultWhId = primaryWh ? primaryWh.warehouseId : '';

    setVariantConfigs((prev) => {
      const next = { ...prev };
      selectedProduct.variants.forEach((v) => {
        if (selectedVariantIds.has(v.productVariantId) && !next[v.productVariantId]) {
          const variantSuffix = v.variantSku.split('-').slice(-2).join('-') || v.productVariantId.slice(-4);
          const autoSku = `SEL-${brandPrefix}-${variantSuffix}`;
          const initialWhIds = new Set<string>();
          const initialAlloc: Record<string, number> = {};
          if (defaultWhId) {
            initialWhIds.add(defaultWhId);
            initialAlloc[defaultWhId] = 10;
          }

          next[v.productVariantId] = {
            productVariantId: v.productVariantId,
            sellerSku: autoSku,
            mrp: v.mrp ? String(v.mrp) : '',
            sellingPrice: v.mrp ? String(v.mrp) : '',
            purchasePrice: '',
            allocations: initialAlloc,
            selectedWhIds: initialWhIds,
          };
        }
      });
      return next;
    });

    if (defaultWhId && !bulkDefaultWarehouseId) {
      setBulkDefaultWarehouseId(defaultWhId);
    }

    setVariantErrors({});
    setSubmitError(null);
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Bulk Fast-Fill Tool ────────────────────────────────────────────────────
  const handleApplyBulkCommercials = () => {
    if (!selectedProduct) return;
    setVariantConfigs((prev) => {
      const next = { ...prev };
      selectedVariantIds.forEach((vId) => {
        const cur = next[vId];
        if (cur) {
          const updatedAlloc = { ...cur.allocations };
          const updatedWhIds = new Set(cur.selectedWhIds);

          if (bulkDefaultWarehouseId) {
            updatedWhIds.add(bulkDefaultWarehouseId);
            updatedAlloc[bulkDefaultWarehouseId] = Math.max(0, parseInt(bulkDefaultStock, 10) || 0);
          }

          next[vId] = {
            ...cur,
            sellingPrice: bulkSellingPrice.trim() ? bulkSellingPrice.trim() : cur.sellingPrice,
            purchasePrice: bulkPurchasePrice.trim() ? bulkPurchasePrice.trim() : cur.purchasePrice,
            allocations: updatedAlloc,
            selectedWhIds: updatedWhIds,
          };
        }
      });
      return next;
    });

    setBulkAppliedToast(true);
    setTimeout(() => setBulkAppliedToast(false), 2500);
  };

  // ── Validation for Step 3 ─────────────────────────────────────────────────
  const validateStep3 = () => {
    const allErrors: Record<string, Record<string, string>> = {};
    let isValid = true;
    const seenSkus = new Set<string>();

    selectedVariantIds.forEach((vId) => {
      const cfg = variantConfigs[vId];
      const errs: Record<string, string> = {};

      if (!cfg) {
        errs.general = 'Missing configuration';
        isValid = false;
        allErrors[vId] = errs;
        return;
      }

      if (!cfg.sellerSku.trim()) {
        errs.sellerSku = 'Seller SKU is required';
      } else {
        const lower = cfg.sellerSku.trim().toLowerCase();
        if (seenSkus.has(lower)) {
          errs.sellerSku = 'Duplicate SKU in selection';
        } else {
          seenSkus.add(lower);
        }
      }

      const numMrp = parseFloat(cfg.mrp) || 0;
      const numSelling = parseFloat(cfg.sellingPrice) || 0;
      const numPurchase = parseFloat(cfg.purchasePrice) || 0;

      if (!numSelling || numSelling <= 0) {
        errs.sellingPrice = 'Required > 0';
      } else if (numMrp > 0 && numSelling > numMrp) {
        errs.sellingPrice = 'Cannot exceed MRP';
      }

      if (!numPurchase || numPurchase <= 0) {
        errs.purchasePrice = 'Required > 0';
      } else if (numSelling > 0 && numPurchase > numSelling) {
        errs.purchasePrice = 'Cannot exceed selling price';
      }

      if (cfg.selectedWhIds.size === 0) {
        errs.warehouses = 'Select at least 1 warehouse';
      }

      if (Object.keys(errs).length > 0) {
        allErrors[vId] = errs;
        isValid = false;
      }
    });

    setVariantErrors(allErrors);
    return isValid;
  };

  const handleProceedToReview = () => {
    if (!validateStep3()) return;
    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Final Atomic Batch Submission ─────────────────────────────────────────
  const handleFinalSubmit = async () => {
    if (!selectedProduct || selectedVariantIds.size === 0) return;
    if (!validateStep3()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const itemsPayload = Array.from(selectedVariantIds).map((vId) => {
      const cfg = variantConfigs[vId];
      const allocationsPayload: WarehouseAllocationInput[] = Array.from(cfg.selectedWhIds).map((whId) => {
        const qty = Math.max(0, parseInt(String(cfg.allocations[whId] || 0), 10));
        return {
          warehouseId: whId,
          initialQuantity: qty,
          poNumber: showAdvancedLogistics && poNumber.trim() ? poNumber.trim() : undefined,
          supplierInvoiceNumber: showAdvancedLogistics && supplierInvoiceNumber.trim() ? supplierInvoiceNumber.trim() : undefined,
        };
      });

      return {
        productVariantId: vId,
        sellerSku: cfg.sellerSku.trim(),
        mrp: parseFloat(cfg.mrp) || parseFloat(cfg.sellingPrice) || 0,
        sellingPrice: parseFloat(cfg.sellingPrice) || 0,
        purchasePrice: parseFloat(cfg.purchasePrice) || 0,
        packerName: packerName.trim() || undefined,
        importerName: importerName.trim() || undefined,
        allocations: allocationsPayload,
      };
    });

    try {
      const res = await apiClient.post<ApiResponse<any>>('/seller/catalog/products/batch-onboard', {
        items: itemsPayload,
      });

      if (res.data.success && res.data.data) {
        setSuccessResult(res.data.data);

        // Update local results so these variants are marked alreadyListed
        setResults((prev) =>
          prev.map((p) => {
            if (p.productId === selectedProduct.productId) {
              return {
                ...p,
                variants: p.variants.map((v) =>
                  selectedVariantIds.has(v.productVariantId) ? { ...v, alreadyListed: true } : v
                ),
              };
            }
            return p;
          })
        );

        setSelectedProduct((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            variants: prev.variants.map((v) =>
              selectedVariantIds.has(v.productVariantId) ? { ...v, alreadyListed: true } : v
            ),
          };
        });
      }
    } catch (err: any) {
      console.error('Failed to onboard batch:', err);
      setSubmitError(
        err.response?.data?.message || 'Failed to list variants. Please review pricing and SKUs.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToCatalog = () => {
    setSuccessResult(null);
    setSelectedProduct(null);
    setSelectedVariantIds(new Set());
    setVariantConfigs({});
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Category Authorization Ungating Handler ───────────────────────────────
  const handleOpenCategoryApply = async (catId: string, catName: string, prodName: string) => {
    setApplyModalData({ categoryId: catId, categoryName: catName, productName: prodName });
    setApplyRemarks('');
    setApplyError(null);
  };

  const handleCategoryApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyModalData) return;

    setIsSubmittingApply(true);
    setApplyError(null);

    try {
      const res = await apiClient.post<ApiResponse<any>>(
        `/seller/catalog/categories/${applyModalData.categoryId}/apply`,
        { remarks: applyRemarks.trim() }
      );

      if (res.data.success) {
        setResults((prev) =>
          prev.map((p) =>
            p.category?.categoryId === applyModalData.categoryId
              ? { ...p, isCategoryPendingApproval: true }
              : p
          )
        );
        setApplyModalData(null);
      }
    } catch (err: any) {
      console.error('Category apply error:', err);
      setApplyError(err.response?.data?.message || 'Failed to submit category approval request.');
    } finally {
      setIsSubmittingApply(false);
    }
  };

  // ── Derived Calculations for Review ───────────────────────────────────────
  const selectedVariantsList = selectedProduct
    ? selectedProduct.variants.filter((v) => selectedVariantIds.has(v.productVariantId))
    : [];

  const totalCalculatedUnits = Array.from(selectedVariantIds).reduce((acc, vId) => {
    const cfg = variantConfigs[vId];
    if (!cfg) return acc;
    const variantTotal = Array.from(cfg.selectedWhIds).reduce(
      (sum, whId) => sum + (cfg.allocations[whId] || 0),
      0
    );
    return acc + variantTotal;
  }, 0);

  const avgGrossMargin = (() => {
    let totalMargin = 0;
    let count = 0;
    selectedVariantIds.forEach((vId) => {
      const cfg = variantConfigs[vId];
      if (cfg) {
        const s = parseFloat(cfg.sellingPrice) || 0;
        const p = parseFloat(cfg.purchasePrice) || 0;
        if (s > 0 && p > 0 && s >= p) {
          totalMargin += ((s - p) / s) * 100;
          count++;
        }
      }
    });
    return count > 0 ? (totalMargin / count).toFixed(1) : null;
  })();

  const availableUnlistedCount = selectedProduct
    ? selectedProduct.variants.filter((v) => !v.alreadyListed).length
    : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── Wizard Progress Tracker ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#ECE5DC] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#641D26]/10 text-[#641D26] text-[11px] font-black uppercase tracking-wider">
                Catalog Fast-Onboarding
              </span>
              <span className="text-stone-300">•</span>
              <span className="text-xs text-stone-500 font-semibold">Step {currentStep} of 4</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mt-1">
              {currentStep === 1 && 'Search & Discover Global Catalog'}
              {currentStep === 2 && 'Select Variants & Verify Specifications'}
              {currentStep === 3 && 'Commercial Terms & Fulfillment Matrix'}
              {currentStep === 4 && 'Review & Batch Launch Listings'}
            </h1>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Search' },
              { num: 2, label: 'Variants' },
              { num: 3, label: 'Pricing & Hubs' },
              { num: 4, label: 'Review' },
            ].map((step, idx) => (
              <div key={step.num} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                    currentStep === step.num
                      ? 'bg-[#641D26] text-white shadow-sm ring-4 ring-[#641D26]/10'
                      : currentStep > step.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#FAF8F5] text-stone-400 border border-[#ECE5DC]'
                  }`}
                >
                  {currentStep > step.num ? <Check className="w-4 h-4" /> : step.num}
                </div>
                {idx < 3 && (
                  <div
                    className={`w-6 sm:w-10 h-0.5 rounded-full ${
                      currentStep > step.num ? 'bg-emerald-600' : 'bg-[#ECE5DC]'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 1: SEARCH & DISCOVER GLOBAL CATALOG
         ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {/* Search Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-[#ECE5DC] shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Product Name, Brand, GTIN Barcode, or Model Code..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#FBF9F6] border border-[#ECE5DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#FBF9F6] border border-[#ECE5DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-700"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#FBF9F6] border border-[#ECE5DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-700"
              >
                <option value="">All Brands</option>
                {brands.map((b) => (
                  <option key={b.brandId} value={b.brandId}>
                    {b.brandName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-[#ECE5DC] p-5 shadow-xs space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-xl shimmer shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-20 shimmer rounded" />
                      <div className="h-4 w-40 shimmer rounded" />
                      <div className="h-3 w-28 shimmer rounded" />
                    </div>
                  </div>
                  <div className="h-8 w-full shimmer rounded-xl" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#ECE5DC] p-8 shadow-xs">
              <NoResults
                description={
                  query || categoryId || brandId
                    ? 'No approved catalog products match your search. Try broadening your keywords.'
                    : 'Search our master product database above to start selling immediately.'
                }
                action={{
                  label: 'Propose New Product to Catalog',
                  to: '/products/propose',
                  icon: <Sparkles className="w-4 h-4" />,
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedResults.map((product) => {
                  const firstVariant = product.variants?.[0];
                  const previewUrl = getImagePreviewUrl(firstVariant?.primaryImage);
                  const isAuthorized = product.isSellerAuthorized;
                  const isPending = product.isCategoryPendingApproval;

                  return (
                    <div
                      key={product.productId}
                      className="bg-white rounded-xl border border-[#ECE5DC] p-5 hover:shadow-md hover:border-[#641D26]/30 transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={product.productName}
                              className="w-16 h-16 object-cover rounded-xl border border-stone-200 bg-white shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                              <Package className="w-8 h-8" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              <span className="text-[#641D26] truncate max-w-[120px]">
                                {product.brand?.brandName || 'Generic'}
                              </span>
                              <span>•</span>
                              <span className="truncate max-w-[120px]">{product.category?.categoryName || 'Catalog'}</span>
                            </div>

                            <h3 className="text-sm font-bold text-stone-900 truncate" title={product.productName}>
                              {product.productName}
                            </h3>

                            <p className="font-mono text-[11px] text-stone-400">
                              Parent SKU: <strong>{product.parentSku}</strong>
                            </p>
                          </div>
                        </div>

                        {/* Variant Pill Tag */}
                        <div className="flex items-center justify-between text-[11px] bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#ECE5DC]">
                          <span className="text-stone-500 font-medium">Available Variants:</span>
                          <span className="font-bold text-stone-800">
                            {product.variants?.length || 0} Options
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div>
                        {isAuthorized ? (
                          <button
                            type="button"
                            onClick={() => handleSelectProduct(product)}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>Sell this Product</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : isPending ? (
                          <div className="py-2.5 px-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Approval Pending</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCategoryApply(
                                product.category?.categoryId || '',
                                product.category?.categoryName || 'Category',
                                product.productName
                              )
                            }
                            className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Apply to Sell Category</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Pagination {...paginationProps} itemLabel="catalog products" themeColor="burgundy" />
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 2: DETAILS & MULTI-VARIANT CHECKLIST
         ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 2 && selectedProduct && (
        <div className="space-y-6">
          {/* Master Product Identity Banner */}
          <div className="bg-white rounded-xl border border-[#ECE5DC] p-6 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#641D26]">
                  <span>{selectedProduct.brand?.brandName || 'Generic'}</span>
                  <span className="text-stone-300">•</span>
                  <span className="text-stone-500">{selectedProduct.category?.categoryName}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900">{selectedProduct.productName}</h2>
              </div>

              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-3 py-1.5 rounded-lg border border-[#ECE5DC] hover:bg-stone-50 text-stone-600 text-xs font-bold self-start transition-all"
              >
                Change Product
              </button>
            </div>

            {/* Highlights Chips */}
            {selectedProduct.highlights && selectedProduct.highlights.length > 0 && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
                  Verified Catalog Highlights
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.highlights.map((h, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#ECE5DC] text-xs font-medium text-stone-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#641D26]" />
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Verification Specs Grid */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-2">
                Physical & Compliance Specifications
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">Brand Identity</span>
                  <span className="text-xs font-bold text-stone-800 truncate block">
                    {selectedProduct.brand?.brandName || 'Generic'}
                  </span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">Model / Part No.</span>
                  <span className="font-mono text-xs font-bold text-stone-800 truncate block">
                    {selectedProduct.baseModelCode || selectedProduct.parentSku || 'Standard'}
                  </span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">HSN Code</span>
                  <span className="font-mono text-xs font-bold text-stone-800 truncate block">
                    {selectedProduct.hsnCode || '7323.93'}
                  </span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">GST Rate</span>
                  <span className="text-xs font-bold text-emerald-800 truncate block">
                    {selectedProduct.gstRate ? `${selectedProduct.gstRate}% GST` : 'Standard'}
                  </span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">Parent SKU</span>
                  <span className="font-mono text-xs font-bold text-stone-800 truncate block">
                    {selectedProduct.parentSku}
                  </span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold uppercase text-stone-400 block mb-0.5">Total Variants</span>
                  <span className="text-xs font-bold text-stone-800 truncate block">
                    {selectedProduct.variants?.length || 0} Options
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Variants Multi-Select Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-stone-900">Select Variants to Sell</h3>
                <p className="text-xs text-stone-500">
                  Select one, multiple, or all variants of this product to list them together in a single batch.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#ECE5DC] hover:bg-stone-50 text-xs font-bold text-stone-700 shadow-2xs transition-all cursor-pointer"
                >
                  {selectedVariantIds.size === availableUnlistedCount && availableUnlistedCount > 0
                    ? 'Deselect All'
                    : `Select All Available (${availableUnlistedCount})`}
                </button>

                <div
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                    selectedVariantIds.size > 0
                      ? 'bg-[#641D26] text-white border-[#641D26] shadow-xs'
                      : 'bg-stone-100 text-stone-500 border-stone-200'
                  }`}
                >
                  {selectedVariantIds.size} of {availableUnlistedCount} Selected
                </div>
              </div>
            </div>

            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead align="center" className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedVariantIds.size === availableUnlistedCount && availableUnlistedCount > 0}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 text-[#641D26] rounded focus:ring-[#641D26] cursor-pointer"
                        title="Select All Available Variants"
                      />
                    </TableHead>
                    <TableHead className="w-16">Preview</TableHead>
                    <TableHead>Variant Attributes</TableHead>
                    <TableHead>Catalog Variant SKU</TableHead>
                    <TableHead>GTIN / Barcode</TableHead>
                    <TableHead>Tax Rate</TableHead>
                    <TableHead align="right">Listing Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProduct.variants?.map((v) => {
                    const previewUrl = getImagePreviewUrl(v.primaryImage);
                    const isSelected = selectedVariantIds.has(v.productVariantId);
                    const isListed = v.alreadyListed;

                    return (
                      <TableRow
                        key={v.productVariantId}
                        onClick={() => {
                          if (!isListed) handleToggleVariant(v.productVariantId);
                        }}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-rose-50/60'
                            : isListed
                            ? 'bg-stone-50/60 opacity-60 cursor-not-allowed'
                            : 'hover:bg-stone-50/60'
                        }`}
                      >
                        {/* Checkbox */}
                        <TableCell align="center">
                          {isListed ? (
                            <span className="text-stone-300">—</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleVariant(v.productVariantId)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-[#641D26] rounded focus:ring-[#641D26] cursor-pointer"
                            />
                          )}
                        </TableCell>

                        {/* Thumbnail */}
                        <TableCell>
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={v.variantSku}
                              className="w-11 h-11 object-cover rounded-lg border border-stone-200 bg-white"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                        </TableCell>

                        {/* Attributes */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {v.attributes && v.attributes.length > 0 ? (
                              v.attributes.map((attr, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-xs font-bold text-stone-700 shadow-2xs"
                                >
                                  <span className="text-stone-400 font-semibold">{attr.attributeName}:</span>{' '}
                                  {attr.attributeValue}
                                </span>
                              ))
                            ) : (
                              <span className="text-stone-400 text-xs italic">Standard Variant</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Catalog SKU */}
                        <TableCell>
                          <span className="font-mono text-xs font-bold text-stone-900">{v.variantSku}</span>
                        </TableCell>

                        {/* GTIN */}
                        <TableCell>
                          <span className="font-mono text-xs text-stone-600">{v.gtin || '—'}</span>
                        </TableCell>

                        {/* Tax Rate */}
                        <TableCell>
                          <span className="text-xs font-semibold text-stone-700">
                            {v.gstRate ? `GST ${v.gstRate}%` : 'Standard'}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell align="right">
                          {isListed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                              <Check className="w-3 h-3" /> Already Listed
                            </span>
                          ) : isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#641D26] text-white text-[10px] font-black uppercase shadow-2xs">
                              <Check className="w-3 h-3" /> Selected
                            </span>
                          ) : (
                            <span className="text-xs text-stone-400 font-medium">Available</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-[#ECE5DC]">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 bg-white border border-[#ECE5DC] text-stone-700 hover:text-stone-900 rounded-xl text-xs font-bold shadow-2xs transition-all"
            >
              Cancel & Change Product
            </button>

            <button
              type="button"
              disabled={selectedVariantIds.size === 0}
              onClick={handleProceedToPricing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <span>
                Next: Configure Pricing & Inventory ({selectedVariantIds.size} Variant
                {selectedVariantIds.size > 1 ? 's' : ''})
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 3: COMMERCIAL PRICING & WAREHOUSE ALLOCATION MATRIX
         ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 3 && selectedProduct && selectedVariantIds.size > 0 && (
        <div className="space-y-6">
          {/* Header Context Banner */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#ECE5DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                <Package className="w-5 h-5 text-[#641D26]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-900">{selectedProduct.productName}</h4>
                <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                  <span className="font-semibold text-stone-700">{selectedProduct.brand?.brandName}</span>
                  <span>•</span>
                  <span>Configuring {selectedVariantIds.size} selected variants</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs font-bold text-[#641D26] hover:underline"
            >
              Change Variant Selection
            </button>
          </div>

          {/* ── ⚡ BULK FAST-FILL TOOLBAR ── */}
          <div className="bg-gradient-to-r from-stone-900 to-[#47151C] text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 fill-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Bulk Fast-Fill (Apply to All {selectedVariantIds.size} Variants)</h3>
                  <p className="text-[11px] text-stone-300">
                    Fill values here to copy prices & default warehouse stock across all selected variants in one click.
                  </p>
                </div>
              </div>

              {bulkAppliedToast && (
                <div className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold animate-in fade-in flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Applied to all variants!</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                  Default Selling Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkSellingPrice}
                    onChange={(e) => setBulkSellingPrice(e.target.value)}
                    placeholder="e.g. 799"
                    className="w-full pl-7 pr-3 py-2 bg-stone-800/80 border border-stone-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                  Default Purchase Cost <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkPurchasePrice}
                    onChange={(e) => setBulkPurchasePrice(e.target.value)}
                    placeholder="e.g. 450"
                    className="w-full pl-7 pr-3 py-2 bg-stone-800/80 border border-stone-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                  Default Dispatch Hub
                </label>
                <select
                  value={bulkDefaultWarehouseId}
                  onChange={(e) => setBulkDefaultWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-800/80 border border-stone-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">No Hub (Keep Manual)</option>
                  {eligibleWarehouses.map((wh) => (
                    <option key={wh.warehouseId} value={wh.warehouseId}>
                      {wh.warehouseName} ({wh.warehouseCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                  Default Opening Units
                </label>
                <input
                  type="number"
                  min="0"
                  value={bulkDefaultStock}
                  onChange={(e) => setBulkDefaultStock(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 bg-stone-800/80 border border-stone-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleApplyBulkCommercials}
                  className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-stone-950" />
                  <span>Apply to All Selected</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── VARIANT MATRIX CARDS ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-stone-900">Commercial Specifications per Variant</h3>
                <p className="text-xs text-stone-500">
                  Verify or tweak individual selling prices, purchase costs, and warehouse allocations below.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {selectedVariantsList.map((variant) => {
                const previewUrl = getImagePreviewUrl(variant.primaryImage);
                const cfg = variantConfigs[variant.productVariantId];
                if (!cfg) return null;

                const errors = variantErrors[variant.productVariantId] || {};
                const numSelling = parseFloat(cfg.sellingPrice) || 0;
                const numPurchase = parseFloat(cfg.purchasePrice) || 0;
                const margin =
                  numSelling > 0 && numPurchase > 0 && numSelling >= numPurchase
                    ? (((numSelling - numPurchase) / numSelling) * 100).toFixed(1)
                    : null;

                return (
                  <div
                    key={variant.productVariantId}
                    className="bg-white rounded-2xl border border-[#ECE5DC] p-5 shadow-xs space-y-4 hover:border-[#641D26]/40 transition-colors"
                  >
                    {/* Variant Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                      <div className="flex items-center gap-3">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={variant.variantSku}
                            className="w-12 h-12 object-cover rounded-xl border border-stone-200 bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                            <Package className="w-6 h-6" />
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {variant.attributes && variant.attributes.length > 0 ? (
                              variant.attributes.map((a, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-stone-200 text-xs font-bold text-stone-800"
                                >
                                  <strong>{a.attributeName}:</strong> {a.attributeValue}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs font-bold text-stone-700">Standard Variant</span>
                            )}
                            <span className="text-stone-300">•</span>
                            <span className="font-mono text-[11px] text-stone-500">
                              Catalog: <strong>{variant.variantSku}</strong>
                            </span>
                            {variant.gtin && (
                              <>
                                <span className="text-stone-300">•</span>
                                <span className="font-mono text-[11px] text-stone-400">GTIN: {variant.gtin}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Margin Pill */}
                      {margin && (
                        <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black self-start sm:self-auto">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Gross Margin: +{margin}%</span>
                        </div>
                      )}
                    </div>

                    {/* Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Seller SKU */}
                      <div>
                        <label className="text-[11px] font-bold text-stone-700 block mb-1">
                          Seller SKU <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={cfg.sellerSku}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setVariantConfigs((prev) => ({
                              ...prev,
                              [variant.productVariantId]: { ...cfg, sellerSku: val },
                            }));
                          }}
                          placeholder="e.g. SEL-WHT-M"
                          className={`w-full px-3 py-2 text-xs font-mono font-bold bg-[#FBF9F6] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] ${
                            errors.sellerSku ? 'border-rose-400 bg-rose-50/30' : 'border-[#ECE5DC]'
                          }`}
                        />
                        {errors.sellerSku && <p className="text-[10px] text-rose-600 font-bold mt-1">{errors.sellerSku}</p>}
                      </div>

                      {/* MRP */}
                      <div>
                        <label className="text-[11px] font-bold text-stone-700 block mb-1">
                          MRP (Catalog Maximum)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cfg.mrp}
                            onChange={(e) => {
                              const val = e.target.value;
                              setVariantConfigs((prev) => ({
                                ...prev,
                                [variant.productVariantId]: { ...cfg, mrp: val },
                              }));
                            }}
                            placeholder="e.g. 999"
                            className="w-full pl-7 pr-3 py-2 text-xs font-bold bg-[#FBF9F6] border border-[#ECE5DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26]"
                          />
                        </div>
                      </div>

                      {/* Selling Price */}
                      <div>
                        <label className="text-[11px] font-bold text-stone-700 block mb-1">
                          Customer Selling Price <span className="text-rose-600">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cfg.sellingPrice}
                            onChange={(e) => {
                              const val = e.target.value;
                              setVariantConfigs((prev) => ({
                                ...prev,
                                [variant.productVariantId]: { ...cfg, sellingPrice: val },
                              }));
                            }}
                            placeholder="e.g. 799"
                            className={`w-full pl-7 pr-3 py-2 text-xs font-bold bg-[#FBF9F6] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] ${
                              errors.sellingPrice ? 'border-rose-400 bg-rose-50/30' : 'border-[#ECE5DC]'
                            }`}
                          />
                        </div>
                        {errors.sellingPrice && <p className="text-[10px] text-rose-600 font-bold mt-1">{errors.sellingPrice}</p>}
                      </div>

                      {/* Purchase Price */}
                      <div>
                        <label className="text-[11px] font-bold text-stone-700 block mb-1">
                          Purchase Cost Price <span className="text-rose-600">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cfg.purchasePrice}
                            onChange={(e) => {
                              const val = e.target.value;
                              setVariantConfigs((prev) => ({
                                ...prev,
                                [variant.productVariantId]: { ...cfg, purchasePrice: val },
                              }));
                            }}
                            placeholder="e.g. 450"
                            className={`w-full pl-7 pr-3 py-2 text-xs font-bold bg-[#FBF9F6] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] ${
                              errors.purchasePrice ? 'border-rose-400 bg-rose-50/30' : 'border-[#ECE5DC]'
                            }`}
                          />
                        </div>
                        {errors.purchasePrice && <p className="text-[10px] text-rose-600 font-bold mt-1">{errors.purchasePrice}</p>}
                      </div>
                    </div>

                    {/* Warehouse Node Allocation for this Variant */}
                    <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#ECE5DC] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          Warehouse Node Allocation & Initial Units
                        </span>
                        {errors.warehouses && (
                          <span className="text-[10px] text-rose-600 font-bold">{errors.warehouses}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {eligibleWarehouses.map((wh) => {
                          const isWhSelected = cfg.selectedWhIds.has(wh.warehouseId);
                          const currentQty = cfg.allocations[wh.warehouseId] ?? 0;

                          return (
                            <div
                              key={wh.warehouseId}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                isWhSelected
                                  ? 'bg-white border-[#641D26]/40 shadow-2xs'
                                  : 'bg-stone-50/50 border-stone-200 opacity-70'
                              }`}
                            >
                              <label className="flex items-center gap-2 cursor-pointer min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isWhSelected}
                                  onChange={(e) => {
                                    const nextWhIds = new Set(cfg.selectedWhIds);
                                    const nextAlloc = { ...cfg.allocations };
                                    if (e.target.checked) {
                                      nextWhIds.add(wh.warehouseId);
                                      if (!nextAlloc[wh.warehouseId]) nextAlloc[wh.warehouseId] = 10;
                                    } else {
                                      nextWhIds.delete(wh.warehouseId);
                                    }
                                    setVariantConfigs((prev) => ({
                                      ...prev,
                                      [variant.productVariantId]: {
                                        ...cfg,
                                        selectedWhIds: nextWhIds,
                                        allocations: nextAlloc,
                                      },
                                    }));
                                  }}
                                  className="w-4 h-4 text-[#641D26] rounded focus:ring-[#641D26] cursor-pointer shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-stone-900 truncate">{wh.warehouseName}</p>
                                  <p className="text-[10px] text-stone-400 font-mono truncate">{wh.city || wh.warehouseCode}</p>
                                </div>
                              </label>

                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  disabled={!isWhSelected}
                                  value={currentQty}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    setVariantConfigs((prev) => ({
                                      ...prev,
                                      [variant.productVariantId]: {
                                        ...cfg,
                                        allocations: {
                                          ...cfg.allocations,
                                          [wh.warehouseId]: val,
                                        },
                                      },
                                    }));
                                  }}
                                  className="w-16 px-2 py-1 text-right text-xs font-bold bg-[#FAF8F5] border border-[#ECE5DC] rounded-lg disabled:opacity-40"
                                />
                                <span className="text-[10px] text-stone-400 font-semibold">Units</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Logistics Information */}
          <div className="bg-white rounded-xl border border-[#ECE5DC] p-4">
            <button
              type="button"
              onClick={() => setShowAdvancedLogistics(!showAdvancedLogistics)}
              className="w-full flex items-center justify-between text-left text-xs font-bold text-stone-700 hover:text-stone-900"
            >
              <div className="flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-[#641D26]" />
                <span>Advanced Inbound Logistics (Optional PO & Invoice)</span>
              </div>
              <span className="text-[11px] text-stone-400 font-normal">
                {showAdvancedLogistics ? 'Hide details' : 'Add PO & Invoice info'}
              </span>
            </button>
            {showAdvancedLogistics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-[#ECE5DC]">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    PO Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="e.g. PO-2026-001"
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#ECE5DC] rounded-lg focus:ring-1 focus:ring-[#641D26]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Supplier Invoice Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-98765"
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#ECE5DC] rounded-lg focus:ring-1 focus:ring-[#641D26]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Packer Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={packerName}
                    onChange={(e) => setPackerName(e.target.value)}
                    placeholder="e.g. ABC Packaging Logistics Pvt Ltd"
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#ECE5DC] rounded-lg focus:ring-1 focus:ring-[#641D26]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Importer Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={importerName}
                    onChange={(e) => setImporterName(e.target.value)}
                    placeholder="e.g. XYZ Global Importers India"
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#ECE5DC] rounded-lg focus:ring-1 focus:ring-[#641D26]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-[#ECE5DC]">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 bg-white border border-[#ECE5DC] text-stone-700 hover:text-stone-900 rounded-xl text-xs font-bold shadow-2xs transition-all"
            >
              Back to Variants Selection
            </button>

            <button
              type="button"
              onClick={handleProceedToReview}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <span>Next: Review & Confirm ({selectedVariantIds.size} Variants)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 4: REVIEW & CONFIRM (AND SUCCESS CELEBRATION)
         ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 4 && selectedProduct && selectedVariantIds.size > 0 && (
        <div className="space-y-6">
          {successResult ? (
            /* ── SUCCESS CELEBRATION CARD ── */
            <div className="bg-white rounded-2xl border border-[#ECE5DC] p-8 sm:p-10 shadow-sm text-center space-y-6 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-stone-900">
                  {selectedVariantIds.size} Variants Listed Successfully!
                </h2>
                <p className="text-xs text-stone-500 max-w-lg mx-auto">
                  Your commercial offers for{' '}
                  <strong className="text-stone-800">{selectedProduct.productName}</strong> have been registered in the
                  marketplace and inventory allocation shells created across your fulfillment hubs.
                </p>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold text-stone-400 uppercase block mb-0.5">Variants Listed</span>
                  <span className="text-base font-black text-stone-900">{selectedVariantIds.size} Variants</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold text-stone-400 uppercase block mb-0.5">Initial Inbound Stock</span>
                  <span className="text-base font-black text-stone-900">{totalCalculatedUnits} Units</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#ECE5DC]">
                  <span className="text-[10px] font-bold text-stone-400 uppercase block mb-0.5">Avg Gross Margin</span>
                  <span className="text-base font-black text-emerald-700">
                    {avgGrossMargin ? `+${avgGrossMargin}%` : 'Standard'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleResetToCatalog}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white border border-[#641D26] text-[#641D26] hover:bg-rose-50 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>List Another Catalog Product</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/products')}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#641D26] hover:bg-[#52161E] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>View in My Products Table</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* ── REVIEW SUMMARY CARD ── */
            <div className="space-y-6">
              {submitError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs font-bold text-rose-800">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-[#ECE5DC] p-6 shadow-xs space-y-6">
                <div className="border-b border-stone-100 pb-4">
                  <h3 className="text-base font-black text-stone-900">Review Batch Listing Details</h3>
                  <p className="text-xs text-stone-500">
                    Review and confirm commercial pricing, seller SKUs, and inventory allocations for all{' '}
                    <strong>{selectedVariantIds.size} variants</strong> before publishing.
                  </p>
                </div>

                {/* Top Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#ECE5DC]">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Total Variants</span>
                    <span className="text-lg font-black text-stone-900">{selectedVariantIds.size} Variants</span>
                  </div>
                  <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#ECE5DC]">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Total Allocated Units</span>
                    <span className="text-lg font-black text-stone-900">{totalCalculatedUnits} Units</span>
                  </div>
                  <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#ECE5DC]">
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Average Margin</span>
                    <span className="text-lg font-black text-emerald-700">
                      {avgGrossMargin ? `+${avgGrossMargin}%` : 'Standard'}
                    </span>
                  </div>
                </div>

                {/* Review Table */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                    Variant Offer Breakdown
                  </span>
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variant Attributes</TableHead>
                          <TableHead>Catalog SKU</TableHead>
                          <TableHead>Seller SKU</TableHead>
                          <TableHead>Selling Price</TableHead>
                          <TableHead>Purchase Cost</TableHead>
                          <TableHead>Margin</TableHead>
                          <TableHead align="right">Fulfillment Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedVariantsList.map((v) => {
                          const cfg = variantConfigs[v.productVariantId];
                          if (!cfg) return null;

                          const numSelling = parseFloat(cfg.sellingPrice) || 0;
                          const numPurchase = parseFloat(cfg.purchasePrice) || 0;
                          const margin =
                            numSelling > 0 && numPurchase > 0 && numSelling >= numPurchase
                              ? (((numSelling - numPurchase) / numSelling) * 100).toFixed(1)
                              : '0.0';

                          const totalUnits = Array.from(cfg.selectedWhIds).reduce(
                            (sum, whId) => sum + (cfg.allocations[whId] || 0),
                            0
                          );

                          return (
                            <TableRow key={v.productVariantId}>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {v.attributes?.map((a, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-[10px] font-bold text-stone-800"
                                    >
                                      {a.attributeName}: {a.attributeValue}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs font-bold text-stone-700">{v.variantSku}</span>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded">
                                  {cfg.sellerSku}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-black text-stone-900">₹{numSelling.toFixed(2)}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-semibold text-stone-600">₹{numPurchase.toFixed(2)}</span>
                              </TableCell>
                              <TableCell>
                                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  +{margin}%
                                </span>
                              </TableCell>
                              <TableCell align="right">
                                <span className="font-mono text-xs font-bold text-stone-900">
                                  {totalUnits} units across {cfg.selectedWhIds.size} hub
                                  {cfg.selectedWhIds.size > 1 ? 's' : ''}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>

                {/* Disclaimer */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-500 leading-relaxed">
                  By clicking <strong>Confirm & Launch Batch</strong>, all selected variants will be atomically onboarded
                  to your catalog and tied to the corresponding warehouse fulfillment nodes.
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-[#ECE5DC]">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 bg-white border border-[#ECE5DC] text-stone-700 hover:text-stone-900 rounded-xl text-xs font-bold shadow-2xs transition-all"
                >
                  Back to Pricing
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinalSubmit}
                  className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Onboarding Variants...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Launch {selectedVariantIds.size} Variants</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CATEGORY AUTHORIZATION UNGATING MODAL
         ═══════════════════════════════════════════════════════════════════════ */}
      {applyModalData && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#ECE5DC] shadow-2xl p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2 text-[#641D26]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base font-black text-stone-900">Category Authorization Required</h3>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalData(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              To sell in <strong className="text-stone-900">{applyModalData.categoryName}</strong>, quality approval is
              required to ensure marketplace integrity.
            </p>

            {applyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold">
                {applyError}
              </div>
            )}

            <form onSubmit={handleCategoryApplySubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 block">Application Notes / Remarks</label>
                <textarea
                  rows={3}
                  value={applyRemarks}
                  onChange={(e) => setApplyRemarks(e.target.value)}
                  placeholder="Describe your brand authorization, supplier relationships, or compliance certifications..."
                  className="w-full p-3 text-xs bg-[#FBF9F6] border border-[#ECE5DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyModalData(null)}
                  className="px-4 py-2 rounded-xl border border-[#ECE5DC] text-stone-600 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApply}
                  className="px-5 py-2 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold"
                >
                  {isSubmittingApply ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
