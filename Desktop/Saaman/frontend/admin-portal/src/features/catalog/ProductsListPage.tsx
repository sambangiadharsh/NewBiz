import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackagePlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Building2,
  Eye,
  RefreshCw,
  X,
  Barcode,
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { showSweetToast } from '../../lib/swal.js';
import { AdminProductListItem, VariantEntry, ResolvedAttributes, UOM } from '../../types/product.js';
import { usePagination } from '../../hooks/usePagination.js';
import { VariantDrawer } from './components/VariantDrawer.js';
import { DataTable, ColumnDef } from '../../components/common/table/index.js';

const STATUS_FILTERS = [
  { label: 'All Products', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Pending QC', value: 'PENDING_QC' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export const ProductsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Selected product for quick inspection drawer
  const [inspectingProduct, setInspectingProduct] = useState<AdminProductListItem | null>(null);

  // Add Variant Modal State
  const [addingVariantProduct, setAddingVariantProduct] = useState<AdminProductListItem | null>(null);
  const [resolvedAttributes, setResolvedAttributes] = useState<ResolvedAttributes | null>(null);
  const [uoms, setUoms] = useState<UOM[]>([]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/catalog/products/list', {
        params: {
          status: statusFilter,
          q: searchQuery || undefined,
          page,
          limit: pageSize,
        },
      });

      if (res.data?.success) {
        const data = res.data.data;
        setProducts(data.items || []);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load products list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [statusFilter, searchQuery, page, pageSize]);

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

  const handleOpenAddVariant = async (product: AdminProductListItem) => {
    if (!product.category?.categoryId) {
      showSweetToast('Product missing category ID', 'error');
      return;
    }
    try {
      const res = await apiClient.get(`/catalog/categories/${product.category.categoryId}/attributes`);
      if (res.data?.success) {
        setResolvedAttributes(res.data.data);
        setAddingVariantProduct(product);
      }
    } catch (err) {
      console.error('Failed to load category attributes', err);
      showSweetToast('Failed to load product attributes', 'error');
    }
  };

  const handleSaveNewVariant = async (variant: VariantEntry) => {
    if (!addingVariantProduct) return;
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
        weight: variant.weight !== '' ? Number(variant.weight) : undefined,
        capacity: variant.capacity !== '' ? Number(variant.capacity) : undefined,
        uoms: variant.uoms.map((u) => ({ uomId: u.uomId, quantity: Number(u.quantity) || 1 })),
        assets: variant.assets.map((a, i) => ({
          assetType: a.assetType || 'IMAGE',
          assetUrl: a.assetUrl,
          isPrimary: a.isPrimary,
          altText: a.altText || undefined,
          displayOrder: a.displayOrder || i + 1,
        })),
        initialStatus: 'ACTIVE',
      };

      const res = await apiClient.post(`/admin/catalog/products/${addingVariantProduct.productId}/variants`, payload);
      if (res.data?.success) {
        showSweetToast('Variant added successfully!', 'success');
        setAddingVariantProduct(null);
        setInspectingProduct(null);
        fetchProducts();
      }
    } catch (err: any) {
      console.error(err);
      showSweetToast(err.response?.data?.message || 'Failed to add variant', 'error');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const pagination = usePagination({
    totalItems: totalCount,
    initialPage: page,
    initialPageSize: pageSize,
    pageSizeOptions: [10, 20, 50, 100],
    onPageChange: (p) => setPage(p),
    onPageSizeChange: (s) => {
      setPageSize(s);
      setPage(1);
    },
  });

  const getFullAssetUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:7000/api/v1').replace(
      /\/api\/v1\/?$/,
      ''
    );
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
            Draft
          </span>
        );
      case 'PENDING_QC':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            <Clock className="w-3 h-3" />
            Pending QC
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  const columns: ColumnDef<AdminProductListItem>[] = [
    {
      header: 'Thumbnail',
      width: '60px',
      cell: ({ row: p }) => {
        const primaryAsset =
          p.assets?.find((a) => a.isPrimary) ||
          p.assets?.[0] ||
          p.variants?.[0]?.assets?.[0];

        return (
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
            {primaryAsset ? (
              <img
                src={getFullAssetUrl(primaryAsset.url)}
                alt={p.productName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://placehold.co/100x100?text=IMG';
                }}
              />
            ) : (
              <Layers className="w-4 h-4 text-slate-400" />
            )}
          </div>
        );
      },
    },
    {
      header: 'Product & SKU',
      cell: ({ row: p }) => (
        <div>
          <div className="font-bold text-slate-900 line-clamp-1">{p.productName}</div>
          <div className="text-[11px] font-mono text-indigo-600 mt-0.5">{p.parentSku}</div>
        </div>
      ),
    },
    {
      header: 'Brand & Category',
      cell: ({ row: p }) => (
        <div>
          <div className="font-semibold text-slate-800 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            <span>{p.brand?.brandName || '—'}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[180px]">
            {p.category?.categoryName || '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Model & Tax',
      cell: ({ row: p }) => (
        <div className="space-y-0.5 font-mono text-[11px]">
          {p.baseModelCode && (
            <div className="text-slate-800">
              <span className="text-slate-400 font-sans">Model: </span>
              {p.baseModelCode}
            </div>
          )}
          {p.hsnCode && (
            <div className="text-slate-600">
              <span className="text-slate-400 font-sans">HSN: </span>
              {p.hsnCode}
            </div>
          )}
          {p.gstRate !== null && p.gstRate !== undefined && (
            <div className="text-emerald-700 font-semibold">{p.gstRate}% GST</div>
          )}
          {!p.baseModelCode && !p.hsnCode && p.gstRate === null && (
            <span className="text-slate-400 italic">Not set</span>
          )}
        </div>
      ),
    },
    {
      header: 'Variants',
      cell: ({ row: p }) => (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
          <Layers className="w-3 h-3" />
          {p.variants?.length || 0} variant{p.variants?.length === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: ({ row: p }) => getStatusBadge(p.status),
    },
    {
      header: 'Created Date',
      cell: ({ row: p }) => (
        <span className="text-slate-500 text-[11px]">
          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: ({ row: p }) => (
        <button
          type="button"
          onClick={() => setInspectingProduct(p)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Details</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Product Catalog Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View, filter, and manage catalog master products, variants, and India GST classifications
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/catalog/products/create')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#7C5CFC] hover:opacity-90 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <PackagePlus className="w-4 h-4" />
          <span>Create Product</span>
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.value
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Product Name, Parent SKU, Brand, or Model Code..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50/50 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Search
          </button>

          {(searchQuery || searchInput) && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
                setPage(1);
              }}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Reset
            </button>
          )}

          <button
            type="button"
            onClick={fetchProducts}
            title="Refresh"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </form>
      </div>

      {/* Products Table */}
      <DataTable<AdminProductListItem>
        columns={columns}
        data={products}
        loading={loading}
        keyExtractor={(p) => p.productId}
        bordered={true}
        striped={true}
        maxHeight="600px"
        containerClassName="rounded-2xl"
        emptyTitle="No Products Found"
        emptyDescription={
          searchQuery
            ? `No products matched "${searchQuery}". Try a different keyword.`
            : 'No products in this status view yet.'
        }
        emptyAction={{
          label: 'Create Product Now',
          onClick: () => navigate('/catalog/products/create'),
          icon: <PackagePlus className="w-4 h-4" />,
        }}
        pagination={{ ...pagination.paginationProps, itemLabel: 'products' }}
      />

      {/* Quick Details Drawer Modal */}
      {inspectingProduct && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setInspectingProduct(null)}
          />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {inspectingProduct.productName}
                </h3>
                <div className="text-xs font-mono text-indigo-600 mt-0.5">
                  {inspectingProduct.parentSku}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Classification Info */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Master Information
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Brand: </span>
                    <span className="font-semibold text-slate-800">
                      {inspectingProduct.brand?.brandName || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Category: </span>
                    <span className="font-semibold text-slate-800">
                      {inspectingProduct.category?.categoryName || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Base Model: </span>
                    <span className="font-mono text-slate-800">
                      {inspectingProduct.baseModelCode || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">HSN Code: </span>
                    <span className="font-mono text-slate-800">
                      {inspectingProduct.hsnCode || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">GST Slab: </span>
                    <span className="font-semibold text-emerald-700">
                      {inspectingProduct.gstRate !== null && inspectingProduct.gstRate !== undefined
                        ? `${inspectingProduct.gstRate}%`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status: </span>
                    <span>{getStatusBadge(inspectingProduct.status)}</span>
                  </div>
                </div>
              </div>

              {/* Variants */}
              <div className="space-y-3">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Variants ({inspectingProduct.variants?.length || 0})</span>
                  <button
                    type="button"
                    onClick={() => handleOpenAddVariant(inspectingProduct)}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded cursor-pointer"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Add Variant</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {inspectingProduct.variants?.map((v) => (
                    <div
                      key={v.productVariantId}
                      className="p-3 border border-slate-200 rounded-xl space-y-2 bg-white shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono font-bold text-slate-900">{v.variantSku}</div>
                        {v.variantModelCode && (
                          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {v.variantModelCode}
                          </span>
                        )}
                      </div>

                      {v.attributes?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {v.attributes.map((a, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium"
                            >
                              {a.attributeName}: {a.attributeValue}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        {v.gtin && (
                          <span className="flex items-center gap-1">
                            <Barcode className="w-3 h-3 text-slate-400" />
                            <span className="font-mono">{v.gtin}</span>
                          </span>
                        )}
                        {v.dimensions?.weight && (
                          <span>Weight: {v.dimensions.weight}kg</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {addingVariantProduct && resolvedAttributes && (
        <VariantDrawer
          isOpen={true}
          onClose={() => setAddingVariantProduct(null)}
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
