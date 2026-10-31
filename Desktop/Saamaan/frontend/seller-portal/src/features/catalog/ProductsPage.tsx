import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Package,
  Sparkles,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Warehouse,
  TrendingUp,
  History,
  Edit3,
  X,
  Boxes,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Lock,
  Calendar,
  Layers,
  Eye,
  Copy,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { ApiResponse } from '../../types/auth.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';
import { NoResults } from '../../components/common/NoResults.js';
import { StatsCard } from '../../components/common/StatsCard.js';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '../../components/common/Table';


interface ActiveReservationItem {
  ReservationID: string | number;
  OrderID: string | number;
  OrderNumber: string;
  Quantity: number;
  Status: string;
  CreatedAt: string;
}

interface WarehouseStockNode {
  warehouseProductId: string;
  warehouseSku?: string | null;
  warehouseProductStatus: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: string;
  city: string;
  state: string;
  isPrimary: boolean;
  inventoryId?: string | null;
  physicalQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  safetyStockQuantity: number;
  availableQuantity: number;
  activeReservations?: ActiveReservationItem[];
}

interface StockSummary {
  totalPhysicalStock: number;
  totalReservedStock: number;
  totalAvailableStock: number;
  totalDamagedStock: number;
  warehousesCount: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

interface SellerProductItem {
  sellerProductId: string;
  sellerSku: string;
  mrp: number;
  sellingPrice: number;
  purchasePrice: number;
  packerName?: string | null;
  importerName?: string | null;
  status: string;
  createdAt: string;
  product: {
    productId: string;
    parentSku: string;
    productName: string;
    brandName: string;
    categoryName: string;
    variantSku: string;
    gtin?: string | null;
    primaryImage?: string | null;
    attributes?: Array<{ attributeName: string; attributeValue: string }>;
  };
  warehouses?: WarehouseStockNode[];
  stockSummary?: StockSummary;
}

interface ProposalItem {
  productId?: string | number;
  productName?: string;
  parentSku?: string;
  brandName?: string;
  categoryName?: string;
  description?: string | null;
  highlights?: string[] | null;
  status?: 'DRAFT' | 'PENDING_QC' | 'APPROVED' | 'REWORK_REQUIRED' | 'REJECTED' | string;
  rejectionReason?: string | null;
  createdAt?: string;
  variantsCount?: number;
  primaryImage?: string | null;
  isVerified?: boolean;
  variants?: Array<{
    variantId: string;
    variantSku: string;
    attributes?: Array<{ attributeName: string; attributeValue: string }>;
  }>;
}

interface ProductTransactionItem {
  transactionId: string;
  inventoryId: string;
  transactionType: string;
  quantity: number;
  reason?: string | null;
  poNumber?: string | null;
  poAmount?: number | null;
  grnNumber?: string | null;
  supplierInvoiceNumber?: string | null;
  createdAt: string;
  warehouse: {
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string;
  };
}

interface EligibleWarehouse {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  city: string;
  state: string;
  isPrimary: boolean;
  isAssigned: boolean;
}

const getImagePreviewUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs: 'listings' (My Listed Products) | 'proposals' (QC Pipeline)
  const initialTab = searchParams.get('tab') === 'proposals' ? 'proposals' : 'listings';
  const [activeTab, setActiveTab] = useState<'listings' | 'proposals'>(initialTab);

  // Data states
  const [sellerProducts, setSellerProducts] = useState<SellerProductItem[]>([]);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);

  // Filters for Listed Products
  const [listingSearch, setListingSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');

  // Proposals Filter & Search
  const [proposalStatusFilter, setProposalStatusFilter] = useState<string>('ALL');
  const [proposalSearch, setProposalSearch] = useState<string>('');
  const [selectedProposalForDrawer, setSelectedProposalForDrawer] = useState<ProposalItem | null>(null);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const handleCopySku = (sku: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  // --- Modal & Drawer States ---
  // 1. Warehouse Management Drawer
  const [warehouseDrawerProduct, setWarehouseDrawerProduct] = useState<SellerProductItem | null>(null);
  const [eligibleWarehouses, setEligibleWarehouses] = useState<EligibleWarehouse[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [assigningWarehouseId, setAssigningWarehouseId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // 2. Stock Movement History Drawer
  const [historyDrawerProduct, setHistoryDrawerProduct] = useState<SellerProductItem | null>(null);
  const [transactions, setTransactions] = useState<ProductTransactionItem[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // 3. Edit Price & Status Modal
  const [editingProduct, setEditingProduct] = useState<SellerProductItem | null>(null);
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editMrp, setEditMrp] = useState('');
  const [editPackerName, setEditPackerName] = useState('');
  const [editImporterName, setEditImporterName] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [priceUpdateError, setPriceUpdateError] = useState<string | null>(null);

  // Sync tab with URL
  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, setSearchParams]);

  // Fetch listed products
  const fetchListings = async () => {
    setLoadingListings(true);
    try {
      const res = await apiClient.get<ApiResponse<SellerProductItem[]>>('/seller/catalog/products');
      if (res.data.success && Array.isArray(res.data.data)) {
        setSellerProducts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch listed products:', err);
    } finally {
      setLoadingListings(false);
    }
  };

  // Fetch QC proposals
  const fetchProposals = async () => {
    setLoadingProposals(true);
    try {
      const res = await apiClient.get<ApiResponse<any>>('/seller/catalog/proposals');
      if (res.data.success && Array.isArray(res.data.data)) {
        setProposals(
          res.data.data.map((item: any) => ({
            productId: item.productId ?? item.ProductID,
            productName: item.productName ?? item.ProductName,
            parentSku: item.parentSku ?? item.ParentSKU,
            brandName: item.brandName ?? item.BrandName,
            categoryName: item.categoryName ?? item.CategoryName,
            description: item.description ?? item.Description,
            highlights: item.highlights ?? item.Highlights,
            status: item.status ?? item.Status,
            isVerified: item.isVerified ?? item.IsVerified,
            rejectionReason: item.rejectionReason ?? item.RejectionReason,
            createdAt: item.createdAt ?? item.CreatedAt,
            variantsCount: item.variantsCount ?? item.VariantsCount ?? (item.variants?.length || 0),
            primaryImage: item.primaryImage ?? item.PrimaryImage,
            variants: item.variants || [],
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoadingProposals(false);
    }
  };

  useEffect(() => {
    fetchListings();
    fetchProposals();
  }, []);

  // Filter listings
  const filteredListings = useMemo(() => {
    return sellerProducts.filter((item) => {
      // Search filter
      const searchLower = listingSearch.toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        item.sellerSku.toLowerCase().includes(searchLower) ||
        item.product.productName.toLowerCase().includes(searchLower) ||
        item.product.brandName.toLowerCase().includes(searchLower) ||
        item.product.variantSku.toLowerCase().includes(searchLower) ||
        (item.product.gtin && item.product.gtin.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // Warehouse filter
      if (warehouseFilter) {
        const hasWh = item.warehouses?.some((w) => w.warehouseId === warehouseFilter);
        if (!hasWh) return false;
      }

      // Stock status filter
      if (stockStatusFilter) {
        const status = item.stockSummary?.stockStatus || 'OUT_OF_STOCK';
        if (status !== stockStatusFilter) return false;
      }

      return true;
    });
  }, [sellerProducts, listingSearch, warehouseFilter, stockStatusFilter]);

  // Aggregate stats for proposals
  const proposalStats = useMemo(() => {
    const total = proposals.length;
    const pendingQC = proposals.filter((p) => p.status === 'PENDING_QC').length;
    const approved = proposals.filter((p) => p.status === 'APPROVED').length;
    const rework = proposals.filter((p) => p.status === 'REWORK_REQUIRED').length;
    const rejected = proposals.filter((p) => p.status === 'REJECTED').length;
    return { total, pendingQC, approved, rework, rejected };
  }, [proposals]);

  // Filter proposals with search and status
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (proposalStatusFilter !== 'ALL' && p.status !== proposalStatusFilter) {
        return false;
      }
      if (proposalSearch.trim()) {
        const q = proposalSearch.toLowerCase().trim();
        const matchesName = (p.productName || '').toLowerCase().includes(q);
        const matchesSku = (p.parentSku || '').toLowerCase().includes(q);
        const matchesBrand = (p.brandName || '').toLowerCase().includes(q);
        const matchesCategory = (p.categoryName || '').toLowerCase().includes(q);
        const matchesVariant = (p.variants || []).some((v) => (v.variantSku || '').toLowerCase().includes(q));
        if (!matchesName && !matchesSku && !matchesBrand && !matchesCategory && !matchesVariant) {
          return false;
        }
      }
      return true;
    });
  }, [proposals, proposalStatusFilter, proposalSearch]);

  // Unique warehouses for filter dropdown
  const uniqueWarehousesList = useMemo(() => {
    const map = new Map<string, string>();
    sellerProducts.forEach((p) => {
      p.warehouses?.forEach((w) => {
        if (!map.has(w.warehouseId)) {
          map.set(w.warehouseId, `${w.warehouseName} (${w.warehouseCode})`);
        }
      });
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [sellerProducts]);

  // Top Aggregate KPIs
  const portfolioStats = useMemo(() => {
    const totalListed = sellerProducts.length;
    const totalAvailable = sellerProducts.reduce(
      (sum, p) => sum + (p.stockSummary?.totalAvailableStock || 0),
      0
    );
    const lowStockCount = sellerProducts.filter(
      (p) => p.stockSummary?.stockStatus === 'LOW_STOCK'
    ).length;
    const outOfStockCount = sellerProducts.filter(
      (p) => p.stockSummary?.stockStatus === 'OUT_OF_STOCK'
    ).length;

    return { totalListed, totalAvailable, lowStockCount, outOfStockCount };
  }, [sellerProducts]);

  // Pagination hook for listings
  const { paginatedData: paginatedListings, paginationProps: listingsPaginationProps } = usePagination({
    data: filteredListings,
    initialPageSize: 8,
    pageSizeOptions: [8, 16, 32],
  });

  // Pagination hook for proposals
  const { paginatedData: paginatedProposals, paginationProps: proposalsPaginationProps } = usePagination({
    data: filteredProposals,
    initialPageSize: 8,
    pageSizeOptions: [8, 16, 32],
  });

  // --- Drawer 1 Handlers: Warehouse Management ---
  const handleOpenWarehouseDrawer = async (product: SellerProductItem) => {
    setWarehouseDrawerProduct(product);
    setAssigningWarehouseId('');
    setAssignError(null);
    setAssignSuccess(null);
    setLoadingEligible(true);

    try {
      const res = await apiClient.get<ApiResponse<EligibleWarehouse[]>>(
        '/seller/catalog/eligible-warehouses'
      );
      if (res.data.success && Array.isArray(res.data.data)) {
        // Filter out warehouses that this product is already assigned to
        const assignedIds = new Set(product.warehouses?.map((w) => w.warehouseId) || []);
        const unassigned = res.data.data.map((w) => ({
          ...w,
          isAssigned: assignedIds.has(w.warehouseId),
        }));
        setEligibleWarehouses(unassigned);
      }
    } catch (err) {
      console.error('Failed to load eligible warehouses:', err);
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleAssignWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseDrawerProduct || !assigningWarehouseId) return;

    setIsAssigning(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      const res = await apiClient.post<ApiResponse<any>>(
        `/seller/catalog/products/${warehouseDrawerProduct.sellerProductId}/warehouses`,
        { warehouseIds: [assigningWarehouseId] }
      );

      if (res.data.success) {
        setAssignSuccess('Product successfully assigned to new warehouse node.');
        setAssigningWarehouseId('');
        // Refresh listings and update current drawer product
        await fetchListings();
        // Update local drawer product
        const assignedWh = eligibleWarehouses.find((w) => w.warehouseId === assigningWarehouseId);
        if (assignedWh) {
          const newNode: WarehouseStockNode = {
            warehouseProductId: 'new',
            warehouseSku: null,
            warehouseProductStatus: 'ACTIVE',
            warehouseId: assignedWh.warehouseId,
            warehouseName: assignedWh.warehouseName,
            warehouseCode: assignedWh.warehouseCode,
            warehouseType: 'Standard',
            city: assignedWh.city,
            state: assignedWh.state,
            isPrimary: assignedWh.isPrimary,
            physicalQuantity: 0,
            reservedQuantity: 0,
            damagedQuantity: 0,
            safetyStockQuantity: 0,
            availableQuantity: 0,
          };
          setWarehouseDrawerProduct((prev) =>
            prev ? { ...prev, warehouses: [...(prev.warehouses || []), newNode] } : null
          );
          setEligibleWarehouses((prev) =>
            prev.map((w) => (w.warehouseId === assigningWarehouseId ? { ...w, isAssigned: true } : w))
          );
        }
      }
    } catch (err: any) {
      setAssignError(err.response?.data?.message || 'Failed to assign warehouse');
    } finally {
      setIsAssigning(false);
    }
  };

  // --- Drawer 2 Handlers: Stock Movement History ---
  const handleOpenHistoryDrawer = async (product: SellerProductItem) => {
    setHistoryDrawerProduct(product);
    setLoadingTransactions(true);
    setTransactions([]);

    try {
      const res = await apiClient.get<ApiResponse<ProductTransactionItem[]>>(
        `/seller/catalog/products/${product.sellerProductId}/transactions`
      );
      if (res.data.success && Array.isArray(res.data.data)) {
        setTransactions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load product transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // --- Modal 3 Handlers: Edit Price & Status ---
  const handleOpenPriceModal = (product: SellerProductItem) => {
    setEditingProduct(product);
    setEditSellingPrice(String(product.sellingPrice));
    setEditMrp(String(product.mrp));
    setEditPackerName(product.packerName || '');
    setEditImporterName(product.importerName || '');
    setEditStatus(product.status || 'ACTIVE');
    setPriceUpdateError(null);
  };

  const handleUpdatePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const numSelling = parseFloat(editSellingPrice);
    const numMrp = parseFloat(editMrp);

    if (numSelling > numMrp) {
      setPriceUpdateError('Selling Price cannot exceed Maximum Retail Price (MRP)');
      return;
    }

    setIsUpdatingPrice(true);
    setPriceUpdateError(null);

    try {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/seller/catalog/products/${editingProduct.sellerProductId}/pricing`,
        {
          sellingPrice: numSelling,
          mrp: numMrp,
          status: editStatus,
          packerName: editPackerName.trim() || null,
          importerName: editImporterName.trim() || null,
        }
      );

      if (res.data.success) {
        setSellerProducts((prev) =>
          prev.map((p) =>
            p.sellerProductId === editingProduct.sellerProductId
              ? {
                  ...p,
                  sellingPrice: numSelling,
                  mrp: numMrp,
                  status: editStatus,
                  packerName: editPackerName.trim() || null,
                  importerName: editImporterName.trim() || null,
                }
              : p
          )
        );
        setEditingProduct(null);
      }
    } catch (err: any) {
      setPriceUpdateError(err.response?.data?.message || 'Failed to update pricing');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Action Links to other pages */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          to="/products/add-existing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-[#E8E1D7] hover:border-[#641D26] hover:text-[#641D26] text-stone-800 font-bold text-xs shadow-sm active:scale-95 transition-all"
        >
          <Search className="w-4 h-4 text-[#641D26]" />
          <span>Add Existing Product</span>
        </Link>
        <Link
          to="/products/propose"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold text-xs shadow-md shadow-rose-950/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Propose New Product</span>
        </Link>
      </div>

      {/* KPI Overview Grid with Shimmer Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {activeTab === 'listings' ? (
          <>
            <StatsCard
              label="Active SKUs"
              value={portfolioStats.totalListed}
              icon={Package}
              loading={loadingListings}
            />
            <StatsCard
              label="Available Units"
              value={portfolioStats.totalAvailable}
              icon={Boxes}
              iconColor="text-emerald-700 bg-emerald-50 border-emerald-200/60"
              loading={loadingListings}
            />
            <StatsCard
              label="Low Stock Items"
              value={portfolioStats.lowStockCount}
              icon={AlertCircle}
              iconColor="text-amber-700 bg-amber-50 border-amber-200/60"
              loading={loadingListings}
            />
            <StatsCard
              label="Out of Stock"
              value={portfolioStats.outOfStockCount}
              icon={XCircle}
              iconColor="text-rose-700 bg-rose-50 border-rose-200/60"
              loading={loadingListings}
            />
          </>
        ) : (
          <>
            <StatsCard
              label="Total Proposed"
              value={proposalStats.total}
              icon={FileText}
              loading={loadingProposals}
            />
            <StatsCard
              label="Under QC Review"
              value={proposalStats.pendingQC}
              icon={Clock}
              iconColor="text-amber-700 bg-amber-50 border-amber-200/60"
              loading={loadingProposals}
            />
            <StatsCard
              label="QC Approved"
              value={proposalStats.approved}
              icon={CheckCircle2}
              iconColor="text-emerald-700 bg-emerald-50 border-emerald-200/60"
              loading={loadingProposals}
            />
            <StatsCard
              label="Rework Needed"
              value={proposalStats.rework}
              icon={RotateCcw}
              iconColor="text-rose-700 bg-rose-50 border-rose-200/60"
              loading={loadingProposals}
            />
          </>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#E8E1D7] pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all duration-200 ${
              activeTab === 'listings'
                ? 'bg-[#641D26] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>My Listed Products</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'listings' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {sellerProducts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('proposals')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all duration-200 ${
              activeTab === 'proposals'
                ? 'bg-[#641D26] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>QC Proposal Pipeline</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'proposals' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {proposals.length}
            </span>
          </button>
        </div>

        <button
          onClick={() => {
            fetchListings();
            fetchProposals();
          }}
          className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY LISTED PRODUCTS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#E8E1D7] shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                placeholder="Search by SKU, Product Name, Brand, GTIN..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-700"
              >
                <option value="">All Fulfillment Warehouses</option>
                {uniqueWarehousesList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium text-stone-700"
              >
                <option value="">All Stock Statuses</option>
                <option value="IN_STOCK">In Stock (&gt;15 units)</option>
                <option value="LOW_STOCK">Low Stock (1-15 units)</option>
                <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
              </select>
            </div>
          </div>

          {/* Listings Table */}
          {loadingListings ? (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%] min-w-[240px]">Product</TableHead>
                    <TableHead className="w-[15%] min-w-[130px]">SKU & Barcode</TableHead>
                    <TableHead className="w-[15%] min-w-[130px]">Variant Specs</TableHead>
                    <TableHead className="w-[14%] min-w-[130px]">Pricing & Margin</TableHead>
                    <TableHead className="w-[13%] min-w-[120px]">Network Stock</TableHead>
                    <TableHead className="w-[8%] min-w-[80px]">Status</TableHead>
                    <TableHead className="w-[7%] min-w-[90px]" align="right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSkeleton columns={7} rows={6} />
                </TableBody>
              </Table>
            </TableContainer>
          ) : filteredListings.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E1D7] p-8 shadow-sm">
              <NoResults
                description={
                  listingSearch || warehouseFilter || stockStatusFilter
                    ? 'No products matched your search filters. Try clearing your filters.'
                    : "You haven't listed any products for sale yet. Search our master catalog to start selling immediately."
                }
                action={{
                  label: 'Search Existing Catalog Products',
                  to: '/products/add-existing',
                  icon: <Search className="w-4 h-4" />,
                }}
              />
            </div>
          ) : (
            <TableContainer
              footer={
                <Pagination {...listingsPaginationProps} itemLabel="products" themeColor="burgundy" />
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%] min-w-[240px]">Product</TableHead>
                    <TableHead className="w-[15%] min-w-[130px]">SKU & Barcode</TableHead>
                    <TableHead className="w-[15%] min-w-[130px]">Variant Specs</TableHead>
                    <TableHead className="w-[14%] min-w-[130px]">Pricing & Margin</TableHead>
                    <TableHead className="w-[13%] min-w-[120px]">Network Stock</TableHead>
                    <TableHead className="w-[8%] min-w-[80px]">Status</TableHead>
                    <TableHead className="w-[7%] min-w-[90px]" align="right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedListings.map((item) => {
                    const previewUrl = getImagePreviewUrl(item.product.primaryImage);
                    const marginPercent =
                      item.sellingPrice > item.purchasePrice
                        ? (((item.sellingPrice - item.purchasePrice) / item.sellingPrice) * 100).toFixed(1)
                        : '0.0';

                    const stockStatus = item.stockSummary?.stockStatus || 'OUT_OF_STOCK';
                    const availableUnits = item.stockSummary?.totalAvailableStock ?? 0;
                    const warehousesCount = item.warehouses?.length || 0;

                    return (
                      <TableRow key={item.sellerProductId} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        {/* 1. Product Identity */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={item.product.productName}
                                className="w-11 h-11 object-cover rounded-lg border border-stone-200 bg-white shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400 shrink-0 border border-stone-200">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-[11px] leading-tight mb-0.5">
                                <span className="font-bold text-[#641D26] uppercase tracking-wider">
                                  {item.product.brandName}
                                </span>
                                <span className="text-stone-300">•</span>
                                <span className="text-stone-500 truncate max-w-[140px]">
                                  {item.product.categoryName}
                                </span>
                              </div>
                              <p
                                className="text-xs font-semibold text-stone-900 truncate max-w-[260px] lg:max-w-[340px]"
                                title={item.product.productName}
                              >
                                {item.product.productName}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. SKU & Barcode */}
                        <TableCell>
                          <div className="space-y-0.5 font-mono">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-stone-400 font-sans font-medium uppercase">SKU</span>
                              <span className="text-xs font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded">
                                {item.product.variantSku || item.sellerSku}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-500 truncate flex items-center gap-1">
                              <span className="text-[10px] text-stone-400 font-sans uppercase">GTIN</span>
                              <span className={item.product.gtin ? 'text-stone-700' : 'text-stone-400 font-sans'}>
                                {item.product.gtin ? item.product.gtin : 'null'}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 3. Variant Specs */}
                        <TableCell>
                          {item.product.attributes && item.product.attributes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.product.attributes.map((attr, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-stone-50 border border-stone-200/80 text-[10px] font-medium text-stone-700"
                                >
                                  <span className="text-stone-400 mr-1">{attr.attributeName}:</span>
                                  <span className="font-semibold text-stone-800">{attr.attributeValue}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-stone-400 text-xs italic">Standard (Default)</span>
                          )}
                        </TableCell>

                        {/* 4. Pricing & Margin */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-extrabold text-stone-900">
                                ₹{Number(item.sellingPrice).toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-stone-400 line-through">
                                ₹{Number(item.mrp).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                <TrendingUp className="w-2.5 h-2.5" />
                                +{marginPercent}%
                              </span>
                              <span className="text-stone-400 font-mono text-[10px]">
                                Cost ₹{Number(item.purchasePrice).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 5. Network Stock */}
                        <TableCell>
                          {(() => {
                            const reservedUnits = item.stockSummary?.totalReservedStock ?? 0;
                            const physicalUnits = item.stockSummary?.totalPhysicalStock ?? 0;

                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      stockStatus === 'IN_STOCK'
                                        ? 'bg-emerald-500 ring-2 ring-emerald-100'
                                        : stockStatus === 'LOW_STOCK'
                                        ? 'bg-amber-500 ring-2 ring-amber-100'
                                        : 'bg-rose-500 ring-2 ring-rose-100'
                                    }`}
                                  />
                                  <span
                                    className={
                                      availableUnits > 0
                                        ? 'text-emerald-800 font-bold'
                                        : 'text-rose-700 font-bold'
                                    }
                                  >
                                    {availableUnits} available
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                                  {reservedUnits > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[10px]">
                                      <Lock className="w-2.5 h-2.5 text-amber-600" />
                                      {reservedUnits} reserved
                                    </span>
                                  ) : (
                                    <span className="text-stone-400 text-[10px] font-medium">
                                      0 reserved
                                    </span>
                                  )}
                                  <span className="text-stone-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenWarehouseDrawer(item)}
                                    className="text-[11px] text-stone-500 hover:text-[#641D26] hover:underline flex items-center gap-1 font-medium transition-colors cursor-pointer"
                                    title={`View ${warehousesCount} warehouse hub(s) (${physicalUnits} total physical units)`}
                                  >
                                    <Warehouse className="w-3 h-3 text-[#7E2532]" />
                                    <span>
                                      {warehousesCount} {warehousesCount === 1 ? 'hub' : 'hubs'}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>

                        {/* 6. Status */}
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                              item.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-stone-100 text-stone-600 border border-stone-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-stone-400'
                              }`}
                            />
                            {item.status}
                          </span>
                        </TableCell>

                        {/* 7. Actions */}
                        <TableCell align="right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenWarehouseDrawer(item)}
                              className="p-1.5 rounded-lg border border-transparent hover:border-[#E8E1D7] hover:bg-stone-50 text-stone-600 hover:text-[#641D26] transition-colors"
                              title="Manage Warehouse Allocations"
                            >
                              <Warehouse className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPriceModal(item)}
                              className="p-1.5 rounded-lg border border-transparent hover:border-[#E8E1D7] hover:bg-stone-50 text-stone-600 hover:text-[#641D26] transition-colors"
                              title="Edit Price & Status"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenHistoryDrawer(item)}
                              className="p-1.5 rounded-lg border border-transparent hover:border-[#E8E1D7] hover:bg-stone-50 text-stone-500 hover:text-stone-900 transition-colors"
                              title="Audit Stock History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PROPOSALS & QC PIPELINE                                            */}
      {/* ========================================================================= */}
      {activeTab === 'proposals' && (
        <div className="space-y-4">
          {/* Search & Filter Header Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#E8E1D7] shadow-xs">
            {/* Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { id: 'ALL', label: 'All Proposals', count: proposalStats.total },
                { id: 'PENDING_QC', label: 'In Review', count: proposalStats.pendingQC, dot: 'bg-amber-500' },
                { id: 'APPROVED', label: 'Approved', count: proposalStats.approved, dot: 'bg-emerald-500' },
                { id: 'REWORK_REQUIRED', label: 'Needs Rework', count: proposalStats.rework, dot: 'bg-rose-500' },
                { id: 'REJECTED', label: 'Rejected', count: proposalStats.rejected, dot: 'bg-stone-500' },
              ].map((tab) => {
                const isActive = proposalStatusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setProposalStatusFilter(tab.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      isActive
                        ? 'bg-[#641D26] text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
                    }`}
                  >
                    {tab.dot && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : tab.dot}`}
                      />
                    )}
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Proposal Search Box */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by title, SKU, brand..."
                  value={proposalSearch}
                  onChange={(e) => setProposalSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#641D26]/20 focus:border-[#641D26] transition-all"
                />
                {proposalSearch && (
                  <button
                    onClick={() => setProposalSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Link
                to="/products/propose"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold text-xs shadow-xs active:scale-95 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Proposal</span>
              </Link>
            </div>
          </div>

          {loadingProposals ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-[#ECE5DC] p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-20 h-20 rounded-xl shimmer shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-28 shimmer rounded" />
                      <div className="h-5 w-64 shimmer rounded-md" />
                      <div className="h-3 w-40 shimmer rounded" />
                    </div>
                  </div>
                  <div className="h-8 w-32 shimmer rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8E1D7] p-8 shadow-sm">
              <NoResults
                description={
                  proposalSearch || proposalStatusFilter !== 'ALL'
                    ? 'No catalog proposals match your active filters or search terms.'
                    : "You haven't proposed any new products to the catalog yet. Propose unique items to expand your product offerings."
                }
                action={
                  proposalSearch || proposalStatusFilter !== 'ALL'
                    ? {
                        label: 'Reset Filters',
                        onClick: () => {
                          setProposalSearch('');
                          setProposalStatusFilter('ALL');
                        },
                      }
                    : {
                        label: 'Propose New Product',
                        to: '/products/propose',
                        icon: <Plus className="w-4 h-4" />,
                      }
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3.5">
                {paginatedProposals.map((item) => {
                  const previewUrl = getImagePreviewUrl(item.primaryImage);
                  const formattedDate = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : null;

                  const isApproved = item.status === 'APPROVED';
                  const isRework = item.status === 'REWORK_REQUIRED';
                  const isPending = item.status === 'PENDING_QC';
                  const isRejected = item.status === 'REJECTED';

                  return (
                    <div
                      key={item.productId}
                      className="bg-white rounded-2xl border border-[#E8E1D7] p-5 hover:shadow-md hover:border-[#DFD6CA] transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-5 group"
                    >
                      {/* Left: Product Media + Details */}
                      <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                        {/* High-res Thumbnail Container */}
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#FAF8F5] border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const container = e.currentTarget.parentElement;
                                if (container) {
                                  e.currentTarget.style.display = 'none';
                                }
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-stone-300">
                              <Package className="w-8 h-8 stroke-[1.5]" />
                            </div>
                          )}

                          {/* Variant Badge */}
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-stone-900/70 backdrop-blur-xs text-[9px] font-bold text-white tracking-wider">
                            {item.variantsCount || 1}V
                          </div>
                        </div>

                        {/* Text & Taxonomy */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          {/* Top Meta Line: Brand & Category Breadcrumbs */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-extrabold uppercase tracking-wider text-[#641D26] bg-[#641D26]/8 px-2 py-0.5 rounded-md text-[10px]">
                              {item.brandName || 'Unbranded'}
                            </span>
                            <span className="text-stone-300">•</span>
                            <span className="font-semibold text-stone-500 truncate max-w-[200px]">
                              {item.categoryName || 'General Category'}
                            </span>
                            {formattedDate && (
                              <>
                                <span className="text-stone-300">•</span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-stone-400 font-medium">
                                  <Calendar className="w-3 h-3 text-stone-400" />
                                  {formattedDate}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Product Title */}
                          <h4 className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight group-hover:text-[#641D26] transition-colors line-clamp-1">
                            {item.productName}
                          </h4>

                          {/* SKU and Variant Pills */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {/* Parent SKU Pill */}
                            <div className="inline-flex items-center gap-1 bg-stone-100/90 text-stone-600 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              <span>SKU: {item.parentSku}</span>
                              <button
                                type="button"
                                onClick={(e) => item.parentSku && handleCopySku(item.parentSku, e)}
                                title="Copy Parent SKU"
                                className="text-stone-400 hover:text-stone-700 transition-colors ml-0.5 cursor-pointer"
                              >
                                {copiedSku === item.parentSku ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* Variants preview chips */}
                            {item.variants && item.variants.length > 0 && (
                              <div className="hidden sm:flex items-center gap-1 text-[11px] text-stone-500 font-medium">
                                <span className="text-stone-300">•</span>
                                <span className="inline-flex items-center gap-1">
                                  <Layers className="w-3 h-3 text-stone-400" />
                                  {item.variants.slice(0, 2).map((v) => {
                                    const attrText = v.attributes?.map((a) => a.attributeValue).join('/') || v.variantSku;
                                    return (
                                      <span
                                        key={v.variantId}
                                        className="bg-[#FAF8F5] border border-stone-200/80 px-1.5 py-0.5 rounded text-[10px] text-stone-600 font-medium"
                                      >
                                        {attrText}
                                      </span>
                                    );
                                  })}
                                  {item.variants.length > 2 && (
                                    <span className="text-[10px] text-stone-400 font-bold">
                                      +{item.variants.length - 2} more
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Reviewer Feedback Banner (If Rework or Rejection note exists) */}
                          {(isRework || (isRejected && item.rejectionReason)) && (
                            <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-2 text-xs text-rose-900">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="font-bold block">
                                  {isRework ? 'Admin Rework Notes:' : 'QC Rejection Reason:'}
                                </span>
                                <span className="text-rose-800 text-[11px] leading-relaxed block mt-0.5">
                                  {item.rejectionReason || 'Please inspect product attributes, tax code, and images to ensure marketplace compliance.'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Status Pill & Action Buttons */}
                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {isPending && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>Under QC Review</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>QC Approved</span>
                            </span>
                          )}
                          {isRework && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200/80 shadow-2xs">
                              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                              <span>Action Needed</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200 shadow-2xs">
                              <XCircle className="w-3.5 h-3.5 text-stone-500" />
                              <span>Declined</span>
                            </span>
                          )}
                        </div>

                        {/* Interactive CTAs */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedProposalForDrawer(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-stone-500" />
                            <span>Inspect</span>
                          </button>

                          {isApproved && (
                            <Link
                              to={`/products/add-existing?search=${encodeURIComponent(item.productName || item.parentSku || '')}`}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold transition-all shadow-sm shadow-[#641D26]/20 active:scale-95"
                            >
                              <span>List for Sale</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          {isRework && (
                            <Link
                              to={`/products/propose?rework=${item.productId}`}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                              <span>Revise Proposal</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Proposals Pagination */}
              <Pagination {...proposalsPaginationProps} itemLabel="proposals" themeColor="burgundy" />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER 1: WAREHOUSES & STOCK BREAKDOWN                                    */}
      {/* ========================================================================= */}
      {warehouseDrawerProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-[#E8E1D7] overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-5 bg-[#FBF9F6] border-b border-[#E8E1D7] flex items-center justify-between shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider">
                  <Warehouse className="w-4 h-4 text-[#7E2532]" />
                  <span>Fulfillment Node Allocation</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 truncate max-w-md">
                  {warehouseDrawerProduct.product.productName}
                </h3>
                <span className="font-mono text-xs text-stone-400 block">
                  Seller SKU: {warehouseDrawerProduct.sellerSku}
                </span>
              </div>
              <button
                onClick={() => setWarehouseDrawerProduct(null)}
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Aggregate KPI Strip */}
              <div className="grid grid-cols-4 gap-2.5 p-4 bg-[#FBF9F6] rounded-2xl border border-[#E8E1D7] text-center">
                <div className="p-2 bg-white rounded-xl border border-stone-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Physical</span>
                  <span className="text-base font-black text-stone-900 block mt-0.5">
                    {warehouseDrawerProduct.stockSummary?.totalPhysicalStock || 0}
                  </span>
                </div>
                <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Available</span>
                  <span className="text-base font-black text-emerald-700 block mt-0.5">
                    {warehouseDrawerProduct.stockSummary?.totalAvailableStock || 0}
                  </span>
                </div>
                <div className="p-2 bg-amber-50/60 rounded-xl border border-amber-200/80 shadow-2xs">
                  <div className="flex items-center justify-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-amber-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Reserved</span>
                  </div>
                  <span className="text-base font-black text-amber-800 block mt-0.5">
                    {warehouseDrawerProduct.stockSummary?.totalReservedStock || 0}
                  </span>
                </div>
                <div className="p-2 bg-rose-50/60 rounded-xl border border-rose-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">Damaged</span>
                  <span className="text-base font-black text-rose-700 block mt-0.5">
                    {warehouseDrawerProduct.stockSummary?.totalDamagedStock || 0}
                  </span>
                </div>
              </div>

              {/* Assigned Warehouses Breakdown */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                  Allocated Warehouses ({warehouseDrawerProduct.warehouses?.length || 0})
                </span>

                {warehouseDrawerProduct.warehouses && warehouseDrawerProduct.warehouses.length > 0 ? (
                  <div className="space-y-3">
                    {warehouseDrawerProduct.warehouses.map((wh) => (
                      <div
                        key={wh.warehouseId}
                        className="p-4 rounded-2xl bg-white border border-[#E8E1D7] shadow-2xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-stone-900">{wh.warehouseName}</span>
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
                              {wh.city}, {wh.state}
                            </p>
                          </div>

                          <div className="text-right space-y-0.5">
                            <span className="text-sm font-black text-emerald-700 block">
                              {wh.availableQuantity} Available
                            </span>
                            {wh.reservedQuantity > 0 && (
                              <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-amber-800">
                                <Lock className="w-3 h-3 text-amber-600" />
                                <span>{wh.reservedQuantity} Reserved</span>
                              </div>
                            )}
                            <span className="text-[10px] text-stone-400 font-medium block">
                              {wh.physicalQuantity} Physical Units
                            </span>
                          </div>
                        </div>

                        {/* Inventory Sub-Ledger Bar */}
                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-stone-100 text-center text-xs">
                          <div className="p-2 bg-emerald-50/70 rounded-xl border border-emerald-200/60">
                            <span className="text-[10px] text-emerald-700 block uppercase font-bold">Available</span>
                            <span className="font-black text-emerald-800 text-sm">{wh.availableQuantity}</span>
                          </div>
                          <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-200/60">
                            <span className="text-[10px] text-amber-700 block uppercase font-bold">Reserved</span>
                            <span className="font-black text-amber-800 text-sm">{wh.reservedQuantity}</span>
                          </div>
                          <div className="p-2 bg-[#FBF9F6] rounded-xl border border-stone-200">
                            <span className="text-[10px] text-stone-500 block uppercase font-bold">Physical</span>
                            <span className="font-bold text-stone-800 text-sm">{wh.physicalQuantity}</span>
                          </div>
                          <div className="p-2 bg-[#FBF9F6] rounded-xl border border-stone-200">
                            <span className="text-[10px] text-stone-400 block uppercase">Damaged</span>
                            <span className="font-bold text-rose-600 text-sm">{wh.damagedQuantity}</span>
                          </div>
                        </div>

                        {/* Active Customer Order Holds (if any) */}
                        {wh.activeReservations && wh.activeReservations.length > 0 && (
                          <div className="mt-2.5 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                              <div className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-amber-700" />
                                <span>Active Order Holds ({wh.activeReservations.length})</span>
                              </div>
                              <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                Awaiting Dispatch
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {wh.activeReservations.map((res) => (
                                <div
                                  key={res.ReservationID}
                                  className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/70 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-stone-900">{res.OrderNumber}</span>
                                    <span className="text-[10px] text-stone-400">
                                      {new Date(res.CreatedAt).toLocaleDateString('en-IN', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  <span className="font-extrabold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-200/60">
                                    {res.Quantity} {res.Quantity === 1 ? 'unit' : 'units'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-stone-400 text-xs bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                    Not currently assigned to any warehouse.
                  </div>
                )}
              </div>

              {/* Assign to Additional Warehouse Section */}
              <div className="pt-4 border-t border-stone-200 space-y-3">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                  Assign to Another Authorized Warehouse
                </span>

                {assignError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{assignError}</span>
                  </div>
                )}

                {assignSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{assignSuccess}</span>
                  </div>
                )}

                {loadingEligible ? (
                  <div className="py-4 text-center text-stone-400 text-xs">
                    Checking available warehouse network...
                  </div>
                ) : eligibleWarehouses.filter((w) => !w.isAssigned).length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#FBF9F6] border border-[#E8E1D7] text-stone-600 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>This product is already active in all of your authorized warehouses.</span>
                  </div>
                ) : (
                  <form onSubmit={handleAssignWarehouseSubmit} className="space-y-3">
                    <select
                      value={assigningWarehouseId}
                      onChange={(e) => setAssigningWarehouseId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] font-medium"
                    >
                      <option value="">Select an available warehouse...</option>
                      {eligibleWarehouses
                        .filter((w) => !w.isAssigned)
                        .map((w) => (
                          <option key={w.warehouseId} value={w.warehouseId}>
                            {w.warehouseName} ({w.warehouseCode}) — {w.city}, {w.state}
                          </option>
                        ))}
                    </select>

                    <button
                      type="submit"
                      disabled={!assigningWarehouseId || isAssigning}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold text-xs shadow-md shadow-rose-950/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                    >
                      {isAssigning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Provisioning Warehouse Node...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Assign Warehouse & Initialize Shell</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER 2: STOCK MOVEMENT LEDGER (InventoryTransactions)                   */}
      {/* ========================================================================= */}
      {historyDrawerProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-[#E8E1D7] overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-5 bg-[#FBF9F6] border-b border-[#E8E1D7] flex items-center justify-between shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider">
                  <History className="w-4 h-4 text-[#7E2532]" />
                  <span>Stock Movement & Audit Ledger</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 truncate max-w-md">
                  {historyDrawerProduct.product.productName}
                </h3>
                <span className="font-mono text-xs text-stone-400 block">
                  Seller SKU: {historyDrawerProduct.sellerSku}
                </span>
              </div>
              <button
                onClick={() => setHistoryDrawerProduct(null)}
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingTransactions ? (
                <div className="py-16 text-center text-stone-500 text-xs">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#641D26] mb-2" />
                  Loading immutable transaction ledger...
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                  <Clock className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="font-bold text-stone-700">No Inventory Transactions Recorded</p>
                  <p className="mt-1 max-w-xs mx-auto">
                    Transactions are logged upon inbound receipt (GRN), order dispatch, or stock adjustments.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const isPositive = tx.quantity > 0;
                    const isNegative = tx.quantity < 0;

                    return (
                      <div
                        key={tx.transactionId}
                        className="p-4 rounded-2xl bg-white border border-[#E8E1D7] shadow-2xs flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                tx.transactionType.includes('INBOUND') || tx.transactionType.includes('OPENING')
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : tx.transactionType.includes('OUTBOUND')
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {tx.transactionType.replace('_', ' ')}
                            </span>
                            <span className="text-stone-300">•</span>
                            <span className="text-xs font-bold text-stone-700">
                              {tx.warehouse.warehouseName}
                            </span>
                          </div>

                          {tx.reason && (
                            <p className="text-xs text-stone-600 font-medium">{tx.reason}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400 font-mono">
                            {tx.grnNumber && <span>GRN: {tx.grnNumber}</span>}
                            {tx.poNumber && <span>PO: {tx.poNumber}</span>}
                            {tx.supplierInvoiceNumber && <span>Inv: {tx.supplierInvoiceNumber}</span>}
                            <span>{new Date(tx.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-base font-black ${
                              isPositive
                                ? 'text-emerald-700'
                                : isNegative
                                ? 'text-rose-600'
                                : 'text-stone-500'
                            }`}
                          >
                            {isPositive ? `+${tx.quantity}` : `${tx.quantity}`}
                          </span>
                          <span className="text-[10px] text-stone-400 block font-semibold uppercase">
                            Units
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK EDIT PRICE & STATUS                                        */}
      {/* ========================================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-[#E8E1D7] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-[#FBF9F6] border-b border-[#E8E1D7] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7E2532] block">
                  Product Commercials
                </span>
                <h3 className="text-base font-bold text-stone-900 mt-0.5">
                  Edit Price & Availability
                </h3>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePriceSubmit} className="p-6 space-y-4 text-xs">
              {priceUpdateError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{priceUpdateError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#FBF9F6] border border-[#E8E1D7] space-y-1">
                <span className="font-bold text-stone-800 block truncate">
                  {editingProduct.product.productName}
                </span>
                <span className="font-mono text-stone-400 block text-[11px]">
                  SKU: {editingProduct.sellerSku}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">Maximum Retail Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={editMrp}
                    onChange={(e) => setEditMrp(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:ring-2 focus:ring-[#641D26]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">Customer Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:ring-2 focus:ring-[#641D26]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block text-xs">Packer Name (Optional)</label>
                  <input
                    type="text"
                    value={editPackerName}
                    onChange={(e) => setEditPackerName(e.target.value)}
                    placeholder="e.g. ABC Packaging Logistics"
                    className="w-full px-3 py-2 text-xs font-medium bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:ring-2 focus:ring-[#641D26]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block text-xs">Importer Name (Optional)</label>
                  <input
                    type="text"
                    value={editImporterName}
                    onChange={(e) => setEditImporterName(e.target.value)}
                    placeholder="e.g. XYZ Global Importers"
                    className="w-full px-3 py-2 text-xs font-medium bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:ring-2 focus:ring-[#641D26]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700 block">Listing Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FBF9F6] border border-[#E8E1D7] rounded-xl focus:ring-2 focus:ring-[#641D26] font-medium"
                >
                  <option value="ACTIVE">ACTIVE (Available for customer orders)</option>
                  <option value="PAUSED">PAUSED (Temporarily hidden from marketplace)</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl text-stone-600 font-bold hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPrice}
                  className="px-5 py-2.5 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold shadow-md shadow-rose-950/20 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isUpdatingPrice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* DRAWER 3: PROPOSAL INSPECTION DRAWER                                      */}
      {/* ========================================================================= */}
      {selectedProposalForDrawer && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-[#E8E1D7] overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-5 bg-[#FBF9F6] border-b border-[#E8E1D7] flex items-center justify-between shrink-0">
              <div className="space-y-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-[#7E2532]" />
                  <span>Catalog Proposal Audit</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 truncate">
                  {selectedProposalForDrawer.productName}
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
                  <span>Parent SKU: {selectedProposalForDrawer.parentSku}</span>
                  <span>•</span>
                  <span>{selectedProposalForDrawer.brandName || 'Brand'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProposalForDrawer(null)}
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  selectedProposalForDrawer.status === 'APPROVED'
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : selectedProposalForDrawer.status === 'PENDING_QC'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : selectedProposalForDrawer.status === 'REWORK_REQUIRED'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                    : 'bg-stone-50 border-stone-200 text-stone-800'
                }`}
              >
                {selectedProposalForDrawer.status === 'APPROVED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : selectedProposalForDrawer.status === 'PENDING_QC' ? (
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : selectedProposalForDrawer.status === 'REWORK_REQUIRED' ? (
                  <RotateCcw className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {selectedProposalForDrawer.status === 'APPROVED'
                      ? 'Approved & Added to Marketplace Master Catalog'
                      : selectedProposalForDrawer.status === 'PENDING_QC'
                      ? 'Quality Control Verification In Progress'
                      : selectedProposalForDrawer.status === 'REWORK_REQUIRED'
                      ? 'Action Required: Re-submission Needed'
                      : 'Proposal Status: ' + selectedProposalForDrawer.status}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">
                    {selectedProposalForDrawer.status === 'APPROVED'
                      ? 'This product has passed quality verification and is now part of the global catalog. You can proceed to attach pricing, warehouse allocations, and list it for sale.'
                      : selectedProposalForDrawer.status === 'PENDING_QC'
                      ? 'Our catalog compliance team is currently auditing the taxonomy, attributes, and image assets. Reviews typically complete within 24 to 48 business hours.'
                      : selectedProposalForDrawer.status === 'REWORK_REQUIRED'
                      ? (selectedProposalForDrawer.rejectionReason || 'Reviewers noted that some attributes or documents need correction. Please revise and resubmit.')
                      : 'Proposal is currently archived or declined.'}
                  </p>
                </div>
              </div>

              {/* Product Hero Details Card */}
              <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#E8E1D7] flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-white border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {selectedProposalForDrawer.primaryImage ? (
                    <img
                      src={getImagePreviewUrl(selectedProposalForDrawer.primaryImage)}
                      alt={selectedProposalForDrawer.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-stone-300" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#641D26] block">
                    {selectedProposalForDrawer.categoryName}
                  </span>
                  <h4 className="text-sm font-bold text-stone-900 leading-snug">
                    {selectedProposalForDrawer.productName}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
                    <span>Parent: {selectedProposalForDrawer.parentSku}</span>
                    <span>•</span>
                    <span>{selectedProposalForDrawer.variantsCount || 1} Variant(s)</span>
                  </div>
                </div>
              </div>

              {/* Product Highlights / Description (if any) */}
              {(selectedProposalForDrawer.description || (selectedProposalForDrawer.highlights && selectedProposalForDrawer.highlights.length > 0)) && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                    Product Description & Highlights
                  </span>
                  {selectedProposalForDrawer.description && (
                    <p className="text-xs text-stone-600 leading-relaxed bg-[#FAF8F5] p-3 rounded-xl border border-stone-200/60">
                      {selectedProposalForDrawer.description}
                    </p>
                  )}
                  {selectedProposalForDrawer.highlights && selectedProposalForDrawer.highlights.length > 0 && (
                    <ul className="space-y-1 text-xs text-stone-600 pl-4 list-disc">
                      {selectedProposalForDrawer.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Variants Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Proposed Variants ({selectedProposalForDrawer.variants?.length || 1})
                  </span>
                </div>

                <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 bg-white">
                  {selectedProposalForDrawer.variants && selectedProposalForDrawer.variants.length > 0 ? (
                    selectedProposalForDrawer.variants.map((v, i) => (
                      <div key={v.variantId || i} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5 min-w-0">
                          <span className="font-mono font-bold text-stone-800 block">
                            {v.variantSku}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {v.attributes && v.attributes.length > 0 ? (
                              v.attributes.map((attr, ai) => (
                                <span
                                  key={ai}
                                  className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-medium"
                                >
                                  <strong>{attr.attributeName}:</strong> {attr.attributeValue}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-stone-400">Standard Variant</span>
                            )}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          Verified Format
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-stone-400">
                      Standard single SKU variant
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 bg-[#FBF9F6] border-t border-[#E8E1D7] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setSelectedProposalForDrawer(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200/60 transition-colors cursor-pointer"
              >
                Close Drawer
              </button>

              <div className="flex items-center gap-2">
                {selectedProposalForDrawer.status === 'APPROVED' && (
                  <Link
                    to={`/products/add-existing?search=${encodeURIComponent(selectedProposalForDrawer.productName || selectedProposalForDrawer.parentSku || '')}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#641D26] hover:bg-[#52161E] text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    <span>List for Sale Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                {selectedProposalForDrawer.status === 'REWORK_REQUIRED' && (
                  <Link
                    to={`/products/propose?rework=${selectedProposalForDrawer.productId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    <span>Revise Proposal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
