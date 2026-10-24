import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Star,
  Package,
  Building2,
  X,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { BrandModal, BrandItem } from './BrandModal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { NoResults } from '../../components/common/NoResults.js';
import {
  DataTable,
  ColumnDef,
  TableContainer,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSkeleton,
  TableEmpty,
} from '../../components/common/table/index.js';

export const BrandsPage: React.FC = () => {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [featuredFilter, setFeaturedFilter] = useState<'ALL' | 'FEATURED' | 'STANDARD'>('ALL');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null);

  // Action states
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<number | null>(null);
  const [deleteConfirmBrand, setDeleteConfirmBrand] = useState<BrandItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Linked Products Modal states
  const [viewProductsBrand, setViewProductsBrand] = useState<BrandItem | null>(null);
  const [brandProducts, setBrandProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Fetch Brands from backend API
  const fetchBrands = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (featuredFilter === 'FEATURED') params.isFeatured = true;
      if (featuredFilter === 'STANDARD') params.isFeatured = false;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get('/admin/brands', { params });
      if (res.data?.success) {
        setBrands(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Fetch brands error:', err);
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to load brands from catalog.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, [statusFilter, featuredFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBrands();
  };

  // Open modal showing linked products
  const openBrandProductsModal = async (brand: BrandItem) => {
    setViewProductsBrand(brand);
    setProductSearch('');
    setLoadingProducts(true);
    try {
      const res = await apiClient.get(`/admin/brands/${brand.brandId}/products`);
      if (res.data?.success) {
        setBrandProducts(res.data.data?.products || []);
      }
    } catch (err: any) {
      console.error('Failed to load brand products:', err);
      setActionMessage({
        type: 'error',
        text: `Failed to load products for brand ${brand.brandName}`,
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  // One-click Featured toggle
  const handleToggleFeatured = async (brand: BrandItem) => {
    setTogglingFeaturedId(brand.brandId);
    const nextFeatured = !brand.isFeatured;
    try {
      await apiClient.patch(`/admin/brands/${brand.brandId}/featured`, {
        isFeatured: nextFeatured,
      });

      // Update locally
      setBrands((prev) =>
        prev.map((b) => (b.brandId === brand.brandId ? { ...b, isFeatured: nextFeatured } : b))
      );

      setActionMessage({
        type: 'success',
        text: `Brand "${brand.brandName}" is now ${nextFeatured ? 'marked as Featured' : 'unmarked from Featured'}.`,
      });
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      console.error('Toggle featured failed:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Failed to update featured status.',
      });
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setTogglingFeaturedId(null);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (brand: BrandItem) => {
    const nextStatus = brand.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiClient.put(`/admin/brands/${brand.brandId}`, {
        status: nextStatus,
      });

      setBrands((prev) =>
        prev.map((b) => (b.brandId === brand.brandId ? { ...b, status: nextStatus } : b))
      );

      setActionMessage({
        type: 'success',
        text: `Brand "${brand.brandName}" status changed to ${nextStatus}.`,
      });
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      console.error('Toggle status failed:', err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Failed to update status.',
      });
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Confirm delete
  const handleDeleteBrand = async () => {
    if (!deleteConfirmBrand) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/admin/brands/${deleteConfirmBrand.brandId}`);
      setBrands((prev) => prev.filter((b) => b.brandId !== deleteConfirmBrand.brandId));
      setActionMessage({
        type: 'success',
        text: `Brand "${deleteConfirmBrand.brandName}" deleted successfully.`,
      });
      setTimeout(() => setActionMessage(null), 3000);
      setDeleteConfirmBrand(null);
    } catch (err: any) {
      console.error('Delete brand failed:', err);
      setActionMessage({
        type: 'error',
        text:
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to delete brand.',
      });
      setTimeout(() => setActionMessage(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper functions for safe property extraction
  const getBrandProductCount = (b: BrandItem | null | undefined): number => {
    if (!b) return 0;
    return b.productsCount ?? b._count?.ProductMaster ?? 0;
  };

  const getBrandImageUrl = (b: BrandItem | null | undefined): string => {
    if (!b) return '';
    return b.imageURL || b.imageUrl || '';
  };

  // KPI Calculations
  const totalCount = brands.length;
  const activeCount = brands.filter((b) => b.status === 'ACTIVE').length;
  const featuredCount = brands.filter((b) => b.isFeatured).length;
  const brandsWithProducts = brands.filter((b) => getBrandProductCount(b) > 0).length;

  // Pagination hook
  const {
    paginatedData: paginatedBrands,
    paginationProps,
  } = usePagination<BrandItem>({
    data: brands,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });

  // Helper for logo URLs
  const getFullImageUrl = (path: string | null | undefined) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:7000';
    return `${apiBase.replace(/\/api\/v1\/?$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const columns: ColumnDef<BrandItem>[] = [
    {
      header: 'Brand',
      cell: ({ row: brand }) => {
        const brandImg = getBrandImageUrl(brand);
        const isFeaturedItem = brand.isFeatured;
        return (
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs relative">
              {brandImg ? (
                <img
                  src={getFullImageUrl(brandImg)}
                  alt={brand.brandName}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://placehold.co/100x100?text=' +
                      encodeURIComponent(brand.brandName.slice(0, 2).toUpperCase());
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                  {brand.brandName.slice(0, 2).toUpperCase()}
                </div>
              )}

              {isFeaturedItem && (
                <div
                  title="Featured Brand"
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs border border-white"
                >
                  <Star className="w-2.5 h-2.5 fill-amber-950" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {brand.brandName}
                </span>
                {isFeaturedItem && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                    Featured
                  </span>
                )}
              </div>
              {brand.description && (
                <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs mt-0.5">
                  {brand.description}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Code',
      cell: ({ row: brand }) =>
        brand.brandCode ? (
          <span className="inline-block px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
            {brand.brandCode}
          </span>
        ) : (
          <span className="text-slate-400 text-xs italic">—</span>
        ),
    },
    {
      header: 'Manufacturer',
      cell: ({ row: brand }) => (
        <span className="text-slate-600">
          {brand.manufacturer || <span className="text-slate-400 italic">—</span>}
        </span>
      ),
    },
    {
      header: 'Linked Products',
      align: 'center',
      cell: ({ row: brand }) => {
        const productCount = getBrandProductCount(brand);
        return (
          <button
            type="button"
            onClick={() => openBrandProductsModal(brand)}
            title={
              productCount > 0
                ? `Click to view ${productCount} products linked to ${brand.brandName}`
                : 'No products linked'
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
              productCount > 0
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 cursor-pointer shadow-xs active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-default'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>{productCount}</span>
          </button>
        );
      },
    },
    {
      header: 'Order',
      align: 'center',
      cell: ({ row: brand }) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold"
          title="Storefront display priority (lower numbers appear first)"
        >
          #{brand.displayOrder ?? 0}
        </span>
      ),
    },
    {
      header: 'Featured',
      align: 'center',
      cell: ({ row: brand }) => {
        const isFeaturedItem = brand.isFeatured;
        const isCurrentToggling = togglingFeaturedId === brand.brandId;
        return (
          <button
            type="button"
            onClick={() => handleToggleFeatured(brand)}
            disabled={isCurrentToggling}
            title={
              isFeaturedItem
                ? 'Click to remove from Featured'
                : 'Click to mark as Featured'
            }
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isFeaturedItem
                ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 shadow-xs'
                : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'
            }`}
          >
            {isCurrentToggling ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            ) : (
              <Star
                className={`w-4 h-4 ${
                  isFeaturedItem ? 'fill-amber-500 text-amber-500' : ''
                }`}
              />
            )}
          </button>
        );
      },
    },
    {
      header: 'Status',
      align: 'center',
      cell: ({ row: brand }) => (
        <button
          onClick={() => handleToggleStatus(brand)}
          title="Click to toggle status"
          className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 transition-all cursor-pointer ${
            brand.status === 'ACTIVE'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              brand.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          {brand.status}
        </button>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: ({ row: brand }) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setEditingBrand(brand);
              setModalOpen(true);
            }}
            title="Edit Brand"
            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirmBrand(brand)}
            title="Delete Brand"
            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
        <div>
         
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Brands Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage manufacturer brands, upload official brand logos, and configure featured brands for storefront display.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchBrands()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh Brands"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            onClick={() => {
              setEditingBrand(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Brand</span>
          </button>
        </div>
      </div>

      {/* Floating Action Notifications */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Brands */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Brands
            </span>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalCount}</h3>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
              Registered in catalog
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Active Brands */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Active Brands
            </span>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">{activeCount}</h3>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
              {totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}% of all brands
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Featured Brands */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Featured Brands
            </span>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{featuredCount}</h3>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
              Highlighted on storefront
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
          </div>
        </div>

        {/* Brands with Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              With Products
            </span>
            <h3 className="text-2xl font-black text-indigo-700 mt-1">{brandsWithProducts}</h3>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
              Have linked SKU masters
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brand name, brand code, manufacturer..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          {/* Featured Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Featured:</span>
            <select
              value={featuredFilter}
              onChange={(e) => setFeaturedFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Brands</option>
              <option value="FEATURED">Featured Only ⭐</option>
              <option value="STANDARD">Standard Only</option>
            </select>
          </div>

          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                fetchBrands();
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Brands Table */}
      {error ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden p-8 text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">Error Loading Brands</h3>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button
            onClick={() => fetchBrands()}
            className="mt-4 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : (
        <DataTable<BrandItem>
          columns={columns}
          data={paginatedBrands}
          loading={loading}
          bordered={true}
          striped={true}
          maxHeight="600px"
          containerClassName="rounded-2xl"
          keyExtractor={(brand) => brand.brandId}
          emptyTitle="No Brands Found"
          emptyDescription={
            searchQuery || statusFilter !== 'ALL' || featuredFilter !== 'ALL'
              ? 'No brands matched your filter criteria. Try adjusting your search query or filters.'
              : 'No brands have been created yet. Add your first brand to start organizing your catalog products.'
          }
          emptyAction={{
            label: 'Add Brand',
            onClick: () => {
              setEditingBrand(null);
              setModalOpen(true);
            },
            icon: <Plus className="w-4 h-4" />,
          }}
          pagination={{
            ...paginationProps,
            itemLabel: 'brands',
            themeColor: 'indigo',
          }}
        />
      )}

      {/* Create / Edit Brand Modal */}
      {modalOpen && (
        <BrandModal
          brand={editingBrand}
          onClose={() => {
            setModalOpen(false);
            setEditingBrand(null);
          }}
          onSuccess={() => {
            setModalOpen(false);
            setEditingBrand(null);
            fetchBrands();
            setActionMessage({
              type: 'success',
              text: editingBrand
                ? 'Brand updated successfully.'
                : 'New brand added successfully.',
            });
            setTimeout(() => setActionMessage(null), 3000);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Delete Brand &quot;{deleteConfirmBrand.brandName}&quot;?
            </h3>

            {getBrandProductCount(deleteConfirmBrand) > 0 ? (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Warning:</strong> This brand has{' '}
                  {getBrandProductCount(deleteConfirmBrand)} linked product(s). To maintain catalog
                  integrity, you must reassign or remove those products before deleting this brand.
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-2">
                Are you sure you want to permanently remove this brand? This action cannot be
                undone.
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmBrand(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBrand}
                disabled={isDeleting || getBrandProductCount(deleteConfirmBrand) > 0}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-all shadow-sm shadow-rose-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Linked Products View Modal */}
      {viewProductsBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Products Linked to &ldquo;{viewProductsBrand.brandName}&rdquo;</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {brandProducts.length} Total
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Catalog products assigned to this brand in the master catalog.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewProductsBrand(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter within linked products */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Filter by product name or Parent SKU..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Products List Body */}
            <div className="max-h-[60vh] overflow-y-auto">
              <TableContainer maxHeight="380px" bordered={true} className="border-0 shadow-none rounded-none">
                <Table>
                  <TableHeader>
                    <TableRow isHeader>
                      <TableHead>Product</TableHead>
                      <TableHead>Parent SKU</TableHead>
                      <TableHead align="center">Variants</TableHead>
                      <TableHead align="center">QC Status</TableHead>
                      <TableHead align="center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody striped={true}>
                    {loadingProducts ? (
                      <TableSkeleton columns={5} rows={3} />
                    ) : brandProducts.filter((p) => {
                        if (!productSearch.trim()) return true;
                        const q = productSearch.toLowerCase();
                        return (
                          p.productName.toLowerCase().includes(q) ||
                          p.parentSku.toLowerCase().includes(q)
                        );
                      }).length === 0 ? (
                      <TableEmpty columns={5} />
                    ) : (
                      brandProducts
                        .filter((p) => {
                          if (!productSearch.trim()) return true;
                          const q = productSearch.toLowerCase();
                          return (
                            p.productName.toLowerCase().includes(q) ||
                            p.parentSku.toLowerCase().includes(q)
                          );
                        })
                        .map((prod) => (
                          <TableRow key={prod.productId}>
                            <TableCell>
                              <span className="font-bold text-slate-900 block">
                                {prod.productName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Added {new Date(prod.createdAt).toLocaleDateString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                                {prod.parentSku}
                              </span>
                            </TableCell>
                            <TableCell align="center">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                                {prod.variantsCount} SKU{prod.variantsCount !== 1 ? 's' : ''}
                              </span>
                            </TableCell>
                            <TableCell align="center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  prod.isVerified
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {prod.isVerified ? 'Verified' : 'QC Pending'}
                              </span>
                            </TableCell>
                            <TableCell align="center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  prod.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {prod.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewProductsBrand(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
