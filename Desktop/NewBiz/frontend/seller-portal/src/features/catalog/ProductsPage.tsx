import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Package,
  PlusCircle,
  Sparkles,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Barcode
} from 'lucide-react';
import { apiClient } from '../../lib/axios.js';
import { usePagination } from '../../hooks/usePagination.js';
import { Pagination } from '../../components/common/Pagination.js';

interface SellerProductItem {
  sellerProductId?: string | number;
  SellerProductID?: number;
  sellerSku?: string;
  SellerSKU?: string;
  mrp?: number;
  sellingPrice?: number;
  SellingPrice?: number;
  purchasePrice?: number;
  basePrice?: number;
  BasePrice?: number;
  currencyCode?: string;
  CurrencyCode?: string;
  status?: string;
  Status?: string;
  createdAt?: string;
  product?: {
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
  ProductVariant?: {
    VariantSKU: string;
    GTIN?: string | null;
    ModelCode?: string | null;
    ProductMaster: {
      ProductName: string;
      ParentSKU: string;
      Brand?: {
        BrandName: string;
        BrandCode?: string;
      };
      ProductCategories?: Array<{
        IsPrimary?: boolean;
        Category?: {
          CategoryID?: number;
          CategoryName?: string;
          CategoryCode?: string;
        };
      }>;
    };
    ProductVariantAttributes?: Array<{
      CategoryAttribute?: {
        AttributeName: string;
      };
      AttributeValue?: {
        ValueName: string;
        ValueCode?: string;
      };
    }>;
  };
}

interface ProposalItem {
  productId?: string | number;
  ProductID?: number;
  productName?: string;
  ProductName?: string;
  parentSku?: string;
  ParentSKU?: string;
  brandName?: string;
  categoryName?: string;
  status?: 'DRAFT' | 'PENDING_QC' | 'APPROVED' | 'REWORK_REQUIRED' | 'REJECTED' | string;
  Status?: 'DRAFT' | 'PENDING_QC' | 'APPROVED' | 'REWORK_REQUIRED' | 'REJECTED' | string;
  rejectionReason?: string | null;
  RejectionReason?: string | null;
  createdAt?: string;
  CreatedAt?: string;
  variantsCount?: number;
  primaryImage?: string | null;
  variants?: Array<{
    variantId: string;
    variantSku: string;
    attributes?: Array<{ attributeName: string; attributeValue: string }>;
  }>;
  Brand?: {
    BrandName: string;
    BrandCode?: string;
  };
  ProductCategories?: Array<{
    IsPrimary?: boolean;
    Category?: {
      CategoryName?: string;
      CategoryCode?: string;
    };
  }>;
  ProductVariants?: Array<{
    VariantID: number;
    VariantSKU: string;
    ProductVariantAttributes?: Array<{
      CategoryAttribute?: {
        AttributeName: string;
      };
      AttributeValue?: {
        ValueName: string;
      };
    }>;
  }>;
  ProductAssets?: Array<{
    AssetID?: number;
    AssetURL: string;
    AssetType?: string;
    IsPrimary?: boolean;
  }>;
}

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'listings' | 'proposals'>('listings');
  useEffect(() => {
    if (searchParams.get('action') === 'add-existing') {
      navigate('/products/add-existing', { replace: true });
    }
  }, [searchParams, navigate]);

  // Listings state
  const [sellerProducts, setSellerProducts] = useState<SellerProductItem[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [listingSearch, setListingSearch] = useState('');

  // Proposals state
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [proposalFilter, setProposalFilter] = useState<string>('ALL');

  const fetchListings = async () => {
    try {
      setLoadingListings(true);
      const res = await apiClient.get('/seller/catalog/products');
      if (res.data.success) {
        setSellerProducts(Array.isArray(res.data.data) ? res.data.data : res.data.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch seller listings', err);
    } finally {
      setLoadingListings(false);
    }
  };

  const fetchProposals = async () => {
    try {
      setLoadingProposals(true);
      const res = await apiClient.get('/seller/catalog/proposals');
      if (res.data.success) {
        setProposals(Array.isArray(res.data.data) ? res.data.data : res.data.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch proposals', err);
    } finally {
      setLoadingProposals(false);
    }
  };

  useEffect(() => {
    fetchListings();
    fetchProposals();
  }, []);

  const filteredListings = sellerProducts.filter((item) => {
    const query = listingSearch.toLowerCase();
    const pName = (item.product?.productName || item.ProductVariant?.ProductMaster?.ProductName || '').toLowerCase();
    const bName = (item.product?.brandName || item.ProductVariant?.ProductMaster?.Brand?.BrandName || '').toLowerCase();
    const sSku = (item.sellerSku || item.SellerSKU || '').toLowerCase();
    const vSku = (item.product?.variantSku || item.ProductVariant?.VariantSKU || '').toLowerCase();
    return pName.includes(query) || bName.includes(query) || sSku.includes(query) || vSku.includes(query);
  });

  const filteredProposals = proposals.filter((p) => {
    const status = p.status || p.Status || 'ALL';
    if (proposalFilter === 'ALL') return true;
    return status === proposalFilter;
  });

  // Tab 1 Pagination (Commercial Listings)
  const { paginatedData: paginatedListings, paginationProps: listingsPaginationProps } = usePagination({
    data: filteredListings,
    initialPageSize: 10,
  });

  // Tab 2 Pagination (Proposals Queue)
  const { paginatedData: paginatedProposals, paginationProps: proposalsPaginationProps } = usePagination({
    data: filteredProposals,
    initialPageSize: 10,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'PENDING_QC':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <Clock className="w-3.5 h-3.5" /> Pending QC
          </span>
        );
      case 'REWORK_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/80">
            <AlertCircle className="w-3.5 h-3.5" /> Rework Required
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Section without colored background */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#7E2532] text-xs font-bold uppercase tracking-wider mb-2">
            
            <span>Catalog & Commercial Portfolio V1</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#221C1E]">
            Products & Commercial Offers
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium max-w-2xl">
            Sell pre-approved catalog products instantly with zero onboarding delay, or propose brand new variants to our central catalog quality team.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/products/add-existing')}
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white border border-[#E8E1D7] hover:border-[#641D26] hover:text-[#641D26] text-stone-800 font-bold text-xs shadow-sm active:scale-95 transition-all duration-200"
          >
            <Search className="w-4 h-4 text-[#641D26]" />
            <span>Add Existing Product</span>
          </button>
          <button
            onClick={() => navigate('/products/propose')}
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#641D26] hover:bg-[#52161E] text-white font-bold text-xs shadow-md shadow-rose-950/20 active:scale-95 transition-all duration-200"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Propose New Product</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">Active Listings</p>
          <p className="text-2xl font-black mt-1.5 text-stone-900">{sellerProducts.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">Proposals in QC</p>
          <p className="text-2xl font-black mt-1.5 text-amber-600">
            {proposals.filter(p => p.Status === 'PENDING_QC').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">Approved Master SKUs</p>
          <p className="text-2xl font-black mt-1.5 text-emerald-600">
            {proposals.filter(p => p.Status === 'APPROVED').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">Rework Required</p>
          <p className="text-2xl font-black mt-1.5 text-rose-600">
            {proposals.filter(p => p.Status === 'REWORK_REQUIRED').length}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeTab === 'listings'
                ? 'bg-[#641D26] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>My Commercial Listings</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'listings' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
            }`}>
              {sellerProducts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('proposals')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeTab === 'proposals'
                ? 'bg-[#641D26] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>My Proposals & QC Pipeline</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'proposals' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
            }`}>
              {proposals.length}
            </span>
          </button>
        </div>

        <button
          onClick={() => {
            fetchListings();
            fetchProposals();
          }}
          className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tab 1: Commercial Listings */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {/* Search Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                placeholder="Search by SKU, Product or Brand..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#641D26] focus:border-transparent transition-all"
              />
            </div>
            <div className="text-xs text-stone-500 font-medium">
              Showing <span className="text-stone-900 font-semibold">{filteredListings.length}</span> of {sellerProducts.length} listings
            </div>
          </div>

          {loadingListings ? (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center shadow-sm">
              <div className="inline-block animate-spin text-[#641D26] mb-3">
                <RefreshCw className="w-8 h-8" />
              </div>
              <p className="text-sm text-stone-500">Loading commercial catalog listings...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-stone-400">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-stone-900">No Commercial Listings Found</h3>
              <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-6">
                You haven't added any products to your commercial inventory yet. Search the approved catalog to start selling immediately.
              </p>
              <button
                onClick={() => navigate('/products/add-existing')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#641D26] text-white font-semibold text-sm shadow-md hover:bg-[#52161E] transition-all"
              >
                <Search className="w-4 h-4" />
                <span>Search Approved Catalog</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {paginatedListings.map((item) => {
                  const id = item.sellerProductId || item.SellerProductID || Math.random();
                  const productName = item.product?.productName || item.ProductVariant?.ProductMaster?.ProductName || 'Commercial Product';
                  const brandName = item.product?.brandName || item.ProductVariant?.ProductMaster?.Brand?.BrandName || 'N/A';
                  const brandCode = item.ProductVariant?.ProductMaster?.Brand?.BrandCode || brandName.slice(0, 3).toUpperCase();
                  const categoryName = item.product?.categoryName || item.ProductVariant?.ProductMaster?.ProductCategories?.[0]?.Category?.CategoryName || 'General';
                  const sellerSku = item.sellerSku || item.SellerSKU || 'N/A';
                  const variantSku = item.product?.variantSku || item.ProductVariant?.VariantSKU || 'N/A';
                  const gtin = item.product?.gtin || item.ProductVariant?.GTIN;
                  const primaryImage = item.product?.primaryImage;
                  const sellingPrice = Number(item.sellingPrice ?? item.SellingPrice ?? 0);
                  const purchasePrice = Number(item.purchasePrice ?? item.basePrice ?? item.BasePrice ?? 0);
                  const mrp = Number(item.mrp ?? 0);
                  const margin = sellingPrice > purchasePrice
                    ? (((sellingPrice - purchasePrice) / sellingPrice) * 100).toFixed(1)
                    : '0.0';

                  const attributes = item.product?.attributes || item.ProductVariant?.ProductVariantAttributes?.map((a) => ({
                    attributeName: a.CategoryAttribute?.AttributeName || 'Attribute',
                    attributeValue: a.AttributeValue?.ValueName || '',
                  })) || [];

                  return (
                    <div
                      key={id}
                      className="bg-white border border-stone-200/80 rounded-2xl p-5 hover:shadow-md hover:border-stone-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        {primaryImage ? (
                          <img
                            src={primaryImage}
                            alt={productName}
                            className="w-14 h-14 object-cover rounded-xl border border-stone-200 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-stone-100 rounded-xl flex items-center justify-center text-[#641D26] font-bold text-sm shrink-0 border border-stone-200">
                            {brandCode}
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                              {brandName}
                            </span>
                            <span className="text-stone-300">•</span>
                            <span className="text-xs font-medium text-stone-500">
                              {categoryName}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-stone-900 leading-snug">
                            {productName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-200">
                              SellerSKU: <strong className="text-stone-900">{sellerSku}</strong>
                            </span>
                            <span className="font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
                              VariantSKU: {variantSku}
                            </span>
                            {gtin && (
                              <span className="font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">
                                GTIN: {gtin}
                              </span>
                            )}
                          </div>

                          {/* Variant Attributes */}
                          {attributes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {attributes.map((attr, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-amber-50 text-amber-900 px-2 py-0.5 rounded font-medium border border-amber-200/60"
                                >
                                  {attr.attributeName}: {attr.attributeValue}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100">
                        <div className="text-right">
                          <div className="text-xs text-stone-400 font-medium">Selling Price</div>
                          <div className="text-xl font-bold text-stone-900">
                            ₹{sellingPrice.toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs text-stone-500">
                            {purchasePrice > 0 ? (
                              <>Base: ₹{purchasePrice} • <span className="text-emerald-600 font-bold">{margin}% margin</span></>
                            ) : mrp > 0 ? (
                              <>MRP: ₹{mrp}</>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reusable Pagination for Commercial Listings */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                <Pagination {...listingsPaginationProps} itemLabel="commercial listings" themeColor="burgundy" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Proposals & QC Pipeline */}
      {activeTab === 'proposals' && (
        <div className="space-y-4">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-sm">
            {['ALL', 'PENDING_QC', 'APPROVED', 'REWORK_REQUIRED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setProposalFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  proposalFilter === st
                    ? 'bg-[#641D26] text-white'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                {st === 'ALL' ? 'All Proposals' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {loadingProposals ? (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center shadow-sm">
              <div className="inline-block animate-spin text-[#641D26] mb-3">
                <RefreshCw className="w-8 h-8" />
              </div>
              <p className="text-sm text-stone-500">Loading catalog proposals...</p>
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-stone-400">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-stone-900">No Proposals Found</h3>
              <p className="text-sm text-stone-500 max-w-md mx-auto mt-1 mb-6">
                You haven't submitted any new product proposals yet. Need a product that doesn't exist in our catalog? Submit a proposal with your variants and spec sheet.
              </p>
              <button
                onClick={() => navigate('/products/propose')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#641D26] text-white font-semibold text-sm shadow-md hover:bg-[#52161E] transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Propose New Product</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {paginatedProposals.map((proposal) => {
                  const id = proposal.productId || proposal.ProductID || Math.random();
                  const productName = proposal.productName || proposal.ProductName || 'Unnamed Product';
                  const brandName = proposal.brandName || proposal.Brand?.BrandName || 'N/A';
                  const categoryName = proposal.categoryName || proposal.ProductCategories?.[0]?.Category?.CategoryName || 'General';
                  const parentSku = proposal.parentSku || proposal.ParentSKU || 'N/A';
                  const status = (proposal.status || proposal.Status || 'PENDING_QC') as string;
                  const createdAt = proposal.createdAt || proposal.CreatedAt || new Date().toISOString();
                  const rejectionReason = proposal.rejectionReason || proposal.RejectionReason;
                  const primaryImage =
                    proposal.primaryImage ||
                    proposal.ProductAssets?.find((a) => a.IsPrimary)?.AssetURL ||
                    proposal.ProductAssets?.[0]?.AssetURL;

                  const variants = proposal.variants?.map((v) => ({
                    id: v.variantId,
                    sku: v.variantSku,
                    attrStr: v.attributes?.map((a) => `${a.attributeName}: ${a.attributeValue}`).join(' / ') || '',
                  })) || proposal.ProductVariants?.map((v) => ({
                    id: String(v.VariantID),
                    sku: v.VariantSKU,
                    attrStr: v.ProductVariantAttributes?.map((a) => a.AttributeValue?.ValueName).filter(Boolean).join(' / ') || '',
                  })) || [];

                  const variantsCount = proposal.variantsCount ?? variants.length;

                  return (
                    <div
                      key={id}
                      className="bg-white border border-stone-200/80 rounded-2xl p-6 hover:shadow-md transition-all space-y-4"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          {primaryImage ? (
                            <img
                              src={primaryImage}
                              alt={productName}
                              className="w-16 h-16 object-cover rounded-xl border border-stone-200 shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 shrink-0 border border-stone-200">
                              <Package className="w-8 h-8" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                                {brandName}
                              </span>
                              <span className="text-stone-300">•</span>
                              <span className="text-xs font-medium text-stone-500">
                                {categoryName}
                              </span>
                            </div>
                            <h4 className="text-lg font-bold text-stone-900 mt-0.5">
                              {productName}
                            </h4>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-500">
                              <span>
                                Parent SKU: <strong className="font-mono text-stone-800">{parentSku}</strong>
                              </span>
                              <span>•</span>
                              <span>Submitted: {new Date(createdAt).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>{variantsCount} Variants</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-2">
                          {getStatusBadge(status)}
                          {status === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => navigate('/products/add-existing')}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#641D26] to-[#7E2532] text-white text-xs font-bold hover:from-[#52161E] hover:to-[#641D26] shadow-sm flex items-center gap-1.5 transition-all"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Add Commercial Listing</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rejection / Rework Feedback Banner */}
                      {rejectionReason && (
                        <div className={`p-4 rounded-xl text-sm border flex items-start gap-3 ${
                          status === 'REWORK_REQUIRED'
                            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                            : 'bg-rose-50/80 border-rose-200 text-rose-900'
                        }`}>
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-current" />
                          <div>
                            <p className="font-bold">
                              {status === 'REWORK_REQUIRED' ? 'Catalog QC Feedback:' : 'Rejection Reason:'}
                            </p>
                            <p className="text-xs mt-0.5 leading-relaxed opacity-90">{rejectionReason}</p>
                          </div>
                        </div>
                      )}

                      {/* Variant previews pill grid */}
                      {variants.length > 0 && (
                        <div className="pt-2 border-t border-stone-100">
                          <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                            Defined Variants ({variants.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {variants.map((v) => (
                              <div
                                key={v.id}
                                className="px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-xs font-mono text-stone-700 flex items-center gap-2"
                              >
                                <Barcode className="w-3.5 h-3.5 text-stone-400" />
                                <span className="font-bold text-stone-900">{v.sku}</span>
                                {v.attrStr && <span className="text-stone-500 font-sans">({v.attrStr})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reusable Pagination for Proposals */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                <Pagination {...proposalsPaginationProps} itemLabel="proposals" themeColor="burgundy" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
