import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Sparkles,
  Barcode,
  Package,
  Check,
  RotateCcw,
  ChevronRight,
  X,
  FileCheck2,
  Clock,
  Warehouse,
  Layers,
  DollarSign,
  Building2,
  Info,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { ApiResponse } from '../../types/auth.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';
import { NoResults } from '../../components/common/NoResults.js';

// --- Domain Interfaces ---
interface VariantAttribute {
  attributeName: string;
  attributeValue: string;
}

interface CatalogVariant {
  productVariantId: string;
  variantSku: string;
  gtin?: string;
  productModelCode?: string;
  hsnCode?: string;
  gstRate?: number;
  alreadyListed: boolean;
  primaryImage?: string;
  attributes: VariantAttribute[];
}

interface CatalogProduct {
  productId: string;
  parentSku: string;
  productName: string;
  description?: string;
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

interface WarehouseAllocationForm {
  warehouseId: string;
  enableOpeningStock: boolean;
  initialQuantity: number;
  poNumber: string;
  poAmount: string;
  supplierInvoiceNumber: string;
  invoiceAmount: string;
}

const getImagePreviewUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const AddExistingProductPage: React.FC = () => {
  // --- Search & Filters ---
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CatalogProduct[]>([]);

  // --- Onboarding Flow State (4-Step Modal Drawer) ---
  const [selectedListing, setSelectedListing] = useState<{
    product: CatalogProduct;
    variant: CatalogVariant;
  } | null>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 2: Commercial Pricing Form
  const [sellerSku, setSellerSku] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [pricingErrors, setPricingErrors] = useState<Record<string, string>>({});

  // Step 3: Multi-Warehouse Node Allocation Form
  const [eligibleWarehouses, setEligibleWarehouses] = useState<EligibleWarehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<Set<string>>(new Set());
  const [warehouseAllocations, setWarehouseAllocations] = useState<Record<string, WarehouseAllocationForm>>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [onboardSuccessData, setOnboardSuccessData] = useState<any | null>(null);

  // --- Category Ungating Modal ---
  const [applyModalData, setApplyModalData] = useState<{
    categoryId: string;
    categoryName: string;
    productName: string;
  } | null>(null);
  const [categoryDocs, setCategoryDocs] = useState<Array<{
    displayName: string;
    code: string;
    isMandatory: boolean;
  }>>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [applyRemarks, setApplyRemarks] = useState('');
  const [isSubmittingApply, setIsSubmittingApply] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Pagination hook
  const { paginatedData: paginatedResults, paginationProps } = usePagination({
    data: results,
    initialPageSize: 6,
    pageSizeOptions: [6, 12, 24],
  });

  // Load categories & brands
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

  // Execute catalog search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  // Initial load and debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, categoryId, brandId]);

  // Open Onboarding Flow for a specific Variant
  const handleOpenOnboarding = async (product: CatalogProduct, variant: CatalogVariant) => {
    setSelectedListing({ product, variant });
    setStep(1);

    // Default SKU generator
    const brandPrefix = (product.brand?.brandCode || product.brand?.brandName || 'SKU')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase();
    const variantSuffix = variant.variantSku.split('-').slice(-2).join('-') || Date.now().toString().slice(-4);
    setSellerSku(`SEL-${brandPrefix}-${variantSuffix}`);

    setMrp('');
    setSellingPrice('');
    setPurchasePrice('');
    setPricingErrors({});
    setSubmitError(null);
    setOnboardSuccessData(null);

    // Fetch eligible warehouses for this seller and variant
    setLoadingWarehouses(true);
    try {
      const res = await apiClient.get<ApiResponse<any[]>>(
        '/seller/catalog/eligible-warehouses',
        { params: { variantId: variant.productVariantId } }
      );
      if (res.data.success && Array.isArray(res.data.data)) {
        const rawWhs = res.data.data;
        const normalizedWhs: EligibleWarehouse[] = rawWhs.map((w: any) => ({
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
        })).filter(w => Boolean(w.warehouseId));

        setEligibleWarehouses(normalizedWhs);

        // Pre-select primary warehouse or all unassigned warehouses by default
        const initialSelected = new Set<string>();
        const initialAllocations: Record<string, WarehouseAllocationForm> = {};

        normalizedWhs.forEach((w) => {
          if (!w.isAssigned) {
            initialSelected.add(w.warehouseId);
            initialAllocations[w.warehouseId] = {
              warehouseId: w.warehouseId,
              enableOpeningStock: false,
              initialQuantity: 0,
              poNumber: '',
              poAmount: '',
              supplierInvoiceNumber: '',
              invoiceAmount: '',
            };
          }
        });

        setSelectedWarehouseIds(initialSelected);
        setWarehouseAllocations(initialAllocations);
      }
    } catch (err) {
      console.error('Failed to load eligible warehouses:', err);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const handleCloseOnboarding = () => {
    setSelectedListing(null);
    setStep(1);
    setSubmitError(null);
    setOnboardSuccessData(null);
  };

  // Pricing calculations
  const numMrp = parseFloat(mrp) || 0;
  const numSelling = parseFloat(sellingPrice) || 0;
  const numPurchase = parseFloat(purchasePrice) || 0;

  const discountPercent = numMrp > 0 && numSelling > 0 && numSelling <= numMrp
    ? (((numMrp - numSelling) / numMrp) * 100).toFixed(1)
    : null;

  const grossMarginPercent = numSelling > 0 && numPurchase > 0
    ? (((numSelling - numPurchase) / numSelling) * 100).toFixed(1)
    : null;

  const unitProfit = numSelling > 0 && numPurchase > 0
    ? (numSelling - numPurchase).toFixed(2)
    : null;

  // Validate step 2
  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (!sellerSku.trim()) errors.sellerSku = 'Seller SKU is required';
    if (!numMrp || numMrp <= 0) errors.mrp = 'MRP must be greater than ₹0';
    if (!numSelling || numSelling <= 0) errors.sellingPrice = 'Selling price must be greater than ₹0';
    if (numSelling > numMrp) errors.sellingPrice = 'Selling price cannot exceed MRP';
    if (numPurchase && numPurchase > numSelling) errors.purchasePrice = 'Purchase price exceeds selling price (Negative margin)';

    setPricingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate step 3
  const validateStep3 = () => {
    if (selectedWarehouseIds.size === 0) {
      setSubmitError('Please select at least one fulfillment warehouse node.');
      return false;
    }
    setSubmitError(null);
    return true;
  };

  // Submit complete onboarding
  const handleFinalSubmit = async () => {
    if (!selectedListing) return;
    if (!validateStep2() || !validateStep3()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const allocationsPayload = Array.from(selectedWarehouseIds).map((whId) => {
      const alloc = warehouseAllocations[whId] || {
        warehouseId: whId,
        enableOpeningStock: false,
        initialQuantity: 0,
      };

      const poAmt = alloc.enableOpeningStock && alloc.poAmount ? parseFloat(String(alloc.poAmount)) : undefined;
      const invAmt = alloc.enableOpeningStock && alloc.invoiceAmount ? parseFloat(String(alloc.invoiceAmount)) : undefined;

      return {
        warehouseId: whId,
        initialQuantity: alloc.enableOpeningStock ? Math.max(0, parseInt(String(alloc.initialQuantity), 10) || 0) : 0,
        poNumber: alloc.enableOpeningStock && alloc.poNumber && alloc.poNumber.trim() ? alloc.poNumber.trim() : undefined,
        poAmount: poAmt !== undefined && !isNaN(poAmt) && poAmt >= 0 ? poAmt : undefined,
        supplierInvoiceNumber: alloc.enableOpeningStock && alloc.supplierInvoiceNumber && alloc.supplierInvoiceNumber.trim() ? alloc.supplierInvoiceNumber.trim() : undefined,
        invoiceAmount: invAmt !== undefined && !isNaN(invAmt) && invAmt >= 0 ? invAmt : undefined,
      };
    });

    const calculatedPurchasePrice = numPurchase > 0 
      ? numPurchase 
      : Math.round(numSelling * 0.7 * 100) / 100;

    try {
      const res = await apiClient.post<ApiResponse<any>>('/seller/catalog/products/onboard', {
        productVariantId: selectedListing.variant.productVariantId,
        sellerSku: sellerSku.trim(),
        mrp: numMrp,
        sellingPrice: numSelling,
        purchasePrice: calculatedPurchasePrice,
        allocations: allocationsPayload,
      });

      if (res.data.success && res.data.data) {
        setOnboardSuccessData(res.data.data);

        // Update local results so variant is marked as listed
        setResults((prev) =>
          prev.map((p) => {
            if (p.productId === selectedListing.product.productId) {
              return {
                ...p,
                variants: p.variants.map((v) =>
                  v.productVariantId === selectedListing.variant.productVariantId
                    ? { ...v, alreadyListed: true }
                    : v
                ),
              };
            }
            return p;
          })
        );
      }
    } catch (err: any) {
      const errorObj = err.response?.data?.error;
      let msg = errorObj?.message || err.response?.data?.message || err.message || 'Failed to list product and allocate warehouses.';
      if (errorObj?.details && Array.isArray(errorObj.details)) {
        const detailMsgs = errorObj.details
          .map((d: any) => (d.message ? `${d.field ? d.field + ': ' : ''}${d.message}` : String(d)))
          .join(', ');
        if (detailMsgs) msg = `${msg} (${detailMsgs})`;
      }
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Warehouse selection toggles
  const toggleWarehouse = (whId: string) => {
    setSelectedWarehouseIds((prev) => {
      const next = new Set(prev);
      if (next.has(whId)) {
        next.delete(whId);
      } else {
        next.add(whId);
        if (!warehouseAllocations[whId]) {
          setWarehouseAllocations((wa) => ({
            ...wa,
            [whId]: {
              warehouseId: whId,
              enableOpeningStock: false,
              initialQuantity: 0,
              poNumber: '',
              poAmount: '',
              supplierInvoiceNumber: '',
              invoiceAmount: '',
            },
          }));
        }
      }
      return next;
    });
  };

  const toggleSelectAllWarehouses = () => {
    const unassigned = eligibleWarehouses.filter((w) => !w.isAssigned);
    if (selectedWarehouseIds.size === unassigned.length) {
      setSelectedWarehouseIds(new Set());
    } else {
      const allIds = new Set(unassigned.map((w) => w.warehouseId));
      setSelectedWarehouseIds(allIds);
      unassigned.forEach((w) => {
        if (!warehouseAllocations[w.warehouseId]) {
          setWarehouseAllocations((wa) => ({
            ...wa,
            [w.warehouseId]: {
              warehouseId: w.warehouseId,
              enableOpeningStock: false,
              initialQuantity: 0,
              poNumber: '',
              poAmount: '',
              supplierInvoiceNumber: '',
              invoiceAmount: '',
            },
          }));
        }
      });
    }
  };

  const updateWarehouseAllocation = (whId: string, updates: Partial<WarehouseAllocationForm>) => {
    setWarehouseAllocations((prev) => ({
      ...prev,
      [whId]: {
        ...(prev[whId] || {
          warehouseId: whId,
          enableOpeningStock: false,
          initialQuantity: 0,
          poNumber: '',
          poAmount: '',
          supplierInvoiceNumber: '',
          invoiceAmount: '',
        }),
        ...updates,
      },
    }));
  };

  // --- Category Ungating flow ---
  const handleOpenCategoryApply = async (categoryId: string, categoryName: string, productName: string) => {
    setApplyModalData({ categoryId, categoryName, productName });
    setApplyError(null);
    setApplyRemarks('');
    setLoadingDocs(true);

    try {
      const res = await apiClient.get<ApiResponse<any>>(`/catalog/categories/${categoryId}/documents`);
      if (res.data.success && Array.isArray(res.data.data)) {
        setCategoryDocs(
          res.data.data.map((d: any) => ({
            displayName: d.DisplayName || d.displayName || 'Category Document',
            code: d.Code || d.code || 'DOC',
            isMandatory: Boolean(d.IsMandatory ?? d.isMandatory),
          }))
        );
      } else {
        setCategoryDocs([]);
      }
    } catch {
      setCategoryDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleApplyCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyModalData) return;

    setIsSubmittingApply(true);
    setApplyError(null);

    try {
      const res = await apiClient.post<ApiResponse<any>>(
        `/seller/catalog/categories/${applyModalData.categoryId}/apply`,
        { remarks: applyRemarks.trim() || 'Seller requested category ungating for existing catalog listing' }
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
      setApplyError(err.response?.data?.message || 'Failed to submit category authorization request.');
    } finally {
      setIsSubmittingApply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Architectural Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E8E1D7] shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider mb-2">
            <Layers className="w-4 h-4 text-[#7E2532]" />
            <span>Product Architecture & Fulfillment Flow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#221C1E]">
            Add Existing Product
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-2xl font-medium">
            Piggyback on verified platform listings. Set your commercial pricing, allocate warehouse fulfillment nodes, and initialize inventory.
          </p>

          {/* Architectural Hierarchy Visual Pill */}
          <div className="mt-4 inline-flex flex-wrap items-center gap-2 p-2 bg-[#FBF9F6] border border-[#E8E1D7] rounded-2xl text-[11px] font-semibold text-stone-600">
            <span className="px-2 py-0.5 rounded-lg bg-stone-200/80 text-stone-800 font-bold">1. Product Master</span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-[#7E2532] font-bold">2. Seller Product</span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-bold">3. Warehouse Product</span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold">4. Inventory & Ledger</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-colors"
          >
            <Package className="w-4 h-4 text-stone-600" />
            <span>My Listings</span>
          </Link>
          <Link
            to="/products/propose"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold text-xs shadow-md shadow-rose-950/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Propose New Product</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-[#E8E1D7] shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Product Title, GTIN / Barcode, Variant SKU, Brand..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] focus:border-transparent transition-all font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-700"
            >
              <option value="">All Product Categories</option>
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.categoryName} {c.isLeaf ? '(Product Type)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-700"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.brandId} value={b.brandId}>
                  {b.brandName}
                </option>
              ))}
            </select>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span>Showing <strong className="text-stone-900">{results.length}</strong> catalog items</span>
            {(query || categoryId || brandId) && (
              <button
                onClick={() => {
                  setQuery('');
                  setCategoryId('');
                  setBrandId('');
                }}
                className="text-[#7E2532] hover:underline font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Category Approved
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Approval Required
            </span>
          </div>
        </div>
      </div>

      {/* Catalog Search Results Grid */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-[#E8E1D7] p-16 text-center shadow-sm">
          <div className="inline-block animate-spin text-[#641D26] mb-3">
            <Loader2 className="w-8 h-8" />
          </div>
          <p className="text-sm text-stone-600 font-semibold">Searching Master Catalog...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#E8E1D7] p-8 shadow-sm">
          <NoResults
            description="Try adjusting your search terms or filters. If the product is not present in our global catalog, you can propose it for Catalog QC review."
            action={{
              label: 'Propose New Product to Catalog',
              to: '/products/propose',
              icon: <Sparkles className="w-4 h-4 text-[#F7CBD2]" />,
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {paginatedResults.map((product) => {
              const brandName = product.brand?.brandName || 'Generic';
              const categoryName = product.category?.categoryName || 'General';
              const isAuthorized = product.isSellerAuthorized;
              const isPending = product.isCategoryPendingApproval;

              return (
                <div
                  key={product.productId}
                  className="bg-white rounded-3xl border border-[#E8E1D7] p-6 hover:shadow-md hover:border-[#641D26]/30 transition-all duration-200"
                >
                  {/* Master Product Row */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-stone-100">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-800 text-[11px] font-bold uppercase tracking-wider">
                          {brandName}
                        </span>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs font-semibold text-stone-600">
                          {categoryName}
                        </span>
                        <span className="text-stone-300">•</span>
                        <span className="font-mono text-xs text-stone-400">
                          Parent SKU: {product.parentSku}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-stone-900">
                        {product.productName}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-stone-500 line-clamp-2 max-w-3xl">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Authorization Status Badge */}
                    <div className="shrink-0 flex items-center gap-2">
                      {isAuthorized ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Eligible to Sell</span>
                        </div>
                      ) : isPending ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Category Approval Pending</span>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            handleOpenCategoryApply(
                              product.category?.categoryId || '',
                              categoryName,
                              product.productName
                            )
                          }
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all shadow-sm"
                        >
                          <ShieldAlert className="w-4 h-4 text-amber-600" />
                          <span>Apply for Category Approval</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Available Sellable Variants Matrix */}
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
                      <span>Available Sellable Variants ({product.variants?.length || 0})</span>
                      <span className="text-[11px] normal-case text-stone-400 font-medium">
                        Select a variant to define your commercial price and warehouse routing
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {product.variants?.map((v) => {
                        const previewUrl = getImagePreviewUrl(v.primaryImage);

                        return (
                          <div
                            key={v.productVariantId}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                              v.alreadyListed
                                ? 'bg-stone-50/70 border-stone-200'
                                : 'bg-[#FBF9F6] border-[#E8E1D7] hover:border-[#641D26] hover:bg-white'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {previewUrl ? (
                                <img
                                  src={previewUrl}
                                  alt={v.variantSku}
                                  className="w-14 h-14 object-cover rounded-xl border border-stone-200 shrink-0 bg-white"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                                  <Package className="w-6 h-6" />
                                </div>
                              )}

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-xs font-bold text-stone-900 truncate">
                                    {v.variantSku}
                                  </span>
                                  {v.alreadyListed && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase shrink-0">
                                      Listed
                                    </span>
                                  )}
                                </div>

                                {v.gtin && (
                                  <div className="flex items-center gap-1 text-[11px] text-stone-500 font-mono">
                                    <Barcode className="w-3.5 h-3.5 text-stone-400" />
                                    <span>GTIN: {v.gtin}</span>
                                  </div>
                                )}

                                {/* Attributes tags */}
                                {v.attributes && v.attributes.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {v.attributes.map((attr, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-[10px] font-semibold text-stone-700"
                                      >
                                        <strong className="text-stone-500">{attr.attributeName}:</strong> {attr.attributeValue}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action Button */}
                            <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between">
                              <div className="text-[11px] text-stone-400">
                                {v.gstRate ? `GST: ${v.gstRate}%` : 'Tax verified'}
                              </div>

                              {v.alreadyListed ? (
                                <Link
                                  to="/products"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-stone-600 hover:text-stone-900"
                                >
                                  <span>View in Listings</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                              ) : isAuthorized ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenOnboarding(product, v)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold shadow-sm shadow-rose-950/20 active:scale-95 transition-all"
                                >
                                  <span>Sell This Variant</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-700">
                                  Requires Approval
                                </span>
                              )}
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

          <Pagination {...paginationProps} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4-STEP ONBOARDING MODAL / SLIDE-OVER DRAWER (Production-Grade UI)          */}
      {/* ========================================================================= */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-[#E8E1D7] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header & Step Indicator */}
            <div className="px-6 py-5 bg-[#FBF9F6] border-b border-[#E8E1D7] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider">
                  <span>Step {step} of 4</span>
                  <span className="text-stone-300">•</span>
                  <span>{step === 1 ? 'Product Specification' : step === 2 ? 'Pricing & Margin' : step === 3 ? 'Warehouse Fulfillment' : 'Review & Confirm'}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 mt-0.5">
                  Add Product to Your Catalog
                </h2>
              </div>
              <button
                onClick={handleCloseOnboarding}
                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-4 border-b border-[#E8E1D7] text-center text-xs font-bold">
              {[
                { num: 1, label: 'Specification' },
                { num: 2, label: 'Pricing & Margin' },
                { num: 3, label: 'Warehouses' },
                { num: 4, label: 'Review' },
              ].map((s) => (
                <div
                  key={s.num}
                  className={`py-2.5 transition-colors flex items-center justify-center gap-1.5 ${
                    step === s.num
                      ? 'bg-white text-[#641D26] border-b-2 border-[#641D26] font-extrabold shadow-sm'
                      : step > s.num
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-stone-100/50 text-stone-400'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step === s.num
                        ? 'bg-[#641D26] text-white'
                        : step > s.num
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {step > s.num ? '✓' : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {submitError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 text-xs">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong className="block font-bold">Listing Error</strong>
                    <span>{submitError}</span>
                  </div>
                </div>
              )}

              {/* SUCCESS CELEBRATION VIEW */}
              {onboardSuccessData ? (
                <div className="py-8 text-center space-y-5">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-stone-900">
                      Product Successfully Listed for Sale!
                    </h3>
                    <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 font-medium">
                      Product added to your catalog under Seller SKU <strong>{onboardSuccessData.sellerSku}</strong> with {onboardSuccessData.totalAllocatedNodes} warehouse node(s) and {onboardSuccessData.totalInitialUnits} opening inventory units.
                    </p>
                  </div>

                  <div className="max-w-md mx-auto p-4 rounded-2xl bg-[#FBF9F6] border border-[#E8E1D7] text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-stone-500 font-semibold">Seller Product ID:</span>
                      <span className="font-mono font-bold text-stone-800">{onboardSuccessData.sellerProductId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500 font-semibold">Selling Price:</span>
                      <span className="font-bold text-stone-800">₹{onboardSuccessData.sellingPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500 font-semibold">Allocated Nodes:</span>
                      <span className="font-bold text-stone-800">{onboardSuccessData.warehouses?.length || 0} Facilities</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-3">
                    <Link
                      to="/products"
                      className="px-5 py-2.5 rounded-xl bg-[#641D26] text-white font-bold text-xs shadow-md hover:bg-[#52161E] transition-all"
                    >
                      Go to My Listed Products
                    </Link>
                    <button
                      onClick={handleCloseOnboarding}
                      className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-colors"
                    >
                      List Another Variant
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* STEP 1: SPECIFICATION & VARIANT DETAILS */}
                  {step === 1 && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 leading-relaxed">
                          <strong>Level 1 Product Master:</strong> You are adding this approved catalog product with your own selling price and warehouse fulfillment. Attributes, media, HSN code, and GST rates are pre-verified by catalog QC.
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-[#FBF9F6] border border-[#E8E1D7] flex flex-col sm:flex-row gap-5">
                        {getImagePreviewUrl(selectedListing.variant.primaryImage) ? (
                          <img
                            src={getImagePreviewUrl(selectedListing.variant.primaryImage)}
                            alt={selectedListing.variant.variantSku}
                            className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl border border-stone-200 bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                            <Package className="w-10 h-10" />
                          </div>
                        )}

                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-stone-200 text-stone-800 text-[10px] font-bold uppercase">
                              {selectedListing.product.brand?.brandName || 'Generic'}
                            </span>
                            <span className="text-xs text-stone-500 font-medium">
                              {selectedListing.product.category?.categoryName || 'General'}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-stone-900">
                            {selectedListing.product.productName}
                          </h3>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
                            <div className="p-2 rounded-xl bg-white border border-stone-200">
                              <span className="text-[10px] font-semibold text-stone-400 block uppercase">Variant SKU</span>
                              <span className="font-mono font-bold text-stone-800 truncate block">
                                {selectedListing.variant.variantSku}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-white border border-stone-200">
                              <span className="text-[10px] font-semibold text-stone-400 block uppercase">GTIN / EAN</span>
                              <span className="font-mono font-bold text-stone-800 truncate block">
                                {selectedListing.variant.gtin || 'N/A'}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-white border border-stone-200">
                              <span className="text-[10px] font-semibold text-stone-400 block uppercase">GST / HSN</span>
                              <span className="font-bold text-stone-800 truncate block">
                                {selectedListing.variant.gstRate ? `${selectedListing.variant.gstRate}%` : 'Standard'} ({selectedListing.variant.hsnCode || 'HSN-GEN'})
                              </span>
                            </div>
                          </div>

                          {selectedListing.variant.attributes?.length > 0 && (
                            <div className="pt-2 flex flex-wrap gap-1.5">
                              {selectedListing.variant.attributes.map((attr, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs font-semibold text-stone-800 shadow-2xs"
                                >
                                  <strong className="text-stone-500">{attr.attributeName}:</strong> {attr.attributeValue}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: COMMERCIAL PRICING & MARGIN ANALYSIS */}
                  {step === 2 && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
                        <DollarSign className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-900 leading-relaxed">
                          <strong>Level 2 Pricing & Selling Details:</strong> Set your selling price and inventory purchase cost. The customer selling price cannot exceed the Maximum Retail Price (MRP).
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                            <span>Seller SKU (Your Internal Inventory Code) *</span>
                            <span className="text-[11px] text-stone-400 font-normal">Must be unique to your account</span>
                          </label>
                          <input
                            type="text"
                            value={sellerSku}
                            onChange={(e) => setSellerSku(e.target.value.toUpperCase())}
                            placeholder="e.g. SEL-SHOE-BLK-42"
                            className={`w-full px-4 py-2.5 text-sm font-mono font-bold bg-[#FBF9F6] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] ${
                              pricingErrors.sellerSku ? 'border-rose-400 bg-rose-50/30' : 'border-[#E8E1D7]'
                            }`}
                          />
                          {pricingErrors.sellerSku && (
                            <p className="text-[11px] font-bold text-rose-600">{pricingErrors.sellerSku}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-800">
                            Maximum Retail Price (MRP ₹) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              value={mrp}
                              onChange={(e) => setMrp(e.target.value)}
                              placeholder="e.g. 2999"
                              className={`w-full pl-8 pr-4 py-2.5 text-sm font-bold bg-[#FBF9F6] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] ${
                                pricingErrors.mrp ? 'border-rose-400 bg-rose-50/30' : 'border-[#E8E1D7]'
                              }`}
                            />
                          </div>
                          {pricingErrors.mrp && (
                            <p className="text-[11px] font-bold text-rose-600">{pricingErrors.mrp}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-800">
                            Selling Price (Customer Price ₹) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              value={sellingPrice}
                              onChange={(e) => setSellingPrice(e.target.value)}
                              placeholder="e.g. 2499"
                              className={`w-full pl-8 pr-4 py-2.5 text-sm font-bold bg-[#FBF9F6] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] ${
                                pricingErrors.sellingPrice ? 'border-rose-400 bg-rose-50/30' : 'border-[#E8E1D7]'
                              }`}
                            />
                          </div>
                          {pricingErrors.sellingPrice && (
                            <p className="text-[11px] font-bold text-rose-600">{pricingErrors.sellingPrice}</p>
                          )}
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                            <span>Purchase / Cost Price (₹)</span>
                            <span className="text-[11px] text-stone-400 font-normal">Confidential — used for margin analytics</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={purchasePrice}
                              onChange={(e) => setPurchasePrice(e.target.value)}
                              placeholder="e.g. 1600"
                              className={`w-full pl-8 pr-4 py-2.5 text-sm font-bold bg-[#FBF9F6] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] ${
                                pricingErrors.purchasePrice ? 'border-rose-400 bg-rose-50/30' : 'border-[#E8E1D7]'
                              }`}
                            />
                          </div>
                          {pricingErrors.purchasePrice && (
                            <p className="text-[11px] font-bold text-rose-600">{pricingErrors.purchasePrice}</p>
                          )}
                        </div>
                      </div>

                      {/* Live Margin & Profitability Metrics Gauge */}
                      {numSelling > 0 && numMrp > 0 && (
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FBF9F6] to-stone-50 border border-[#E8E1D7] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                              <TrendingUp className="w-4 h-4 text-[#7E2532]" />
                              <span>Live Profit & Margin Breakdown</span>
                            </span>
                            {grossMarginPercent && (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                                  Number(grossMarginPercent) >= 25
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : Number(grossMarginPercent) >= 10
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {Number(grossMarginPercent) >= 25 ? 'Healthy Margin' : Number(grossMarginPercent) >= 10 ? 'Moderate Margin' : 'Thin Margin'}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-3 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
                              <span className="text-[11px] font-semibold text-stone-400 block uppercase">Customer Discount</span>
                              <span className="text-lg font-black text-rose-600 block mt-0.5">
                                {discountPercent ? `${discountPercent}%` : '0%'}
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
                              <span className="text-[11px] font-semibold text-stone-400 block uppercase">Gross Margin</span>
                              <span className="text-lg font-black text-emerald-600 block mt-0.5">
                                {grossMarginPercent ? `${grossMarginPercent}%` : '--'}
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
                              <span className="text-[11px] font-semibold text-stone-400 block uppercase">Net Profit / Unit</span>
                              <span className="text-lg font-black text-stone-900 block mt-0.5">
                                {unitProfit ? `₹${unitProfit}` : '--'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 3: MULTI-WAREHOUSE NODE ALLOCATION & STOCK SETUP */}
                  {step === 3 && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-3">
                        <Warehouse className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-indigo-900 leading-relaxed">
                          <strong>Level 3 & 4 Routing & Stock Ledgers:</strong> Select which authorized warehouses will fulfill this product. Initial quantity is set to 0 by default, waiting for inbound warehouse receipt (GRN). You can optionally declare opening stock.
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                          Authorized Warehouse Facilities ({eligibleWarehouses.length})
                        </span>
                        {eligibleWarehouses.filter((w) => !w.isAssigned).length > 0 && (
                          <button
                            type="button"
                            onClick={toggleSelectAllWarehouses}
                            className="text-xs font-bold text-[#641D26] hover:underline"
                          >
                            {selectedWarehouseIds.size === eligibleWarehouses.filter((w) => !w.isAssigned).length
                              ? 'Deselect All'
                              : 'Select All Unassigned Warehouses'}
                          </button>
                        )}
                      </div>

                      {loadingWarehouses ? (
                        <div className="p-10 text-center text-stone-500 text-xs">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#641D26] mb-2" />
                          Loading authorized warehouses...
                        </div>
                      ) : eligibleWarehouses.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-stone-50 border border-dashed border-stone-300 text-center text-xs text-stone-500">
                          <Building2 className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                          <p className="font-bold text-stone-800">No Authorized Warehouses Found</p>
                          <p className="mt-1 max-w-sm mx-auto">
                            You must link or be invited to at least one fulfillment warehouse before listing products.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {eligibleWarehouses.map((wh) => {
                            const isSelected = selectedWarehouseIds.has(wh.warehouseId);
                            const isAssigned = wh.isAssigned;
                            const alloc = warehouseAllocations[wh.warehouseId] || {
                              warehouseId: wh.warehouseId,
                              enableOpeningStock: false,
                              initialQuantity: 0,
                              poNumber: '',
                              poAmount: '',
                              supplierInvoiceNumber: '',
                              invoiceAmount: '',
                            };

                            return (
                              <div
                                key={wh.warehouseId}
                                className={`rounded-2xl border transition-all p-4 ${
                                  isAssigned
                                    ? 'bg-stone-50 border-stone-200 opacity-60'
                                    : isSelected
                                    ? 'bg-white border-[#641D26] shadow-sm'
                                    : 'bg-[#FBF9F6] border-[#E8E1D7] hover:border-stone-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <label className="flex items-start gap-3 cursor-pointer select-none flex-1">
                                    <input
                                      type="checkbox"
                                      disabled={isAssigned}
                                      checked={isSelected || isAssigned}
                                      onChange={() => toggleWarehouse(wh.warehouseId)}
                                      className="w-4 h-4 mt-1 rounded text-[#641D26] focus:ring-[#641D26]"
                                    />
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-stone-900">
                                          {wh.warehouseName}
                                        </span>
                                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-bold">
                                          {wh.warehouseCode}
                                        </span>
                                        {wh.isPrimary && (
                                          <span className="px-2 py-0.5 rounded bg-rose-100 text-[#7E2532] text-[10px] font-extrabold uppercase">
                                            Primary Hub
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-stone-500 mt-0.5">
                                        {wh.addressLine1}, {wh.city}, {wh.state}
                                      </p>
                                    </div>
                                  </label>

                                  <div>
                                    {isAssigned ? (
                                      <span className="px-2.5 py-1 rounded-lg bg-stone-200 text-stone-700 text-xs font-bold">
                                        Already Assigned
                                      </span>
                                    ) : isSelected ? (
                                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Allocated</span>
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-500 text-xs font-semibold">
                                        Unallocated
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Optional Opening Stock Intake Box */}
                                {isSelected && !isAssigned && (
                                  <div className="mt-4 pt-4 border-t border-stone-100 space-y-3 pl-7">
                                    <div className="flex items-center justify-between">
                                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-700">
                                        <input
                                          type="checkbox"
                                          checked={alloc.enableOpeningStock}
                                          onChange={(e) =>
                                            updateWarehouseAllocation(wh.warehouseId, {
                                              enableOpeningStock: e.target.checked,
                                              initialQuantity: e.target.checked ? (alloc.initialQuantity || 10) : 0,
                                            })
                                          }
                                          className="w-3.5 h-3.5 rounded text-[#641D26] focus:ring-[#641D26]"
                                        />
                                        <span>Declare Direct Opening Inventory Units</span>
                                      </label>
                                      <span className="text-[11px] text-stone-400">
                                        {alloc.enableOpeningStock ? 'Signed +Units recorded' : 'Zero-stock shell (Default)'}
                                      </span>
                                    </div>

                                    {alloc.enableOpeningStock && (
                                      <div className="p-3.5 rounded-xl bg-[#FBF9F6] border border-[#E8E1D7] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                                        <div className="space-y-1">
                                          <label className="text-[11px] font-bold text-stone-700">Opening Units *</label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={alloc.initialQuantity}
                                            onChange={(e) =>
                                              updateWarehouseAllocation(wh.warehouseId, {
                                                initialQuantity: parseInt(e.target.value, 10) || 0,
                                              })
                                            }
                                            placeholder="Units"
                                            className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#641D26]"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[11px] font-bold text-stone-700">PO Number (Optional)</label>
                                          <input
                                            type="text"
                                            value={alloc.poNumber}
                                            onChange={(e) =>
                                              updateWarehouseAllocation(wh.warehouseId, { poNumber: e.target.value })
                                            }
                                            placeholder="e.g. PO-2026-001"
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#641D26]"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[11px] font-bold text-stone-700">Supplier Invoice (Optional)</label>
                                          <input
                                            type="text"
                                            value={alloc.supplierInvoiceNumber}
                                            onChange={(e) =>
                                              updateWarehouseAllocation(wh.warehouseId, { supplierInvoiceNumber: e.target.value })
                                            }
                                            placeholder="e.g. INV-9844"
                                            className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#641D26]"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 4: REVIEW & ATOMIC LAUNCH */}
                  {step === 4 && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-900 leading-relaxed">
                          <strong>Ready for Final Onboarding:</strong> Review your commercial terms and allocated fulfillment nodes. When you submit, our system atomically provisions all 4 architectural levels.
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* Summary: Product & Variant */}
                        <div className="p-4 rounded-2xl bg-[#FBF9F6] border border-[#E8E1D7] space-y-2">
                          <span className="font-bold uppercase tracking-wider text-stone-400 block text-[11px]">
                            1. Product Master Identity
                          </span>
                          <p className="font-bold text-sm text-stone-900">
                            {selectedListing.product.productName}
                          </p>
                          <div className="space-y-1 text-stone-600">
                            <div><strong>Brand:</strong> {selectedListing.product.brand?.brandName || 'Generic'}</div>
                            <div><strong>Variant SKU:</strong> <span className="font-mono">{selectedListing.variant.variantSku}</span></div>
                            <div><strong>GTIN:</strong> <span className="font-mono">{selectedListing.variant.gtin || 'N/A'}</span></div>
                          </div>
                        </div>

                        {/* Summary: Commercial Contract */}
                        <div className="p-4 rounded-2xl bg-[#FBF9F6] border border-[#E8E1D7] space-y-2">
                          <span className="font-bold uppercase tracking-wider text-stone-400 block text-[11px]">
                            2. Pricing & Selling Terms
                          </span>
                          <div className="space-y-1 text-stone-700">
                            <div><strong>Seller SKU:</strong> <span className="font-mono font-bold">{sellerSku}</span></div>
                            <div><strong>MRP:</strong> ₹{numMrp}</div>
                            <div><strong>Selling Price:</strong> <span className="text-emerald-700 font-bold">₹{numSelling}</span> ({discountPercent}% discount)</div>
                            <div><strong>Estimated Margin:</strong> <span className="text-blue-700 font-bold">{grossMarginPercent}%</span> (₹{unitProfit}/unit)</div>
                          </div>
                        </div>

                        {/* Summary: Allocated Warehouses */}
                        <div className="p-4 rounded-2xl bg-[#FBF9F6] border border-[#E8E1D7] md:col-span-2 space-y-2">
                          <span className="font-bold uppercase tracking-wider text-stone-400 block text-[11px]">
                            3. Allocated Fulfillment Nodes ({selectedWarehouseIds.size})
                          </span>
                          <div className="divide-y divide-stone-200">
                            {Array.from(selectedWarehouseIds).map((whId) => {
                              const wh = eligibleWarehouses.find((w) => w.warehouseId === whId);
                              const alloc = warehouseAllocations[whId];
                              const qty = alloc?.enableOpeningStock ? alloc.initialQuantity : 0;

                              return (
                                <div key={whId} className="py-2 flex items-center justify-between">
                                  <div>
                                    <span className="font-bold text-stone-900">{wh?.warehouseName}</span>{' '}
                                    <span className="text-stone-400 font-mono text-[10px]">({wh?.warehouseCode})</span>
                                    <p className="text-[11px] text-stone-500">{wh?.city}, {wh?.state}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-stone-800">
                                      {qty > 0 ? `${qty} Opening Units` : '0 Units (Shell)'}
                                    </span>
                                    <p className="text-[10px] text-stone-400">
                                      {qty > 0 ? 'OPENING_BALANCE signed tx' : 'Awaiting physical GRN'}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer Controls */}
            {!onboardSuccessData && (
              <div className="px-6 py-4 bg-[#FBF9F6] border-t border-[#E8E1D7] flex items-center justify-between">
                <div>
                  {step > 1 ? (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setStep((s) => (s - 1) as any)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCloseOnboarding}
                      className="px-4 py-2 rounded-xl text-stone-500 font-bold text-xs hover:text-stone-800 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div>
                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (step === 2 && !validateStep2()) return;
                        if (step === 3 && !validateStep3()) return;
                        setStep((s) => (s + 1) as any);
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold text-xs shadow-md shadow-rose-950/20 transition-all"
                    >
                      <span>Continue to {step === 1 ? 'Pricing' : step === 2 ? 'Warehouse Allocation' : 'Review'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleFinalSubmit}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-950/20 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Provisioning Nodes...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>List Product for Sale</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CATEGORY UNGATING / AUTHORIZATION MODAL                                   */}
      {/* ========================================================================= */}
      {applyModalData && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#E8E1D7] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-[#FBF9F6] border-b border-[#E8E1D7] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                  Category Authorization Required
                </span>
                <h3 className="text-base font-bold text-stone-900 mt-0.5">
                  Request Permission for "{applyModalData.categoryName}"
                </h3>
              </div>
              <button
                onClick={() => setApplyModalData(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyCategorySubmit} className="p-6 space-y-4 text-xs">
              {applyError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{applyError}</span>
                </div>
              )}

              <p className="text-stone-600 leading-relaxed">
                To maintain brand safety and customer trust, selling in <strong>{applyModalData.categoryName}</strong> requires category approval. Once approved, you can immediately list any variant in this category.
              </p>

              {loadingDocs ? (
                <div className="py-4 text-center text-stone-400">Checking document prerequisites...</div>
              ) : categoryDocs.length > 0 ? (
                <div className="space-y-2 p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                  <span className="font-bold text-stone-700 block text-[11px] uppercase tracking-wider">
                    Required Regulatory Documents
                  </span>
                  <ul className="space-y-1.5">
                    {categoryDocs.map((doc, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-stone-600">
                        <FileCheck2 className="w-3.5 h-3.5 text-stone-400" />
                        <span>{doc.displayName}</span>
                        {doc.isMandatory && (
                          <span className="text-[10px] text-rose-600 font-bold">(Mandatory)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-1">
                <label className="font-bold text-stone-700 block">
                  Application Remarks / Justification
                </label>
                <textarea
                  rows={3}
                  value={applyRemarks}
                  onChange={(e) => setApplyRemarks(e.target.value)}
                  placeholder="Explain your sourcing, authorized distributor credentials, or brand relationship..."
                  className="w-full px-3 py-2 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setApplyModalData(null)}
                  className="px-4 py-2 rounded-xl text-stone-600 font-bold hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApply}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold shadow-md shadow-rose-950/20 disabled:opacity-60"
                >
                  {isSubmittingApply ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Authorization Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
